/**
 * GitLab Data Provider
 * Integrates GitLab API v4 and GraphQL with react-gantt DataStore
 */

import type { ITask, ILink, TID } from '@svar-ui/gantt-store';
import type {
  GitLabIssue,
  GitLabIssueLink,
  GitLabMilestone,
  GitLabEpic,
  GitLabSyncOptions,
  GitLabDataResponse,
  GitLabConfig,
} from '../types/gitlab';
import { GitLabGraphQLClient } from './GitLabGraphQLClient';

export interface GitLabDataProviderConfig {
  gitlabUrl: string;
  token: string;
  projectId?: string | number;
  groupId?: string | number;
  type: 'project' | 'group';
}

export class GitLabDataProvider {
  private config: GitLabDataProviderConfig;
  private milestones: Map<number, GitLabMilestone> = new Map();
  private epics: Map<number, GitLabEpic> = new Map();
  private issueMap: Map<TID, GitLabIssue> = new Map();
  private graphqlClient: GitLabGraphQLClient;

  constructor(config: GitLabDataProviderConfig) {
    this.config = config;
    this.graphqlClient = new GitLabGraphQLClient({
      gitlabUrl: config.gitlabUrl,
      token: config.token,
    });
  }

  /**
   * Get API base URL
   */
  private get apiBase(): string {
    return `${this.config.gitlabUrl}/api/v4`;
  }

