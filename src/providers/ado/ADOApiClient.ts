import type {
  ADOConfig,
  ADOQueryResult,
  ADOBatchResponse,
  ADOWorkItem,
  ADODependencyLink,
  ADOFetchDependenciesOptions,
  ADOFetchDependenciesResult,
  ADOLinkType,
  ADOIteration,
  ADOIterationsResponse,
  Sprint,
  SprintCapacityInfo,
} from '../../types/azure-devops';
import {
  extractWorkItemIdFromUrl,
  mapADOLinkTypeToGantt,
  validateADOLink,
  convertADODependencyToILink,
  filterCircularDependencies,
} from '../../types/azure-devops';
import type { ILink, ITask } from '@svar-ui/gantt-store';

const DEPENDENCY_LINK_TYPES: ADOLinkType[] = [
  'System.LinkTypes.Dependency-Forward',
  'System.LinkTypes.Dependency-Reverse',
];

export class ADOApiClient {
  private config: ADOConfig;
  private baseUrl: string;

  constructor(config: ADOConfig) {
    this.config = config;
    this.baseUrl = `${config.organizationUrl}/${config.project}/_apis`;
  }

  private getAuthHeaders(): HeadersInit {
    const token = btoa(`:${this.config.pat}`);
    return {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json;api-version=7.0',
    };
  }

  private async fetchApi<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ADO API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async getWorkItemsWithRelations(ids: number[]): Promise<ADOWorkItem[]> {
    if (ids.length === 0) return [];

    const batchSize = 200;
    const allWorkItems: ADOWorkItem[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchResult = await this.fetchApi<ADOBatchResponse>(
        `/wit/workitems?ids=${batch.join(',')}&$expand=relations`,
      );
      allWorkItems.push(...batchResult.value);
    }

    return allWorkItems;
  }

  async fetchDependenciesByQuery(
    workItemIds: number[],
  ): Promise<ADOFetchDependenciesResult> {
    const errors: string[] = [];
    const links: ILink[] = [];
    const processedLinks = new Set<string>();
    const adoDependencies: ADODependencyLink[] = [];

    if (workItemIds.length === 0) {
      return { links, errors };
    }

    const validIds = new Set(workItemIds);

    const workItems = await this.getWorkItemsWithRelations(workItemIds);

    for (const workItem of workItems) {
      if (!workItem.relations) continue;

      for (const relation of workItem.relations) {
        if (!DEPENDENCY_LINK_TYPES.includes(relation.rel as ADOLinkType)) {
          continue;
        }

        const targetId = extractWorkItemIdFromUrl(relation.url);
        if (!targetId) {
          errors.push(
            `Could not extract target ID from relation URL: ${relation.url}`,
          );
          continue;
        }

        const isForward =
          relation.rel === 'System.LinkTypes.Dependency-Forward';
        const sourceId = isForward ? workItem.id : targetId;
        const actualTargetId = isForward ? targetId : workItem.id;

        const linkType = mapADOLinkTypeToGantt(
          relation.rel as ADOLinkType,
          isForward,
        );

        const lag = relation.attributes?.lag;

        const dependency: ADODependencyLink = {
          sourceId,
          targetId: actualTargetId,
          type: linkType,
          lag,
          relationType: relation.rel as ADOLinkType,
        };

        const validation = validateADOLink(dependency, validIds);
        if (!validation.valid) {
          errors.push(
            `Invalid link from ${sourceId} to ${actualTargetId}: ${validation.error}`,
          );
          continue;
        }

        const linkKey = `${sourceId}-${actualTargetId}`;
        const reverseKey = `${actualTargetId}-${sourceId}`;
        if (processedLinks.has(linkKey) || processedLinks.has(reverseKey)) {
          continue;
        }
        processedLinks.add(linkKey);

        adoDependencies.push(dependency);
      }
    }

    const { validLinks, circularLinks } =
      filterCircularDependencies(adoDependencies);

    if (circularLinks.length > 0) {
      console.warn(
        `[ADO] Filtered out ${circularLinks.length} circular dependency links`,
      );
    }

    validLinks.forEach((dep) => {
      const iLink = convertADODependencyToILink(dep);
      links.push(iLink);
    });

    console.log(
      `[ADO] Fetched ${links.length} dependency links from ${workItems.length} work items`,
    );

    return { links, errors };
  }

