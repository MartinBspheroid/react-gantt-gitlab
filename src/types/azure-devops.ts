import type { ITask, ILink } from '@svar-ui/gantt-store';

export type ADOLinkType =
  | 'System.LinkTypes.Dependency-Forward'
  | 'System.LinkTypes.Dependency-Reverse'
  | 'System.LinkTypes.Related'
  | 'System.LinkTypes.Hierarchy-Forward'
  | 'System.LinkTypes.Hierarchy-Reverse';

export interface ADOLinkRelation {
  rel: ADOLinkType;
  url: string;
  attributes?: {
    isLocked?: boolean;
    name?: string;
    lag?: number;
  };
}

export interface ADOWorkItem {
  id: number;
  rev?: number;
  url?: string;
  fields: {
    'System.Id': number;
    'System.Title': string;
    'System.State': string;
    'System.WorkItemType': string;
    'System.AssignedTo'?: {
      displayName: string;
      uniqueName: string;
      id: string;
    };
    'Microsoft.VSTS.Common.Priority'?: number;
    'Microsoft.VSTS.Common.Activity'?: string;
    'Microsoft.VSTS.Scheduling.StartDate'?: string;
    'Microsoft.VSTS.Scheduling.FinishDate'?: string;
    'Microsoft.VSTS.Scheduling.OriginalEstimate'?: number;
    'Microsoft.VSTS.Scheduling.CompletedWork'?: number;
    'Microsoft.VSTS.Scheduling.RemainingWork'?: number;
    'Microsoft.VSTS.Scheduling.Effort'?: number;
    'System.Tags'?: string;
    'System.Description'?: string;
    'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;
    'System.IterationPath'?: string;
    'System.AreaPath'?: string;
    'System.Parent'?: number;
    [key: string]: unknown;
  };
  relations?: ADOLinkRelation[];
  _links?: {
    html?: { href: string };
    workItemType?: { href: string };
  };
}

export interface ADOQueryResult {
  queryType: string;
  queryResultType: string;
  asOf: string;
  columns: Array<{ referenceName: string; name: string; url: string }>;
  workItems: Array<{ id: number; url: string }>;
  workItemRelations?: Array<{
    rel: string | null;
    source?: { id: number; url: string };
    target: { id: number; url: string };
  }>;
}

export interface ADOBatchResponse {
  count: number;
  value: ADOWorkItem[];
}

export interface ADOConfig {
  organizationUrl: string;
  project: string;
  pat: string;
  team?: string;
}

export interface ADODependencyLink {
  sourceId: number;
  targetId: number;
  type: 'e2s' | 's2e' | 'e2e' | 's2s';
  lag?: number;
  relationType: ADOLinkType;
}

export interface ADOFetchDependenciesOptions {
  workItemIds: number[];
  includeLag?: boolean;
}

export interface ADOFetchDependenciesResult {
  links: ILink[];
  errors: string[];
}

export function mapADOLinkTypeToGantt(
  adoRelationType: ADOLinkType,
  isForward: boolean,
): 'e2s' | 's2e' | 'e2e' | 's2s' {
  if (
    adoRelationType === 'System.LinkTypes.Dependency-Forward' ||
    adoRelationType === 'System.LinkTypes.Dependency-Reverse'
  ) {
    return isForward ? 'e2s' : 's2e';
  }
  return 'e2s';
}

export function extractWorkItemIdFromUrl(url: string): number | null {
  const match = url.match(/\/workItems\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function validateADOLink(
  link: ADODependencyLink,
  validIds: Set<number>,
): { valid: boolean; error?: string } {
  if (!link.sourceId || !link.targetId) {
    return { valid: false, error: 'Link missing source or target ID' };
  }

  if (!validIds.has(link.sourceId)) {
    return { valid: false, error: `Invalid source ID: ${link.sourceId}` };
  }

  if (!validIds.has(link.targetId)) {
    return { valid: false, error: `Invalid target ID: ${link.targetId}` };
  }

  if (link.sourceId === link.targetId) {
    return { valid: false, error: 'Source and target cannot be the same' };
  }

  return { valid: true };
}

export function convertADODependencyToILink(
  dependency: ADODependencyLink,
): ILink {
  return {
    id: `${dependency.sourceId}-${dependency.targetId}-${dependency.type}`,
    source: dependency.sourceId,
    target: dependency.targetId,
    type: dependency.type,
    _ado: {
      relationType: dependency.relationType,
      lag: dependency.lag,
    },
  } as ILink & { _ado: { relationType: ADOLinkType; lag?: number } };
}

export interface ADOIteration {
  id: string;
  name: string;
  path: string;
  startDate?: string;
  finishDate?: string;
  attributes?: {
    startDate?: string;
    finishDate?: string;
    timeFrame?: 'past' | 'current' | 'future';
  };
}

export interface ADOIterationsResponse {
  count: number;
  value: ADOIteration[];
}

export interface ADOTeamIterationsResponse {
  count: number;
  value: Array<{
    id: string;
    name: string;
    path: string;
    attributes: {
      startDate?: string;
      finishDate?: string;
      timeFrame?: 'past' | 'current' | 'future';
    };
    url: string;
  }>;
}

export interface ADOTeamCapacity {
  teamId: string;
  iterations: Array<{
    id: string;
    name: string;
    capacity?: number;
    daysOff?: number;
    totalCapacity?: number;
    remainingCapacity?: number;
  }>;
}

export interface Sprint {
  id: string;
  name: string;
  path: string;
  startDate: Date | null;
  finishDate: Date | null;
  isCurrent: boolean;
  capacity?: number;
  assignedWork?: number;
  remainingWork?: number;
}

export interface SprintCapacityInfo {
  sprintId: string;
  teamCapacity: number;
  assignedWork: number;
  remainingWork: number;
  status: 'under' | 'near' | 'over';
}