  /**
   * Format date for GitLab API using local timezone
   * Returns YYYY-MM-DD format without UTC conversion
   */
  private formatDateForGitLab(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Check if running in development mode
   */
  private get isDev(): boolean {
    return import.meta.env.DEV;
  }

  /**
   * Convert GitLab URL to proxy URL in dev mode or with CORS proxy
   */
  private getProxyUrl(url: string): string {
    // In development, use Vite proxy
    if (this.isDev) {
      const gitlabUrl = this.config.gitlabUrl;
      return url.replace(gitlabUrl, '/api/gitlab-proxy');
    }

    // In production, check if CORS proxy is configured
    const corsProxy = import.meta.env.VITE_CORS_PROXY;
    if (corsProxy) {
      // Add CORS proxy prefix to the URL
      return `${corsProxy}/${url}`;
    }

    // No proxy, return original URL
    return url;
  }

  /**
   * Get headers for requests
   */
  private getHeaders(): HeadersInit {
    if (this.isDev) {
      // In dev mode, send token via custom header for proxy
      return {
        'X-GitLab-Token': this.config.token,
        'Content-Type': 'application/json',
      };
    }

    return {
      'PRIVATE-TOKEN': this.config.token,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make authenticated request to GitLab API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    let url = endpoint.startsWith('http')
      ? endpoint
      : `${this.apiBase}${endpoint}`;

    // Apply proxy in dev mode
    url = this.getProxyUrl(url);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitLab API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Fetch all pages of paginated GitLab API response
   */
  private async fetchAllPages<T>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const queryParams = new URLSearchParams({
        ...params,
        page: String(page),
        per_page: String(perPage),
      });

      let url = `${endpoint}?${queryParams}`;

      // Apply proxy in dev mode
      url = this.getProxyUrl(url);

      console.log(`[GitLab] fetchAllPages: Fetching page ${page} from:`, url);

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      console.log(`[GitLab] fetchAllPages: Response status:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GitLab] fetchAllPages: Error response:`, errorText);
        throw new Error(`GitLab API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[GitLab] fetchAllPages: Received ${data.length} items`);
      results.push(...data);

      // Check if there are more pages
      const totalPages = response.headers.get('x-total-pages');
      console.log(
        `[GitLab] fetchAllPages: Total pages:`,
        totalPages,
        `Current page:`,
        page,
      );
      if (!totalPages || page >= parseInt(totalPages, 10)) {
        break;
      }

      page++;
    }

    console.log(
      `[GitLab] fetchAllPages: Complete, total items:`,
      results.length,
    );
    return results;
  }

  /**
   * Get project ID for API calls
   */
  private getProjectId(): string | number {
    if (this.config.type === 'project' && this.config.projectId) {
      return this.config.projectId;
    }
    throw new Error('Project ID not configured');
  }

  /**
   * Get URL-encoded project ID for API calls
   */
  private getEncodedProjectId(): string {
    const projectId = this.getProjectId();
    return encodeURIComponent(String(projectId));
  }

  /**
   * Fetch issues from GitLab
   */
  private async fetchIssues(
    options: GitLabSyncOptions = {},
  ): Promise<GitLabIssue[]> {
    const params: Record<string, string> = {
      scope: 'all',
      with_labels_details: 'true',
    };

    if (!options.includeClosed) {
      params.state = 'opened';
    }

    if (options.milestoneId) {
      params.milestone = String(options.milestoneId);
    }

    if (options.epicId) {
      params.epic_id = String(options.epicId);
    }

    if (options.labels && options.labels.length > 0) {
      params.labels = options.labels.join(',');
    }

    let endpoint: string;
    if (this.config.type === 'group' && this.config.groupId) {
      endpoint = `${this.apiBase}/groups/${this.config.groupId}/issues`;
    } else {
      endpoint = `${this.apiBase}/projects/${this.getEncodedProjectId()}/issues`;
    }

    return this.fetchAllPages<GitLabIssue>(endpoint, params);
  }

  /**
   * Fetch issue links (dependencies)
   */
  private async fetchIssueLinks(issueIid: number): Promise<GitLabIssueLink[]> {
    const endpoint = `/projects/${this.getEncodedProjectId()}/issues/${issueIid}/links`;
    try {
      return await this.request<GitLabIssueLink[]>(endpoint);
    } catch (error) {
      // Links may not be available in all GitLab versions
      console.warn(`Failed to fetch links for issue ${issueIid}:`, error);
      return [];
    }
  }

  /**
   * Fetch milestones
   */
  private async fetchMilestones(): Promise<GitLabMilestone[]> {
    console.log('[GitLab] fetchMilestones: Starting...');
    let endpoint: string;
    if (this.config.type === 'group' && this.config.groupId) {
      endpoint = `${this.apiBase}/groups/${this.config.groupId}/milestones`;
    } else {
      endpoint = `${this.apiBase}/projects/${this.getEncodedProjectId()}/milestones`;
    }
    console.log('[GitLab] fetchMilestones: Endpoint:', endpoint);

    const milestones = await this.fetchAllPages<GitLabMilestone>(endpoint, {
      state: 'active',
    });
    console.log('[GitLab] fetchMilestones: Done, count:', milestones.length);

    milestones.forEach((milestone) => {
      this.milestones.set(milestone.id, milestone);
    });

    return milestones;
  }

  /**
   * Fetch epics (GitLab Premium feature)
   */
  private async fetchEpics(): Promise<GitLabEpic[]> {
    if (this.config.type !== 'group' || !this.config.groupId) {
      return [];
    }

    try {
      const endpoint = `${this.apiBase}/groups/${this.config.groupId}/epics`;
      const epics = await this.fetchAllPages<GitLabEpic>(endpoint, {
        state: 'opened',
      });

      epics.forEach((epic) => {
        this.epics.set(epic.id, epic);
      });

      return epics;
    } catch (error) {
      // Epics require GitLab Premium
      console.warn('Failed to fetch epics (Premium feature):', error);
      return [];
    }
  }

  /**
   * Calculate progress from task completion status
   */
  private calculateProgress(issue: GitLabIssue): number {
    if (issue.state === 'closed') {
      return 100;
    }

    if (issue.task_completion_status) {
      const { count, completed_count } = issue.task_completion_status;
      if (count > 0) {
        return Math.round((completed_count / count) * 100);
      }
    }

    return 0;
  }

  /**
   * Convert GitLab issue to Gantt task
   */
  private convertIssueToTask(issue: GitLabIssue): ITask {
    console.log('[GitLabDataProvider] Converting issue to task:', {
      iid: issue.iid,
      title: issue.title,
      start_date: issue.start_date,
      due_date: issue.due_date,
      created_at: issue.created_at,
    });

    const startDate = issue.start_date
      ? new Date(issue.start_date)
      : new Date(issue.created_at);

    const endDate = issue.due_date ? new Date(issue.due_date) : undefined;

    // Calculate duration in days
    let duration: number | undefined;
    if (endDate) {
      const diffTime = endDate.getTime() - startDate.getTime();
      duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const task: ITask = {
      id: issue.iid,
      text: issue.title,
      start: startDate,
      end: endDate,
      duration,
      progress: this.calculateProgress(issue),
      type: 'task',
      details: issue.description || '',

      // Milestone as parent for grouping
      parent: issue.milestone?.id || 0,

      // Custom fields
      assigned: issue.assignees.map((a) => a.name).join(', '),
      labels: issue.labels.join(', '),
      weight: issue.weight || undefined,
      state: issue.state,
      web_url: issue.web_url,

      // Store original GitLab data
      _gitlab: {
        id: issue.id,
        iid: issue.iid,
        project_id: issue.project_id,
        state: issue.state,
        updated_at: issue.updated_at,
        milestone: issue.milestone,
        epic: issue.epic,
      },
    };

    // Store in map for later reference
    this.issueMap.set(issue.iid, issue);

    return task;
  }

  /**
   * Convert GitLab issue link to Gantt link
   */
  private convertIssueLink(link: GitLabIssueLink, sourceIid: number): ILink {
    // Map GitLab link types to Gantt link types
    let ganttLinkType: ILink['type'];
    switch (link.link_type) {
      case 'blocks':
        ganttLinkType = 'e2s'; // End-to-Start: source must finish before target starts
        break;
      case 'is_blocked_by':
        ganttLinkType = 's2e'; // Start-to-End: reverse of blocks
        break;
      case 'relates_to':
      default:
        ganttLinkType = 'e2s'; // Default to End-to-Start
        break;
    }

    return {
      id: link.issue_link_id,
      source: sourceIid,
      target: link.iid,
      type: ganttLinkType,
    };
  }

  /**
   * Get all data from GitLab
   */
  async getData(options: GitLabSyncOptions = {}): Promise<GitLabDataResponse> {
    try {
      console.log('[GitLab] Starting data fetch...');

      // Fetch milestones and epics for grouping
      console.log('[GitLab] Fetching milestones and epics...');
      const [milestones, epics] = await Promise.all([
        this.fetchMilestones(),
        this.fetchEpics(),
      ]);
      console.log(
        `[GitLab] Fetched ${milestones.length} milestones, ${epics.length} epics`,
      );

      // Fetch issues
      console.log('[GitLab] Fetching issues...');
      const issues = await this.fetchIssues(options);
      console.log(`[GitLab] Fetched ${issues.length} issues`);

      // Fetch start dates from GraphQL
      console.log('[GitLab] Fetching start dates via GraphQL...');
      const startDates = await this.fetchIssueDateGraphQL(
        issues.map((i) => i.iid),
      );
      console.log('[GitLab] Fetched start dates:', startDates);

      // Merge start dates into issues
      issues.forEach((issue) => {
        const startDate = startDates.get(issue.iid);
        if (startDate) {
          issue.start_date = startDate;
        }
      });

      // Convert issues to tasks
      const tasks: ITask[] = [];

      // Add milestone summary tasks
      milestones.forEach((milestone) => {
        const milestoneStart = milestone.start_date
          ? new Date(milestone.start_date)
          : new Date(milestone.created_at);

        const milestoneEnd = milestone.due_date
          ? new Date(milestone.due_date)
          : undefined;

        tasks.push({
          id: milestone.id,
          text: `[Milestone] ${milestone.title}`,
          start: milestoneStart,
          end: milestoneEnd,
          type: 'summary',
          parent: 0,
          open: true,
          details: milestone.description,
          _gitlab: {
            type: 'milestone',
            id: milestone.id,
          },
        });
      });

      // Add issue tasks
      console.log('[GitLab] Converting issues to tasks...');
      issues.forEach((issue) => {
        const task = this.convertIssueToTask(issue);
        console.log(
          '[GitLab] Converted issue:',
          issue.iid,
          issue.title,
          '-> task:',
          task,
        );
        tasks.push(task);
      });

      console.log('[GitLab] Total tasks after conversion:', tasks.length);

      // Fetch and convert links
      console.log('[GitLab] Fetching issue links...');
      const links: ILink[] = [];
      await Promise.all(
        issues.map(async (issue) => {
          try {
            const issueLinks = await this.fetchIssueLinks(issue.iid);
            issueLinks.forEach((link) => {
              links.push(this.convertIssueLink(link, issue.iid));
            });
          } catch (error) {
            console.warn(`Failed to fetch links for issue ${issue.iid}`, error);
          }
        }),
      );

      console.log('[GitLab] getData complete, returning:', {
        tasks: tasks.length,
        links: links.length,
        milestones: milestones.length,
        epics: epics.length,
      });

      return {
        tasks,
        links,
        milestones,
        epics,
      };
    } catch (error) {
      console.error('Failed to fetch GitLab data:', error);
      throw error;
    }
  }

  /**
   * Create new issue in GitLab
   */
  async createIssue(task: Partial<ITask>): Promise<GitLabIssue> {
    const endpoint = `/projects/${this.getEncodedProjectId()}/issues`;

    const payload: any = {
      title: task.text || 'New GitLab Issue',
    };

    if (task.details) {
      payload.description = task.details;
    }

    if (task.start) {
      payload.start_date = this.formatDateForGitLab(task.start);
    }

    if (task.end) {
      payload.due_date = this.formatDateForGitLab(task.end);
    }

    if (task.weight) {
      payload.weight = task.weight;
    }

    if (task.parent && task.parent !== 0) {
      payload.milestone_id = task.parent;
    }

    if (task.labels) {
      payload.labels =
        typeof task.labels === 'string' ? task.labels : task.labels.join(',');
    }

    return this.request<GitLabIssue>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Create new milestone in GitLab
   */
  async createMilestone(milestone: Partial<ITask>): Promise<ITask> {
    const endpoint = `/projects/${this.getEncodedProjectId()}/milestones`;

    const payload: any = {
      title: milestone.text || 'New Milestone',
    };

    if (milestone.details) {
      payload.description = milestone.details;
    }

    if (milestone.start) {
      payload.start_date = this.formatDateForGitLab(milestone.start);
    }

    if (milestone.end) {
      payload.due_date = this.formatDateForGitLab(milestone.end);
    }

    const m = await this.request<GitLabMilestone>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      id: m.id,
      text: `[Milestone] ${m.title}`,
      start: m.start_date ? new Date(m.start_date) : undefined,
      end: m.due_date ? new Date(m.due_date) : undefined,
      type: 'summary',
      parent: 0,
      open: true,
      details: m.description,
      _gitlab: {
        type: 'milestone',
        id: m.id,
        web_url: m.web_url,
      },
    };
  }

  /**
   * Update issue in GitLab using GraphQL for dates, REST API for other fields
   */
  async updateIssue(
    id: TID,
    task: Partial<ITask>,
  ): Promise<GitLabIssue | null> {
    console.log('[GitLabDataProvider] updateIssue called with:', { id, task });

    // Use GraphQL for start_date and due_date updates
    const hasDateChanges = task.start !== undefined || task.end !== undefined;

    if (hasDateChanges) {
      await this.updateIssueDatesGraphQL(id, task);
    }

    // Use REST API for other fields
    const hasOtherChanges =
      task.text !== undefined ||
      task.details !== undefined ||
      task.weight !== undefined ||
      task.parent !== undefined ||
      task.labels !== undefined ||
      task.state !== undefined;

    if (hasOtherChanges) {
      const endpoint = `/projects/${this.getEncodedProjectId()}/issues/${id}`;
      const payload: any = {};

      if (task.text !== undefined) {
        payload.title = task.text;
      }

      if (task.details !== undefined) {
        payload.description = task.details;
      }

      if (task.weight !== undefined) {
        payload.weight = task.weight;
      }

      if (task.parent !== undefined && task.parent !== 0) {
        payload.milestone_id = task.parent;
      }

      if (task.labels !== undefined) {
        payload.labels =
          typeof task.labels === 'string' ? task.labels : task.labels.join(',');
      }

      if (task.state !== undefined) {
        payload.state_event = task.state === 'closed' ? 'close' : 'reopen';
      }

      console.log(
        '[GitLabDataProvider] Updating other fields via REST API:',
        payload,
      );

      return this.request<GitLabIssue>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    }

    // If only dates changed, return null (don't fetch via REST API to avoid losing start_date)
    console.log('[GitLabDataProvider] Only dates changed, returning null');
    return null;
  }

  /**
   * Update issue dates using GraphQL API
   */
  private async updateIssueDatesGraphQL(
    id: TID,
    task: Partial<ITask>,
  ): Promise<void> {
    const workItemId = await this.getWorkItemId(id);

    const mutation = `
      mutation updateWorkItem($input: WorkItemUpdateInput!) {
        workItemUpdate(input: $input) {
          workItem {
            id
            widgets {
              ... on WorkItemWidgetStartAndDueDate {
                startDate
                dueDate
              }
            }
          }
          errors
        }
      }
    `;

    const startAndDueDateWidget: any = {};

    if (task.start !== undefined) {
      startAndDueDateWidget.startDate = task.start
        ? this.formatDateForGitLab(task.start)
        : null;
    }

    if (task.end !== undefined) {
      startAndDueDateWidget.dueDate = task.end
        ? this.formatDateForGitLab(task.end)
        : null;
    }

    const variables = {
      input: {
        id: workItemId,
        startAndDueDateWidget,
      },
    };

    console.log('[GitLabDataProvider] Updating dates via GraphQL:', variables);

    const result = await this.graphqlClient.mutate<{
      workItemUpdate: {
        workItem: any;
        errors: string[];
      };
    }>(mutation, variables);

    if (
      result.workItemUpdate.errors &&
      result.workItemUpdate.errors.length > 0
    ) {
      throw new Error(
        `Failed to update dates: ${result.workItemUpdate.errors.join(', ')}`,
      );
    }

    console.log('[GitLabDataProvider] Dates updated successfully via GraphQL');
  }

  /**
   * Get WorkItem ID from issue IID using GraphQL
   */
  private async getWorkItemId(iid: TID): Promise<string> {
    const query = `
      query getWorkItem($fullPath: ID!, $iid: String!) {
        project(fullPath: $fullPath) {
          workItems(iids: [$iid]) {
            nodes {
              id
            }
          }
        }
      }
    `;

    const fullPath = this.getProjectFullPath();
    const variables = {
      fullPath,
      iid: String(iid),
    };

    const result = await this.graphqlClient.query<{
      project: {
        workItems: {
          nodes: Array<{ id: string }>;
        };
      };
    }>(query, variables);

    const workItem = result.project.workItems.nodes[0];
    if (!workItem) {
      throw new Error(`Work item not found for IID: ${iid}`);
    }

    return workItem.id;
  }

  /**
   * Get project full path (e.g., "farllee/gitlab-testbed")
   */
  private getProjectFullPath(): string {
    return String(this.config.projectId);
  }

  /**
   * Fetch issue dates from GraphQL in batch
   */
  private async fetchIssueDateGraphQL(
    iids: number[],
  ): Promise<Map<number, string>> {
    if (iids.length === 0) {
      return new Map();
    }

    const query = `
      query getWorkItems($fullPath: ID!, $iids: [String!]) {
        project(fullPath: $fullPath) {
          workItems(iids: $iids) {
            nodes {
              iid
              widgets {
                ... on WorkItemWidgetStartAndDueDate {
                  startDate
                  dueDate
                }
              }
            }
          }
        }
      }
    `;

    const fullPath = this.getProjectFullPath();
    const variables = {
      fullPath,
      iids: iids.map((iid) => String(iid)),
    };

    const result = await this.graphqlClient.query<{
      project: {
        workItems: {
          nodes: Array<{
            iid: string;
            widgets: Array<{
              startDate?: string;
              dueDate?: string;
            }>;
          }>;
        };
      };
    }>(query, variables);

    const dateMap = new Map<number, string>();

    result.project.workItems.nodes.forEach((workItem) => {
      const startAndDueDateWidget = workItem.widgets.find(
        (w) => w.startDate !== undefined,
      );
      if (startAndDueDateWidget && startAndDueDateWidget.startDate) {
        dateMap.set(Number(workItem.iid), startAndDueDateWidget.startDate);
      }
    });

    return dateMap;
  }

  /**
   * Delete issue in GitLab
   * @param id - The issue ID
   * @param task - Optional task data (for type detection in GraphQL provider)
   */
  async deleteIssue(id: TID, task?: Partial<ITask>): Promise<void> {
    const endpoint = `/projects/${this.getEncodedProjectId()}/issues/${id}`;
    await this.request<void>(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Create issue link in GitLab
   */
  async createIssueLink(link: Partial<ILink>): Promise<void> {
    if (!link.source || !link.target) {
      throw new Error('Source and target are required for issue links');
    }

    const endpoint = `/projects/${this.getEncodedProjectId()}/issues/${link.source}/links`;

    // Map Gantt link type to GitLab link type
    let linkType: string;
    switch (link.type) {
      case 'e2s':
        linkType = 'blocks';
        break;
      case 's2e':
        linkType = 'is_blocked_by';
        break;
      default:
        linkType = 'relates_to';
        break;
    }

    await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        target_project_id: this.getProjectId(),
        target_issue_iid: link.target,
        link_type: linkType,
      }),
    });
  }

