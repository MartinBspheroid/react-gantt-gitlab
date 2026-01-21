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
