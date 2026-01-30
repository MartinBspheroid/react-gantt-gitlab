/**
 * Description Metadata Utilities
 *
 * Utility functions for storing and retrieving metadata (particularly link relationships)
 * within GitLab issue descriptions using HTML comments.
 *
 * Format:
 * <!-- GANTT_METADATA_START
 * { "version": 1, "gantt": { "links": { ... } } }
 * GANTT_METADATA_END -->
 *
 * The HTML comment format ensures metadata is invisible in GitLab's UI rendering.
 *
 * NOTE: This is a fallback mechanism for GitLab Free tier users who cannot use
 * the native blocked work items feature (requires Premium/Ultimate subscription).
 */

// ============================================================================
// Constants
// ============================================================================

const METADATA_START_MARKER = '<!-- GANTT_METADATA_START';
const METADATA_END_MARKER = 'GANTT_METADATA_END -->';
const CURRENT_METADATA_VERSION = 1;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Link relationship stored in description metadata
 */
export interface DescriptionLinkMetadata {
  /** Issue IIDs that this issue blocks (current issue must complete first) */
  blocks?: number[];
  /** Issue IIDs that block this issue (must complete before this issue) */
  blocked_by?: number[];
}

/**
 * Complete metadata structure in description
 * Version field allows future schema evolution
 */
export interface DescriptionMetadata {
  version: number;
  gantt?: {
    links?: DescriptionLinkMetadata;
  };
}

/**
 * Result of extracting links from description
 */
