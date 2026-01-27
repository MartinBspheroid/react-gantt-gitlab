/**
 * Milestone ID Utilities
 *
 * Milestone task IDs use a string format "m-{iid}" to avoid ID collisions
 * with work items (Issues/Tasks) that use numeric IIDs.
 *
 * Previously, milestones used a numeric offset (10000 + iid) which would
 * cause collisions when a project has more than 10000 issues.
 */

const MILESTONE_ID_PREFIX = 'm-';

/**
 * Create a milestone task ID from a milestone IID
 * @param iid - The milestone's IID from GitLab
 * @returns String ID in format "m-{iid}"
 */
export function createMilestoneTaskId(iid: number | string): string {
  return `${MILESTONE_ID_PREFIX}${iid}`;
}

/**
 * Check if a task ID is a milestone ID
 * @param id - The task ID to check
 * @returns true if the ID is a milestone task ID
 */
export function isMilestoneTaskId(id: number | string): boolean {
  return typeof id === 'string' && id.startsWith(MILESTONE_ID_PREFIX);
}

/**
 * Extract the milestone IID from a milestone task ID
 * @param id - The task ID (should be in format "m-{iid}")
 * @returns The milestone IID, or null if not a valid milestone ID
 */
export function extractMilestoneIid(id: number | string): number | null {
  if (typeof id !== 'string' || !id.startsWith(MILESTONE_ID_PREFIX)) {
    return null;
  }
  const iid = parseInt(id.slice(MILESTONE_ID_PREFIX.length), 10);
  return isNaN(iid) ? null : iid;
}

/**
 * Migrate legacy milestone ID (10000 + iid) to new string format
 * Used for backward compatibility with existing localStorage data
 * @param id - The task ID (could be legacy numeric or new string format)
 * @returns The new string format ID, or original ID if not a legacy milestone
 */
export function migrateLegacyMilestoneId(id: number | string): number | string {
  // Handle numeric IDs >= 10000 (legacy milestone format)
  if (typeof id === 'number' && id >= 10000) {
    return createMilestoneTaskId(id - 10000);
  }
  // Handle string numeric IDs >= 10000
  if (typeof id === 'string') {
    const numId = parseInt(id, 10);
    if (!isNaN(numId) && numId >= 10000 && String(numId) === id) {
      return createMilestoneTaskId(numId - 10000);
    }
  }
  return id;
}

/**
 * Check if an ID is a legacy milestone ID (10000+)
 * @param id - The task ID to check
 * @returns true if this is a legacy milestone ID
 */
export function isLegacyMilestoneId(id: number | string): boolean {
  if (typeof id === 'number') {
    return id >= 10000;
  }
  if (typeof id === 'string') {
    const numId = parseInt(id, 10);
    return !isNaN(numId) && numId >= 10000 && String(numId) === id;
  }
  return false;
}
