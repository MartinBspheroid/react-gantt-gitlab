/**
 * GitLab Data Provider Adapter
 *
 * Adapts the existing GitLabGraphQLProvider to the generic DataProviderInterface.
 * This allows GitLab to be used alongside other data sources in a unified way.
 *
 * The adapter:
 * - Converts generic DataProviderConfig to GitLab-specific config
 * - Maps DataProviderInterface methods to GitLabGraphQLProvider methods
 * - Translates generic filter options to GitLab API format
 */

import type { ITask, ILink } from '@svar-ui/gantt-store';
import type {
  DataProviderInterface,
  DataProviderConfig,
  DataResponse,
  FilterOptions,
  FilterOptionsData,
  SyncOptions,
} from '../core/DataProviderInterface';
import type { GitLabSyncOptions } from '../../types/gitlab';
import type {
  GitLabGraphQLProviderConfig,
  CreateLinkResult,
} from '../GitLabGraphQLProvider';
import { GitLabGraphQLProvider } from '../GitLabGraphQLProvider';

/**
 * GitLab implementation of DataProviderInterface
 * Wraps GitLabGraphQLProvider to provide the generic interface
 */
export class GitLabAdapter implements DataProviderInterface {
  private gitlabProvider: GitLabGraphQLProvider;
  private config: DataProviderConfig;

  constructor(config: DataProviderConfig) {
    this.config = config;

    // Validate GitLab-specific config
    if (!config.sourceUrl) {
      throw new Error('GitLab adapter requires sourceUrl in config');
    }
    if (!config.credentials || typeof config.credentials !== 'object') {
      throw new Error('GitLab adapter requires credentials in config');
    }
    const creds = config.credentials as Record<string, string>;
    if (!creds.token) {
      throw new Error('GitLab adapter requires token in credentials');
    }

    // Convert generic config to GitLab-specific config
    const gitlabConfig: GitLabGraphQLProviderConfig = {
      gitlabUrl: config.sourceUrl,
      token: creds.token,
      projectId: config.projectId,
      type: (config.metadata?.configType as 'project' | 'group') || 'project',
      fullPath: config.metadata?.fullPath as string | undefined,
    };

    // Handle optional groupId if provided
    if (config.metadata?.groupId) {
      gitlabConfig.groupId = config.metadata.groupId;
    }

    this.gitlabProvider = new GitLabGraphQLProvider(gitlabConfig);
  }

  /**
   * Sync data from GitLab
   * Fetches all tasks and links for the configured project/group
   */
  async sync(options?: SyncOptions): Promise<DataResponse> {
    const gitlabOptions: GitLabSyncOptions = {};

    // Map generic filter options to GitLab sync options
    if (options?.filters) {
      gitlabOptions.serverFilters = this.mapFiltersToGitLab(options.filters);
    }

    if (options?.includeClosed !== undefined) {
      gitlabOptions.includeClosed = options.includeClosed;
    }

    // Fetch data from GitLab
    const result = await this.gitlabProvider.getData({
      ...gitlabOptions,
      signal: options?.signal,
      onProgress: options?.onProgress,
    });

    return {
      tasks: result.tasks,
      links: result.links,
      metadata: {
        milestones: result.milestones,
        epics: result.epics,
      },
    };
  }

  /**
   * Update a single task in GitLab
   */
  async syncTask(id: string | number, updates: Partial<ITask>): Promise<ITask> {
    await this.gitlabProvider.updateWorkItem(id, updates);

    // Fetch updated task data
    // For now, we'll need to do a full sync or partial sync to get the updated task
    // This is a limitation of the GitLab API that we accept
    // A better approach would be to cache task data and return the merged result
    // But since GitLabGraphQLProvider doesn't provide a way to fetch a single task,
    // we return the updated task as is

    // Return a minimal task object with the ID
    // The actual updated task will be fetched in the next sync
    return {
      ...updates,
      id: id as number,
    } as ITask;
  }

  /**
   * Create a new task in GitLab
   */
  async createTask(task: Partial<ITask>): Promise<ITask> {
    return this.gitlabProvider.createWorkItem(task);
  }

  /**
   * Delete a task from GitLab
   */
  async deleteTask(id: string | number): Promise<void> {
    await this.gitlabProvider.deleteWorkItem(id);
  }

  /**
   * Create a dependency link between two tasks
   */
  async createLink(link: Partial<ILink>): Promise<ILink> {
    const result = await this.gitlabProvider.createIssueLink(link);

    // Return the link as is - the ILink interface is compatible
    return link as ILink;
  }

  /**
   * Delete a dependency link from GitLab
   * The metadata should contain GitLab-specific information needed for deletion
   */
  async deleteLink(linkId: string | number, metadata?: unknown): Promise<void> {
    const metadataObj = metadata as Record<string, unknown> | undefined;

    // Extract GitLab-specific data from metadata
    const apiSourceIid = metadataObj?.apiSourceIid as
      | string
      | number
      | undefined;
    const linkedWorkItemGlobalId = metadataObj?.linkedWorkItemGlobalId as
      | string
      | undefined;

    if (!apiSourceIid) {
      throw new Error(
        'GitLab adapter requires apiSourceIid in metadata to delete link',
      );
    }

    await this.gitlabProvider.deleteIssueLink(
      linkId,
      apiSourceIid,
      linkedWorkItemGlobalId,
    );
  }

  /**
   * Reorder a task relative to another task
   * Used for kanban-style task ordering
   */
  async reorderTask(
    taskId: string | number,
    targetId: string | number,
    position: 'before' | 'after',
  ): Promise<void> {
    await this.gitlabProvider.reorderWorkItem(taskId, targetId, position);
  }

  /**
   * Get available filter options (members, labels, milestones)
   * Used to populate filter UI
   */
  async getFilterOptions(): Promise<FilterOptionsData> {
    const gitlabOptions = await this.gitlabProvider.getFilterOptions();

    return {
      members: gitlabOptions.members,
      labels: gitlabOptions.labels,
      milestones: gitlabOptions.milestones.map((m) => ({
        id: m.iid,
        title: m.title,
      })),
    };
  }

  /**
   * Check if current user can edit data
   */
  async checkCanEdit(): Promise<boolean> {
    return this.gitlabProvider.checkCanEdit();
  }

  /**
   * Get the current configuration
   */
  getConfig(): DataProviderConfig {
    return this.config;
  }

  /**
   * Map generic filter options to GitLab-specific format
   * Translates common concepts (milestones, labels, assignees) to GitLab API format
   */
  private mapFiltersToGitLab(filters: FilterOptions) {
    return {
      labelNames: filters.labels,
      milestoneTitles: filters.milestones,
      assigneeUsernames: filters.assignees,
      // Map states if provided
      // Note: GitLab uses different state names in different contexts
      // For issues: 'opened', 'closed'
      // The GitLab provider handles this internally
      ...filters.sourceFilters,
    };
  }
}