export interface ExtractLinksResult {
  /** Extracted link metadata (empty object if none found) */
  links: DescriptionLinkMetadata;
  /** Whether metadata block was found in description */
  hasMetadata: boolean;
  /** The raw metadata object if found, for debugging */
  rawMetadata?: DescriptionMetadata;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Extract link metadata from a GitLab issue description
 *
 * Handles edge cases:
 * - null/undefined/empty description
 * - Description with no metadata
 * - Malformed JSON in metadata block
 * - Multiple metadata blocks (uses first valid one)
 * - Whitespace variations
 *
 * @param description - The issue description (can be null/undefined)
 * @returns Extracted links and metadata status
 */
export function extractLinksFromDescription(
  description: string | null | undefined,
): ExtractLinksResult {
  // Handle empty/null description
  if (!description || typeof description !== 'string') {
    return { links: {}, hasMetadata: false };
  }

  const trimmed = description.trim();
  if (!trimmed) {
    return { links: {}, hasMetadata: false };
  }

  // Find metadata block
  const startIndex = trimmed.indexOf(METADATA_START_MARKER);
  if (startIndex === -1) {
    return { links: {}, hasMetadata: false };
  }

  const endIndex = trimmed.indexOf(METADATA_END_MARKER, startIndex);
  if (endIndex === -1) {
    // Malformed: has start but no end marker
    console.warn('[DescriptionMetadata] Found start marker but no end marker');
    return { links: {}, hasMetadata: false };
  }

  // Extract JSON content between markers
  const jsonStart = startIndex + METADATA_START_MARKER.length;
  const jsonContent = trimmed.substring(jsonStart, endIndex).trim();

  if (!jsonContent) {
    console.warn('[DescriptionMetadata] Empty metadata block');
    return { links: {}, hasMetadata: true, rawMetadata: undefined };
  }

  // Parse JSON
  let metadata: DescriptionMetadata;
  try {
    metadata = JSON.parse(jsonContent);
  } catch (error) {
    console.warn('[DescriptionMetadata] Failed to parse metadata JSON:', error);
    return { links: {}, hasMetadata: true };
  }

  // Validate structure
  if (typeof metadata !== 'object' || metadata === null) {
    console.warn('[DescriptionMetadata] Metadata is not an object');
    return { links: {}, hasMetadata: true };
  }

  // Version check for future compatibility
  if (metadata.version !== CURRENT_METADATA_VERSION) {
    console.warn(
      `[DescriptionMetadata] Unknown metadata version: ${metadata.version}, expected: ${CURRENT_METADATA_VERSION}`,
    );
    // Still try to extract links for forward compatibility
  }

  // Extract links
  const links: DescriptionLinkMetadata = {};

  if (metadata.gantt?.links) {
    const rawLinks = metadata.gantt.links;

    // Validate and sanitize blocks array
    if (Array.isArray(rawLinks.blocks)) {
      const validBlocks = rawLinks.blocks
        .filter(
          (id): id is number =>
            typeof id === 'number' && Number.isInteger(id) && id > 0,
        )
        .sort((a, b) => a - b);
      if (validBlocks.length > 0) {
        links.blocks = validBlocks;
      }
    }

    // Validate and sanitize blocked_by array
    if (Array.isArray(rawLinks.blocked_by)) {
      const validBlockedBy = rawLinks.blocked_by
        .filter(
          (id): id is number =>
            typeof id === 'number' && Number.isInteger(id) && id > 0,
        )
        .sort((a, b) => a - b);
      if (validBlockedBy.length > 0) {
        links.blocked_by = validBlockedBy;
      }
    }
  }

  return {
    links,
    hasMetadata: true,
    rawMetadata: metadata,
  };
}

/**
 * Update a GitLab issue description with link metadata
 *
 * Behavior:
 * - Preserves original description content
 * - Replaces existing metadata block if present
 * - Adds new metadata block at the end if none exists
 * - Removes metadata block entirely if links are empty
 * - Handles null/undefined/empty description gracefully
 *
 * @param description - The original issue description (can be null/undefined)
 * @param links - Link metadata to store (empty removes metadata block)
 * @returns Updated description string
 */
export function updateDescriptionWithLinks(
  description: string | null | undefined,
  links: DescriptionLinkMetadata,
): string {
  // Check if we have any links to store
  const hasLinks =
    (links.blocks && links.blocks.length > 0) ||
    (links.blocked_by && links.blocked_by.length > 0);

  // Get clean description without existing metadata
  const cleanDescription = removeMetadataFromDescription(description);

  // If no links, return clean description only
  if (!hasLinks) {
    return cleanDescription;
  }

  // Build metadata object
  const metadata: DescriptionMetadata = {
    version: CURRENT_METADATA_VERSION,
    gantt: {
      links: {},
    },
  };

  // Only include non-empty arrays
  if (links.blocks && links.blocks.length > 0) {
    metadata.gantt!.links!.blocks = [...links.blocks].sort((a, b) => a - b);
  }
  if (links.blocked_by && links.blocked_by.length > 0) {
    metadata.gantt!.links!.blocked_by = [...links.blocked_by].sort(
      (a, b) => a - b,
    );
  }

  // Format metadata block
  const metadataBlock = formatMetadataBlock(metadata);

  // Combine description and metadata
  if (!cleanDescription) {
    return metadataBlock;
  }

  // Add separation if description doesn't end with newlines
  const separator = cleanDescription.endsWith('\n\n')
    ? ''
    : cleanDescription.endsWith('\n')
      ? '\n'
      : '\n\n';

  return cleanDescription + separator + metadataBlock;
}

/**
 * Remove link metadata from description while preserving user content
 *
 * This is useful when:
 * - User wants to clear all link metadata
 * - Migrating to native GitLab links
 * - Cleaning up orphaned metadata
 *
 * @param description - The issue description (can be null/undefined)
 * @returns Description with metadata block removed
 */
export function removeLinksFromDescription(
  description: string | null | undefined,
): string {
  return removeMetadataFromDescription(description);
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Format metadata as HTML comment block
 */
function formatMetadataBlock(metadata: DescriptionMetadata): string {
  const jsonStr = JSON.stringify(metadata, null, 2);
  return `${METADATA_START_MARKER}\n${jsonStr}\n${METADATA_END_MARKER}`;
}

/**
 * Remove metadata block from description, preserving all other content
 */
function removeMetadataFromDescription(
  description: string | null | undefined,
): string {
  if (!description || typeof description !== 'string') {
    return '';
  }

  const startIndex = description.indexOf(METADATA_START_MARKER);
  if (startIndex === -1) {
    return description.trim();
  }

  const endIndex = description.indexOf(METADATA_END_MARKER, startIndex);
  if (endIndex === -1) {
    // Malformed: return as-is but trimmed
    return description.trim();
  }

  // Calculate the end position including the marker
  const fullEndIndex = endIndex + METADATA_END_MARKER.length;

  // Extract parts before and after metadata block
  const before = description.substring(0, startIndex);
  const after = description.substring(fullEndIndex);

  // Combine and clean up extra whitespace
  const result = (before + after).trim();

  // Remove excessive newlines that might be left behind
  return result.replace(/\n{3,}/g, '\n\n');
}

// ============================================================================
// Link Manipulation Helpers
// ============================================================================

/**
 * Add a "blocks" relationship to existing links
 *
 * @param currentLinks - Current link metadata
 * @param targetIid - IID of the issue being blocked
 * @returns Updated link metadata
 */
export function addBlocksRelation(
  currentLinks: DescriptionLinkMetadata,
  targetIid: number,
): DescriptionLinkMetadata {
  const blocks = new Set(currentLinks.blocks || []);
  blocks.add(targetIid);

  return {
    ...currentLinks,
    blocks: Array.from(blocks).sort((a, b) => a - b),
  };
}

/**
 * Add a "blocked_by" relationship to existing links
 *
 * @param currentLinks - Current link metadata
 * @param blockerIid - IID of the blocking issue
 * @returns Updated link metadata
 */
export function addBlockedByRelation(
  currentLinks: DescriptionLinkMetadata,
  blockerIid: number,
): DescriptionLinkMetadata {
  const blockedBy = new Set(currentLinks.blocked_by || []);
  blockedBy.add(blockerIid);

  return {
    ...currentLinks,
    blocked_by: Array.from(blockedBy).sort((a, b) => a - b),
  };
}

/**
 * Remove a "blocks" relationship from existing links
 *
 * @param currentLinks - Current link metadata
 * @param targetIid - IID of the issue to unblock
 * @returns Updated link metadata
 */
export function removeBlocksRelation(
  currentLinks: DescriptionLinkMetadata,
  targetIid: number,
): DescriptionLinkMetadata {
  const blocks = (currentLinks.blocks || []).filter((id) => id !== targetIid);

  return {
    ...currentLinks,
    blocks: blocks.length > 0 ? blocks : undefined,
  };
}

/**
 * Remove a "blocked_by" relationship from existing links
 *
 * @param currentLinks - Current link metadata
 * @param blockerIid - IID of the blocker to remove
 * @returns Updated link metadata
 */
export function removeBlockedByRelation(
  currentLinks: DescriptionLinkMetadata,
  blockerIid: number,
): DescriptionLinkMetadata {
  const blockedBy = (currentLinks.blocked_by || []).filter(
    (id) => id !== blockerIid,
  );

  return {
    ...currentLinks,
    blocked_by: blockedBy.length > 0 ? blockedBy : undefined,
  };
}

/**
 * Check if metadata has any link relationships
 *
 * @param links - Link metadata to check
 * @returns true if there are any links
 */
export function hasAnyLinks(links: DescriptionLinkMetadata): boolean {
  return (
    (links.blocks !== undefined && links.blocks.length > 0) ||
    (links.blocked_by !== undefined && links.blocked_by.length > 0)
  );
}

/**
 * Merge two link metadata objects
 * Useful when combining links from multiple sources
 *
 * @param a - First link metadata
 * @param b - Second link metadata
 * @returns Merged link metadata (union of both)
 */
export function mergeLinks(
  a: DescriptionLinkMetadata,
  b: DescriptionLinkMetadata,
): DescriptionLinkMetadata {
  const blocks = new Set([...(a.blocks || []), ...(b.blocks || [])]);
  const blockedBy = new Set([...(a.blocked_by || []), ...(b.blocked_by || [])]);

  return {
    blocks:
      blocks.size > 0 ? Array.from(blocks).sort((a, b) => a - b) : undefined,
    blocked_by:
      blockedBy.size > 0
        ? Array.from(blockedBy).sort((a, b) => a - b)
        : undefined,
  };
}
