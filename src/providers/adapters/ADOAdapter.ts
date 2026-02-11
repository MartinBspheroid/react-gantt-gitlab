import type { ITask, ILink } from '@svar-ui/gantt-store';
import type {
  DataProviderInterface,
  DataProviderConfig,
  DataResponse,
  FilterOptions,
  FilterOptionsData,
  SyncOptions,
} from '../core/DataProviderInterface';
import type { ADOConfig, ADOWorkItem, Sprint } from '../../types/azure-devops';
import { ADOApiClient } from '../ado/ADOApiClient';

const ADO_WORK_ITEM_FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.WorkItemType',
  'System.AssignedTo',
  'Microsoft.VSTS.Common.Priority',
  'Microsoft.VSTS.Scheduling.StartDate',
  'Microsoft.VSTS.Scheduling.FinishDate',
  'Microsoft.VSTS.Scheduling.OriginalEstimate',
  'Microsoft.VSTS.Scheduling.CompletedWork',
  'Microsoft.VSTS.Scheduling.RemainingWork',
  'System.Tags',
  'System.Description',
  'System.IterationPath',
  'System.AreaPath',
  'System.Parent',
].join(',');

const TASK_TYPES = [
  'Task',
  'User Story',
  'Bug',
  'Feature',
  'Epic',
  'Issue',
  'Product Backlog Item',
];

export interface ADOAdapterConfig extends DataProviderConfig {
  type: 'azure-devops';
  sourceUrl: string;
  projectId: string;
  credentials: {
    pat: string;
  };
  metadata?: {
    team?: string;
    areaPath?: string;
    iterationPath?: string;
    workItemTypes?: string[];
  };
}

export class ADOAdapter implements DataProviderInterface {
  private config: DataProviderConfig;
  private adoConfig: ADOConfig;
  private apiClient: ADOApiClient;

  constructor(config: DataProviderConfig) {
    this.config = config;

    if (!config.sourceUrl) {
      throw new Error('ADO adapter requires sourceUrl (organization URL)');
    }
    if (!config.projectId) {
      throw new Error('ADO adapter requires projectId');
    }
    if (
      !config.credentials ||
      typeof config.credentials !== 'object' ||
      !('pat' in config.credentials)
    ) {
      throw new Error('ADO adapter requires credentials.pat');
    }

    this.adoConfig = {
      organizationUrl: config.sourceUrl.replace(/\/$/, ''),
      project: String(config.projectId),
      pat: (config.credentials as { pat: string }).pat,
      team: config.metadata?.team as string | undefined,
    };

    this.apiClient = new ADOApiClient(this.adoConfig);
  }

  async sync(options?: SyncOptions): Promise<DataResponse> {
    const workItemTypes =
      (this.config.metadata?.workItemTypes as string[]) || TASK_TYPES;

    const wiql = this.buildWiqlQuery(workItemTypes, options);

    const queryResult = await this.apiClient.queryWorkItemRelations(wiql);

    const workItemIds = queryResult.workItems.map((wi) => wi.id);

    if (workItemIds.length === 0) {
      const emptySprints = await this.apiClient.fetchSprintsWithCapacity([]);
      return { tasks: [], links: [], metadata: { sprints: emptySprints } };
    }

    const workItems =
      await this.apiClient.getWorkItemsWithRelations(workItemIds);

    const tasks = workItems.map((wi) => this.convertToTask(wi));

    const depResult = await this.apiClient.fetchAllDependencies({
      workItemIds,
    });

    const sprints = await this.apiClient.fetchSprintsWithCapacity(tasks);

    return {
      tasks,
      links: depResult.links,
      metadata: {
        errors: depResult.errors,
        totalWorkItems: workItemIds.length,
        sprints,
      },
    };
  }

  private buildWiqlQuery(
    workItemTypes: string[],
    options?: SyncOptions,
  ): string {
    const types = workItemTypes.map((t) => `'${t}'`).join(', ');

    let whereClause = `[System.WorkItemType] IN (${types})`;

    if (!options?.includeClosed) {
      whereClause += ` AND [System.State] <> 'Closed' AND [System.State] <> 'Removed'`;
    }

    if (this.config.metadata?.areaPath) {
      whereClause += ` AND [System.AreaPath] UNDER '${this.config.metadata.areaPath}'`;
    }

    if (this.config.metadata?.iterationPath) {
      whereClause += ` AND [System.IterationPath] UNDER '${this.config.metadata.iterationPath}'`;
    }

    if (options?.filters?.assignees && options.filters.assignees.length > 0) {
      const assignees = options.filters.assignees
        .map((a) => `'${a}'`)
        .join(', ');
      whereClause += ` AND [System.AssignedTo] IN (${assignees})`;
    }

    return `SELECT [System.Id] FROM WorkItems WHERE ${whereClause} ORDER BY [System.Id]`;
  }

