/**
 * GitLab Link Utilities
 * Helper functions for GitLab URL handling and link display
 */

import type { ITask } from '@svar-ui/gantt-store';

export interface GitLabLinkInfo {
  url: string | null;
  displayId: string | null;
  title: string;
  isMilestone: boolean;
}

/**
 * Get GitLab web URL from a task
 * @param task - Gantt task with GitLab metadata (can be null)
 * @returns The web URL or null
 */
export function getGitLabUrl(task: ITask | null | undefined): string | null {
  if (!task) return null;
  return task._gitlab?.web_url || task.web_url || null;
}

/**
 * Check if a task is a milestone
 * @param task - Gantt task (can be null)
 * @returns true if task is a milestone
 */
export function isMilestoneTask(task: ITask | null | undefined): boolean {
  if (!task) return false;
  return task.$isMilestone || task._gitlab?.type === 'milestone';
}

/**
 * Extract GitLab link information from a task
 * @param task - Gantt task with GitLab metadata (can be null)
 * @returns Link info including URL, display ID, and type
 */
export function getGitLabLinkInfo(
  task: ITask | null | undefined,
): GitLabLinkInfo {
  if (!task) {
    return { url: null, displayId: null, title: '', isMilestone: false };
  }

  const isMilestone = isMilestoneTask(task);
  const url = getGitLabUrl(task);

  if (isMilestone) {
    const milestoneId = task._gitlab?.id;
    return {
      url,
      displayId: milestoneId ? `M#${milestoneId}` : null,
      title: 'Open milestone in GitLab',
      isMilestone: true,
    };
  }

  return {
    url,
    displayId: task.issueId ? `#${task.issueId}` : null,
    title: 'Open in GitLab',
    isMilestone: false,
  };
}

/**
 * Open GitLab URL in new tab
 * @param task - Gantt task with GitLab metadata (can be null)
 * @returns true if URL was opened, false otherwise
 */
export function openGitLabLink(task: ITask | null | undefined): boolean {
  const url = getGitLabUrl(task);
  if (url) {
    window.open(url, '_blank');
    return true;
  }
  return false;
}

// ============================================================================
// Link (Dependency) Utilities
// ============================================================================

export interface ILink {
  id: number | string;
  source: number | string;
  target: number | string;
  type?: string;
  _gitlab?: {
    apiSourceIid: number;
    linkedWorkItemGlobalId: string;
  };
}

export interface LinkValidationResult {
  valid: boolean;
  apiSourceIid?: number;
  linkedWorkItemGlobalId?: string;
  error?: string;
}

/**
 * Find a link by source and target IDs from a links array.
 * Handles bidirectional matching (source/target can be swapped).
 * Prefers links with GitLab metadata (_gitlab) over local-only links.
 *
 * @param links - Array of link objects
 * @param sourceId - Source task ID
 * @param targetId - Target task ID
 * @returns The matching link object, or null if not found
 */
export function findLinkBySourceTarget(
  links: ILink[] | null | undefined,
  sourceId: number | string | null | undefined,
  targetId: number | string | null | undefined,
): ILink | null {
  if (!links || !sourceId || !targetId) return null;

  const matchingLinks = links.filter(
    (l) =>
      (l.source === sourceId && l.target === targetId) ||
      (l.source === targetId && l.target === sourceId),
  );

  // Prefer link with _gitlab metadata (synced from API), fall back to any match
  return matchingLinks.find((l) => l._gitlab) || matchingLinks[0] || null;
}

/**
 * Validate that a link has the required GitLab metadata for API operations.
 *
 * @param link - Link object to validate
 * @returns Validation result with metadata if valid, error message if not
 */
export function validateLinkGitLabMetadata(
  link: ILink | null | undefined,
): LinkValidationResult {
  if (!link) {
    return { valid: false, error: 'Link is null or undefined' };
  }

  if (!link._gitlab) {
    return {
      valid: false,
      error:
        'Link missing _gitlab metadata - may be newly created and not yet synced',
    };
  }

  const { apiSourceIid, linkedWorkItemGlobalId } = link._gitlab;

  if (!apiSourceIid || !linkedWorkItemGlobalId) {
    return {
      valid: false,
      error:
        'Cannot delete link: missing GitLab metadata fields. ' +
        'Please refresh the page to reload links with proper metadata.',
    };
  }

  return { valid: true, apiSourceIid, linkedWorkItemGlobalId };
}