  /**
   * Delete issue link in GitLab
   */
  async deleteIssueLink(linkId: TID, sourceIid: TID): Promise<void> {
    const endpoint = `/projects/${this.getEncodedProjectId()}/issues/${sourceIid}/links/${linkId}`;
    await this.request<void>(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Get handlers for Gantt actions
   */
  getHandlers() {
    return {
      'add-task': {
        handler: async (data: { task: Partial<ITask> }) => {
          const issue = await this.createIssue(data.task);
          return { id: issue.iid, ...this.convertIssueToTask(issue) };
        },
      },
      'update-task': {
        handler: async (data: { id: TID; task: Partial<ITask> }) => {
          const issue = await this.updateIssue(data.id, data.task);
          return { id: issue.iid, ...this.convertIssueToTask(issue) };
        },
      },
      'delete-task': {
        handler: async (data: { id: TID }) => {
          await this.deleteIssue(data.id);
          return { id: data.id };
        },
      },
      'add-link': {
        handler: async (data: { link: Partial<ILink> }) => {
          await this.createIssueLink(data.link);
          return { id: data.link.id };
        },
      },
      'delete-link': {
        handler: async (data: { id: TID; link?: ILink }) => {
          if (data.link) {
            await this.deleteIssueLink(data.id, data.link.source);
          }
          return { id: data.id };
        },
      },
    };
  }

  /**
   * Get stored milestones
   */
  getMilestones(): GitLabMilestone[] {
    return Array.from(this.milestones.values());
  }

  /**
   * Get stored epics
   */
  getEpics(): GitLabEpic[] {
    return Array.from(this.epics.values());
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GitLabDataProviderConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    // Clear cached data
    this.milestones.clear();
    this.epics.clear();
    this.issueMap.clear();
  }
}