  private convertToTask(wi: ADOWorkItem): ITask {
    const fields = wi.fields;

    const startDate = fields['Microsoft.VSTS.Scheduling.StartDate']
      ? new Date(fields['Microsoft.VSTS.Scheduling.StartDate'])
      : undefined;

    const endDate = fields['Microsoft.VSTS.Scheduling.FinishDate']
      ? new Date(fields['Microsoft.VSTS.Scheduling.FinishDate'])
      : undefined;

    const duration = this.calculateDuration(
      startDate,
      endDate,
      fields['Microsoft.VSTS.Scheduling.RemainingWork'],
    );

    const progress = this.calculateProgress(
      fields['Microsoft.VSTS.Scheduling.CompletedWork'],
      fields['Microsoft.VSTS.Scheduling.OriginalEstimate'] ||
        fields['Microsoft.VSTS.Scheduling.RemainingWork'],
    );

    return {
      id: wi.id,
      text: fields['System.Title'] || 'Untitled',
      start: startDate,
      end: endDate,
      duration,
      progress,
      type: this.mapWorkItemType(fields['System.WorkItemType']),
      parent: fields['System.Parent'],
      details: fields['System.Description'],
      unscheduled: !startDate,
      _ado: {
        id: wi.id,
        rev: wi.rev,
        url: wi.url,
        webUrl: wi._links?.html?.href,
        state: fields['System.State'],
        workItemType: fields['System.WorkItemType'],
        assignedTo: fields['System.AssignedTo']
          ? {
              displayName: fields['System.AssignedTo'].displayName,
              uniqueName: fields['System.AssignedTo'].uniqueName,
            }
          : null,
        priority: fields['Microsoft.VSTS.Common.Priority'],
        tags: fields['System.Tags']
          ? fields['System.Tags'].split(';').map((t) => t.trim())
          : [],
        iterationPath: fields['System.IterationPath'],
        areaPath: fields['System.AreaPath'],
        originalEstimate: fields['Microsoft.VSTS.Scheduling.OriginalEstimate'],
        completedWork: fields['Microsoft.VSTS.Scheduling.CompletedWork'],
        remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'],
      },
    } as ITask & {
      _ado: {
        id: number;
        rev?: number;
        url?: string;
        webUrl?: string;
        state: string;
        workItemType: string;
        assignedTo: { displayName: string; uniqueName: string } | null;
        priority?: number;
        tags: string[];
        iterationPath?: string;
        areaPath?: string;
        originalEstimate?: number;
        completedWork?: number;
        remainingWork?: number;
      };
    };
  }

  private calculateDuration(
    startDate?: Date,
    endDate?: Date,
    remainingWork?: number,
  ): number | undefined {
    if (startDate && endDate) {
      const diffTime = endDate.getTime() - startDate.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    if (remainingWork) {
      return Math.ceil(remainingWork / 8);
    }
    return undefined;
  }

  private calculateProgress(
    completedWork?: number,
    totalWork?: number,
  ): number | undefined {
    if (
      completedWork !== undefined &&
      totalWork !== undefined &&
      totalWork > 0
    ) {
      return Math.min(1, completedWork / totalWork);
    }
    return undefined;
  }

  private mapWorkItemType(
    workItemType: string,
  ): 'task' | 'summary' | 'milestone' {
    switch (workItemType.toLowerCase()) {
      case 'epic':
      case 'feature':
        return 'summary';
      case 'milestone':
        return 'milestone';
      default:
        return 'task';
    }
  }

  async syncTask(id: string | number, updates: Partial<ITask>): Promise<ITask> {
    console.warn('[ADO] syncTask not fully implemented');
    return { ...updates, id } as ITask;
  }

  async createTask(task: Partial<ITask>): Promise<ITask> {
    console.warn('[ADO] createTask not fully implemented');
    return task as ITask;
  }

  async deleteTask(id: string | number): Promise<void> {
    console.warn('[ADO] deleteTask not fully implemented');
  }

  async createLink(link: Partial<ILink>): Promise<ILink> {
    console.warn('[ADO] createLink not fully implemented');
    return link as ILink;
  }

  async deleteLink(linkId: string | number, metadata?: unknown): Promise<void> {
    console.warn('[ADO] deleteLink not fully implemented');
  }

  async reorderTask(
    taskId: string | number,
    targetId: string | number,
    position: 'before' | 'after',
  ): Promise<void> {
    console.warn('[ADO] reorderTask not implemented for ADO');
  }

  async getFilterOptions(): Promise<FilterOptionsData> {
    return {
      members: [],
      labels: [],
      milestones: [],
    };
  }

  async checkCanEdit(): Promise<boolean> {
    return this.apiClient.testConnection();
  }

  getConfig(): DataProviderConfig {
    return this.config;
  }
}
