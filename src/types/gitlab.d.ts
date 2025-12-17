/**
 * GitLab API Type Definitions
 * Based on GitLab API v4
 */

export type GitLabIssueState = 'opened' | 'closed';
export type GitLabIssueLinkType = 'relates_to' | 'blocks' | 'is_blocked_by';

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  web_url: string;
}

export interface GitLabMilestone {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: 'active' | 'closed';
  created_at: string;
  updated_at: string;
  due_date: string | null;
  start_date: string | null;
  web_url: string;
}

export interface GitLabEpic {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: 'opened' | 'closed';
  web_url: string;
  created_at: string;
  updated_at: string;
  start_date: string | null;
  end_date: string | null;
}

export interface GitLabTaskCompletionStatus {
  count: number;
  completed_count: number;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: GitLabIssueState;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  due_date: string | null;
  start_date: string | null;
  web_url: string;

  // Assignees
  assignees: GitLabUser[];
  assignee: GitLabUser | null;

  // Organization
  labels: string[];
  milestone: GitLabMilestone | null;
  epic?: GitLabEpic | null;

  // Metadata
  weight: number | null;
  task_completion_status: GitLabTaskCompletionStatus;

  // Relations
  has_tasks: boolean;
  _links?: {
    project: string;
    self: string;
  };
}

export interface GitLabIssueLink {
  id: number;
  iid: number;
  issue_link_id: number;
  project_id: number;
  created_at: string;
  link_type: GitLabIssueLinkType;
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  description: string;
  web_url: string;
  avatar_url: string | null;
  created_at: string;
}

export interface GitLabGroup {
  id: number;
  name: string;
  path: string;
  description: string;
  full_name: string;
  full_path: string;
  web_url: string;
  avatar_url: string | null;
}

export interface GitLabConfig {
  id: string;
  name: string;
  gitlabUrl: string;
  token: string;
  projectId?: string | number;
  groupId?: string | number;
  type: 'project' | 'group';
  isDefault?: boolean;
}

/**
 * Server-side filter options for GitLab GraphQL API
 * These filters are applied at the API level to reduce data transfer
 */
export interface GitLabServerFilters {
  labelNames?: string[]; // GitLab API: labelName
  milestoneTitles?: string[]; // GitLab API: milestoneTitle
  assigneeUsernames?: string[]; // GitLab API: assigneeUsernames
  createdAfter?: string; // GitLab GraphQL Time type (ISO 8601 format)
  createdBefore?: string; // GitLab GraphQL Time type (ISO 8601 format)
}

/**
 * Filter options available for server-side filtering
 * These are fetched before sync to allow users to set filters immediately
 */
export interface GitLabFilterOptionsData {
  members: Array<{ username: string; name: string }>;
  labels: Array<{ title: string; color?: string }>;
  milestones: Array<{ iid: number; title: string }>;
}

export interface GitLabSyncOptions {
  includeClosed?: boolean;
  milestoneId?: number;
  epicId?: number;
  labels?: string[];
  // Server-side filters (applied at API level)
  serverFilters?: GitLabServerFilters;
}

export interface GitLabDataResponse {
  tasks: import('@svar-ui/gantt-store').ITask[];
  links: import('@svar-ui/gantt-store').ILink[];
  milestones?: GitLabMilestone[];
  epics?: GitLabEpic[];
}
