/**
 * GitLab GraphQL Provider
 * Pure GraphQL implementation for GitLab integration
 *
 * IMPORTANT: GitLab API differences between Project and Group
 * ===========================================================
 * This provider supports both project and group configurations.
 * There are subtle but critical differences in the GitLab GraphQL API:
 *
 * 1. Endpoint root:
 *    - Project: query { project(fullPath: "...") { ... } }
 *    - Group: query { group(fullPath: "...") { ... } }
 *
 * 2. milestoneTitle filter type (Issues query):
 *    - Project issues: milestoneTitle accepts String (single value)
 *    - Group issues: milestoneTitle accepts [String] (array)
 *    This difference requires dynamic query generation based on config.type.
 *
 * 3. Work Items API:
 *    - Both project and group use the same workItems query structure
 *    - milestoneTitle accepts [String!] for both
 *    - Group-level workItem(iid:) returns null, must query at project level
 *
 * 4. Snippets API (REST, not GraphQL):
 *    - Project: /projects/:id/snippets - SUPPORTED
 *    - Group: NOT SUPPORTED by GitLab!
 *    See: https://gitlab.com/gitlab-org/gitlab/-/issues/15958
 *    For groups, Holidays/ColorRules/FilterPresets features are disabled.
 *
 * When adding new features, always test with BOTH project and group configurations.
 */

import type { ITask, ILink, TID } from '@svar-ui/gantt-store';
import type {
  GitLabSyncOptions,
  GitLabDataResponse,
  GitLabFilterOptionsData,
} from '../types/gitlab';
import type {
  SyncProgressCallback,
  SyncResourceType,
} from '../types/syncProgress';
import {
  createProgressMessage,
  checkAborted,
  reportProgress,
} from '../types/syncProgress';
import { GitLabGraphQLClient } from './GitLabGraphQLClient';
import {
  gitlabRestRequest,
  gitlabRestRequestPaginated,
} from './GitLabApiUtils';
import {
  createMilestoneTaskId,
  extractMilestoneIid,
} from '../utils/MilestoneIdUtils';

/**
 * Format iteration title for display
 * - Manual iterations with title: "Cadence: Iteration Title"
 * - Auto-generated iterations: "Cadence: Feb 1-28" (date range)
 */
