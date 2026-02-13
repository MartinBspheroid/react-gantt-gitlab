/**
 * Generic data provider interface for task management systems
 *
 * This interface abstracts the data source from the UI layer.
 * Any data source implementing this interface can work with the Gantt chart.
 *
 * Key design principles:
 * - Data-agnostic: No references to specific backends
 * - Sync-based: Fetch all data for a time period in one operation
 * - Extensible: metadata field allows source-specific data
 */

import type { ITask, ILink } from '@svar-ui/gantt-store';

/**
 * Configuration for data provider
 * Specifies the data source type and connection details
 */
export interface DataProviderConfig {
  /** Type of data source */
  type: string;

  /** URL of the data source */
  sourceUrl?: string;

  /** Authentication credentials (format depends on type) */
  credentials?: unknown;

  /** Project/repository ID in the source system */
  projectId?: string | number;

  /** Source-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for syncing data from the source
 */
export interface SyncOptions {
  /** Include closed/completed items */
  includeClosed?: boolean;

  /** Apply server-side filters to reduce data transfer */
  filters?: FilterOptions;

  /** Progress callback for long-running syncs */
  onProgress?: SyncProgressCallback;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Filter options for data queries
 * These should map to common concepts across different data sources
 */
export interface FilterOptions {
  /** Filter by milestone/iteration title */
  milestones?: string[];

  /** Filter by label/tag */
  labels?: string[];

  /** Filter by assignee username/id */
  assignees?: string[];

  /** Filter by item state (open, closed, etc) */
  states?: string[];

  /** Source-specific filters (passed through to provider) */
  sourceFilters?: Record<string, unknown>;
}

/**
 * Result of a sync operation
 */
export interface DataResponse {
  /** All tasks/issues for the project */
  tasks: ITask[];

  /** All dependencies between tasks */
  links: ILink[];

  /** Source-specific metadata (milestones, epics, etc) */
  metadata?: Record<string, unknown>;
}

/**
 * Options for a data provider to retrieve available filter values
 */
export interface FilterOptionsData {
  /** Available people/assignees */
  members: Array<{ username: string; name: string }>;

  /** Available labels */
  labels: Array<{ title: string; color?: string; priority?: number | null }>;

  /** Available milestones/iterations */
  milestones: Array<{ id: string | number; title: string }>;
}

/**
 * Progress callback during sync
 */
export type SyncProgressCallback = (progress: SyncProgress) => void;

export interface SyncProgress {
  /** Current step in the sync process */
  step: string;

  /** Current count (items synced) */
  current: number;

  /** Total to process (if known) */
  total?: number;

  /** Percentage complete (0-100) */
  percent?: number;
}

/**
 * Result of a batch operation
 */
export interface BatchOperationResult {
  /** Successfully updated item IIDs */
  success: number[];

  /** Failed items with error details */
  failed: Array<{
    iid: number;
    error: string;
  }>;
}

/**
 * Generic interface that all data providers must implement
 *
 * This is the contract that UI components use to fetch and modify data.
 * Implementation details (API calls, caching, etc) are hidden behind this interface.
 */
export interface DataProviderInterface {
  /**
   * Sync data from the source
   * Fetches all tasks and links matching the sync options
   */
  sync(options?: SyncOptions): Promise<DataResponse>;

  /**
   * Update a single task in the source system
   * Performs server-side update and returns updated task data
   */
  syncTask(id: string | number, updates: Partial<ITask>): Promise<ITask>;

  /**
   * Create a new task in the source system
   */
  createTask(task: Partial<ITask>): Promise<ITask>;

  /**
   * Delete a task from the source system
   */
  deleteTask(id: string | number): Promise<void>;

  /**
   * Create a dependency link between two tasks
   */
  createLink(link: Partial<ILink>): Promise<ILink>;

  /**
   * Delete a dependency link
   * metadata may contain source-specific info needed for deletion
   */
  deleteLink(linkId: string | number, metadata?: unknown): Promise<void>;

  /**
   * Reorder a task relative to another task
   * Used for kanban-style task ordering
   */
  reorderTask(
    taskId: string | number,
    targetId: string | number,
    position: 'before' | 'after',
  ): Promise<void>;

  /**
   * Get available filter options (members, labels, milestones)
   * Used to populate filter UI
   */
  getFilterOptions(): Promise<FilterOptionsData>;

  /**
   * Reorder a work item relative to another work item
   * Similar to reorderTask but uses source system IIDs
   * Used for kanban-style ordering in the source system
   */
  reorderWorkItem(
    taskId: string | number,
    targetId: string | number,
    position: 'before' | 'after',
  ): Promise<void>;

  /**
   * Batch update parent for multiple items
   * @param iids - Array of item IIDs to update
   * @param parentId - The new parent ID to set
   * @returns Result with success and failed arrays
   */
  batchUpdateParent(
    iids: number[],
    parentId: string | number,
  ): Promise<BatchOperationResult>;

  /**
   * Batch update milestone for multiple items
   * @param iids - Array of item IIDs to update
   * @param milestoneId - The new milestone ID to set
   * @returns Result with success and failed arrays
   */
  batchUpdateMilestone(
    iids: number[],
    milestoneId: string | number,
  ): Promise<BatchOperationResult>;

  /**
   * Batch update epic for multiple items
   * @param iids - Array of item IIDs to update
   * @param epicId - The new epic ID to set
   * @returns Result with success and failed arrays
   */
  batchUpdateEpic(
    iids: number[],
    epicId: string | number,
  ): Promise<BatchOperationResult>;

  /**
   * Check if current user can edit data
   */
  checkCanEdit(): Promise<boolean>;

  /**
   * Get the current configuration
   */
  getConfig(): DataProviderConfig;
}
