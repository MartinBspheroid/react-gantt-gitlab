/**
 * GitLab GraphQL Provider
 * Pure GraphQL implementation for GitLab integration
 */

import type { ITask, ILink, TID } from '@svar-ui/gantt-store';
import type { GitLabSyncOptions, GitLabDataResponse } from '../types/gitlab';
import { GitLabGraphQLClient } from './GitLabGraphQLClient';
import { gitlabRestRequest } from './GitLabApiUtils';

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
   * Fetch all work items (issues) using GraphQL
   */
  async getData(
    options: GitLabSyncOptions & { enablePagination?: boolean } = {},
  ): Promise<GitLabDataResponse> {
    // Fetching work items and milestones

    // Query for work items with pagination
    const workItemsQuery = `
      query getWorkItems($fullPath: ID!, $state: IssuableState, $after: String) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(types: [ISSUE, TASK], state: $state, first: 100, after: $after) {
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
    const issuesQuery = `
      query getIssues($fullPath: ID!, $state: IssuableState, $after: String) {
        ${this.config.type}(fullPath: $fullPath) {
          issues(state: $state, first: 100, after: $after) {
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

    const variables: any = {
      fullPath: this.getFullPath(),
      state: options.includeClosed ? undefined : 'opened',
    };

    // Fetch work items with optional pagination
    const enablePagination = options.enablePagination !== false; // Default to true
    const MAX_PAGES = enablePagination ? 3 : 1; // If pagination enabled, limit to 3 pages (300 items)
    const allWorkItems: WorkItem[] = [];
    let hasNextPage = true;
    let endCursor: string | null = null;
    let pageCount = 0;

    while (hasNextPage && pageCount < MAX_PAGES) {
      const paginatedVariables = { ...variables, after: endCursor };
      const workItemsResult = await this.graphqlClient.query<WorkItemsResponse>(
        workItemsQuery,
        paginatedVariables,
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

    // Fetch milestones (usually fewer, so use smaller limit)
    const allMilestones: GitLabMilestone[] = [];
    hasNextPage = true;
    endCursor = null;
    pageCount = 0;
    const MAX_MILESTONE_PAGES = enablePagination ? 2 : 1; // Maximum 200 milestones if pagination enabled

    while (hasNextPage && pageCount < MAX_MILESTONE_PAGES) {
      const milestonesResult = await this.graphqlClient.query<any>(
        milestonesQuery,
        {
          fullPath: this.getFullPath(),
          after: endCursor,
        },
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
      } else {
        hasNextPage = false;
      }
    }

    console.log(`[GitLabGraphQL] Fetched ${allMilestones.length} milestones`);

    // Fetch issues for relativePosition (same limit as work items)
    const allIssuesWithPosition: { iid: string; relativePosition: number }[] =
      [];
    hasNextPage = true;
    endCursor = null;
    pageCount = 0;

    try {
      const MAX_ISSUE_PAGES = enablePagination ? 3 : 1; // Same as work items
      while (hasNextPage && pageCount < MAX_ISSUE_PAGES) {
        const issuesResult = await this.graphqlClient.query<any>(issuesQuery, {
          ...variables,
          after: endCursor,
        });

        const issuesData =
          this.config.type === 'group'
            ? issuesResult.group?.issues
            : issuesResult.project?.issues;

        if (issuesData) {
          allIssuesWithPosition.push(...issuesData.nodes);
          hasNextPage = issuesData.pageInfo?.hasNextPage || false;
          endCursor = issuesData.pageInfo?.endCursor || null;
          pageCount++;
        } else {
          hasNextPage = false;
        }
      }
    } catch (error) {
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

    // Use numeric ID with offset to avoid conflicts with work item IIDs
    // Offset: 10000 (e.g., milestone iid=1 becomes 10001)
    const milestoneTaskId = 10000 + Number(milestone.iid);

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
    );
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

    // Extract assignees
    const assignees =
      assigneesWidget?.assignees?.nodes.map((a) => a.name).join(', ') || '';

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
    //   - In our Gantt: We use 'parent' field to show Issues under Milestones (parent = 10000 + milestone.iid)
    //   - In our Gantt: Epic parents are NOT supported, Issues with Epic parents appear at root with [Epic #] notation
    //
    // For GitLab Tasks:
    //   - In GitLab API: Tasks have hierarchical parent (another Issue or Task)
    //   - In our Gantt: We use 'parent' field to maintain this hierarchy (parent = parent.iid)
    //
    // Parent ID ranges:
    //   - 0: Root level (no parent)
    //   - 1-9999: Regular work item IDs (Issues/Tasks) or Epic IDs (not displayed)
    //   - 10000+: Milestone IDs (offset by 10000 to avoid conflicts)

    let parent: number = 0;
    let parentIid: number | null = null;
    let epicParentId: number | null = null;

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
      parent = 10000 + Number(milestoneWidget.milestone.iid);
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
      assigned: assignees,
      labels,
      weight: weightWidget?.weight,
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
        web_url: workItem.webUrl, // GitLab web URL for opening in browser
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
    // Check if this is a milestone (ID >= 10000)
    if (Number(id) >= 10000) {
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

    // For root level Issues, use relativePosition
    const issuesQuery = `
      query getIssuesPosition($fullPath: ID!) {
        ${this.config.type}(fullPath: $fullPath) {
          issues(first: 100) {
            nodes {
              iid
              relativePosition
            }
          }
        }
      }
    `;

    const issuesResult = await this.graphqlClient
      .query<any>(issuesQuery, {
        fullPath: this.getFullPath(),
      })
      .catch(() => ({ [this.config.type]: { issues: { nodes: [] } } }));

    const relativePositionMap = new Map<number, number>();
    const issues =
      this.config.type === 'group'
        ? issuesResult.group?.issues.nodes || []
        : issuesResult.project?.issues.nodes || [];

    issues.forEach((issue: any) => {
      if (
        issue.relativePosition !== null &&
        issue.relativePosition !== undefined
      ) {
        relativePositionMap.set(Number(issue.iid), issue.relativePosition);
      }
    });

    // Query all work items to find root-level siblings
    const query = `
      query getSiblingTasks($fullPath: ID!) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(types: [ISSUE, TASK], first: 100) {
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

    const result = await this.graphqlClient.query<WorkItemsResponse>(query, {
      fullPath: this.getFullPath(),
    });

    const workItems =
      this.config.type === 'group'
        ? result.group?.workItems.nodes || []
        : result.project?.workItems.nodes || [];

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
        // Don't fail the whole operation if linking fails
      }
    }

    return createdTask;
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
        milestoneId = String(milestone._gitlab.id || Number(id) - 10000);
      }
    } else if (milestone._gitlab?.id) {
      // Fallback: use iid (may cause 404 if iid !== internal ID)
      console.warn(
        '[GitLabGraphQL] Using iid as fallback for milestone update, may cause 404',
      );
      milestoneId = String(milestone._gitlab.id);
    } else {
      // Last resort: calculate from task ID (may cause 404)
      console.warn(
        '[GitLabGraphQL] No milestone ID info, using calculated iid',
      );
      milestoneId = String(Number(id) - 10000);
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

        links.push({
          id: linkIdCounter++,
          source: linkSource,
          target: linkTarget,
          type: ganttLinkType,
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
   */
  async deleteIssueLink(linkId: TID, sourceIid: TID): Promise<void> {
    // Deleting issue link

    // Get global ID for source work item
    const sourceGlobalId = await this.getWorkItemGlobalId(sourceIid);

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
        workItemsLinkIds: [linkId],
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
   * Check if current user has edit permissions (Maintainer+) for the project
   * Uses userPermissions.pushCode as proxy for Maintainer access
   */
  async checkCanEdit(): Promise<boolean> {
    const query = `
      query checkProjectPermissions($fullPath: ID!) {
        ${this.config.type}(fullPath: $fullPath) {
          userPermissions {
            pushCode
            createSnippet
          }
        }
      }
    `;

    try {
      const result = await this.graphqlClient.query<{
        project?: {
          userPermissions: {
            pushCode: boolean;
            createSnippet: boolean;
          };
        };
        group?: {
          userPermissions: {
            pushCode: boolean;
            createSnippet: boolean;
          };
        };
      }>(query, { fullPath: this.getFullPath() });

      const permissions =
        this.config.type === 'group'
          ? result.group?.userPermissions
          : result.project?.userPermissions;

      // User can edit if they can create snippets (Maintainer+ permission)
      return permissions?.createSnippet ?? false;
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
   * Fetch project members (for Workload View)
   * Returns list of member names who have access to the project
   */
  async getProjectMembers(): Promise<string[]> {
    const query = `
      query getProjectMembers($fullPath: ID!) {
        ${this.config.type}(fullPath: $fullPath) {
          projectMembers(first: 100) {
            nodes {
              user {
                name
                username
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.graphqlClient.query<any>(query, {
        fullPath: this.getFullPath(),
      });

      const members =
        this.config.type === 'group'
          ? result.group?.projectMembers?.nodes || []
          : result.project?.projectMembers?.nodes || [];

      // Extract unique member names
      const names = members
        .map((m: any) => m.user?.name)
        .filter((name: string | undefined) => name);

      return [...new Set(names)].sort() as string[];
    } catch (error) {
      console.warn('[GitLabGraphQL] Failed to fetch project members:', error);
      return [];
    }
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
        // Search for user by name
        const users = await gitlabRestRequest<{ id: number; name: string }[]>(
          `/users?search=${encodeURIComponent(name)}`,
          {
            gitlabUrl: this.config.gitlabUrl,
            token: this.config.token,
            isDev: this.isDev,
          },
        );

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
    const query = `
      query getProjectLabels($fullPath: ID!) {
        ${this.config.type}(fullPath: $fullPath) {
          labels(first: 100) {
            nodes {
              title
            }
          }
        }
      }
    `;

    try {
      const result = await this.graphqlClient.query<any>(query, {
        fullPath: this.getFullPath(),
      });

      const labels =
        this.config.type === 'group'
          ? result.group?.labels?.nodes || []
          : result.project?.labels?.nodes || [];

      // Extract label titles
      return labels
        .map((l: any) => l.title)
        .filter((title: string | undefined) => title)
        .sort();
    } catch (error) {
      console.warn('[GitLabGraphQL] Failed to fetch project labels:', error);
      return [];
    }
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
      groupPath = String(this.config.groupId);
    } else {
      // For project, extract group path from project path (e.g., "mygroup/myproject" -> "mygroup")
      // Or for nested groups: "parent/child/project" -> "parent/child"
      const projectPath = String(this.config.projectId);
      const lastSlashIndex = projectPath.lastIndexOf('/');

      if (lastSlashIndex === -1) {
        // No group in path (shouldn't happen for GitLab projects)
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
}
