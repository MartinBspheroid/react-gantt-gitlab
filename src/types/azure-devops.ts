import type { ITask, ILink } from '@svar-ui/gantt-store';

export type TaskPriority = 0 | 1 | 2 | 3 | 4;

export interface ADOExtendedTaskFields {
  priority?: TaskPriority;
  workItemType?: string;
  acceptanceCriteria?: string;
}

export type ADOTask = ITask & ADOExtendedTaskFields;

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

export interface ADOAssignedTo {
  displayName: string;
  uniqueName: string;
  id: string;
  imageUrl?: string;
  url?: string;
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
    'System.AssignedTo'?: ADOAssignedTo;
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
    lag: dependency.lag,
    _ado: {
      relationType: dependency.relationType,
      lag: dependency.lag,
    },
  } as ILink & {
    lag?: number;
    _ado: { relationType: ADOLinkType; lag?: number };
  };
}

export function detectCircularDependencies(
  links: ADODependencyLink[],
): Set<string> {
  const cycles = new Set<string>();
  const graph = new Map<number, number[]>();

  links.forEach((link) => {
    if (!graph.has(link.sourceId)) {
      graph.set(link.sourceId, []);
    }
    graph.get(link.sourceId)!.push(link.targetId);
  });

  function dfs(
    start: number,
    current: number,
    visited: Set<number>,
    path: number[],
  ): boolean {
    if (visited.has(current)) {
      if (current === start && path.length > 1) {
        const cycleKey = path.map(String).join('-');
        cycles.add(cycleKey);
        return true;
      }
      return false;
    }

    visited.add(current);
    path.push(current);

    const successors = graph.get(current) || [];
    for (const succ of successors) {
      if (succ === start || !visited.has(succ)) {
        dfs(start, succ, visited, path);
      }
    }

    path.pop();
    visited.delete(current);
    return false;
  }

  const allIds = new Set<number>();
  links.forEach((link) => {
    allIds.add(link.sourceId);
    allIds.add(link.targetId);
  });

  allIds.forEach((id) => {
    dfs(id, id, new Set(), []);
  });

  return cycles;
}

export function filterCircularDependencies(links: ADODependencyLink[]): {
  validLinks: ADODependencyLink[];
  circularLinks: ADODependencyLink[];
} {
  const validLinks: ADODependencyLink[] = [];
  const circularLinks: ADODependencyLink[] = [];

  const graph = new Map<number, Set<number>>();
  links.forEach((link) => {
    if (!graph.has(link.sourceId)) {
      graph.set(link.sourceId, new Set());
    }
    graph.get(link.sourceId)!.add(link.targetId);
  });

  function hasCycle(
    source: number,
    target: number,
    visited: Set<number>,
    recStack: Set<number>,
  ): boolean {
    visited.add(target);
    recStack.add(target);

    const neighbors = graph.get(target) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(source, neighbor, visited, recStack)) {
          return true;
        }
      } else if (neighbor === source) {
        return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(target);
    return false;
  }

  const cycleLinkKeys = new Set<string>();
  const allNodes = new Set<number>();
  links.forEach((link) => {
    allNodes.add(link.sourceId);
    allNodes.add(link.targetId);
  });

  links.forEach((link) => {
    const visited = new Set<number>();
    const recStack = new Set<number>();

    if (hasCycle(link.sourceId, link.targetId, visited, recStack)) {
      cycleLinkKeys.add(`${link.sourceId}-${link.targetId}`);
    }
  });

  const cycles = detectCircularDependencies(links);
  if (cycles.size > 0) {
    console.warn(
      `[ADO] Detected ${cycles.size} potential circular dependency paths`,
    );
  }

  links.forEach((link) => {
    const linkKey = `${link.sourceId}-${link.targetId}`;
    if (cycleLinkKeys.has(linkKey)) {
      circularLinks.push(link);
      console.warn(
        `[ADO] Skipping circular link: ${link.sourceId} -> ${link.targetId}`,
      );
    } else {
      validLinks.push(link);
    }
  });

  return { validLinks, circularLinks };
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

export interface ADOFieldValidationResult {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
}

const REQUIRED_TASK_FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.WorkItemType',
] as const;

const OPTIONAL_BUT_RECOMMENDED_FIELDS = [
  'System.AssignedTo',
  'Microsoft.VSTS.Common.Priority',
  'Microsoft.VSTS.Scheduling.StartDate',
  'Microsoft.VSTS.Scheduling.FinishDate',
  'System.IterationPath',
  'System.Parent',
] as const;

export function validateADOWorkItemFields(
  fields: ADOWorkItem['fields'],
): ADOFieldValidationResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  for (const requiredField of REQUIRED_TASK_FIELDS) {
    if (fields[requiredField] === undefined || fields[requiredField] === null) {
      missingFields.push(requiredField);
    }
  }

  for (const optionalField of OPTIONAL_BUT_RECOMMENDED_FIELDS) {
    if (fields[optionalField] === undefined || fields[optionalField] === null) {
      warnings.push(`Missing optional field: ${optionalField}`);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

export function extractHierarchyParent(
  relations?: ADOLinkRelation[],
): number | null {
  if (!relations) return null;

  const hierarchyRelation = relations.find(
    (r) => r.rel === 'System.LinkTypes.Hierarchy-Reverse',
  );

  if (hierarchyRelation) {
    return extractWorkItemIdFromUrl(hierarchyRelation.url);
  }

  return null;
}

export function extractHierarchyChildren(
  relations?: ADOLinkRelation[],
): number[] {
  if (!relations) return [];

  return relations
    .filter((r) => r.rel === 'System.LinkTypes.Hierarchy-Forward')
    .map((r) => extractWorkItemIdFromUrl(r.url))
    .filter((id): id is number => id !== null);
}