  async queryWorkItemRelations(wiql: string): Promise<ADOQueryResult> {
    return this.fetchApi<ADOQueryResult>('/wit/wiql', {
      method: 'POST',
      body: JSON.stringify({ query: wiql }),
    });
  }

  async fetchAllDependencies(
    options: ADOFetchDependenciesOptions,
  ): Promise<ADOFetchDependenciesResult> {
    return this.fetchDependenciesByQuery(options.workItemIds);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchApi<{ count: number }>(
        '/wit/workitems?ids=1&errorPolicy=omit',
      );
      return true;
    } catch {
      return false;
    }
  }

  async fetchTeamIterations(): Promise<ADOIteration[]> {
    if (!this.config.team) {
      console.warn('[ADO] Team not configured, cannot fetch iterations');
      return [];
    }

    const team = encodeURIComponent(this.config.team);
    const project = encodeURIComponent(this.config.project);

    const result = await this.fetchApi<{
      count: number;
      value: ADOIteration[];
    }>(`/work/teamsettings/iterations?$top=100`);

    return result.value || [];
  }

  async fetchProjectIterations(): Promise<ADOIteration[]> {
    const project = encodeURIComponent(this.config.project);

    const result = await this.fetchApi<{
      count: number;
      value: ADOIteration[];
    }>(`/wit/classificationnodes/${project}?depth=2&$expand=children`);

    return result.value || [];
  }

  calculateSprintCapacity(
    sprint: ADOIteration,
    tasks: ITask[],
  ): SprintCapacityInfo {
    const sprintPath = sprint.path;
    const sprintStartDate = sprint.attributes?.startDate
      ? new Date(sprint.attributes.startDate)
      : sprint.startDate
        ? new Date(sprint.startDate)
        : null;
    const sprintFinishDate = sprint.attributes?.finishDate
      ? new Date(sprint.attributes.finishDate)
      : sprint.finishDate
        ? new Date(sprint.finishDate)
        : null;

    let assignedWork = 0;
    let remainingWork = 0;

    for (const task of tasks) {
      const adoData = (task as ITask & { _ado?: { iterationPath?: string } })
        ._ado;
      if (adoData?.iterationPath === sprintPath) {
        const effort =
          adoData &&
          'remainingWork' in adoData &&
          typeof adoData.remainingWork === 'number'
            ? adoData.remainingWork
            : 0;
        assignedWork += effort;
        remainingWork += effort;
      }
    }

    let teamCapacity = 0;
    if (sprintStartDate && sprintFinishDate) {
      const days = Math.ceil(
        (sprintFinishDate.getTime() - sprintStartDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      teamCapacity = days * 8 * 5;
    }

    let status: 'under' | 'near' | 'over' = 'under';
    if (teamCapacity > 0) {
      const utilization = assignedWork / teamCapacity;
      if (utilization > 1) {
        status = 'over';
      } else if (utilization > 0.85) {
        status = 'near';
      }
    }

    return {
      sprintId: sprint.id,
      teamCapacity,
      assignedWork,
      remainingWork,
      status,
    };
  }

  convertToSprint(iteration: ADOIteration, tasks: ITask[]): Sprint {
    const capacityInfo = this.calculateSprintCapacity(iteration, tasks);

    const startDate = iteration.attributes?.startDate || iteration.startDate;
    const finishDate = iteration.attributes?.finishDate || iteration.finishDate;

    return {
      id: iteration.id,
      name: iteration.name,
      path: iteration.path,
      startDate: startDate ? new Date(startDate) : null,
      finishDate: finishDate ? new Date(finishDate) : null,
      isCurrent: iteration.attributes?.timeFrame === 'current',
      capacity: capacityInfo.teamCapacity,
      assignedWork: capacityInfo.assignedWork,
      remainingWork: capacityInfo.remainingWork,
    };
  }

  async fetchSprintsWithCapacity(tasks: ITask[]): Promise<Sprint[]> {
    let iterations: ADOIteration[];

    if (this.config.team) {
      iterations = await this.fetchTeamIterations();
    } else {
      iterations = [];
    }

    return iterations.map((iter) => this.convertToSprint(iter, tasks));
  }
}

export async function fetchADODependencies(
  config: ADOConfig,
  workItemIds: number[],
): Promise<ILink[]> {
  const client = new ADOApiClient(config);
  const result = await client.fetchAllDependencies({ workItemIds });

  if (result.errors.length > 0) {
    console.warn('[ADO] Errors fetching dependencies:', result.errors);
  }

  return result.links;
}