function formatIterationTitle(iteration: {
  title?: string | null;
  startDate?: string;
  dueDate?: string;
  iterationCadence?: { title: string };
}): string {
  const cadenceTitle = iteration.iterationCadence?.title;
  const iterationTitle = iteration.title?.trim() || '';
  const startDate = iteration.startDate;
  const dueDate = iteration.dueDate;

  // Format date range compactly
  let dateRange = '';
  if (startDate && dueDate) {
    const start = new Date(startDate);
    const end = new Date(dueDate);
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();

    if (startMonth === endMonth) {
      // Same month: "Feb 1-28"
      dateRange = `${startMonth} ${startDay}-${endDay}`;
    } else {
      // Different months: "Jan 15 - Feb 14"
      dateRange = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
  }

  // Combine cadence title with iteration title (if available) or date range
  // Manual iterations have a title, auto-generated ones don't
  if (cadenceTitle && iterationTitle) {
    return `${cadenceTitle}: ${iterationTitle}`;
  } else if (cadenceTitle && dateRange) {
    return `${cadenceTitle}: ${dateRange}`;
  } else if (cadenceTitle) {
    return cadenceTitle;
  } else if (dateRange) {
    return dateRange;
  } else if (iterationTitle) {
    return iterationTitle;
  }
  return 'Iteration';
}

export interface GitLabGraphQLProviderConfig {
  gitlabUrl: string;
  token: string;
  projectId?: string | number;
  groupId?: string | number;
  type: 'project' | 'group';
}

interface WorkItem {
  id: string;
  iid: string;
  title: string;
  createdAt: string;
  closedAt: string | null;
  state: string;
  webUrl: string;
  relativePosition?: number | null;
  workItemType?: {
    name: string;
  };
  widgets: Array<{
    type?: string;
    description?: string;
    startDate?: string;
    dueDate?: string;
    assignees?: {
      nodes: Array<{
        id: string;
        name: string;
        username: string;
      }>;
    };
    labels?: {
      nodes: Array<{
        id: string;
        title: string;
      }>;
    };
    weight?: number;
    milestone?: {
      id: string;
      title: string;
    };
    iteration?: {
      id: string;
      iid: string;
      title: string;
      startDate?: string;
      dueDate?: string;
    };
    parent?: {
      id: string;
      iid: string;
    };
    children?: {
      nodes: Array<{
        id: string;
        iid: string;
      }>;
    };
  }>;
}

interface WorkItemsResponse {
  project?: {
    workItems: {
      pageInfo?: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: WorkItem[];
    };
  };
  group?: {
    workItems: {
      pageInfo?: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: WorkItem[];
    };
  };
}

export class GitLabGraphQLProvider {
  private config: GitLabGraphQLProviderConfig;
  public graphqlClient: GitLabGraphQLClient; // Public for testing purposes
  private updateQueue: Map<number | string, Promise<void>> = new Map();
  private isDev: boolean;

  constructor(config: GitLabGraphQLProviderConfig) {
    this.config = config;
    this.graphqlClient = new GitLabGraphQLClient({
      gitlabUrl: config.gitlabUrl,
      token: config.token,
    });
    this.isDev = import.meta.env.DEV;
  }

  /**
   * Get project/group full path
   */
  private getFullPath(): string {
    if (this.config.type === 'group') {
      return String(this.config.groupId);
    }
    return String(this.config.projectId);
  }

  /**
   * Helper to extract paginated data from GraphQL result based on config type
   * Reduces boilerplate in queryPaginated calls
   */
  private extractPaginatedData<T>(
    result: unknown,
    fieldPath: string,
  ): {
    nodes: T[];
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  } {
    const root = (result as Record<string, unknown>)[this.config.type] as
      | Record<string, unknown>
      | undefined;
    const data = fieldPath
      .split('.')
      .reduce<unknown>(
        (obj, key) => (obj as Record<string, unknown>)?.[key],
        root,
      ) as
      | {
          nodes?: T[];
          pageInfo?: { hasNextPage: boolean; endCursor: string | null };
        }
      | undefined;
    return {
      nodes: data?.nodes || [],
      pageInfo: data?.pageInfo,
    };
  }

  /**
   * Execute a paginated GraphQL query and return all results
   * Handles the common pattern of fetching all pages using cursor-based pagination
   *
   * @param query - GraphQL query string (must include $after variable and pageInfo in response)
   * @param variables - Variables to pass to the query (excluding 'after')
   * @param extractData - Function to extract nodes array and pageInfo from query result
   * @param maxPages - Maximum pages to fetch (default: 20, = 2000 items with first:100)
   * @param signal - Optional AbortSignal for request cancellation
   * @param onProgress - Optional callback for progress updates
   * @param resourceType - Resource type for progress messages
   * @returns Combined array of all nodes from all pages
   */
  private async queryPaginated<T>(
    query: string,
    variables: Record<string, unknown>,
    extractData: (result: unknown) => {
      nodes: T[];
      pageInfo?: { hasNextPage: boolean; endCursor: string | null };
    },
    maxPages: number = 20,
    signal?: AbortSignal,
    onProgress?: SyncProgressCallback,
    resourceType?: SyncResourceType,
  ): Promise<T[]> {
    const allNodes: T[] = [];
    let hasNextPage = true;
    let endCursor: string | null = null;
    let pageCount = 0;

    while (hasNextPage && pageCount < maxPages) {
      checkAborted(signal);

      const result = await this.graphqlClient.query<unknown>(
        query,
        {
          ...variables,
          after: endCursor,
        },
        signal,
      );

      const data = extractData(result);
      allNodes.push(...data.nodes);

      hasNextPage = data.pageInfo?.hasNextPage || false;
      endCursor = data.pageInfo?.endCursor || null;
      pageCount++;

      if (resourceType) {
        reportProgress(onProgress, resourceType, pageCount, allNodes.length);
      }
    }

    if (pageCount === maxPages && hasNextPage) {
      console.warn(
        `[GitLabGraphQL] Reached max pages limit (${maxPages}). Some data may not be loaded.`,
      );
    }

    return allNodes;
  }

  /**
   * Fetch filter options (members, labels, milestones) for server-side filtering
   * This should be called before sync to allow users to set filters immediately
   * All queries support pagination to handle large datasets (>100 items)
   */
  async getFilterOptions(): Promise<GitLabFilterOptionsData> {
    const fullPath = this.getFullPath();
    const membersField =
      this.config.type === 'group' ? 'groupMembers' : 'projectMembers';

    // Paginated query for members
    const membersQuery = `
      query getMembers($fullPath: ID!, $after: String) {
        ${this.config.type}(fullPath: $fullPath) {
          ${membersField}(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              user {
                username
                name
              }
            }
          }
        }
      }
    `;

    // Paginated query for milestones
    const milestonesQuery = `
      query getMilestones($fullPath: ID!, $after: String) {
        ${this.config.type}(fullPath: $fullPath) {
          milestones(state: active, first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              iid
              title
            }
          }
        }
      }
    `;

    // GitLab REST API label response type
    interface GitLabRestLabel {
      name: string;
      color: string;
      priority: number | null;
    }

    try {
      // Fetch members, milestones, and labels in parallel with pagination support
      const labelsEndpoint =
        this.config.type === 'project'
          ? `/projects/${encodeURIComponent(fullPath)}/labels`
          : `/groups/${encodeURIComponent(fullPath)}/labels?include_ancestor_groups=true`;

      const [membersNodes, milestonesNodes, labelsFromRest] = await Promise.all(
        [
          // Paginated members query
          this.queryPaginated<{
            user: { username: string; name: string } | null;
          }>(membersQuery, { fullPath }, (result) =>
            this.extractPaginatedData(result, membersField),
          ),
          // Paginated milestones query
          this.queryPaginated<{ iid: string; title: string }>(
            milestonesQuery,
            { fullPath },
            (result) => this.extractPaginatedData(result, 'milestones'),
          ),
          // Paginated labels via REST API
          gitlabRestRequestPaginated<GitLabRestLabel>(labelsEndpoint, {
            gitlabUrl: this.config.gitlabUrl,
            token: this.config.token,
          }),
        ],
      );

      // Extract members (filter out null users)
      const members: GitLabFilterOptionsData['members'] = membersNodes
        .filter((node) => node.user !== null)
        .map((node) => ({
          username: node.user!.username,
          name: node.user!.name,
        }));

      // Extract labels from REST API (includes priority for projects)
      const labels: GitLabFilterOptionsData['labels'] = (
        labelsFromRest || []
      ).map((label) => ({
        title: label.name,
        color: label.color,
        priority: label.priority ?? null,
      }));

      // Extract milestones
      const milestones: GitLabFilterOptionsData['milestones'] =
        milestonesNodes.map((node) => ({
          iid: Number(node.iid),
          title: node.title,
        }));

      return { members, labels, milestones };
    } catch (error) {
      console.error(
        '[GitLabGraphQLProvider] Failed to fetch filter options:',
        error,
      );
      return { members: [], labels: [], milestones: [] };
    }
  }

  /**
   * Fetch all work items (issues) using GraphQL
   *
   * @param options - Sync options including filters
   * @param options.signal - Optional AbortSignal for request cancellation
   * @param options.onProgress - Optional callback for progress updates
   */
  async getData(
    options: GitLabSyncOptions & {
      enablePagination?: boolean;
      signal?: AbortSignal;
      onProgress?: SyncProgressCallback;
    } = {},
  ): Promise<GitLabDataResponse> {
    const { signal, onProgress } = options;
    // Fetching work items and milestones

    // Query for work items with pagination
    // Supports server-side filtering via labelName, milestoneTitle/milestoneWildcardId, assigneeUsernames/assigneeWildcardId, createdAfter/Before
    // Note: milestoneTitle and milestoneWildcardId are mutually exclusive
    // Note: assigneeUsernames and assigneeWildcardId are mutually exclusive
    const workItemsQuery = `
      query getWorkItems(
        $fullPath: ID!,
        $state: IssuableState,
        $after: String,
        $labelName: [String!],
        $milestoneTitle: [String!],
        $milestoneWildcardId: MilestoneWildcardId,
        $assigneeUsernames: [String!],
        $assigneeWildcardId: AssigneeWildcardId,
        $createdAfter: Time,
        $createdBefore: Time
      ) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(
            types: [ISSUE, TASK],
            state: $state,
            first: 100,
            after: $after,
            labelName: $labelName,
            milestoneTitle: $milestoneTitle,
            milestoneWildcardId: $milestoneWildcardId,
            assigneeUsernames: $assigneeUsernames,
            assigneeWildcardId: $assigneeWildcardId,
            createdAfter: $createdAfter,
            createdBefore: $createdBefore
          ) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              iid
              title
              createdAt
              closedAt
              state
              webUrl
              workItemType {
                name
              }
              widgets {
                __typename
                ... on WorkItemWidgetDescription {
                  description
                }
                ... on WorkItemWidgetStartAndDueDate {
                  startDate
                  dueDate
                }
                ... on WorkItemWidgetAssignees {
                  assignees {
                    nodes {
                      id
                      name
                      username
                    }
                  }
                }
                ... on WorkItemWidgetLabels {
                  labels {
                    nodes {
                      id
                      title
                    }
                  }
                }
                ... on WorkItemWidgetWeight {
                  weight
                }
                ... on WorkItemWidgetMilestone {
                  milestone {
                    id
                    iid
                    title
                    description
                    state
                    dueDate
                    startDate
                    webPath
                    createdAt
                  }
                }
                ... on WorkItemWidgetIteration {
                  iteration {
                    id
                    iid
                    title
                    startDate
                    dueDate
                    iterationCadence {
                      id
                      title
                    }
                  }
                }
                ... on WorkItemWidgetHierarchy {
                  parent {
                    id
                    iid
                    title
                    workItemType {
                      name
                    }
                  }
                  children {
                    nodes {
                      id
                      iid
                    }
                  }
                }
                ... on WorkItemWidgetLinkedItems {
                  linkedItems {
                    nodes {
                      linkId
                      linkType
                      linkCreatedAt
                      linkUpdatedAt
                      workItem {
                        id
                        iid
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    // Query for milestones with pagination
    const milestonesQuery = `
      query getMilestones($fullPath: ID!, $after: String) {
        ${this.config.type}(fullPath: $fullPath) {
          milestones(state: active, first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              iid
              title
              description
              state
              dueDate
              startDate
              webPath
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    // Query for issues to get relativePosition (Issue API supports this field) with pagination
    // Also supports server-side filtering to match workItems query
    // Note: milestoneTitle and milestoneWildcardId are mutually exclusive
    // Note: assigneeUsernames and assigneeWildcardId are mutually exclusive
    //
    // IMPORTANT: GitLab API difference between project and group:
    // - Project issues: milestoneTitle accepts String (single value)
    // - Group issues: milestoneTitle accepts [String] (array)
    const milestoneTitleType =
      this.config.type === 'group' ? '[String!]' : 'String';
    console.log(
      '[GitLabGraphQL] issuesQuery configType:',
      this.config.type,
      'milestoneTitleType:',
      milestoneTitleType,
    );
    const issuesQuery = `
      query getIssues(
        $fullPath: ID!,
        $state: IssuableState,
        $after: String,
        $labelName: [String!],
        $milestoneTitle: ${milestoneTitleType},
        $milestoneWildcardId: MilestoneWildcardId,
        $assigneeUsernames: [String!],
        $assigneeWildcardId: AssigneeWildcardId,
        $createdAfter: Time,
        $createdBefore: Time
      ) {
        ${this.config.type}(fullPath: $fullPath) {
          issues(
            state: $state,
            first: 100,
            after: $after,
            labelName: $labelName,
            milestoneTitle: $milestoneTitle,
            milestoneWildcardId: $milestoneWildcardId,
            assigneeUsernames: $assigneeUsernames,
            assigneeWildcardId: $assigneeWildcardId,
            createdAfter: $createdAfter,
            createdBefore: $createdBefore
          ) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              iid
              relativePosition
            }
          }
        }
      }
    `;

    // Build server filter variables (shared between workItems and issues queries)
    const serverFilters = options.serverFilters;
    const baseVariables: any = {
      fullPath: this.getFullPath(),
      state: options.includeClosed ? undefined : 'opened',
    };

    // Add server-side filter variables if present
    if (serverFilters?.labelNames?.length) {
      baseVariables.labelName = serverFilters.labelNames;
    }
    // Handle assignee filtering - assigneeUsernames and assigneeWildcardId are mutually exclusive
    if (serverFilters?.assigneeUsernames?.length) {
      const hasNone = serverFilters.assigneeUsernames.includes('NONE');
      const otherUsernames = serverFilters.assigneeUsernames.filter(
        (u) => u !== 'NONE',
      );

      if (hasNone && otherUsernames.length === 0) {
        // Only NONE selected - use wildcard to find unassigned items
        baseVariables.assigneeWildcardId = 'NONE';
      } else if (otherUsernames.length > 0) {
        // Has specific usernames - use assigneeUsernames (cannot combine with wildcard)
        // Note: If NONE is also selected, we can only filter by usernames (API limitation)
        baseVariables.assigneeUsernames = otherUsernames;
      }
    }
    if (serverFilters?.createdAfter) {
      baseVariables.createdAfter = serverFilters.createdAfter;
    }
    if (serverFilters?.createdBefore) {
      baseVariables.createdBefore = serverFilters.createdBefore;
    }

    // Handle milestone filtering - milestoneTitle and milestoneWildcardId are mutually exclusive
    // Check for NONE in milestoneTitles
    const milestoneHasNone = serverFilters?.milestoneTitles?.includes('NONE');
    const otherMilestoneTitles = serverFilters?.milestoneTitles?.filter(
      (t) => t !== 'NONE',
    );

    // Variables for workItems query (milestoneTitle accepts array)
    const variables: any = {
      ...baseVariables,
    };

    // Variables for issues query (milestoneTitle accepts single string only)
    const issuesVariables: any = {
      ...baseVariables,
    };

    // Apply milestone filter based on selection
    if (
      milestoneHasNone &&
      (!otherMilestoneTitles || otherMilestoneTitles.length === 0)
    ) {
      // Only NONE selected - use wildcard to find items without milestone
      variables.milestoneWildcardId = 'NONE';
      issuesVariables.milestoneWildcardId = 'NONE';
    } else if (otherMilestoneTitles && otherMilestoneTitles.length > 0) {
      // Has specific milestone titles - use milestoneTitle (cannot combine with wildcard)
      // Note: If NONE is also selected, we can only filter by titles (API limitation)
      variables.milestoneTitle = otherMilestoneTitles;
      // Project issues accept String (single), Group issues accept [String] (array)
      issuesVariables.milestoneTitle =
        this.config.type === 'group'
          ? otherMilestoneTitles
          : otherMilestoneTitles[0];
    }

    // Fetch work items with optional pagination
    const enablePagination = options.enablePagination !== false; // Default to true
    const MAX_PAGES = 20; // 100 × 20 = 2000 items max
    const allWorkItems: WorkItem[] = [];
    let hasNextPage = true;
    let endCursor: string | null = null;
    let pageCount = 0;

    while (hasNextPage && pageCount < MAX_PAGES) {
      checkAborted(signal);

      const paginatedVariables = { ...variables, after: endCursor };
      const workItemsResult = await this.graphqlClient.query<WorkItemsResponse>(
        workItemsQuery,
        paginatedVariables,
        signal,
      );

      const workItemsData =
        this.config.type === 'group'
          ? workItemsResult.group?.workItems
          : workItemsResult.project?.workItems;

      if (workItemsData) {
        allWorkItems.push(...workItemsData.nodes);
        hasNextPage = workItemsData.pageInfo?.hasNextPage || false;
        endCursor = workItemsData.pageInfo?.endCursor || null;
        pageCount++;

        reportProgress(onProgress, 'workItems', pageCount, allWorkItems.length);
      } else {
        hasNextPage = false;
      }
    }

    if (pageCount === MAX_PAGES && hasNextPage) {
      console.warn(
        `[GitLabGraphQL] Reached page limit (${MAX_PAGES}). ${enablePagination ? 'Some work items may not be loaded. Consider increasing MAX_PAGES.' : 'Enable pagination to load more items.'}`,
      );
    }

    console.log(
      `[GitLabGraphQL] Fetched ${allWorkItems.length} work items in ${pageCount} page(s)`,
    );

    // IMPORTANT: Group Work Items API Fallback
    // ========================================
    // GitLab's group-level workItems query may return empty results in some cases:
    // 1. GitLab version doesn't support group-level work items
    // 2. Group work items feature is disabled
    // 3. Permission restrictions
    //
    // When this happens, we fall back to using the Issues API which has better
    // group-level support. The Issues API returns basic issue data, and we
    // construct a minimal workItem-like structure for consistency.
    if (allWorkItems.length === 0 && this.config.type === 'group') {
      console.log(
        '[GitLabGraphQL] No work items from Group API, attempting Issues API fallback...',
      );

      // Fetch full issue data as fallback for groups
      const fallbackIssuesQuery = `
        query getGroupIssuesFallback(
          $fullPath: ID!,
          $state: IssuableState,
          $after: String,
          $labelName: [String!],
          $milestoneTitle: [String!],
          $milestoneWildcardId: MilestoneWildcardId,
          $assigneeUsernames: [String!],
          $assigneeWildcardId: AssigneeWildcardId,
          $createdAfter: Time,
          $createdBefore: Time
        ) {
          group(fullPath: $fullPath) {
            issues(
              state: $state,
              first: 100,
              after: $after,
              labelName: $labelName,
              milestoneTitle: $milestoneTitle,
              milestoneWildcardId: $milestoneWildcardId,
              assigneeUsernames: $assigneeUsernames,
              assigneeWildcardId: $assigneeWildcardId,
              createdAfter: $createdAfter,
              createdBefore: $createdBefore
            ) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                iid
                title
                description
                createdAt
                closedAt
                state
                webUrl
                relativePosition
                dueDate
                weight
                assignees {
                  nodes {
                    id
                    name
                    username
                  }
                }
                labels {
                  nodes {
                    id
                    title
                  }
                }
                milestone {
                  id
                  iid
                  title
                  description
                  state
                  dueDate
                  startDate
                  webPath
                  createdAt
                }
              }
            }
          }
        }
      `;

      // Fetch issues using the group-compatible variables
      hasNextPage = true;
      endCursor = null;
      pageCount = 0;
      const MAX_FALLBACK_PAGES = 20;

      while (hasNextPage && pageCount < MAX_FALLBACK_PAGES) {
        checkAborted(signal);

        try {
          const fallbackResult = await this.graphqlClient.query<any>(
            fallbackIssuesQuery,
            { ...issuesVariables, after: endCursor },
            signal,
          );

          const issuesData = fallbackResult.group?.issues;
          if (issuesData && issuesData.nodes.length > 0) {
            // Convert Issue format to WorkItem-like format for consistency
            for (const issue of issuesData.nodes) {
              const workItemLike: WorkItem = {
                id: `gid://gitlab/Issue/${issue.iid}`, // Synthetic ID
                iid: String(issue.iid),
                title: issue.title,
                createdAt: issue.createdAt,
                closedAt: issue.closedAt,
                state: issue.state,
                webUrl: issue.webUrl,
                workItemType: { name: 'Issue' }, // Issues are always type Issue
                widgets: [
                  {
                    __typename: 'WorkItemWidgetDescription',
                    description: issue.description,
                  },
                  {
                    __typename: 'WorkItemWidgetStartAndDueDate',
                    startDate: null,
                    dueDate: issue.dueDate,
                  },
                  {
                    __typename: 'WorkItemWidgetAssignees',
                    assignees: { nodes: issue.assignees?.nodes || [] },
                  },
                  {
                    __typename: 'WorkItemWidgetLabels',
                    labels: { nodes: issue.labels?.nodes || [] },
                  },
                  {
                    __typename: 'WorkItemWidgetWeight',
                    weight: issue.weight,
                  },
                  ...(issue.milestone
                    ? [
                        {
                          __typename: 'WorkItemWidgetMilestone',
                          milestone: issue.milestone,
                        },
                      ]
                    : []),
                ],
              };
              allWorkItems.push(workItemLike);
            }
            hasNextPage = issuesData.pageInfo?.hasNextPage || false;
            endCursor = issuesData.pageInfo?.endCursor || null;
            pageCount++;

            reportProgress(
              onProgress,
              'workItems',
              pageCount,
              allWorkItems.length,
            );
          } else {
            hasNextPage = false;
          }
        } catch (fallbackError) {
          console.warn(
            '[GitLabGraphQL] Issues API fallback failed:',
            fallbackError,
          );
          hasNextPage = false;
        }
      }

      console.log(
        `[GitLabGraphQL] Fallback: Fetched ${allWorkItems.length} issues as work items`,
      );

      // IMPORTANT: Group Work Items API Limitation
      // ==========================================
      // GitLab's group-level workItem(iid:) query returns null for all items.
      // This is a known limitation - Work Items API at group level is restricted.
      //
      // Solution: Extract Project path from each issue's webUrl and query at PROJECT level.
      // Issues in a group come from different projects, so we need to:
      // 1. Group issues by their source project (extracted from webUrl)
      // 2. Query each project's workItem API to get hierarchy and tasks
      //
      // Example webUrl: https://gitlab.com/group/project/-/issues/123
      // Extracted project path: group/project
      console.log(
        '[GitLabGraphQL] Fetching work item details from source projects for hierarchy...',
      );

      // Helper function to extract project path from webUrl
      const extractProjectPath = (webUrl: string): string | null => {
        // Pattern: https://gitlab.com/namespace/project/-/issues/123
        // or: https://gitlab.example.com/group/subgroup/project/-/issues/123
        // or: https://gitlab.example.com/group/subgroup/project/-/work_items/123
        const match = webUrl.match(
          /^https?:\/\/[^/]+\/(.+?)\/-\/(?:issues|work_items)\/\d+/,
        );
        return match ? match[1] : null;
      };

      // Query to get work items with children by IIDs (PROJECT level, not group)
      // NOTE: We use workItems(iids: [...]) instead of workItem(iid:) because:
      // 1. workItem(iid:) is a newer API that may not exist in older GitLab versions
      // 2. workItems with iids filter allows batch querying multiple items at once
      const workItemsByIidsQuery = `
        query getWorkItemsByIids($fullPath: ID!, $iids: [String!]) {
          project(fullPath: $fullPath) {
            workItems(iids: $iids, first: 100) {
              nodes {
                id
                iid
                title
                createdAt
                closedAt
                state
                webUrl
                workItemType {
                  name
                }
                widgets {
                  __typename
                  ... on WorkItemWidgetDescription {
                    description
                  }
                  ... on WorkItemWidgetStartAndDueDate {
                    startDate
                    dueDate
                  }
                  ... on WorkItemWidgetAssignees {
                    assignees {
                      nodes {
                        id
                        name
                        username
                      }
                    }
                  }
                  ... on WorkItemWidgetLabels {
                    labels {
                      nodes {
                        id
                        title
                      }
                    }
                  }
                  ... on WorkItemWidgetWeight {
                    weight
                  }
                  ... on WorkItemWidgetMilestone {
                    milestone {
                      id
                      iid
                      title
                      description
                      state
                      dueDate
                      startDate
                      webPath
                      createdAt
                    }
                  }
                  ... on WorkItemWidgetHierarchy {
                    parent {
                      id
                      iid
                      title
                      workItemType {
                        name
                      }
                    }
                    children {
                      nodes {
                        id
                        iid
                        title
                        createdAt
                        closedAt
                        state
                        webUrl
                        workItemType {
                          name
                        }
                        widgets {
                          __typename
                          ... on WorkItemWidgetDescription {
                            description
                          }
                          ... on WorkItemWidgetStartAndDueDate {
                            startDate
                            dueDate
                          }
                          ... on WorkItemWidgetAssignees {
                            assignees {
                              nodes {
                                id
                                name
                                username
                              }
                            }
                          }
                          ... on WorkItemWidgetLabels {
                            labels {
                              nodes {
                                id
                                title
                              }
                            }
                          }
                          ... on WorkItemWidgetWeight {
                            weight
                          }
                          ... on WorkItemWidgetMilestone {
                            milestone {
                              id
                              iid
                              title
                            }
                          }
                          ... on WorkItemWidgetHierarchy {
                            parent {
                              id
                              iid
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      // Collect all tasks from issue children
      const allTasks: WorkItem[] = [];

      // Group issues by their source project (extracted from webUrl)
      // This is necessary because group-level workItem(iid:) returns null,
      // so we must query at project level instead.
      const issuesByProject = new Map<
        string,
        Array<{ iid: string; index: number }>
      >();

      for (let i = 0; i < allWorkItems.length; i++) {
        const wi = allWorkItems[i];
        const projectPath = extractProjectPath(wi.webUrl);
        if (projectPath) {
          if (!issuesByProject.has(projectPath)) {
            issuesByProject.set(projectPath, []);
          }
          issuesByProject.get(projectPath)!.push({ iid: wi.iid, index: i });
        } else {
          console.warn(
            `[GitLabGraphQL] Could not extract project path from webUrl: ${wi.webUrl}`,
          );
        }
      }

      console.log(
        `[GitLabGraphQL] Will fetch work item details from ${issuesByProject.size} projects for ${allWorkItems.length} issues`,
      );

      // Batch fetch work items to get hierarchy
      // Using workItems(iids: [...]) for batch querying (more efficient and compatible with older GitLab)
      const BATCH_SIZE = 50; // Can fetch more at once with batch query
      let successCount = 0;
      let failCount = 0;

      // Build a map of iid -> index for quick lookup
      const iidToIndexMap = new Map<string, number>();
      for (let i = 0; i < allWorkItems.length; i++) {
        iidToIndexMap.set(allWorkItems[i].iid, i);
      }

      // Process each project's issues
      for (const [projectPath, issues] of issuesByProject.entries()) {
        console.log(
          `[GitLabGraphQL] Fetching ${issues.length} work items from project: ${projectPath}`,
        );

        // Batch within each project
        for (let i = 0; i < issues.length; i += BATCH_SIZE) {
          checkAborted(signal);

          const batch = issues.slice(i, i + BATCH_SIZE);
          const iids = batch.map((b) => b.iid);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(issues.length / BATCH_SIZE);
          console.log(
            `[GitLabGraphQL] Project ${projectPath} batch ${batchNumber}/${totalBatches}, ${iids.length} iids`,
          );

          reportProgress(
            onProgress,
            'hierarchy',
            batchNumber,
            successCount,
            totalBatches,
            `Fetching Hierarchy (${projectPath} ${batchNumber}/${totalBatches})...`,
          );

          try {
            const result = await this.graphqlClient.query<any>(
              workItemsByIidsQuery,
              { fullPath: projectPath, iids },
              signal,
            );

            // IMPORTANT: Use result.project (not result.group) because we're querying at project level
            const workItems = result.project?.workItems?.nodes || [];
            console.log(
              `[GitLabGraphQL] Got ${workItems.length} work items from project ${projectPath}`,
            );

            for (const workItem of workItems) {
              if (!workItem) continue;

              successCount++;

              // Find and update the corresponding issue in allWorkItems
              const index = iidToIndexMap.get(workItem.iid);
              if (index !== undefined) {
                allWorkItems[index] = workItem;
              }

              // Extract child tasks
              const hierarchyWidget = workItem.widgets?.find(
                (w: any) => w.__typename === 'WorkItemWidgetHierarchy',
              );
              const children = hierarchyWidget?.children?.nodes || [];

              for (const child of children) {
                // Only add if not already in the list
                if (!allWorkItems.some((wi) => wi.iid === child.iid)) {
                  allTasks.push(child);
                }
              }
            }

            // Count items that weren't returned
            const returnedIids = new Set(workItems.map((wi: any) => wi.iid));
            for (const iid of iids) {
              if (!returnedIids.has(iid)) {
                failCount++;
              }
            }
          } catch (err) {
            // Batch fetch failed, count all as failed
            failCount += iids.length;
            console.warn(
              `[GitLabGraphQL] Failed to fetch work items batch from project ${projectPath}:`,
              err instanceof Error ? err.message : err,
            );
          }
        }
      }

      // Summary of work item fetch results
      console.log(
        `[GitLabGraphQL] Work item details fetch complete: ${successCount} success, ${failCount} not found/failed`,
      );

      // Add all tasks to work items
      if (allTasks.length > 0) {
        console.log(
          `[GitLabGraphQL] Found ${allTasks.length} child tasks from hierarchy`,
        );
        allWorkItems.push(...allTasks);
      } else {
        console.log(
          '[GitLabGraphQL] No child tasks found from hierarchy queries',
        );
      }
    }

    // Fetch milestones (usually fewer, so use smaller limit)
    // Report progress for milestones
    reportProgress(onProgress, 'milestones', 1, 0);

    const allMilestones: GitLabMilestone[] = [];
    hasNextPage = true;
    endCursor = null;
    pageCount = 0;
    const MAX_MILESTONE_PAGES = enablePagination ? 2 : 1; // Maximum 200 milestones if pagination enabled

    while (hasNextPage && pageCount < MAX_MILESTONE_PAGES) {
      checkAborted(signal);

      const milestonesResult = await this.graphqlClient.query<any>(
        milestonesQuery,
        {
          fullPath: this.getFullPath(),
          after: endCursor,
        },
        signal,
      );

      const milestonesData =
        this.config.type === 'group'
          ? milestonesResult.group?.milestones
          : milestonesResult.project?.milestones;

      if (milestonesData) {
        allMilestones.push(...milestonesData.nodes);
        hasNextPage = milestonesData.pageInfo?.hasNextPage || false;
        endCursor = milestonesData.pageInfo?.endCursor || null;
        pageCount++;

        reportProgress(
          onProgress,
          'milestones',
          pageCount,
          allMilestones.length,
        );
      } else {
        hasNextPage = false;
      }
    }

    console.log(`[GitLabGraphQL] Fetched ${allMilestones.length} milestones`);

    // Fetch issues for relativePosition (same limit as work items)
    reportProgress(onProgress, 'issues', 1, 0);

    const allIssuesWithPosition: { iid: string; relativePosition: number }[] =
      [];
    hasNextPage = true;
    endCursor = null;
    pageCount = 0;

    try {
      const MAX_ISSUE_PAGES = 20; // 100 × 20 = 2000 items max, same as work items
      while (hasNextPage && pageCount < MAX_ISSUE_PAGES) {
        checkAborted(signal);

        const issuesResult = await this.graphqlClient.query<any>(
          issuesQuery,
          {
            ...issuesVariables,
            after: endCursor,
          },
          signal,
        );

        const issuesData =
          this.config.type === 'group'
            ? issuesResult.group?.issues
            : issuesResult.project?.issues;

        if (issuesData) {
          allIssuesWithPosition.push(...issuesData.nodes);
          hasNextPage = issuesData.pageInfo?.hasNextPage || false;
          endCursor = issuesData.pageInfo?.endCursor || null;
          pageCount++;

          reportProgress(
            onProgress,
            'issues',
            pageCount,
            allIssuesWithPosition.length,
          );
        } else {
          hasNextPage = false;
        }
      }
    } catch (error) {
      // Re-throw abort errors, but log warning for other errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      console.warn(
        '[GitLabGraphQL] Failed to fetch Issue relativePosition, will fall back to IID sorting:',
        error,
      );
    }

    console.log(
      `[GitLabGraphQL] Fetched ${allIssuesWithPosition.length} issues with relativePosition`,
    );

    const workItems = allWorkItems;
    const milestones = allMilestones;

    // Build relativePosition map from Issue API results
    const relativePositionMap = new Map<number, number>();
    allIssuesWithPosition.forEach((issue: any) => {
      if (
        issue.relativePosition !== null &&
        issue.relativePosition !== undefined
      ) {
        relativePositionMap.set(Number(issue.iid), issue.relativePosition);
      }
    });

    // Build children order map for Tasks
    // For each parent, store the order of its children based on array index
    // Use ORDER_GAP spacing to match Gantt's order calculation
    const ORDER_GAP = 10; // Must match the value in GitLabGantt.jsx
    const childrenOrderMap = new Map<number, Map<number, number>>(); // parentIid -> (childIid -> order)

    for (const wi of workItems) {
      const hierarchyWidget = wi.widgets?.find(
        (w: any) => w.__typename === 'WorkItemWidgetHierarchy',
      ) as any;

      const children = hierarchyWidget?.children?.nodes || [];
      if (children.length > 0) {
        const parentIid = Number(wi.iid);
        const childOrderMap = new Map<number, number>();

        children.forEach((child: any, index: number) => {
          const childIid = Number(child.iid);
          // Use ORDER_GAP spacing (0, 10, 20, 30...) instead of raw index (0, 1, 2, 3...)
          // This matches how Gantt calculates order values for proper comparison
          childOrderMap.set(childIid, index * ORDER_GAP);
        });

        childrenOrderMap.set(parentIid, childOrderMap);
      }
    }

    // Convert milestones to tasks
    const milestoneTasks: ITask[] = milestones.map((m) =>
      this.convertMilestoneToTask(m),
    );

    // Create a set of existing milestone IIDs for quick lookup
    const existingMilestoneIids = new Set(milestones.map((m) => Number(m.iid)));

    // Collect milestones referenced by work items but not in our milestones list
    // This handles Group Milestones when viewing a Project
    const referencedMilestones = new Map<number, any>(); // iid -> milestone data

    for (const wi of workItems) {
      const milestoneWidget = wi.widgets?.find(
        (w: any) => w.milestone !== undefined,
      ) as any;

      if (milestoneWidget?.milestone) {
        const milestoneIid = Number(milestoneWidget.milestone.iid);
        if (
          !existingMilestoneIids.has(milestoneIid) &&
          !referencedMilestones.has(milestoneIid)
        ) {
          // This milestone is not in our list - likely a Group Milestone
          referencedMilestones.set(milestoneIid, milestoneWidget.milestone);
          console.log(
            `[GitLabGraphQL] Found referenced milestone not in list (possibly Group Milestone): iid=${milestoneIid}, title="${milestoneWidget.milestone.title}"`,
          );
        }
      }
    }

    // Convert referenced milestones (Group Milestones) to tasks
    // These are milestones not in the project/group milestone list but referenced by work items
    // When in Project mode, these are likely Group Milestones
    const isProjectMode = this.config.type === 'project';
    const referencedMilestoneTasks: ITask[] = Array.from(
      referencedMilestones.values(),
    ).map((m) => this.convertMilestoneToTask(m, isProjectMode)); // Mark as Group Milestone if in Project mode

    if (referencedMilestoneTasks.length > 0) {
      console.log(
        `[GitLabGraphQL] Added ${referencedMilestoneTasks.length} Group Milestone(s) from work item references`,
      );
    }

    // Convert work items to tasks (with relativePosition map and children order map)
    const workItemTasks: ITask[] = workItems.map((wi) =>
      this.convertWorkItemToTask(wi, relativePositionMap, childrenOrderMap),
    );

    // Combine all tasks (including referenced Group Milestones)
    let tasks: ITask[] = [
      ...milestoneTasks,
      ...referencedMilestoneTasks,
      ...workItemTasks,
    ];

    // Sort tasks by display order if available
    tasks = this.sortTasksByOrder(tasks);

    // Calculate spanning dates for parent tasks
    tasks = this.calculateSpanningDates(tasks);

    // LOG: Validate final tasks structure before returning
    tasks.forEach((task, index) => {
      if (!task.id || !task.text) {
        console.error(`[GitLabGraphQL] Invalid task at index ${index}:`, task);
      }
    });

    // Fetch links (related work items)
    const links = await this.fetchWorkItemLinks(workItems);

    // Fetch epics (only for group level)
    const epics = await this.fetchEpics();

    return {
      tasks,
      links,
      milestones: [], // Milestones are now included in tasks
      epics, // Return fetched epics
    };
  }

  /**
   * Sort tasks by display order (within same parent)
   * Special handling for root level: Milestones sorted by date, Issues by displayOrder
   * displayOrder comes from description metadata or relativePosition (from Issue API)
   */
  private sortTasksByOrder(tasks: ITask[]): ITask[] {
    // Group tasks by parent
    const tasksByParent = new Map<number, ITask[]>();
    tasks.forEach((task) => {
      const parentId = task.parent || 0;
      if (!tasksByParent.has(parentId)) {
        tasksByParent.set(parentId, []);
      }
      tasksByParent.get(parentId)!.push(task);
    });

    // Sort each parent group
    const sortedTasks: ITask[] = [];
    tasksByParent.forEach((parentTasks, parentId) => {
      if (parentId === 0) {
        // Root level: separate milestones and issues
        const milestones = parentTasks.filter(
          (t) => t._gitlab?.type === 'milestone',
        );
        const issues = parentTasks.filter(
          (t) => t._gitlab?.type !== 'milestone',
        );

        // Sort milestones by due date > start date > title
        milestones.sort((a, b) => {
          if (a.end && b.end) {
            return a.end.getTime() - b.end.getTime();
          }
          if (a.end) return -1;
          if (b.end) return 1;
          if (a.start && b.start) {
            return a.start.getTime() - b.start.getTime();
          }
          if (a.start) return -1;
          if (b.start) return 1;
          return (a.text || '').localeCompare(b.text || '');
        });

        // Sort issues by displayOrder (ascending, nulls last) > id
        issues.sort((a, b) => {
          const orderA = a.$custom?.displayOrder;
          const orderB = b.$custom?.displayOrder;

          // Both have order: sort by order value
          if (
            orderA !== undefined &&
            orderA !== null &&
            orderB !== undefined &&
            orderB !== null
          ) {
            return orderA - orderB;
          }
          // Only A has order: A comes first
          if (orderA !== undefined && orderA !== null) return -1;
          // Only B has order: B comes first
          if (orderB !== undefined && orderB !== null) return 1;
          // Neither has order: sort by id
          return Number(a.id) - Number(b.id);
        });

        // Milestones first, then issues
        sortedTasks.push(...milestones, ...issues);
      } else {
        // Non-root level: sort by displayOrder (ascending, nulls last) > id
        parentTasks.sort((a, b) => {
          const orderA = a.$custom?.displayOrder;
          const orderB = b.$custom?.displayOrder;

          // Both have order: sort by order value
          if (
            orderA !== undefined &&
            orderA !== null &&
            orderB !== undefined &&
            orderB !== null
          ) {
            return orderA - orderB;
          }
          // Only A has order: A comes first
          if (orderA !== undefined && orderA !== null) return -1;
          // Only B has order: B comes first
          if (orderB !== undefined && orderB !== null) return 1;
          // Neither has order: sort by id
          return Number(a.id) - Number(b.id);
        });

        sortedTasks.push(...parentTasks);
      }
    });

    return sortedTasks;
  }

  /**
   * Calculate spanning dates for parent tasks that have subtasks
   * Main bar shows task's own dates (adjustable)
   * Baseline bar shows the span of all subtasks (read-only reference)
   */
  private calculateSpanningDates(tasks: ITask[]): ITask[] {
    return tasks.map((task) => {
      // Find all direct children of this task
      const children = tasks.filter((t) => t.parent === task.id);

      if (children.length > 0) {
        // This task has children, calculate spanning range
        const childStarts = children
          .map((c) => c.start)
          .filter((s): s is Date => s !== undefined);
        const childEnds = children
          .map((c) => c.end)
          .filter((e): e is Date => e !== undefined);

        if (childStarts.length > 0 && childEnds.length > 0) {
          const spanStart = new Date(
            Math.min(...childStarts.map((d) => d.getTime())),
          );
          const spanEnd = new Date(
            Math.max(...childEnds.map((d) => d.getTime())),
          );

          // Parent task keeps its own dates from GitLab (start_date/due_date)
          // Baseline shows the span of all children for reference
          return {
            ...task,
            // Keep the task's type unchanged (milestone stays as 'milestone', issues stay as they are)
            // Milestone type will be rendered with purple color via CSS
            $parent: true, // Custom flag for CSS styling
            // Keep task's own dates - these are independent and adjustable
            // start, end, duration remain unchanged from GitLab
            // Store children's span as baseline for reference
            base_start: spanStart,
            base_end: spanEnd,
          };
        }
      }

      // For tasks without children, don't set baseline at all
      return task;
    });
  }

  /**
   * Convert GitLab Milestone to Gantt Task
   * @param milestone - The milestone data from GraphQL or REST API
   * @param isGroupMilestone - Whether this is a Group Milestone (for API endpoint selection)
   */
  private convertMilestoneToTask(
    milestone: any,
    isGroupMilestone: boolean = false,
  ): ITask {
    // Construct full web URL from webPath (GraphQL) or web_url (REST API)
    const webUrl = milestone.webPath
      ? `${this.config.gitlabUrl}${milestone.webPath}`
      : milestone.web_url || undefined;

    // Use string ID with prefix to avoid conflicts with work item IIDs
    // Format: "m-{iid}" (e.g., milestone iid=1 becomes "m-1")
    const milestoneTaskId = createMilestoneTaskId(milestone.iid);

    // Ensure milestones have valid dates with proper timezone handling
    // Handle both GraphQL (startDate/dueDate) and REST API (start_date/due_date) field names
    // If no start date, use creation date or today
    const startDateStr = milestone.startDate || milestone.start_date;
    const dueDateStr = milestone.dueDate || milestone.due_date;
    const createdAtStr = milestone.createdAt || milestone.created_at;

    const startDate = startDateStr
      ? new Date(startDateStr + 'T00:00:00')
      : createdAtStr
        ? new Date(createdAtStr)
        : new Date();

    // If no due date, use start date with end of day time to ensure visibility even for same-day milestones
    const endDate = dueDateStr
      ? new Date(dueDateStr + 'T23:59:59')
      : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Calculate duration in days (same logic as work items)
    const diffTime = endDate.getTime() - startDate.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, days);

    // Determine globalId and internalId:
    // - GraphQL returns id as "gid://gitlab/Milestone/1141"
    // - REST API returns id as numeric 1141, need to construct global ID
    let globalId: string;
    let internalId: number | undefined;

    if (typeof milestone.id === 'string' && milestone.id.startsWith('gid://')) {
      // GraphQL: extract internal ID from globalId
      globalId = milestone.id;
      const match = milestone.id.match(/\/Milestone\/(\d+)$/);
      if (match) {
        internalId = parseInt(match[1], 10);
      }
    } else if (typeof milestone.id === 'number') {
      // REST API: milestone.id is the internal ID
      globalId = `gid://gitlab/Milestone/${milestone.id}`;
      internalId = milestone.id;
    } else {
      // Fallback
      globalId = `gid://gitlab/Milestone/${milestone.id}`;
    }

    return {
      id: milestoneTaskId,
      text: milestone.title, // Don't add [Milestone] prefix - use icon in grid instead
      start: startDate,
      end: endDate,
      duration,
      type: 'task', // Use 'task' type to show bar with baseline support
      parent: 0, // Milestones are always at root level
      // DO NOT set open: true without data property - causes Gantt store error
      // Gantt will handle open state based on children
      details: milestone.description || '',
      // Sorting defaults (see ColumnSettingsDropdown.jsx for SORTING SUPPORT docs)
      displayOrder: 0,
      issueId: 0,
      iteration: '',
      epic: '',
      assigned: '',
      weight: 0,
      $isMilestone: true, // Custom flag for identifying milestones (for CSS styling)
      _gitlab: {
        type: 'milestone',
        id: milestone.iid,
        internalId, // Store internal ID for REST API calls (different from iid)
        globalId, // Store global ID for mutations (constructed if from REST API)
        web_url: webUrl,
        isGroupMilestone, // Whether this milestone belongs to a Group (affects API endpoint)
      },
    };
  }

  /**
   * Convert GraphQL WorkItem to Gantt Task
   * @param workItem - The WorkItem from GraphQL query
   * @param relativePositionMap - Map of IID to relativePosition from Issue API
   * @param childrenOrderMap - Map of parent IID to (child IID to order index)
   */
  private convertWorkItemToTask(
    workItem: WorkItem,
    relativePositionMap: Map<number, number> = new Map(),
    childrenOrderMap: Map<number, Map<number, number>> = new Map(),
  ): ITask {
    // Extract widgets
    const descriptionWidget = workItem.widgets.find(
      (w) => w.description !== undefined,
    );
    const dateWidget = workItem.widgets.find(
      (w) => w.startDate !== undefined || w.dueDate !== undefined,
    );
    const assigneesWidget = workItem.widgets.find(
      (w) => w.assignees !== undefined,
    );
    const labelsWidget = workItem.widgets.find((w) => w.labels !== undefined);
    const weightWidget = workItem.widgets.find((w) => w.weight !== undefined);
    const milestoneWidget = workItem.widgets.find(
      (w) => w.milestone !== undefined,
    ) as { milestone?: { id: string; iid: string; title: string } } | undefined;
    const iterationWidget = workItem.widgets.find(
      (w: any) => w.__typename === 'WorkItemWidgetIteration',
    ) as
      | {
          iteration?: {
            id: string;
            iid: string;
            title: string;
            startDate?: string;
            dueDate?: string;
            iterationCadence?: { id: string; title: string };
          };
        }
      | undefined;

    const hierarchyWidget = workItem.widgets.find(
      (w) => w.parent !== undefined || w.children !== undefined,
    );

    // Determine start date: use startDate if available, otherwise use createdAt
    const startDate = dateWidget?.startDate
      ? new Date(dateWidget.startDate + 'T00:00:00')
      : new Date(workItem.createdAt);

    const endDate = dateWidget?.dueDate
      ? new Date(dateWidget.dueDate + 'T23:59:59')
      : undefined;

    // Calculate duration
    let duration: number | undefined;
    if (endDate) {
      // For date-only fields from GitLab:
      // - startDate represents start of day (00:00:00)
      // - dueDate represents end of day (23:59:59)
      // So same-day tasks (start=end) should have duration of 1 day
      const diffTime = endDate.getTime() - startDate.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Ensure minimum duration of 1 day
      duration = Math.max(1, days);
    }

    // Calculate progress based on state
    const progress = workItem.state === 'closed' ? 1 : 0;

    // Extract assignees - display names for Gantt column
    const assignees =
      assigneesWidget?.assignees?.nodes
        .map((a: { name?: string }) => a.name)
        .join(', ') || '';

    // Extract assignee usernames for Blueprint storage (use @username format)
    const assigneeUsernames =
      assigneesWidget?.assignees?.nodes
        .map((a: { username?: string }) =>
          a.username ? `@${a.username}` : null,
        )
        .filter(Boolean)
        .join(', ') || '';

    // Extract labels
    const labels =
      labelsWidget?.labels?.nodes.map((l) => l.title).join(', ') || '';

    // Extract description (no longer parsing metadata)
    const description = descriptionWidget?.description || '';

    // Determine parent field for Gantt display
    // IMPORTANT: The 'parent' field in our Gantt has different meanings:
    //
    // For GitLab Issues:
    //   - In GitLab API: Issues can have a parent Epic (through Epic relationship)
    //   - In GitLab API: Issues can belong to a Milestone (through milestone field)
    //   - In our Gantt: We use 'parent' field to show Issues under Milestones (parent = "m-{iid}")
    //   - In our Gantt: Epic parents are NOT supported, Issues with Epic parents appear at root with [Epic #] notation
    //
    // For GitLab Tasks:
    //   - In GitLab API: Tasks have hierarchical parent (another Issue or Task)
    //   - In our Gantt: We use 'parent' field to maintain this hierarchy (parent = parent.iid)
    //
    // Parent ID types:
    //   - 0: Root level (no parent)
    //   - number: Regular work item IID (Issues/Tasks)
    //   - string "m-{iid}": Milestone ID (e.g., "m-1", "m-8")

    let parent: number | string = 0;
    let parentIid: number | null = null;
    let epicParentId: number | null = null;
    let epicTitle: string | null = null;

    // Determine work item type
    const isIssue = workItem.workItemType?.name !== 'Task';

    // First, check if Issue has Epic parent (store for filtering regardless of milestone)
    // This must be done BEFORE determining display parent, because an Issue can have
    // both an Epic parent AND a Milestone - we want to store Epic for filtering
    if (isIssue && hierarchyWidget?.parent) {
      const parentType = (hierarchyWidget.parent as any).workItemType?.name;
      if (parentType === 'Epic') {
        // Store Epic parent ID for filtering
        // Note: We use iid because Epic API and WorkItem API return different global IDs
        // but iid is consistent across both APIs
        epicParentId = Number(hierarchyWidget.parent.iid);
        epicTitle = (hierarchyWidget.parent as any).title || null;
      }
    }

    // Now determine display parent (for Gantt hierarchy)
    // Priority for parent assignment:
    // 1. For Tasks: Use hierarchyWidget.parent (Task hierarchy)
    // 2. For Issues: Use Milestone first (for display), even if Epic parent exists
    // 3. For Issues without Milestone but with Epic: Show at root level

    if (!isIssue && hierarchyWidget?.parent) {
      // This is a Task with parent - use hierarchy
      parent = Number(hierarchyWidget.parent.iid);
      parentIid = parent;
    } else if (milestoneWidget?.milestone) {
      // Issue or Task belongs to a milestone - display under milestone
      // Note: epicParentId is already set above if Epic parent exists
      // Use string ID format "m-{iid}" to match milestone task IDs
      parent = createMilestoneTaskId(milestoneWidget.milestone.iid);
    } else if (isIssue && hierarchyWidget?.parent) {
      // Issue with parent but no Milestone
      const parentType = (hierarchyWidget.parent as any).workItemType?.name;
      if (parentType === 'Epic') {
        // Epic parent without Milestone - show at root level
        // epicParentId is already set above
        parent = 0;
      } else if (parentType) {
        // Issue has another Issue/Task as parent (unlikely but possible)
        parent = Number(hierarchyWidget.parent.iid);
        parentIid = parent;
      }
    }
    // else: standalone issue at root level (parent = 0)

    // Determine displayOrder based on whether this is a Task or Issue
    const iid = Number(workItem.iid);
    let finalOrder: number | undefined = undefined;

    if (parentIid !== null) {
      // This is a Task (has parent) - get order from children array index
      const parentChildrenMap = childrenOrderMap.get(parentIid);
      if (parentChildrenMap) {
        finalOrder = parentChildrenMap.get(iid);
      }
    } else {
      // This is a root-level Issue - get order from relativePosition
      finalOrder = relativePositionMap.get(iid);
    }

    // Always use 'task' type to avoid Gantt's auto-calculation for summary types
    // Use custom flag $isIssue to distinguish GitLab Issue from Task for styling
    // Note: isIssue already defined above at line 736

    const task: ITask = {
      id: Number(workItem.iid),
      text: workItem.title,
      start: startDate,
      end: endDate,
      duration,
      progress,
      type: 'task', // Always 'task' to prevent auto-calculation
      details: description,
      parent,
      labels,
      // Sorting defaults (see ColumnSettingsDropdown.jsx for SORTING SUPPORT docs)
      displayOrder: finalOrder ?? Number.MAX_SAFE_INTEGER,
      issueId: Number(workItem.iid),
      iteration: iterationWidget?.iteration
        ? formatIterationTitle(iterationWidget.iteration)
        : '',
      epic: epicTitle || '',
      assigned: assignees || '',
      weight: weightWidget?.weight ?? 0,
      state: workItem.state,
      web_url: workItem.webUrl,
      $isIssue: isIssue, // Custom flag: true for GitLab Issue, false for GitLab Task
      $custom:
        finalOrder !== null && finalOrder !== undefined
          ? { displayOrder: finalOrder }
          : undefined,
      _gitlab: {
        id: workItem.id, // Global ID
        iid: Number(workItem.iid),
        state: workItem.state,
        workItemType: workItem.workItemType?.name,
        startDate: dateWidget?.startDate, // Track if task has explicit start date
        dueDate: dateWidget?.dueDate, // Track if task has explicit due date
        epicParentId, // Store Epic parent ID if exists (for Issues without Milestone)
        epicTitle: epicTitle || undefined, // Epic title for display
        web_url: workItem.webUrl, // GitLab web URL for opening in browser
        // Assignee usernames for Blueprint storage (use @username format)
        assigneeUsernames: assigneeUsernames || undefined,
        // Milestone info for client-side filtering (not using parent field anymore)
        milestoneIid: milestoneWidget?.milestone
          ? Number(milestoneWidget.milestone.iid)
          : undefined,
        milestoneTitle: milestoneWidget?.milestone?.title,
        // Iteration info for display
        // GitLab iterations: cadence title (e.g. "Sprint 1") + date range (e.g. "Feb 1-28, 2026")
        iterationIid: iterationWidget?.iteration
          ? Number(iterationWidget.iteration.iid)
          : undefined,
        iterationTitle: iterationWidget?.iteration
          ? formatIterationTitle(iterationWidget.iteration)
          : undefined,
      },
    };

    // No need to add Epic notation - Epic and Milestone won't be mixed in GitLab

    return task;
  }

  /**
   * Update work item using GraphQL mutation
   * Uses queue to prevent race conditions
   */
  async updateWorkItem(id: TID, task: Partial<ITask>): Promise<void> {
    // Check if this is a milestone based on _gitlab.type
    // Previously used ID >= 10000 as a heuristic, but this fails for projects with 10000+ issues
    if (task._gitlab?.type === 'milestone') {
      return this.updateMilestone(id, task);
    }

    // Wait for any pending update for this task to complete
    const pendingUpdate = this.updateQueue.get(id);
    if (pendingUpdate) {
      await pendingUpdate;
    }

    // Create and store the update promise
    const updatePromise = this.performUpdate(id, task);
    this.updateQueue.set(id, updatePromise);

    try {
      await updatePromise;
    } finally {
      // Remove from queue when done
      this.updateQueue.delete(id);
    }
  }

  /**
   * Reorder an Issue using GitLab REST API
   * This uses the native /issues/:iid/reorder endpoint which updates relativePosition
   *
   * ⚠️ CRITICAL: GitLab REST API has INVERTED parameter behavior (confirmed bug)
   *
   * **Problem:**
   * - GitLab's REST API `/issues/:iid/reorder` has parameters that work opposite to their names
   * - This is inconsistent with the GraphQL API which works correctly
   *
   * **Evidence:**
   * - Tested on GitLab v18.2.6 (2025-01)
   * - When calling: PUT /issues/113/reorder with move_after_id=112
   *   - Expected: Issue #113 appears AFTER (below) Issue #112
   *   - Actual: Issue #113 appears BEFORE (above) Issue #112
   * - GraphQL API with `relativePosition: AFTER` works as expected
   *
   * **Workaround:**
   * - To place an issue AFTER another issue → use `move_before_id`
   * - To place an issue BEFORE another issue → use `move_after_id`
   * - This workaround is implemented below
   *
   * **References:**
   * - Test suite: demos/cases/TestReorderAPI.jsx
   * - GitLab API docs: https://docs.gitlab.com/ee/api/issues.html#reorder-an-issue
   *
   * @param issueIid - The IID (not global ID) of the issue to move
   * @param afterIssueId - The numeric ID (not global ID) of the issue to place this after
   */
  private async reorderIssue(
    issueIid: number,
    afterIssueId: number,
  ): Promise<void> {
    const projectPath = this.getFullPath();
    const endpoint = `/projects/${encodeURIComponent(projectPath)}/issues/${issueIid}/reorder`;

    // WORKAROUND: GitLab REST API has inverted parameters (confirmed via testing)
    // To move issue AFTER another issue, we must use move_before_id
    // See detailed explanation in function documentation above
    await gitlabRestRequest(
      endpoint,
      {
        gitlabUrl: this.config.gitlabUrl,
        token: this.config.token,
        isDev: this.isDev,
      },
      {
        method: 'PUT',
        body: JSON.stringify({
          move_before_id: afterIssueId, // ⚠️  INVERTED: use move_before_id to achieve "move AFTER" behavior
        }),
      },
    );
  }

  /**
   * Reorder an Issue to appear BEFORE another Issue using GitLab REST API
   * This uses the native /issues/:iid/reorder endpoint which updates relativePosition
   *
   * ⚠️ CRITICAL: GitLab REST API has INVERTED parameter behavior (confirmed bug)
   *
   * To place an issue BEFORE another issue, we must use `move_after_id` (inverted)
   * See detailed explanation in reorderIssue() documentation above.
   *
   * @param issueIid - The IID (not global ID) of the issue to move
   * @param beforeIssueId - The numeric ID (not global ID) of the issue to place this before
   */
  private async reorderIssueBefore(
    issueIid: number,
    beforeIssueId: number,
  ): Promise<void> {
    const projectPath = this.getFullPath();
    const endpoint = `/projects/${encodeURIComponent(projectPath)}/issues/${issueIid}/reorder`;

    // WORKAROUND: GitLab REST API has inverted parameters (confirmed via testing)
    // To move issue BEFORE another issue, we must use move_after_id
    // See detailed explanation in reorderIssue() documentation
    await gitlabRestRequest(
      endpoint,
      {
        gitlabUrl: this.config.gitlabUrl,
        token: this.config.token,
        isDev: this.isDev,
      },
      {
        method: 'PUT',
        body: JSON.stringify({
          move_after_id: beforeIssueId, // ⚠️  INVERTED: use move_after_id to achieve "move BEFORE" behavior
        }),
      },
    );
  }

  /**
   * Reorder a Task using GitLab GraphQL API
   * This uses hierarchyWidget with adjacentWorkItemId for parent-child ordering
   * @param taskGlobalId - The global ID of the task to move
   * @param afterTaskGlobalId - The global ID of the task to place this after
   */
  private async reorderTask(
    taskGlobalId: string,
    afterTaskGlobalId: string,
  ): Promise<void> {
    const mutation = `
      mutation {
        workItemUpdate(input: {
          id: "${taskGlobalId}",
          hierarchyWidget: {
            adjacentWorkItemId: "${afterTaskGlobalId}",
            relativePosition: AFTER
          }
        }) {
          workItem {
            id
            iid
          }
          errors
        }
      }
    `;

    const result = await this.graphqlClient.mutate<{
      workItemUpdate: {
        workItem: { id: string; iid: string };
        errors: string[];
      };
    }>(mutation, {});

    if (
      result.workItemUpdate.errors &&
      result.workItemUpdate.errors.length > 0
    ) {
      console.error(
        '[GitLabGraphQL] Task reorder errors:',
        result.workItemUpdate.errors,
      );
      throw new Error(
        `Failed to reorder task: ${result.workItemUpdate.errors.join(', ')}`,
      );
    }
  }

  /**
   * Reorder a Task to be BEFORE another task using GitLab GraphQL API
   * This uses hierarchyWidget with adjacentWorkItemId and relativePosition: BEFORE
   * @param taskGlobalId - The global ID of the task to move
   * @param beforeTaskGlobalId - The global ID of the task to place this before
   */
  private async reorderTaskBefore(
    taskGlobalId: string,
    beforeTaskGlobalId: string,
  ): Promise<void> {
    const mutation = `
      mutation {
        workItemUpdate(input: {
          id: "${taskGlobalId}",
          hierarchyWidget: {
            adjacentWorkItemId: "${beforeTaskGlobalId}",
            relativePosition: BEFORE
          }
        }) {
          workItem {
            id
            iid
          }
          errors
        }
      }
    `;

    const result = await this.graphqlClient.mutate<{
      workItemUpdate: {
        workItem: { id: string; iid: string };
        errors: string[];
      };
    }>(mutation, {});

    if (
      result.workItemUpdate.errors &&
      result.workItemUpdate.errors.length > 0
    ) {
      console.error(
        '[GitLabGraphQL] Task reorder before errors:',
        result.workItemUpdate.errors,
      );
      throw new Error(
        `Failed to reorder task before: ${result.workItemUpdate.errors.join(', ')}`,
      );
    }
  }

  /**
   * Reorder a single work item relative to a target work item
   * @param movedId - The IID of the work item to move
   * @param targetId - The IID of the target work item
   * @param mode - 'before' or 'after' the target
   */
  async reorderWorkItem(
    movedId: TID,
    targetId: TID,
    mode: 'before' | 'after',
  ): Promise<void> {
    // Get work item data for both moved and target
    const dataMap = await this.getBatchWorkItemsDataForReorder([
      movedId,
      targetId,
    ]);
    const movedData = dataMap.get(movedId);
    const targetData = dataMap.get(targetId);

    if (!movedData || !targetData) {
      throw new Error(
        `Failed to get work item data for reorder: moved=${movedId}, target=${targetId}`,
      );
    }

    // Determine if this is an Issue (root level) or Task (child level)
    const isTask = movedData.workItemType === 'Task' && movedData.hasParent;

    if (isTask) {
      // Use GraphQL for Tasks
      if (mode === 'before') {
        await this.reorderTaskBefore(movedData.globalId, targetData.globalId);
      } else {
        await this.reorderTask(movedData.globalId, targetData.globalId);
      }
    } else {
      // Use REST API for Issues
      if (mode === 'before') {
        // Use reorderIssueBefore which handles the inverted API behavior
        await this.reorderIssueBefore(Number(movedId), targetData.numericId);
      } else {
        await this.reorderIssue(Number(movedId), targetData.numericId);
      }
    }

    console.log(
      `[GitLabGraphQL] Successfully reordered ${movedId} ${mode} ${targetId}`,
    );
  }

  /**
   * Update task order using GitLab native reorder APIs
   * For Issues (root level): uses REST API /issues/:iid/reorder
   * For Tasks (child level): uses GraphQL hierarchyWidget.adjacentWorkItemId
   *
   * This method accepts tasks with order numbers and determines the correct
   * "move after" target by querying current sibling tasks from GitLab.
   */
  async updateTasksOrder(
    tasks: Array<{ id: TID; order: number }>,
  ): Promise<void> {
    console.log(
      `[GitLabGraphQL] Batch updating order for ${tasks.length} tasks using native APIs`,
    );

    // Sort tasks by order to get the target sequence
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

    // Batch fetch work items data (global ID, numeric ID, parent info, workItemType)
    const iids = tasks.map((t) => t.id);
    const dataMap = await this.getBatchWorkItemsDataForReorder(iids);

    // For single task updates, we need to find the correct "move after" target
    // by querying all sibling tasks with their current order
    if (tasks.length === 1) {
      const task = tasks[0];
      const taskData = dataMap.get(task.id);

      if (!taskData) {
        console.error(`[GitLabGraphQL] No data found for task ${task.id}`);
        return;
      }

      // Find all sibling tasks (tasks with same parent)
      const siblings = await this.getSiblingTasksWithOrder(
        task.id,
        taskData.hasParent,
      );

      if (!siblings || siblings.length === 0) {
        return;
      }

      // Find the task that should come before this task based on order
      // Strategy: Insert the moving task into the sorted siblings list based on order value,
      // then find what task comes before it in the resulting list.

      // Filter out the current task itself from siblings
      const otherSiblings = siblings.filter((s) => s.id !== task.id);

      // Sort siblings by order (current GitLab order)
      const sortedSiblings = otherSiblings
        .filter((s) => s.order !== null && s.order !== undefined)
        .sort((a, b) => (a.order as number) - (b.order as number));

      // Find where the moving task should be inserted based on its new order value
      // The new order might be in a different numeric range than sibling orders,
      // so we need to find the position by comparing ratios or counts

      // Count how many siblings should come before this task
      // Strategy: Calculate the ratio of this task's position among all tasks (including itself)
      // Then apply that ratio to find the target position among siblings

      // Get all order values including the moving task
      const allOrders = [
        ...sortedSiblings.map((s) => s.order as number),
        task.order,
      ].sort((a, b) => a - b);
      const taskPositionInAll = allOrders.indexOf(task.order);

      // The targetIndex is how many siblings should come before this task
      // If task is at position 0 in all orders, targetIndex should be 0 (first position)
      // If task is at position N in all orders, targetIndex should be N
      let targetIndex = taskPositionInAll;

      // Determine if this is an Issue (root level) or Task (child level)
      const isTask = taskData.workItemType === 'Task' && taskData.hasParent;

      try {
        if (targetIndex === 0) {
          // Task should be first - move it before the current first task
          if (sortedSiblings.length === 0) {
            return;
          }

          const firstTask = sortedSiblings[0];

          if (isTask) {
            // Use GraphQL for Tasks (child level) - move BEFORE the first task
            await this.reorderTaskBefore(taskData.globalId, firstTask.globalId);
          } else {
            // Use REST API for Issues (root level) - move BEFORE the first issue
            await this.reorderIssueBefore(Number(task.id), firstTask.numericId);
          }
        } else {
          // Task should come after another task
          const previousTask = sortedSiblings[targetIndex - 1];

          if (!previousTask) {
            console.error(
              `[GitLabGraphQL] Failed to find previous task at index ${targetIndex - 1}`,
            );
            return;
          }

          if (isTask) {
            // Use GraphQL for Tasks (child level)
            await this.reorderTask(taskData.globalId, previousTask.globalId);
          } else {
            // Use REST API for Issues (root level)
            await this.reorderIssue(Number(task.id), previousTask.numericId);
          }
        }
      } catch (error) {
        console.error(
          `[GitLabGraphQL] Failed to reorder task ${task.id}:`,
          error,
        );
        throw error;
      }

      return;
    }

    // For batch updates (multiple tasks), process each task in sequence
    for (let i = 0; i < sortedTasks.length; i++) {
      const currentTask = sortedTasks[i];
      const currentData = dataMap.get(currentTask.id);

      if (!currentData) {
        console.error(
          `[GitLabGraphQL] No data found for task ${currentTask.id}`,
        );
        continue;
      }

      // Determine if this is an Issue (root level) or Task (child level)
      const isTask =
        currentData.workItemType === 'Task' && currentData.hasParent;

      try {
        if (i === 0) {
          // First task in the new order - need to move it to first position
          console.log(
            `[GitLabGraphQL] Task ${currentTask.id} should be first in new order`,
          );

          // Get current GitLab sibling order to find the current first task
          const siblings = await this.getSiblingTasksWithOrder(
            currentTask.id,
            currentData.hasParent,
          );
          const sortedSiblings = siblings
            .filter(
              (s) =>
                s.id !== currentTask.id &&
                s.order !== null &&
                s.order !== undefined,
            )
            .sort((a, b) => (a.order as number) - (b.order as number));

          if (sortedSiblings.length === 0) {
            continue;
          }

          const currentFirstTask = sortedSiblings[0];

          if (isTask) {
            // Use GraphQL for Tasks - move BEFORE the current first task
            await this.reorderTaskBefore(
              currentData.globalId,
              currentFirstTask.globalId,
            );
          } else {
            // Use REST API for Issues - move BEFORE the current first issue
            await this.reorderIssueBefore(
              Number(currentTask.id),
              currentFirstTask.numericId,
            );
          }
        } else {
          // Not first task - move after the previous task in the sorted order
          const previousTask = sortedTasks[i - 1];
          const previousData = dataMap.get(previousTask.id);

          if (!previousData) {
            console.error(
              `[GitLabGraphQL] No data found for previous task ${previousTask.id}`,
            );
            continue;
          }

          if (isTask) {
            // Use GraphQL for Tasks (child level)
            await this.reorderTask(currentData.globalId, previousData.globalId);
          } else {
            // Use REST API for Issues (root level)
            await this.reorderIssue(
              Number(currentTask.id),
              previousData.numericId,
            );
          }
        }
      } catch (error) {
        console.error(
          `[GitLabGraphQL] Failed to reorder task ${currentTask.id}:`,
          error,
        );
        // Continue with other tasks even if one fails
      }
    }
  }

  /**
   * Get sibling tasks with their order values
   * For a given task, return all tasks with the same parent
   *
   * For Issues (root level): order comes from relativePosition
   * For Tasks (child level): order comes from parent's children array index
   */
  private async getSiblingTasksWithOrder(
    taskId: TID,
    hasParent: boolean,
  ): Promise<
    Array<{
      id: TID;
      globalId: string;
      numericId: number;
      order: number | null;
    }>
  > {
    // First, get the full info for this task including parent ID
    const taskQuery = `
      query getTaskWithParent($fullPath: ID!, $iid: String!) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(iids: [$iid]) {
            nodes {
              id
              iid
              widgets {
                __typename
                ... on WorkItemWidgetHierarchy {
                  parent {
                    id
                    iid
                  }
                }
              }
            }
          }
        }
      }
    `;

    const taskResult = await this.graphqlClient.query<WorkItemsResponse>(
      taskQuery,
      { fullPath: this.getFullPath(), iid: String(taskId) },
    );

    const taskWorkItems =
      this.config.type === 'group'
        ? taskResult.group?.workItems.nodes || []
        : taskResult.project?.workItems.nodes || [];

    if (taskWorkItems.length === 0) {
      return [];
    }

    const taskWorkItem = taskWorkItems[0];
    const taskHierarchyWidget = taskWorkItem.widgets?.find(
      (w: any) => w.__typename === 'WorkItemWidgetHierarchy',
    ) as any;
    const taskParentId = taskHierarchyWidget?.parent?.id || null;
    const taskParentIid = taskHierarchyWidget?.parent?.iid || null;

    // For child tasks, get the parent's children order
    if (hasParent && taskParentIid) {
      // Query the parent to get children order
      const parentQuery = `
        query getParentChildren($fullPath: ID!, $iid: String!) {
          ${this.config.type}(fullPath: $fullPath) {
            workItems(iids: [$iid]) {
              nodes {
                id
                iid
                widgets {
                  __typename
                  ... on WorkItemWidgetHierarchy {
                    children {
                      nodes {
                        id
                        iid
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const parentResult = await this.graphqlClient.query<WorkItemsResponse>(
        parentQuery,
        { fullPath: this.getFullPath(), iid: String(taskParentIid) },
      );

      const parentWorkItems =
        this.config.type === 'group'
          ? parentResult.group?.workItems.nodes || []
          : parentResult.project?.workItems.nodes || [];

      if (parentWorkItems.length > 0) {
        const parentWorkItem = parentWorkItems[0];
        const parentHierarchyWidget = parentWorkItem.widgets?.find(
          (w: any) => w.__typename === 'WorkItemWidgetHierarchy',
        ) as any;
        const children = parentHierarchyWidget?.children?.nodes || [];

        // Build siblings list with order based on index in children array
        // Use ORDER_GAP spacing to match Gantt's order calculation
        const ORDER_GAP = 10; // Must match the value in GitLabGantt.jsx
        const siblings: Array<{
          id: TID;
          globalId: string;
          numericId: number;
          order: number | null;
        }> = [];

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const numericIdMatch = child.id.match(/\/(\d+)$/);
          const numericId = numericIdMatch
            ? parseInt(numericIdMatch[1], 10)
            : Number(child.iid);

          siblings.push({
            id: Number(child.iid),
            globalId: child.id,
            numericId,
            order: i * ORDER_GAP, // Use ORDER_GAP spacing (0, 10, 20...) instead of raw index
          });
        }

        console.log(
          `[GitLabGraphQL] Found ${siblings.length} siblings for task ${taskId} from parent ${taskParentIid} children array`,
        );
        return siblings;
      }
    }

    // For root level Issues, use relativePosition (with pagination)
    const issuesQuery = `
      query getIssuesPosition($fullPath: ID!, $after: String) {
        ${this.config.type}(fullPath: $fullPath) {
          issues(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              iid
              relativePosition
            }
          }
        }
      }
    `;

    let issues: Array<{ iid: string; relativePosition: number | null }> = [];
    try {
      issues = await this.queryPaginated<{
        iid: string;
        relativePosition: number | null;
      }>(issuesQuery, { fullPath: this.getFullPath() }, (result) =>
        this.extractPaginatedData(result, 'issues'),
      );
    } catch {
      // Ignore errors, use empty array
    }

    const relativePositionMap = new Map<number, number>();
    issues.forEach((issue) => {
      if (
        issue.relativePosition !== null &&
        issue.relativePosition !== undefined
      ) {
        relativePositionMap.set(Number(issue.iid), issue.relativePosition);
      }
    });

    // Query all work items to find root-level siblings (with pagination)
    const workItemsQuery = `
      query getSiblingTasks($fullPath: ID!, $after: String) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(types: [ISSUE, TASK], first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              iid
              workItemType {
                name
              }
              widgets {
                __typename
                ... on WorkItemWidgetHierarchy {
                  parent {
                    id
                    iid
                  }
                }
              }
            }
          }
        }
      }
    `;

    const workItems = await this.queryPaginated<WorkItem>(
      workItemsQuery,
      { fullPath: this.getFullPath() },
      (result) => this.extractPaginatedData(result, 'workItems'),
    );

    // Filter for root-level siblings (no parent)
    const siblings: Array<{
      id: TID;
      globalId: string;
      numericId: number;
      order: number | null;
    }> = [];

    for (const wi of workItems) {
      const hierarchyWidget = wi.widgets?.find(
        (w: any) => w.__typename === 'WorkItemWidgetHierarchy',
      ) as any;
      const wiParentId = hierarchyWidget?.parent?.id || null;

      // Check if this work item has no parent (root level)
      if (wiParentId === null) {
        const numericIdMatch = wi.id.match(/\/(\d+)$/);
        const numericId = numericIdMatch
          ? parseInt(numericIdMatch[1], 10)
          : Number(wi.iid);
        const order = relativePositionMap.get(Number(wi.iid)) || null;

        siblings.push({
          id: Number(wi.iid),
          globalId: wi.id,
          numericId,
          order,
        });
      }
    }

    console.log(
      `[GitLabGraphQL] Found ${siblings.length} root-level siblings for task ${taskId}`,
    );
    return siblings;
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
   * Perform the actual update
   */
  private async performUpdate(id: TID, task: Partial<ITask>): Promise<void> {
    // Get the work item global ID from task._gitlab or query it
    let workItemId: string;
    if (task._gitlab?.id) {
      workItemId = task._gitlab.id;
    } else {
      workItemId = await this.getWorkItemGlobalId(id);
    }

    // Build mutation input
    const input: any = {
      id: workItemId,
    };

    // Title
    if (task.text !== undefined) {
      input.title = task.text;
    }

    // Description
    if (task.details !== undefined) {
      input.descriptionWidget = {
        description: task.details,
      };
    }

    // Dates
    if (task.start !== undefined || task.end !== undefined) {
      input.startAndDueDateWidget = {};
      if (task.start !== undefined) {
        input.startAndDueDateWidget.startDate = task.start
          ? this.formatDateForGitLab(task.start)
          : null;
      }
      if (task.end !== undefined) {
        input.startAndDueDateWidget.dueDate = task.end
          ? this.formatDateForGitLab(task.end)
          : null;
      }
    }

    // Weight
    if (task.weight !== undefined) {
      input.weightWidget = {
        weight: task.weight,
      };
    }

    // State
    if (task.state !== undefined) {
      input.stateEvent = task.state === 'closed' ? 'CLOSE' : 'REOPEN';
    }

    // TODO: Handle assignees, labels, milestone

    const mutation = `
      mutation updateWorkItem($input: WorkItemUpdateInput!) {
        workItemUpdate(input: $input) {
          workItem {
            id
            iid
          }
          errors
        }
      }
    `;

    const result = await this.graphqlClient.mutate<{
      workItemUpdate: {
        workItem: { id: string; iid: string };
        errors: string[];
      };
    }>(mutation, { input });

    if (
      result.workItemUpdate.errors &&
      result.workItemUpdate.errors.length > 0
    ) {
      console.error(
        '[GitLabGraphQL] Update errors:',
        result.workItemUpdate.errors,
      );
      throw new Error(
        `Failed to update work item: ${result.workItemUpdate.errors.join(', ')}`,
      );
    }
  }

  /**
   * Batch fetch work items data for reorder operations
   * Returns global ID, numeric ID, parent info, and workItemType
   */
  private async getBatchWorkItemsDataForReorder(iids: TID[]): Promise<
    Map<
      TID,
      {
        globalId: string;
        numericId: number;
        workItemType: string;
        hasParent: boolean;
      }
    >
  > {
    const query = `
      query getBatchWorkItemsForReorder($fullPath: ID!, $iids: [String!]!) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(iids: $iids) {
            nodes {
              id
              iid
              workItemType {
                name
              }
              widgets {
                __typename
                ... on WorkItemWidgetHierarchy {
                  parent {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      fullPath: this.getFullPath(),
      iids: iids.map(String),
    };

    const result = await this.graphqlClient.query<WorkItemsResponse>(
      query,
      variables,
    );

    const workItems =
      this.config.type === 'group'
        ? result.group?.workItems.nodes || []
        : result.project?.workItems.nodes || [];

    const dataMap = new Map<
      TID,
      {
        globalId: string;
        numericId: number;
        workItemType: string;
        hasParent: boolean;
      }
    >();

    for (const wi of workItems) {
      // Extract numeric ID from global ID (e.g., "gid://gitlab/Issue/123" -> 123)
      const numericIdMatch = wi.id.match(/\/(\d+)$/);
      const numericId = numericIdMatch
        ? parseInt(numericIdMatch[1], 10)
        : Number(wi.iid);

      // Check if has parent
      const hierarchyWidget = wi.widgets?.find(
        (w: any) => w.__typename === 'WorkItemWidgetHierarchy',
      ) as any;
      const hasParent = !!hierarchyWidget?.parent;

      dataMap.set(Number(wi.iid), {
        globalId: wi.id,
        numericId,
        workItemType: wi.workItemType?.name || 'Issue',
        hasParent,
      });
    }

    return dataMap;
  }

  private async getWorkItemGlobalId(iid: TID): Promise<string> {
    // Check if this is a temporary ID (not yet saved to GitLab)
    const iidStr = String(iid);
    if (iidStr.startsWith('temp://') || iidStr.includes('temp')) {
      throw new Error(
        `Cannot get global ID for temporary task ID: ${iid}. Please wait for the task to be saved first.`,
      );
    }

    const query = `
      query getWorkItem($fullPath: ID!, $iid: String!) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(iids: [$iid]) {
            nodes {
              id
              widgets {
                __typename
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

    const variables = {
      fullPath: this.getFullPath(),
      iid: iidStr,
    };

    console.log('[GitLabGraphQL] Querying work item for global ID...');
    const result = await this.graphqlClient.query<WorkItemsResponse>(
      query,
      variables,
    );

    const workItems =
      this.config.type === 'group'
        ? result.group?.workItems.nodes || []
        : result.project?.workItems.nodes || [];

    const workItem = workItems[0];
    if (!workItem) {
      throw new Error(`Work item not found for IID: ${iid}`);
    }

    // Log the dates from GitLab to see if they're stale
    const dateWidget = workItem.widgets?.find(
      (w) => w.startDate !== undefined || w.dueDate !== undefined,
    );
    console.log('[GitLabGraphQL] Current dates in GitLab:', {
      startDate: dateWidget?.startDate,
      dueDate: dateWidget?.dueDate,
    });

    return workItem.id;
  }

  /**
   * Create new work item
   */
  async createWorkItem(task: Partial<ITask>): Promise<ITask> {
    console.log('[GitLabGraphQL] Creating work item:', task);

    // Check if this is a subtask (has a parent task)
    const isSubtask = task.parent && task.parent !== 0;
    // Use Task type for subtasks, Issue type for top-level tasks
    const workItemTypeId = isSubtask
      ? 'gid://gitlab/WorkItems::Type/5' // Task type
      : 'gid://gitlab/WorkItems::Type/1'; // Issue type

    // Set appropriate default name based on work item type
    const defaultName = isSubtask ? 'New GitLab Task' : 'New GitLab Issue';

    // Resolve label titles to global IDs if labels are provided
    let labelIds: string[] | undefined;
    if (task.labels) {
      const labelTitles = task.labels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
      if (labelTitles.length > 0) {
        const labelIdMap = await this.getLabelIdsByTitles(labelTitles);
        labelIds = labelTitles
          .map((title) => labelIdMap.get(title))
          .filter((id): id is string => !!id);
        // Log any labels that couldn't be found
        const notFoundLabels = labelTitles.filter(
          (title) => !labelIdMap.has(title),
        );
        if (notFoundLabels.length > 0) {
          console.warn(
            '[GitLabGraphQL] Labels not found:',
            notFoundLabels.join(', '),
          );
        }
      }
    }

    // Resolve usernames to global IDs if assignees are provided
    let assigneeIds: string[] | undefined;
    if (task.assigned) {
      const usernames = task.assigned
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      if (usernames.length > 0) {
        const userIdMap = await this.getUserIdsByUsernames(usernames);
        assigneeIds = usernames
          .map((username) => userIdMap.get(username))
          .filter((id): id is string => !!id);
        // Log any users that couldn't be found
        const notFoundUsers = usernames.filter(
          (username) => !userIdMap.has(username),
        );
        if (notFoundUsers.length > 0) {
          console.warn(
            '[GitLabGraphQL] Users not found:',
            notFoundUsers.join(', '),
          );
        }
      }
    }

    const mutation = `
      mutation CreateWorkItem($input: WorkItemCreateInput!) {
        workItemCreate(input: $input) {
          workItem {
            id
            iid
            title
            state
            createdAt
            webUrl
            workItemType {
              name
            }
            widgets {
              __typename
              ... on WorkItemWidgetDescription {
                description
              }
              ... on WorkItemWidgetStartAndDueDate {
                startDate
                dueDate
              }
              ... on WorkItemWidgetLabels {
                labels {
                  nodes {
                    id
                    title
                  }
                }
              }
              ... on WorkItemWidgetAssignees {
                assignees {
                  nodes {
                    id
                    name
                    username
                  }
                }
              }
            }
          }
          errors
        }
      }
    `;

    // Determine whether to use projectPath or namespacePath
    const pathInput =
      this.config.type === 'project'
        ? { projectPath: this.getFullPath() }
        : { namespacePath: this.getFullPath() };

    // Calculate end date if only start and duration are provided
    let endDate = task.end;
    if (task.start && !endDate && task.duration) {
      endDate = new Date(task.start);
      endDate.setDate(endDate.getDate() + task.duration - 1);
    }

    const variables = {
      input: {
        ...pathInput,
        workItemTypeId,
        title: task.text || defaultName,
        ...(task.details && {
          descriptionWidget: {
            description: task.details,
          },
        }),
        ...(task.start || endDate
          ? {
              startAndDueDateWidget: {
                ...(task.start && {
                  startDate: this.formatDateForGitLab(task.start),
                }),
                ...(endDate && {
                  dueDate: this.formatDateForGitLab(endDate),
                }),
              },
            }
          : {}),
        // Add milestone assignment if specified
        ...(task._gitlab?.milestoneGlobalId && {
          milestoneWidget: {
            milestoneId: task._gitlab.milestoneGlobalId,
          },
        }),
        // Add labels if resolved
        ...(labelIds &&
          labelIds.length > 0 && {
            labelsWidget: {
              labelIds,
            },
          }),
        // Add assignees if resolved
        ...(assigneeIds &&
          assigneeIds.length > 0 && {
            assigneesWidget: {
              assigneeIds,
            },
          }),
      },
    };

    const result = await this.graphqlClient.query<any>(mutation, variables);

    if (
      result.workItemCreate.errors &&
      result.workItemCreate.errors.length > 0
    ) {
      throw new Error(
        `Failed to create work item: ${result.workItemCreate.errors.join(', ')}`,
      );
    }

    const workItem = result.workItemCreate.workItem;
    const createdTask = this.convertWorkItemToTask(workItem);

    // If this is a subtask, create the hierarchy link
    if (isSubtask) {
      try {
        await this.linkWorkItemAsChild(workItem.id, task.parent as number);
      } catch (error) {
        console.error(
          '[GitLabGraphQL] Failed to link subtask to parent:',
          error,
        );

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const userMessage = this.formatLinkingErrorMessage(
          errorMessage,
          task.parent as number,
        );

        createdTask._gitlab = {
          ...createdTask._gitlab,
          linkingError: userMessage,
        };
      }
    }

    return createdTask;
  }

  /**
   * Format user-friendly error message for subtask linking failures
   */
  private formatLinkingErrorMessage(
    errorMessage: string,
    parentIid: number,
  ): string {
    const suffix = 'Please link the task manually in GitLab.';

    if (errorMessage.includes('No matching work item found')) {
      return `Subtask was created but could not be linked to parent Issue. This may be due to insufficient permissions or the parent Issue not supporting Work Item hierarchy. ${suffix}`;
    }
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('does not exist')
    ) {
      return `Subtask was created but the parent Issue (IID: ${parentIid}) could not be found or you don't have permission to access it. ${suffix}`;
    }
    return `Subtask was created but could not be linked to parent Issue: ${errorMessage}. ${suffix}`;
  }

  /**
   * Link work item as a child to a parent
   */
  private async linkWorkItemAsChild(
    childGlobalId: string,
    parentIid: number,
  ): Promise<void> {
    // Linking work item as child

    // First, get the parent's Global ID
    const query = `
      query GetParentWorkItem($fullPath: ID!, $iid: String!) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(iids: [$iid], first: 1) {
            nodes {
              id
            }
          }
        }
      }
    `;

    const queryVariables = {
      fullPath: this.getFullPath(),
      iid: String(parentIid),
    };

    const queryResult = await this.graphqlClient.query<any>(
      query,
      queryVariables,
    );
    const parentGlobalId =
      queryResult[this.config.type]?.workItems?.nodes?.[0]?.id;

    if (!parentGlobalId) {
      throw new Error(`Parent work item with iid ${parentIid} not found`);
    }

    // Now create the parent-child hierarchy link
    const mutation = `
      mutation LinkChildWorkItem($input: WorkItemUpdateInput!) {
        workItemUpdate(input: $input) {
          workItem {
            id
          }
          errors
        }
      }
    `;

    const variables = {
      input: {
        id: childGlobalId,
        hierarchyWidget: {
          parentId: parentGlobalId,
        },
      },
    };

    const result = await this.graphqlClient.query<any>(mutation, variables);

    if (
      result.workItemUpdate.errors &&
      result.workItemUpdate.errors.length > 0
    ) {
      throw new Error(
        `Failed to link work items: ${result.workItemUpdate.errors.join(', ')}`,
      );
    }

    // Successfully linked work items
  }

  /**
   * Delete work item
   */
  async deleteWorkItem(id: TID): Promise<void> {
    console.log('[GitLabGraphQL] Deleting work item:', id);

    // Skip deletion for temporary IDs (created locally but not yet saved to GitLab)
    if (String(id).startsWith('temp://')) {
      console.log(
        '[GitLabGraphQL] Skipping deletion of temporary work item:',
        id,
      );
      return;
    }

    // First, we need to query the work item to get its Global ID
    // because we only have the iid (local ID within project)
    const query = `
      query GetWorkItem($fullPath: ID!, $iid: String!) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(iids: [$iid], first: 1) {
            nodes {
              id
            }
          }
        }
      }
    `;

    const queryVariables = {
      fullPath: this.getFullPath(),
      iid: String(id),
    };

    const queryResult = await this.graphqlClient.query<any>(
      query,
      queryVariables,
    );
    const workItemNode = queryResult[this.config.type]?.workItems?.nodes?.[0];
    const globalId = workItemNode?.id;

    if (!globalId) {
      throw new Error(`Work item with iid ${id} not found`);
    }

    // Now delete using the Global ID
    const mutation = `
      mutation DeleteWorkItem($input: WorkItemDeleteInput!) {
        workItemDelete(input: $input) {
          errors
        }
      }
    `;

    const variables = {
      input: {
        id: globalId,
      },
    };

    const result = await this.graphqlClient.query<any>(mutation, variables);

    if (
      result.workItemDelete.errors &&
      result.workItemDelete.errors.length > 0
    ) {
      throw new Error(
        `Failed to delete work item: ${result.workItemDelete.errors.join(', ')}`,
      );
    }
  }

  /**
   * Alias for createWorkItem (for compatibility with useGitLabSync)
   */
  async createIssue(task: Partial<ITask>): Promise<ITask> {
    return this.createWorkItem(task);
  }

  /**
   * Alias for deleteWorkItem (for compatibility with useGitLabSync)
   * Also handles milestone deletion based on _gitlab.type
   */
  async deleteIssue(id: TID, task?: Partial<ITask>): Promise<void> {
    // Check if this is a milestone based on _gitlab.type
    if (task?._gitlab?.type === 'milestone') {
      return this.deleteMilestone(id, task);
    }
    return this.deleteWorkItem(id);
  }

  /**
   * Delete a milestone using REST API
   * Note: GitLab REST API requires the internal milestone ID (not iid)
   * The internal ID can be extracted from globalId: "gid://gitlab/Milestone/1137" -> 1137
   */
  async deleteMilestone(id: TID, task?: Partial<ITask>): Promise<void> {
    console.log('[GitLabGraphQL] Deleting milestone:', id, task);

    // Extract internal milestone ID from globalId
    // globalId format: "gid://gitlab/Milestone/1137" -> internal ID is 1137
    const globalId = task?._gitlab?.globalId;
    if (!globalId) {
      throw new Error('Cannot delete milestone: missing globalId');
    }

    const match = globalId.match(/\/Milestone\/(\d+)$/);
    if (!match) {
      throw new Error(
        `Cannot delete milestone: invalid globalId format: ${globalId}`,
      );
    }
    const milestoneInternalId = match[1];

    // Determine the correct API endpoint (same logic as updateMilestone)
    let endpoint: string;
    let apiPath: string;

    const isGroupMilestone = task?._gitlab?.isGroupMilestone;
    const webPath = task?._gitlab?.web_url || '';

    if (isGroupMilestone) {
      // This is a Group Milestone - extract group path from webPath
      // The group path is between /groups/ and /-/milestones
      const groupMatch = webPath.match(/\/groups\/(.+?)\/-\/milestones/);
      if (groupMatch) {
        endpoint = 'groups';
        apiPath = groupMatch[1];
        console.log(
          `[GitLabGraphQL] Deleting Group Milestone, extracted group path: ${apiPath}`,
        );
      } else {
        console.warn(
          '[GitLabGraphQL] Cannot extract group path from webPath, falling back to config',
          webPath,
        );
        endpoint = this.config.type === 'group' ? 'groups' : 'projects';
        apiPath = this.getFullPath();
      }
    } else {
      endpoint = this.config.type === 'group' ? 'groups' : 'projects';
      apiPath = this.getFullPath();
    }

    const encodedPath = encodeURIComponent(apiPath);

    // Use shared REST API utility to delete the milestone
    await gitlabRestRequest(
      `/${endpoint}/${encodedPath}/milestones/${milestoneInternalId}`,
      {
        gitlabUrl: this.config.gitlabUrl,
        token: this.config.token,
        isDev: this.isDev,
      },
      {
        method: 'DELETE',
      },
    );

    console.log('[GitLabGraphQL] Milestone deleted:', milestoneInternalId);
  }

  /**
   * Create a new milestone using REST API
   * Note: GitLab GraphQL API does not support milestone creation
   */
  async createMilestone(milestone: Partial<ITask>): Promise<ITask> {
    console.log('[GitLabGraphQL] Creating milestone via REST API:', milestone);

    // Build payload for REST API
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
    } else if (milestone.start && milestone.duration) {
      // Calculate end date from start + duration
      const endDate = new Date(milestone.start);
      endDate.setDate(endDate.getDate() + milestone.duration - 1);
      payload.due_date = this.formatDateForGitLab(endDate);
    }

    // Get path and encode it for URL
    // Use correct endpoint based on config type (group vs project)
    const endpoint = this.config.type === 'group' ? 'groups' : 'projects';
    const path = this.getFullPath();
    const encodedPath = encodeURIComponent(path);

    // Use shared REST API utility
    const createdMilestone = await gitlabRestRequest(
      `/${endpoint}/${encodedPath}/milestones`,
      {
        gitlabUrl: this.config.gitlabUrl,
        token: this.config.token,
        isDev: this.isDev,
      },
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    console.log('[GitLabGraphQL] Milestone created:', createdMilestone);

    // Convert the REST API response to ITask format
    return this.convertMilestoneToTask(createdMilestone);
  }

  /**
   * Update an existing milestone using REST API
   * Note: GitLab GraphQL API does not support milestone updates
   */
  async updateMilestone(id: TID, milestone: Partial<ITask>): Promise<void> {
    console.log('[GitLabGraphQL] Updating milestone via REST API:', {
      id,
      milestone,
    });

    // Extract milestone internal ID for REST API
    // GitLab REST API uses the internal ID (not iid) for milestone_id parameter
    // Priority: internalId > globalId parsing > fallback to iid (may cause 404)
    let milestoneId: string;

    if (milestone._gitlab?.internalId) {
      // Best case: use stored internal ID directly
      milestoneId = String(milestone._gitlab.internalId);
    } else if (milestone._gitlab?.globalId) {
      // Extract internal ID from globalId (e.g., "gid://gitlab/Milestone/1130" -> "1130")
      const match = milestone._gitlab.globalId.match(/\/Milestone\/(\d+)$/);
      if (match) {
        milestoneId = match[1];
      } else {
        // Fallback to iid if globalId format is unexpected (may cause 404)
        console.warn(
          '[GitLabGraphQL] Invalid globalId format, falling back to iid:',
          milestone._gitlab.globalId,
        );
        // Try to extract iid from task ID (format: "m-{iid}")
        const extractedIid = extractMilestoneIid(id);
        milestoneId = String(milestone._gitlab.id || extractedIid);
      }
    } else if (milestone._gitlab?.id) {
      // Fallback: use iid (may cause 404 if iid !== internal ID)
      console.warn(
        '[GitLabGraphQL] Using iid as fallback for milestone update, may cause 404',
      );
      milestoneId = String(milestone._gitlab.id);
    } else {
      // Last resort: extract iid from task ID (format: "m-{iid}")
      const extractedIid = extractMilestoneIid(id);
      if (extractedIid !== null) {
        console.warn(
          '[GitLabGraphQL] No milestone ID info, using extracted iid from task ID',
        );
        milestoneId = String(extractedIid);
      } else {
        throw new Error(`Cannot determine milestone ID from task ID: ${id}`);
      }
    }

    // Build payload for REST API
    const payload: any = {};

    if (milestone.text !== undefined) {
      payload.title = milestone.text;
    }

    if (milestone.details !== undefined) {
      payload.description = milestone.details;
    }

    if (milestone.start !== undefined) {
      payload.start_date = milestone.start
        ? this.formatDateForGitLab(milestone.start)
        : null;
    }

    if (milestone.end !== undefined) {
      payload.due_date = milestone.end
        ? this.formatDateForGitLab(milestone.end)
        : null;
    }

    // Determine the correct API endpoint
    // Group Milestones need /groups/ endpoint, Project Milestones need /projects/
    // We can determine this from:
    // 1. isGroupMilestone flag (set when milestone was discovered from work item reference)
    // 2. webPath format: /groups/xxx/-/milestones/N vs /project-path/-/milestones/N
    let endpoint: string;
    let apiPath: string;

    const isGroupMilestone = milestone._gitlab?.isGroupMilestone;
    const webPath = milestone._gitlab?.web_url || '';

    if (isGroupMilestone) {
      // This is a Group Milestone - need to find the group path from webPath
      // webPath format: https://gitlab.com/groups/group-name/-/milestones/42
      // or webPath (from GraphQL): /groups/group-name/-/milestones/42
      // The group path is between /groups/ and /-/milestones
      const groupMatch = webPath.match(/\/groups\/(.+?)\/-\/milestones/);
      if (groupMatch) {
        endpoint = 'groups';
        apiPath = groupMatch[1];
        console.log(
          `[GitLabGraphQL] Updating Group Milestone, extracted group path: ${apiPath}`,
        );
      } else {
        // Fallback: cannot determine group path, this will likely fail
        console.warn(
          '[GitLabGraphQL] Cannot extract group path from webPath, falling back to config',
          webPath,
        );
        endpoint = this.config.type === 'group' ? 'groups' : 'projects';
        apiPath = this.getFullPath();
      }
    } else {
      // Project Milestone or config-based selection
      endpoint = this.config.type === 'group' ? 'groups' : 'projects';
      apiPath = this.getFullPath();
    }

    const encodedPath = encodeURIComponent(apiPath);

    // Use shared REST API utility
    const updatedMilestone = await gitlabRestRequest(
      `/${endpoint}/${encodedPath}/milestones/${milestoneId}`,
      {
        gitlabUrl: this.config.gitlabUrl,
        token: this.config.token,
        isDev: this.isDev,
      },
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );

    console.log('[GitLabGraphQL] Milestone updated:', updatedMilestone);
  }

  /**
   * Fetch links (related work items) for all work items
   */
  private async fetchWorkItemLinks(workItems: any[]): Promise<ILink[]> {
    const links: ILink[] = [];
    let linkIdCounter = 1;

    console.log(
      '[GitLabGraphQL] Processing',
      workItems.length,
      'work items for links',
    );

    // Create a map of IID to work item for quick lookup
    // Note: Store both string and number versions for compatibility
    const iidMap = new Map<number, any>();
    workItems.forEach((wi) => {
      const iid = typeof wi.iid === 'string' ? parseInt(wi.iid, 10) : wi.iid;
      iidMap.set(iid, wi);
    });

    console.log('[GitLabGraphQL] iidMap keys:', Array.from(iidMap.keys()));

    // Track processed links to avoid duplicates
    // GitLab stores bidirectional relationships, so we need to deduplicate
    // Use a set of normalized link identifiers: "source-target-type"
    const processedLinks = new Set<string>();

    // Extract links from each work item
    for (const workItem of workItems) {
      // Find the LinkedItems widget
      const linkedItemsWidget = workItem.widgets?.find(
        (w: any) => w.__typename === 'WorkItemWidgetLinkedItems',
      ) as any;

      if (!linkedItemsWidget?.linkedItems?.nodes) {
        continue;
      }

      // Convert source IID to number
      const sourceIid =
        typeof workItem.iid === 'string'
          ? parseInt(workItem.iid, 10)
          : workItem.iid;

      // Process each linked item
      for (const linkedItem of linkedItemsWidget.linkedItems.nodes) {
        const targetIidStr = linkedItem.workItem?.iid;
        const linkType = linkedItem.linkType;

        if (!targetIidStr) {
          continue;
        }

        // Convert IID to number for comparison and storage
        const targetIid =
          typeof targetIidStr === 'string'
            ? parseInt(targetIidStr, 10)
            : targetIidStr;

        if (!iidMap.has(targetIid)) {
          // Skip if target is not in our task list
          continue;
        }

        // Map GitLab link types to Gantt link types
        // Note: GitLab returns lowercase with underscores (relates_to, blocks, is_blocked_by)
        let ganttLinkType: ILink['type'];
        let linkSource: number;
        let linkTarget: number;
        const normalizedLinkType = linkType?.toLowerCase();

        // Determine link direction based on GitLab link type
        // sourceIid = current work item, targetIid = linked work item
        if (normalizedLinkType === 'blocks') {
          // "A blocks B" means A must finish before B starts
          // Arrow: A -> B
          linkSource = sourceIid;
          linkTarget = targetIid;
          ganttLinkType = 'e2s'; // End-to-Start
        } else if (normalizedLinkType === 'is_blocked_by') {
          // "A is_blocked_by B" means B must finish before A starts
          // Arrow: B -> A (reversed!)
          linkSource = targetIid;
          linkTarget = sourceIid;
          ganttLinkType = 'e2s'; // End-to-Start
        } else {
          // relates_to - non-directional, use arbitrary direction
          linkSource = sourceIid;
          linkTarget = targetIid;
          ganttLinkType = 'e2s'; // Default to End-to-Start
        }

        // Create normalized link identifier for deduplication
        // For directional links (blocks/is_blocked_by), we need to check both directions
        // because GitLab stores the relationship on both sides
        let linkIdentifier: string;
        let reverseIdentifier: string;

        if (normalizedLinkType === 'blocks') {
          // "A blocks B" means A must finish before B starts (A -> B)
          linkIdentifier = `${sourceIid}-${targetIid}-blocks`;
          reverseIdentifier = `${targetIid}-${sourceIid}-is_blocked_by`;
        } else if (normalizedLinkType === 'is_blocked_by') {
          // "A is_blocked_by B" means B must finish before A starts (B -> A)
          linkIdentifier = `${targetIid}-${sourceIid}-blocks`;
          reverseIdentifier = `${sourceIid}-${targetIid}-is_blocked_by`;
        } else {
          // For relates_to, use sorted IDs to avoid duplicates
          const [id1, id2] = [sourceIid, targetIid].sort((a, b) => a - b);
          linkIdentifier = `${id1}-${id2}-relates_to`;
          reverseIdentifier = linkIdentifier; // Same as forward for non-directional
        }

        // Check if we've already processed this link (or its reverse)
        if (
          processedLinks.has(linkIdentifier) ||
          processedLinks.has(reverseIdentifier)
        ) {
          // Skipping duplicate link
          continue;
        }

        // Mark this link as processed
        processedLinks.add(linkIdentifier);

        // Adding link to collection
        // NOTE: For deletion, we need the ORIGINAL API relationship (before direction swap)
        // GitLab's workItemRemoveLinkedItems requires:
        // - id: source work item's global ID (the work item we're calling the mutation on)
        // - workItemsIds: array of target work item global IDs to unlink
        //
        // IMPORTANT: linkSource/linkTarget may be swapped for Gantt visualization,
        // but for deletion we need the ORIGINAL API relationship:
        // - sourceIid = current work item (the one we iterate from)
        // - linkedItem.workItem = the linked work item
        links.push({
          id: linkIdCounter++,
          source: linkSource,
          target: linkTarget,
          type: ganttLinkType,
          _gitlab: {
            // Store ORIGINAL API source work item's IID (for getWorkItemGlobalId lookup)
            apiSourceIid: sourceIid,
            // Store the LINKED work item's global ID (this is what we pass to workItemsIds)
            linkedWorkItemGlobalId: linkedItem.workItem?.id,
          },
        } as ILink & {
          _gitlab: { apiSourceIid: number; linkedWorkItemGlobalId: string };
        });
      }
    }

    return links;
  }

  /**
   * Create issue link using GraphQL Work Items API
   */
  async createIssueLink(link: Partial<ILink>): Promise<void> {
    if (!link.source || !link.target) {
      throw new Error('Source and target are required for issue links');
    }

    // Creating issue link

    // Get global IDs for both work items
    const sourceGlobalId = await this.getWorkItemGlobalId(link.source);
    const targetGlobalId = await this.getWorkItemGlobalId(link.target);

    // Map Gantt link type to GitLab link type
    // Note: Gantt's e2s means "source must finish before target starts"
    // which is "blocks" in GitLab (source blocks target)
    // GitLab API expects: RELATED, BLOCKED_BY, BLOCKS (not RELATES_TO or IS_BLOCKED_BY)
    let linkType: string;
    switch (link.type) {
      case 'e2s':
        linkType = 'BLOCKS';
        break;
      case 's2e':
        linkType = 'BLOCKED_BY';
        break;
      default:
        linkType = 'RELATED';
        break;
    }

    // Creating link with specified type

    const mutation = `
      mutation workItemAddLinkedItems($input: WorkItemAddLinkedItemsInput!) {
        workItemAddLinkedItems(input: $input) {
          workItem {
            id
            iid
          }
          errors
        }
      }
    `;

    const variables = {
      input: {
        id: sourceGlobalId,
        workItemsIds: [targetGlobalId],
        linkType: linkType,
      },
    };

    const result = await this.graphqlClient.mutate<{
      workItemAddLinkedItems: {
        workItem: { id: string; iid: string };
        errors: string[];
      };
    }>(mutation, variables);

    if (
      result.workItemAddLinkedItems.errors &&
      result.workItemAddLinkedItems.errors.length > 0
    ) {
      console.error(
        '[GitLabGraphQL] Failed to create link:',
        result.workItemAddLinkedItems.errors,
      );
      throw new Error(
        `Failed to create link: ${result.workItemAddLinkedItems.errors.join(', ')}`,
      );
    }

    // Link created successfully
  }

  /**
   * Delete issue link using GraphQL Work Items API
   *
   * @param apiSourceIid - The IID of the ORIGINAL API source work item (before any direction swap)
   * @param linkedWorkItemGlobalId - The global ID of the linked work item to unlink
   *
   * NOTE: GitLab's workItemRemoveLinkedItems mutation requires:
   * - id: source work item's global ID (the work item we fetched the link from)
   * - workItemsIds: array of linked work item global IDs to unlink
   *
   * IMPORTANT: We use the ORIGINAL API relationship, not the Gantt visualization direction.
   * The link was fetched from apiSourceIid's linkedItems widget, so we must call
   * the mutation on apiSourceIid to remove the link.
   */
  async deleteIssueLink(
    apiSourceIid: TID,
    linkedWorkItemGlobalId: string,
  ): Promise<void> {
    // Deleting issue link

    // Get global ID for the original API source work item
    const sourceGlobalId = await this.getWorkItemGlobalId(apiSourceIid);

    console.log('[GitLabGraphQL] Deleting link:', {
      apiSourceIid,
      sourceGlobalId,
      linkedWorkItemGlobalId,
    });

    const mutation = `
      mutation workItemRemoveLinkedItems($input: WorkItemRemoveLinkedItemsInput!) {
        workItemRemoveLinkedItems(input: $input) {
          workItem {
            id
            iid
          }
          errors
        }
      }
    `;

    const variables = {
      input: {
        id: sourceGlobalId,
        workItemsIds: [linkedWorkItemGlobalId],
      },
    };

    const result = await this.graphqlClient.mutate<{
      workItemRemoveLinkedItems: {
        workItem: { id: string; iid: string };
        errors: string[];
      };
    }>(mutation, variables);

    if (
      result.workItemRemoveLinkedItems.errors &&
      result.workItemRemoveLinkedItems.errors.length > 0
    ) {
      console.error(
        '[GitLabGraphQL] Failed to delete link:',
        result.workItemRemoveLinkedItems.errors,
      );
      throw new Error(
        `Failed to delete link: ${result.workItemRemoveLinkedItems.errors.join(', ')}`,
      );
    }

    // Link deleted successfully
  }

  /**
   * Check if current user has edit permissions for the project/group
   *
   * IMPORTANT: GitLab does NOT support Group Snippets!
   * See: https://gitlab.com/gitlab-org/gitlab/-/issues/15958
   *
   * For group configurations, this always returns false because:
   * - Holidays, Workdays, ColorRules, and FilterPresets are stored in Snippets
   * - GitLab only supports Personal Snippets and Project Snippets
   * - Group Snippets is a requested feature that has not been implemented
   *
   * For project configurations, we check the createSnippet permission.
   */
  async checkCanEdit(): Promise<boolean> {
    // Group mode: GitLab does not support Group Snippets
    // Always return false to disable Holidays/ColorRules/Presets editing
    if (this.config.type === 'group') {
      console.log(
        '[GitLabGraphQL] checkCanEdit: Group mode - returning false (GitLab does not support Group Snippets)',
      );
      return false;
    }

    // Project mode: check createSnippet permission
    const query = `
      query checkPermissions($fullPath: ID!) {
        project(fullPath: $fullPath) {
          userPermissions {
            createSnippet
          }
        }
      }
    `;

    try {
      const result = await this.graphqlClient.query<{
        project?: {
          userPermissions: {
            createSnippet?: boolean;
          };
        };
      }>(query, { fullPath: this.getFullPath() });

      return result.project?.userPermissions?.createSnippet ?? false;
    } catch (error) {
      console.error('[GitLabGraphQL] Failed to check permissions:', error);
      return false;
    }
  }

  /**
   * Get proxy config for REST API calls
   */
  getProxyConfig() {
    return {
      gitlabUrl: this.config.gitlabUrl,
      token: this.config.token,
      isDev: this.isDev,
    };
  }

  /**
   * Fetch project/group members (for Workload View)
   * Returns list of member names who have access to the project/group
   *
   * IMPORTANT: GitLab API difference between Project and Group:
   * - Project: uses projectMembers field
   * - Group: uses groupMembers field
   */
  async getProjectMembers(): Promise<string[]> {
    const members = await this.getProjectMembersWithIds();
    return [...new Set(members.map((m) => m.name))].sort();
  }

  /**
   * Fetch project/group members with IDs
   * Returns list of members with id, name, and username
   * Supports pagination to handle large teams (>100 members)
   */
  async getProjectMembersWithIds(): Promise<
    Array<{ id: string; name: string; username: string }>
  > {
    const membersField =
      this.config.type === 'group' ? 'groupMembers' : 'projectMembers';

    const query = `
      query getMembers($fullPath: ID!, $after: String) {
        ${this.config.type}(fullPath: $fullPath) {
          ${membersField}(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              user {
                id
                name
                username
              }
            }
          }
        }
      }
    `;

    try {
      const membersNodes = await this.queryPaginated<{
        user: { id: string; name: string; username: string } | null;
      }>(query, { fullPath: this.getFullPath() }, (result) =>
        this.extractPaginatedData(result, membersField),
      );

      return membersNodes
        .filter((m) => m.user?.id && m.user?.name && m.user?.username)
        .map((m) => ({
          id: m.user!.id,
          name: m.user!.name,
          username: m.user!.username,
        }));
    } catch (error) {
      console.warn('[GitLabGraphQL] Failed to fetch members:', error);
      return [];
    }
  }

  /**
   * Get user global IDs by their names or usernames
   * Supports matching by:
   * - @username format (e.g., "@johndoe") - preferred, strips @ prefix before matching
   * - Plain username (e.g., "johndoe")
   * - Display name (e.g., "John Doe") - fallback for legacy data
   * @param nameOrUsernames - Array of names or usernames (with or without @ prefix)
   * @returns Map of input name/username -> global ID
   */
  async getUserIdsByUsernames(
    nameOrUsernames: string[],
  ): Promise<Map<string, string>> {
    const members = await this.getProjectMembersWithIds();
    const result = new Map<string, string>();

    for (const input of nameOrUsernames) {
      // Strip @ prefix if present (e.g., "@johndoe" -> "johndoe")
      const normalizedInput = input.startsWith('@') ? input.slice(1) : input;

      // First try to match by username (case-insensitive)
      let member = members.find(
        (m) => m.username.toLowerCase() === normalizedInput.toLowerCase(),
      );

      // If not found by username, try to match by display name (case-insensitive)
      // This is for backward compatibility with older Blueprints that stored display names
      if (!member) {
        member = members.find(
          (m) => m.name.toLowerCase() === normalizedInput.toLowerCase(),
        );
      }

      if (member) {
        result.set(input, member.id);
      }
    }

    return result;
  }

  /**
   * Update issue assignees using REST API
   * @param issueIid - Issue IID (not global ID)
   * @param assigneeNames - Array of assignee names to set
   */
  async updateIssueAssignees(
    issueIid: TID,
    assigneeNames: string[],
  ): Promise<void> {
    // First, get user IDs from usernames
    const userIds: number[] = [];

    for (const name of assigneeNames) {
      try {
        // Search for user by name (with pagination to handle many matches)
        const users = await gitlabRestRequestPaginated<{
          id: number;
          name: string;
        }>(`/users?search=${encodeURIComponent(name)}`, {
          gitlabUrl: this.config.gitlabUrl,
          token: this.config.token,
          isDev: this.isDev,
        });

        // Find exact match
        const user = users.find((u) => u.name === name);
        if (user) {
          userIds.push(user.id);
        } else {
          console.warn(
            `[GitLabGraphQL] Could not find user ID for name: ${name}`,
          );
        }
      } catch (error) {
        console.warn(
          `[GitLabGraphQL] Error searching for user ${name}:`,
          error,
        );
      }
    }

    // Update issue with new assignee IDs
    const projectPath = this.getFullPath();
    const endpoint = `/projects/${encodeURIComponent(projectPath)}/issues/${issueIid}`;

    await gitlabRestRequest(
      endpoint,
      {
        gitlabUrl: this.config.gitlabUrl,
        token: this.config.token,
        isDev: this.isDev,
      },
      {
        method: 'PUT',
        body: JSON.stringify({
          assignee_ids: userIds,
        }),
      },
    );

    console.log(
      `[GitLabGraphQL] Updated issue #${issueIid} assignees to:`,
      assigneeNames,
    );
  }

  /**
   * Add an assignee to an issue (keeps existing assignees)
   * @param issueIid - Issue IID (not global ID)
   * @param assigneeName - Name of assignee to add
   * @param currentAssignees - Current assignee names
   */
  async addIssueAssignee(
    issueIid: TID,
    assigneeName: string,
    currentAssignees: string[],
  ): Promise<void> {
    // Don't add if already assigned
    if (currentAssignees.includes(assigneeName)) {
      console.log(
        `[GitLabGraphQL] ${assigneeName} is already assigned to issue #${issueIid}`,
      );
      return;
    }

    const newAssignees = [...currentAssignees, assigneeName];
    await this.updateIssueAssignees(issueIid, newAssignees);
  }

  /**
   * Remove an assignee from an issue
   * @param issueIid - Issue IID (not global ID)
   * @param assigneeName - Name of assignee to remove
   * @param currentAssignees - Current assignee names
   */
  async removeIssueAssignee(
    issueIid: TID,
    assigneeName: string,
    currentAssignees: string[],
  ): Promise<void> {
    const newAssignees = currentAssignees.filter((a) => a !== assigneeName);
    await this.updateIssueAssignees(issueIid, newAssignees);
  }

  /**
   * Update issue labels using REST API
   * @param issueIid - Issue IID (not global ID)
   * @param labels - Array of label titles to set
   */
  async updateIssueLabels(issueIid: TID, labels: string[]): Promise<void> {
    const projectPath = this.getFullPath();
    const endpoint = `/projects/${encodeURIComponent(projectPath)}/issues/${issueIid}`;

    await gitlabRestRequest(
      endpoint,
      {
        gitlabUrl: this.config.gitlabUrl,
        token: this.config.token,
        isDev: this.isDev,
      },
      {
        method: 'PUT',
        body: JSON.stringify({
          labels: labels.join(','),
        }),
      },
    );

    console.log(
      `[GitLabGraphQL] Updated issue #${issueIid} labels to:`,
      labels,
    );
  }

  /**
   * Add a label to an issue (keeps existing labels)
   * @param issueIid - Issue IID (not global ID)
   * @param labelName - Name of label to add
   * @param currentLabels - Current label names
   */
  async addIssueLabel(
    issueIid: TID,
    labelName: string,
    currentLabels: string[],
  ): Promise<void> {
    // Don't add if already has label
    if (currentLabels.includes(labelName)) {
      console.log(
        `[GitLabGraphQL] Issue #${issueIid} already has label: ${labelName}`,
      );
      return;
    }

    const newLabels = [...currentLabels, labelName];
    await this.updateIssueLabels(issueIid, newLabels);
  }

  /**
   * Remove a label from an issue
   * @param issueIid - Issue IID (not global ID)
   * @param labelName - Name of label to remove
   * @param currentLabels - Current label names
   */
  async removeIssueLabel(
    issueIid: TID,
    labelName: string,
    currentLabels: string[],
  ): Promise<void> {
    const newLabels = currentLabels.filter((l) => l !== labelName);
    await this.updateIssueLabels(issueIid, newLabels);
  }

  /**
   * Fetch project labels (for Workload View)
   * Returns list of label titles available in the project
   */
  async getProjectLabels(): Promise<string[]> {
    const labels = await this.getProjectLabelsWithIds();
    return labels.map((l) => l.title).sort();
  }

  /**
   * Fetch labels from GitLab (project or group) with IDs
   * Returns list of labels with id and title
   * Supports pagination to handle projects with many labels (>100)
   */
  async getProjectLabelsWithIds(): Promise<
    Array<{ id: string; title: string }>
  > {
    const query = `
      query getProjectLabels($fullPath: ID!, $after: String) {
        ${this.config.type}(fullPath: $fullPath) {
          labels(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              title
            }
          }
        }
      }
    `;

    try {
      const labelsNodes = await this.queryPaginated<{
        id: string;
        title: string;
      }>(query, { fullPath: this.getFullPath() }, (result) =>
        this.extractPaginatedData(result, 'labels'),
      );

      return labelsNodes
        .filter((l) => l.id && l.title)
        .map((l) => ({ id: l.id, title: l.title }));
    } catch (error) {
      console.warn('[GitLabGraphQL] Failed to fetch project labels:', error);
      return [];
    }
  }

  /**
   * Get label global IDs by their titles
   * @param titles - Array of label titles
   * @returns Map of title -> global ID
   */
  async getLabelIdsByTitles(titles: string[]): Promise<Map<string, string>> {
    const labels = await this.getProjectLabelsWithIds();
    const result = new Map<string, string>();

    for (const title of titles) {
      const label = labels.find(
        (l) => l.title.toLowerCase() === title.toLowerCase(),
      );
      if (label) {
        result.set(title, label.id);
      }
    }

    return result;
  }

  /**
   * Fetch Epics from GitLab
   * For group config: fetches epics directly from the group
   * For project config: extracts group path from project path and fetches group epics
   * Returns list of epics with their id, iid, and title
   */
  async fetchEpics(): Promise<
    Array<{ id: number; iid: number; title: string }>
  > {
    // Determine group path based on config type
    let groupPath: string;

    if (this.config.type === 'group') {
      // Direct group access
      groupPath = this.getFullPath();
    } else {
      // For project, extract group path from project path (e.g., "mygroup/myproject" -> "mygroup")
      // Or for nested groups: "parent/child/project" -> "parent/child"
      const projectPath = this.getFullPath();
      const lastSlashIndex = projectPath.lastIndexOf('/');

      if (lastSlashIndex === -1) {
        // projectId might be a numeric ID without group path - try to get group from project info
        console.warn(
          '[GitLabGraphQL] Cannot extract group path from projectId for Epic fetch. ' +
            'Epics require a group path. projectId:',
          projectPath,
        );
        return [];
      }

      groupPath = projectPath.substring(0, lastSlashIndex);
    }

    const query = `
      query getEpics($fullPath: ID!, $after: String) {
        group(fullPath: $fullPath) {
          epics(state: opened, first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              iid
              title
              state
            }
          }
        }
      }
    `;

    try {
      const allEpics: Array<{ id: number; iid: number; title: string }> = [];
      let hasNextPage = true;
      let endCursor: string | null = null;

      // Fetch all pages
      while (hasNextPage) {
        const variables: any = {
          fullPath: groupPath,
        };

        if (endCursor) {
          variables.after = endCursor;
        }

        const result = await this.graphqlClient.query<{
          group: {
            epics: {
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
              nodes: Array<{
                id: string;
                iid: string;
                title: string;
                state: string;
              }>;
            };
          };
        }>(query, variables);

        const epics = result.group?.epics?.nodes || [];

        // Convert and add epics to array
        // Use iid as the primary identifier for filtering because:
        // - Epic API returns gid://gitlab/Epic/X
        // - WorkItem API returns gid://gitlab/WorkItem/Y for the same Epic
        // - These are different IDs! But iid is consistent across both APIs
        epics.forEach((epic) => {
          allEpics.push({
            id: Number(epic.iid), // Use iid for filtering consistency
            iid: Number(epic.iid),
            title: epic.title,
          });
        });

        hasNextPage = result.group?.epics?.pageInfo?.hasNextPage || false;
        endCursor = result.group?.epics?.pageInfo?.endCursor || null;
      }

      return allEpics.sort((a, b) => a.title.localeCompare(b.title));
    } catch (error) {
      console.warn('[GitLabGraphQL] Failed to fetch epics:', error);
      return [];
    }
  }

  // ============================================
  // Batch Update Methods for Move In... Feature
  // ============================================

  /**
   * Batch update parent for multiple work items (Tasks)
   * Used for moving Tasks to an Issue as children
   * @param childIids - Array of child work item iids to update
   * @param parentIid - Target parent Issue iid, or null to remove parent
   * @returns Result with success and failed items
   */
  async batchUpdateParent(
    childIids: number[],
    parentIid: number | null,
  ): Promise<{
    success: number[];
    failed: Array<{ iid: number; error: string }>;
  }> {
    const results: {
      success: number[];
      failed: Array<{ iid: number; error: string }>;
    } = {
      success: [],
      failed: [],
    };

    // Get parent's Global ID if specified
    let parentGlobalId: string | null = null;
    if (parentIid !== null) {
      try {
        const query = `
          query GetParentWorkItem($fullPath: ID!, $iid: String!) {
            ${this.config.type}(fullPath: $fullPath) {
              workItems(iids: [$iid], first: 1) {
                nodes {
                  id
                }
              }
            }
          }
        `;

        const queryResult = await this.graphqlClient.query<any>(query, {
          fullPath: this.getFullPath(),
          iid: String(parentIid),
        });

        parentGlobalId =
          queryResult[this.config.type]?.workItems?.nodes?.[0]?.id;

        if (!parentGlobalId) {
          // All items fail if parent not found
          childIids.forEach((iid) => {
            results.failed.push({
              iid,
              error: `Parent work item with iid ${parentIid} not found`,
            });
          });
          return results;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        childIids.forEach((iid) => {
          results.failed.push({
            iid,
            error: `Failed to get parent: ${errorMessage}`,
          });
        });
        return results;
      }
    }

    // Process each child
    for (const childIid of childIids) {
      try {
        // Get child's Global ID
        const childQuery = `
          query GetChildWorkItem($fullPath: ID!, $iid: String!) {
            ${this.config.type}(fullPath: $fullPath) {
              workItems(iids: [$iid], first: 1) {
                nodes {
                  id
                }
              }
            }
          }
        `;

        const childResult = await this.graphqlClient.query<any>(childQuery, {
          fullPath: this.getFullPath(),
          iid: String(childIid),
        });

        const childGlobalId =
          childResult[this.config.type]?.workItems?.nodes?.[0]?.id;

        if (!childGlobalId) {
          results.failed.push({
            iid: childIid,
            error: `Work item with iid ${childIid} not found`,
          });
          continue;
        }

        // Update parent using hierarchyWidget
        const mutation = `
          mutation UpdateWorkItemParent($input: WorkItemUpdateInput!) {
            workItemUpdate(input: $input) {
              workItem {
                id
              }
              errors
            }
          }
        `;

        const updateResult = await this.graphqlClient.query<any>(mutation, {
          input: {
            id: childGlobalId,
            hierarchyWidget: {
              parentId: parentGlobalId, // null removes parent
            },
          },
        });

        if (
          updateResult.workItemUpdate.errors &&
          updateResult.workItemUpdate.errors.length > 0
        ) {
          results.failed.push({
            iid: childIid,
            error: updateResult.workItemUpdate.errors.join(', '),
          });
        } else {
          results.success.push(childIid);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({
          iid: childIid,
          error: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * Batch update milestone for multiple work items
   * Used for moving Issues/Tasks to a Milestone
   * @param iids - Array of work item iids to update
   * @param milestoneIid - Target Milestone iid, or null to remove milestone
   * @returns Result with success and failed items
   */
  async batchUpdateMilestone(
    iids: number[],
    milestoneIid: number | null,
  ): Promise<{
    success: number[];
    failed: Array<{ iid: number; error: string }>;
  }> {
    const results: {
      success: number[];
      failed: Array<{ iid: number; error: string }>;
    } = {
      success: [],
      failed: [],
    };

    // Get milestone's Global ID if specified
    let milestoneGlobalId: string | null = null;
    // Ensure milestoneIid is a number for comparison
    const targetMilestoneIid =
      milestoneIid !== null ? Number(milestoneIid) : null;

    if (targetMilestoneIid !== null) {
      try {
        // Note: GitLab milestones query doesn't support filtering by iids directly,
        // so we fetch all with pagination and filter client-side
        const query = `
          query GetMilestone($fullPath: ID!, $after: String) {
            ${this.config.type}(fullPath: $fullPath) {
              milestones(includeAncestors: true, first: 100, after: $after) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  iid
                }
              }
            }
          }
        `;

        const milestones = await this.queryPaginated<{
          id: string;
          iid: string;
        }>(query, { fullPath: this.getFullPath() }, (result) =>
          this.extractPaginatedData(result, 'milestones'),
        );

        const milestone = milestones.find(
          (m) => Number(m.iid) === targetMilestoneIid,
        );

        if (milestone) {
          milestoneGlobalId = milestone.id;
        } else {
          // All items fail if milestone not found
          iids.forEach((iid) => {
            results.failed.push({
              iid,
              error: `Milestone with iid ${targetMilestoneIid} not found`,
            });
          });
          return results;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        iids.forEach((iid) => {
          results.failed.push({
            iid,
            error: `Failed to get milestone: ${errorMessage}`,
          });
        });
        return results;
      }
    }

    // Process each work item
    for (const iid of iids) {
      try {
        // Get work item's Global ID
        const workItemQuery = `
          query GetWorkItem($fullPath: ID!, $iid: String!) {
            ${this.config.type}(fullPath: $fullPath) {
              workItems(iids: [$iid], first: 1) {
                nodes {
                  id
                }
              }
            }
          }
        `;

        const workItemResult = await this.graphqlClient.query<any>(
          workItemQuery,
          {
            fullPath: this.getFullPath(),
            iid: String(iid),
          },
        );

        const workItemGlobalId =
          workItemResult[this.config.type]?.workItems?.nodes?.[0]?.id;

        if (!workItemGlobalId) {
          results.failed.push({
            iid,
            error: `Work item with iid ${iid} not found`,
          });
          continue;
        }

        // Update milestone using milestoneWidget
        const mutation = `
          mutation UpdateWorkItemMilestone($input: WorkItemUpdateInput!) {
            workItemUpdate(input: $input) {
              workItem {
                id
                widgets {
                  ... on WorkItemWidgetMilestone {
                    milestone {
                      id
                      iid
                      title
                    }
                  }
                }
              }
              errors
            }
          }
        `;

        const updateResult = await this.graphqlClient.query<any>(mutation, {
          input: {
            id: workItemGlobalId,
            milestoneWidget: {
              milestoneId: milestoneGlobalId, // null removes milestone
            },
          },
        });

        if (
          updateResult.workItemUpdate.errors &&
          updateResult.workItemUpdate.errors.length > 0
        ) {
          results.failed.push({
            iid,
            error: updateResult.workItemUpdate.errors.join(', '),
          });
        } else {
          results.success.push(iid);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({
          iid,
          error: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * Batch update epic for multiple Issues
   * Used for moving Issues to an Epic
   * Note: Epic is a parent relationship using hierarchyWidget, same as Issue-Task relationship
   * @param issueIids - Array of Issue iids to update
   * @param epicIid - Target Epic iid, or null to remove epic
   * @returns Result with success and failed items
   */
  async batchUpdateEpic(
    issueIids: number[],
    epicIid: number | null,
  ): Promise<{
    success: number[];
    failed: Array<{ iid: number; error: string }>;
  }> {
    const results: {
      success: number[];
      failed: Array<{ iid: number; error: string }>;
    } = {
      success: [],
      failed: [],
    };

    // Determine group path for Epic lookup
    // Use same logic as fetchEpics() for consistency
    let groupPath: string;
    if (this.config.type === 'group') {
      groupPath = this.getFullPath();
    } else {
      // For project config, extract group from project path
      const projectPath = this.getFullPath();
      const lastSlashIndex = projectPath.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        groupPath = projectPath.substring(0, lastSlashIndex);
      } else {
        // Cannot determine group path (projectId might be numeric)
        issueIids.forEach((iid) => {
          results.failed.push({
            iid,
            error: 'Cannot determine group path for Epic lookup',
          });
        });
        return results;
      }
    }

    // Get epic's Global ID if specified
    let epicGlobalId: string | null = null;
    if (epicIid !== null) {
      try {
        const query = `
          query GetEpic($groupPath: ID!, $iid: ID!) {
            group(fullPath: $groupPath) {
              epic(iid: $iid) {
                id
              }
            }
          }
        `;

        const queryResult = await this.graphqlClient.query<any>(query, {
          groupPath,
          iid: String(epicIid),
        });

        epicGlobalId = queryResult.group?.epic?.id;

        if (!epicGlobalId) {
          // All items fail if epic not found
          issueIids.forEach((iid) => {
            results.failed.push({
              iid,
              error: `Epic with iid ${epicIid} not found`,
            });
          });
          return results;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        issueIids.forEach((iid) => {
          results.failed.push({
            iid,
            error: `Failed to get epic: ${errorMessage}`,
          });
        });
        return results;
      }
    }

    // Process each Issue
    for (const issueIid of issueIids) {
      try {
        // Get Issue's Global ID
        const issueQuery = `
          query GetIssue($fullPath: ID!, $iid: String!) {
            ${this.config.type}(fullPath: $fullPath) {
              workItems(iids: [$iid], first: 1) {
                nodes {
                  id
                }
              }
            }
          }
        `;

        const issueResult = await this.graphqlClient.query<any>(issueQuery, {
          fullPath: this.getFullPath(),
          iid: String(issueIid),
        });

        const issueGlobalId =
          issueResult[this.config.type]?.workItems?.nodes?.[0]?.id;

        if (!issueGlobalId) {
          results.failed.push({
            iid: issueIid,
            error: `Issue with iid ${issueIid} not found`,
          });
          continue;
        }

        // Update epic parent using hierarchyWidget
        // Note: Epic is treated as a parent type in GitLab's hierarchy
        const mutation = `
          mutation UpdateIssueEpic($input: WorkItemUpdateInput!) {
            workItemUpdate(input: $input) {
              workItem {
                id
                widgets {
                  ... on WorkItemWidgetHierarchy {
                    parent {
                      id
                      iid
                    }
                  }
                }
              }
              errors
            }
          }
        `;

        const updateResult = await this.graphqlClient.query<any>(mutation, {
          input: {
            id: issueGlobalId,
            hierarchyWidget: {
              parentId: epicGlobalId, // null removes epic parent
            },
          },
        });

        if (
          updateResult.workItemUpdate.errors &&
          updateResult.workItemUpdate.errors.length > 0
        ) {
          results.failed.push({
            iid: issueIid,
            error: updateResult.workItemUpdate.errors.join(', '),
          });
        } else {
          results.success.push(issueIid);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({
          iid: issueIid,
          error: errorMessage,
        });
      }
    }

    return results;
  }
}
