/**
 * GitLab GraphQL Provider
 * Pure GraphQL implementation for GitLab integration
 */

import type { ITask, ILink, TID } from '@svar-ui/gantt-store';
import type { GitLabSyncOptions, GitLabDataResponse } from '../types/gitlab';
import { GitLabGraphQLClient } from './GitLabGraphQLClient';

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
      nodes: WorkItem[];
    };
  };
  group?: {
    workItems: {
      nodes: WorkItem[];
    };
  };
}

export class GitLabGraphQLProvider {
  private config: GitLabGraphQLProviderConfig;
  private graphqlClient: GitLabGraphQLClient;
  private updateQueue: Map<number | string, Promise<void>> = new Map();

  constructor(config: GitLabGraphQLProviderConfig) {
    this.config = config;
    this.graphqlClient = new GitLabGraphQLClient({
      gitlabUrl: config.gitlabUrl,
      token: config.token,
    });
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
  async getData(options: GitLabSyncOptions = {}): Promise<GitLabDataResponse> {
    console.log('[GitLabGraphQL] Fetching work items...');

    const query = `
      query getWorkItems($fullPath: ID!, $state: IssuableState) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(types: [ISSUE, TASK], state: $state, first: 100) {
            nodes {
              id
              iid
              title
              createdAt
              closedAt
              state
              webUrl
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
                    title
                  }
                }
                ... on WorkItemWidgetHierarchy {
                  parent {
                    id
                    iid
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

    const variables: any = {
      fullPath: this.getFullPath(),
      state: options.includeClosed ? undefined : 'opened',
    };

    const result = await this.graphqlClient.query<WorkItemsResponse>(
      query,
      variables,
    );

    const workItems =
      this.config.type === 'group'
        ? result.group?.workItems.nodes || []
        : result.project?.workItems.nodes || [];

    console.log(`[GitLabGraphQL] Fetched ${workItems.length} work items`);

    // Log raw work items to debug date issues
    workItems.forEach((wi) => {
      const dateWidget = wi.widgets.find(
        (w) => w.startDate !== undefined || w.dueDate !== undefined,
      );
      console.log(`[GitLabGraphQL] WorkItem ${wi.iid} raw dates:`, {
        startDate: dateWidget?.startDate,
        dueDate: dateWidget?.dueDate,
      });
    });

    // Convert work items to tasks
    let tasks: ITask[] = workItems.map((wi) => this.convertWorkItemToTask(wi));

    // Sort tasks by display order if available
    tasks = this.sortTasksByOrder(tasks);

    // Calculate spanning dates for parent tasks
    tasks = this.calculateSpanningDates(tasks);

    // Fetch links (related work items)
    console.log('[GitLabGraphQL] Fetching work item links...');
    const links = await this.fetchWorkItemLinks(workItems);
    console.log('[GitLabGraphQL] Found', links.length, 'links');

    return {
      tasks,
      links,
      milestones: [], // TODO: Fetch milestones if needed
      epics: [], // TODO: Fetch epics if needed
    };
  }

  /**
   * Sort tasks by display order (within same parent)
   * Tasks with order metadata are sorted first, then by creation date
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
    tasksByParent.forEach((parentTasks) => {
      parentTasks.sort((a, b) => {
        const orderA = a.$custom?.displayOrder;
        const orderB = b.$custom?.displayOrder;

        // Both have order: sort by order
        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB;
        }

        // Only a has order: a comes first
        if (orderA !== undefined) {
          return -1;
        }

        // Only b has order: b comes first
        if (orderB !== undefined) {
          return 1;
        }

        // Neither has order: sort by ID (creation order)
        return Number(a.id) - Number(b.id);
      });

      sortedTasks.push(...parentTasks);
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

          // If parent's dates equal children's span, give parent a smaller default range
          // so the two bars don't completely overlap
          let parentStart = task.start;
          let parentEnd = task.end;

          if (parentStart && parentEnd) {
            const parentStartTime = new Date(parentStart).getTime();
            const parentEndTime = new Date(parentEnd).getTime();
            const spanStartTime = spanStart.getTime();
            const spanEndTime = spanEnd.getTime();

            // If parent dates equal children span, shrink parent to 50% of the range
            if (
              parentStartTime === spanStartTime &&
              parentEndTime === spanEndTime
            ) {
              const totalDuration = spanEndTime - spanStartTime;
              const quarterDuration = totalDuration * 0.25;
              parentStart = new Date(spanStartTime + quarterDuration);
              parentEnd = new Date(spanEndTime - quarterDuration);

              console.log(
                '[GitLabProvider] Parent dates equal children span, adjusting parent to:',
                {
                  taskId: task.id,
                  newParentStart: parentStart,
                  newParentEnd: parentEnd,
                },
              );
            }
          }

          // Main bar keeps the task's original dates (adjustable)
          // Baseline bar shows the subtask span (read-only reference)
          return {
            ...task,
            // Use 'task' type to avoid summary's auto-calculation behavior
            // Mark it as parent for styling
            type: 'task',
            $parent: true, // Custom flag for CSS styling
            // Keep original dates for main bar
            start: parentStart,
            end: parentEnd,
            duration: task.duration,
            // Store subtask span as baseline
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
   * Extract display order from description metadata
   * Looks for <!-- gantt:order=123 --> in description
   */
  private extractOrderFromDescription(description: string): {
    description: string;
    order: number | null;
  } {
    const orderRegex = /<!--\s*gantt:order=(\d+)\s*-->/;
    const match = description.match(orderRegex);

    if (match) {
      const order = parseInt(match[1], 10);
      // Remove the metadata comment from description
      const cleanDescription = description.replace(orderRegex, '').trim();
      return { description: cleanDescription, order };
    }

    return { description, order: null };
  }

  /**
   * Inject display order into description as metadata
   * Adds <!-- gantt:order=123 --> at the beginning
   */
  private injectOrderIntoDescription(
    description: string,
    order: number,
  ): string {
    // Remove existing order metadata if present
    const cleanDescription = description
      .replace(/<!--\s*gantt:order=\d+\s*-->/, '')
      .trim();
    // Add new order metadata at the beginning
    return `<!-- gantt:order=${order} -->\n${cleanDescription}`;
  }

  /**
   * Convert GraphQL WorkItem to Gantt Task
   */
  private convertWorkItemToTask(workItem: WorkItem): ITask {
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

    // Extract description and parse order metadata
    const rawDescription = descriptionWidget?.description || '';
    const { description, order } =
      this.extractOrderFromDescription(rawDescription);

    // Determine parent: use hierarchy parent if available, otherwise use milestone
    let parent = 0;
    if (hierarchyWidget?.parent) {
      parent = Number(hierarchyWidget.parent.iid);
    } else if (milestoneWidget?.milestone) {
      // Use milestone as parent for backward compatibility
      parent = 0; // We don't map milestones to parent in this version
    }

    const task: ITask = {
      id: Number(workItem.iid),
      text: workItem.title,
      start: startDate,
      end: endDate,
      duration,
      progress,
      type: 'task',
      details: description,
      parent,
      assigned: assignees,
      labels,
      weight: weightWidget?.weight,
      state: workItem.state,
      web_url: workItem.webUrl,
      $custom: order !== null ? { displayOrder: order } : undefined,
      _gitlab: {
        id: workItem.id, // Global ID
        iid: Number(workItem.iid),
        state: workItem.state,
      },
    };

    console.log(
      '[GitLabGraphQL] Converted work item:',
      workItem.iid,
      '→',
      task,
    );

    return task;
  }

  /**
   * Update work item using GraphQL mutation
   * Uses queue to prevent race conditions
   */
  async updateWorkItem(id: TID, task: Partial<ITask>): Promise<void> {
    console.log('[GitLabGraphQL] updateWorkItem called with:', { id, task });

    // Wait for any pending update for this task to complete
    const pendingUpdate = this.updateQueue.get(id);
    if (pendingUpdate) {
      console.log('[GitLabGraphQL] Waiting for pending update to complete...');
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
   * Batch update task order for multiple tasks
   * This is more efficient than updating one by one
   */
  async updateTasksOrder(
    tasks: Array<{ id: TID; order: number }>,
  ): Promise<void> {
    console.log(
      `[GitLabGraphQL] Batch updating order for ${tasks.length} tasks`,
    );

    // 1. Batch fetch all work items data (global ID + description) in one query
    const iids = tasks.map((t) => t.id);
    const dataMap = await this.getBatchWorkItemsData(iids);

    // 2. Update each task (still needs individual mutations unfortunately)
    for (const { id, order } of tasks) {
      const data = dataMap.get(id);
      if (!data) {
        console.error(`[GitLabGraphQL] No data found for task ${id}`);
        continue;
      }

      // Inject order into description
      const newDescription = this.injectOrderIntoDescription(
        data.description,
        order,
      );

      // Perform mutation
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

      const input = {
        id: data.globalId,
        descriptionWidget: {
          description: newDescription,
        },
      };

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
          `[GitLabGraphQL] Failed to update order for task ${id}:`,
          result.workItemUpdate.errors,
        );
      }
    }

    console.log('[GitLabGraphQL] Batch update completed');
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

    // Description (with order metadata if provided)
    if (
      task.details !== undefined ||
      task.$custom?.displayOrder !== undefined
    ) {
      let description: string;

      // If details is not provided, we need to fetch current description from GitLab
      if (
        task.details === undefined &&
        task.$custom?.displayOrder !== undefined
      ) {
        description = await this.getWorkItemDescription(id);
      } else {
        description = task.details !== undefined ? task.details : '';
      }

      // Inject order metadata if provided
      if (task.$custom?.displayOrder !== undefined) {
        description = this.injectOrderIntoDescription(
          description,
          task.$custom.displayOrder,
        );
      }

      input.descriptionWidget = {
        description,
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
   * Get work item global ID from IID
   */
  /**
   * Get work item description by IID
   */
  private async getWorkItemDescription(iid: TID): Promise<string> {
    const query = `
      query getWorkItemDescription($fullPath: ID!, $iid: String!) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(iids: [$iid]) {
            nodes {
              widgets {
                __typename
                ... on WorkItemWidgetDescription {
                  description
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      fullPath: this.getFullPath(),
      iid: String(iid),
    };

    const result = await this.graphqlClient.query<WorkItemsResponse>(
      query,
      variables,
    );

    const workItems =
      this.config.type === 'group'
        ? result.group?.workItems.nodes || []
        : result.project?.workItems.nodes || [];

    if (!workItems || workItems.length === 0) {
      throw new Error(`Work item with IID ${iid} not found`);
    }

    const descriptionWidget = workItems[0].widgets?.find(
      (w: any) => w.__typename === 'WorkItemWidgetDescription',
    ) as any;

    return descriptionWidget?.description || '';
  }

  /**
   * Batch fetch work items data (global ID and description) for multiple IIDs
   */
  private async getBatchWorkItemsData(
    iids: TID[],
  ): Promise<Map<TID, { globalId: string; description: string }>> {
    const query = `
      query getBatchWorkItems($fullPath: ID!, $iids: [String!]!) {
        ${this.config.type}(fullPath: $fullPath) {
          workItems(iids: $iids) {
            nodes {
              id
              iid
              widgets {
                __typename
                ... on WorkItemWidgetDescription {
                  description
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

    const dataMap = new Map<TID, { globalId: string; description: string }>();

    for (const wi of workItems) {
      const descriptionWidget = wi.widgets?.find(
        (w: any) => w.__typename === 'WorkItemWidgetDescription',
      ) as any;

      dataMap.set(Number(wi.iid), {
        globalId: wi.id,
        description: descriptionWidget?.description || '',
      });
    }

    return dataMap;
  }

  private async getWorkItemGlobalId(iid: TID): Promise<string> {
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
      iid: String(iid),
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

    const mutation = `
      mutation CreateWorkItem($input: WorkItemCreateInput!) {
        workItemCreate(input: $input) {
          workItem {
            id
            iid
            title
            state
            createdAt
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

    const variables = {
      input: {
        ...pathInput,
        workItemTypeId,
        title: task.text || 'New Task',
        ...(task.details && {
          descriptionWidget: {
            description: task.details,
          },
        }),
        ...(task.start || task.end
          ? {
              startAndDueDateWidget: {
                ...(task.start && {
                  startDate: task.start.toISOString().split('T')[0],
                }),
                ...(task.end && {
                  dueDate: task.end.toISOString().split('T')[0],
                }),
              },
            }
          : {}),
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
    console.log('[GitLabGraphQL] Linking work item as child:', {
      childGlobalId,
      parentIid,
    });

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

    console.log('[GitLabGraphQL] Successfully linked work items');
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
   */
  async deleteIssue(id: TID): Promise<void> {
    return this.deleteWorkItem(id);
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

      console.log(
        `[GitLabGraphQL] WorkItem ${workItem.iid} linkedItemsWidget:`,
        linkedItemsWidget,
      );

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

        console.log(
          `[GitLabGraphQL] Checking link from ${sourceIid} to ${targetIid} (type: ${linkType})`,
        );

        if (!iidMap.has(targetIid)) {
          // Skip if target is not in our task list
          console.log(
            `[GitLabGraphQL] Skipping link to ${targetIid} (not in task list)`,
          );
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
          console.log(
            `[GitLabGraphQL] Skipping duplicate link: ${sourceIid} -> ${targetIid} (${linkType})`,
          );
          continue;
        }

        // Mark this link as processed
        processedLinks.add(linkIdentifier);

        console.log(
          `[GitLabGraphQL] Adding link: ${linkSource} -> ${linkTarget} (${linkType} => ${ganttLinkType})`,
        );

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
   * Create issue link (not yet implemented for GraphQL)
   */
  async createIssueLink(link: Partial<ILink>): Promise<void> {
    console.warn(
      '[GitLabGraphQL] createIssueLink is not yet implemented for Work Items API',
    );
    // TODO: Implement using workItemAddLinkedItems mutation
    throw new Error('Creating links is not yet supported with Work Items API');
  }

  /**
   * Delete issue link (not yet implemented for GraphQL)
   */
  async deleteIssueLink(linkId: TID, sourceIid: TID): Promise<void> {
    console.warn(
      '[GitLabGraphQL] deleteIssueLink is not yet implemented for Work Items API',
    );
    // TODO: Implement using workItemRemoveLinkedItems mutation
    throw new Error('Deleting links is not yet supported with Work Items API');
  }
}
