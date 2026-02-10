/**
 * useDataSync Hook
 * React hook for managing data synchronization with Gantt
 *
 * This is a data-source agnostic version of useGitLabSync.
 * It works with any provider implementing DataProviderInterface.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ITask, ILink } from '@svar-ui/gantt-store';
import type {
  DataProviderInterface,
  SyncOptions,
} from '../providers/core/DataProviderInterface';
import type { SyncProgress } from '../types/syncProgress';

export interface SyncState {
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSyncTime: Date | null;
  /** Sync progress info (available during sync) */
  progress: SyncProgress | null;
}

export interface UseDataSyncOptions {
  /** Callback for non-fatal warnings (e.g., subtask linking failed) */
  onWarning?: (message: string) => void;
}

export interface DataSyncResult {
  tasks: ITask[];
  links: ILink[];
  metadata: Record<string, unknown>;
  syncState: SyncState;
  sync: (options?: SyncOptions) => Promise<void>;
  syncTask: (id: number | string, updates: Partial<ITask>) => Promise<ITask>;
  reorderTaskLocal: (
    taskId: number | string,
    targetTaskId: number | string,
    position: 'before' | 'after',
  ) => { rollback: () => void };
  createTask: (task: Partial<ITask>) => Promise<ITask>;
  deleteTask: (id: number | string, taskData?: ITask) => Promise<void>;
  createLink: (link: Partial<ILink>) => Promise<ILink>;
  deleteLink: (linkId: number | string, metadata?: unknown) => Promise<void>;
}

export function useDataSync(
  provider: DataProviderInterface | null,
  autoSync = false,
  syncInterval = 60000, // 60 seconds
  options: UseDataSyncOptions = {},
): DataSyncResult {
  const { onWarning } = options;
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [links, setLinks] = useState<ILink[]>([]);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [syncState, setSyncState] = useState<SyncState>({
    isLoading: true,
    isSyncing: false,
    error: null,
    lastSyncTime: null,
    progress: null,
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const tasksRef = useRef<ITask[]>(tasks);
  const onWarningRef = useRef(onWarning);
  // AbortController for cancelling in-flight sync requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep refs in sync
  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  // Keep tasksRef in sync with tasks state
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  /**
   * Main sync function to fetch data from provider
   * Supports cancellation via AbortController when provider changes or new sync starts
   */
  const sync = useCallback(
    async (syncOptions?: SyncOptions) => {
      if (!provider) {
        setSyncState((prev) => ({
          ...prev,
          error: 'Data provider not initialized',
        }));
        return;
      }

      // Cancel any in-flight sync request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this sync
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setSyncState((prev) => ({
        ...prev,
        isSyncing: true,
        error: null,
        progress: null,
      }));

      // Progress callback that updates state
      const onProgress = (progress: SyncProgress) => {
        if (isMountedRef.current && !abortController.signal.aborted) {
          setSyncState((prev) => ({
            ...prev,
            progress,
          }));
        }
      };

      try {
        const data = await provider.sync({
          ...syncOptions,
          signal: abortController.signal,
          onProgress,
        });

        console.log(
          '[useDataSync] Sync completed, received links:',
          data.links.map((l) => ({
            id: l.id,
            source: l.source,
            target: l.target,
          })),
        );

        // Only update state if not aborted and still mounted
        if (isMountedRef.current && !abortController.signal.aborted) {
          setTasks(data.tasks);
          setLinks(data.links);
          setMetadata(data.metadata || {});

          setSyncState({
            isLoading: false,
            isSyncing: false,
            error: null,
            lastSyncTime: new Date(),
            progress: null,
          });
        }
      } catch (error) {
        // Handle abort specifically - don't set error state for aborts
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('[useDataSync] Sync aborted');
          return;
        }

        console.error('Data sync error:', error);

        if (isMountedRef.current) {
          setSyncState((prev) => ({
            ...prev,
            isLoading: false,
            isSyncing: false,
            error: error instanceof Error ? error.message : 'Sync failed',
            progress: null,
          }));
        }
      }
    },
    [provider],
  );

  /**
   * Sync a single task update with optimistic update
   * Updates local state immediately, then syncs to provider.
   * On failure, reverts local state and throws error.
   */
  const syncTask = useCallback(
    async (id: number | string, updates: Partial<ITask>): Promise<ITask> => {
      if (!provider) {
        throw new Error('Data provider not initialized');
      }

      // Capture snapshot for potential rollback
      const previousTasks = tasksRef.current;
      const taskIndex = previousTasks.findIndex((t) => t.id === id);

      if (taskIndex === -1) {
        throw new Error(`Task ${id} not found`);
      }

      // Optimistic update: apply changes to local state immediately
      const updatedTasks = [...previousTasks];
      updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], ...updates };
      setTasks(updatedTasks);
      tasksRef.current = updatedTasks;

      try {
        // Sync to provider
        const result = await provider.syncTask(id, updates);
        return result;
      } catch (error) {
        console.error('Failed to sync task update:', error);

        // Rollback: restore previous state
        setTasks(previousTasks);
        tasksRef.current = previousTasks;

        throw error;
      }
    },
    [provider],
  );

  /**
   * Optimistically reorder a task's position relative to a target task.
   *
   * Algorithm: Midpoint Calculation
   * Instead of modifying the underlying system immediately,
   * we assign a temporary _localOrder value that positions the task correctly
   * in the sort order. The value is calculated as the midpoint between the
   * target and its neighbor:
   *
   * - Place after target: _localOrder = (target + next) / 2
   * - Place before target: _localOrder = (prev + target) / 2
   *
   * This ensures stable sorting during rapid consecutive drags without
   * waiting for provider API responses.
   *
   * @param taskId - The ID of the task to move
   * @param targetTaskId - The ID of the target task
   * @param position - 'before' or 'after' the target
   * @returns Object with rollback function to restore previous state on failure
   */
  const reorderTaskLocal = useCallback(
    (
      taskId: number | string,
      targetTaskId: number | string,
      position: 'before' | 'after',
    ): { rollback: () => void } => {
      const previousTasks = tasksRef.current;

      // Early exit if dropping on self (no-op)
      if (taskId === targetTaskId) {
        return { rollback: () => {} };
      }

      const task = previousTasks.find((t) => t.id === taskId);
      const targetTask = previousTasks.find((t) => t.id === targetTaskId);

      if (!task || !targetTask) {
        return { rollback: () => {} };
      }

      // Get sort value: prefer _localOrder (from previous drag), then provider-specific sort key, then id
      // Subclasses can override getSortValue if they have provider-specific sort fields
      const getSortValue = (t: ITask): number =>
        t._localOrder ?? (t as any)._sortKey ?? (t.id as number);

      // Sort all tasks (excluding the dragged one) to find correct neighbors
      const otherTasks = previousTasks
        .filter((t) => t.id !== taskId)
        .map((t) => ({ task: t, sortValue: getSortValue(t) }))
        .sort((a, b) => a.sortValue - b.sortValue);

      // Find target's position in sorted list
      const targetIdx = otherTasks.findIndex((t) => t.task.id === targetTaskId);
      if (targetIdx === -1) {
        return { rollback: () => {} };
      }

      const targetSortValue = otherTasks[targetIdx].sortValue;

      // Calculate midpoint between target and neighbor
      let newLocalOrder: number;

      if (position === 'after') {
        const nextTask = otherTasks[targetIdx + 1];
        newLocalOrder = nextTask
          ? (targetSortValue + nextTask.sortValue) / 2
          : targetSortValue + 1;
      } else {
        const prevTask = otherTasks[targetIdx - 1];
        newLocalOrder = prevTask
          ? (prevTask.sortValue + targetSortValue) / 2
          : targetSortValue - 1;
      }

      // Only update the dragged task's _localOrder
      const updatedTasks = previousTasks.map((t) =>
        t.id === taskId ? { ...t, _localOrder: newLocalOrder } : t,
      );

      setTasks(updatedTasks);
      tasksRef.current = updatedTasks;

      return {
        rollback: () => {
          setTasks(previousTasks);
          tasksRef.current = previousTasks;
        },
      };
    },
    [],
  );

  /**
   * Create a new task
   */
  const createTask = useCallback(
    async (task: Partial<ITask>): Promise<ITask> => {
      if (!provider) {
        throw new Error('Data provider not initialized');
      }

      try {
        const createdTask = await provider.createTask(task);

        // Add to local state for instant feedback
        setTasks((prevTasks) => [...prevTasks, createdTask]);

        return createdTask;
      } catch (error) {
        console.error('Failed to create task:', error);
        throw error;
      }
    },
    [provider],
  );

  /**
   * Delete a task
   */
  const deleteTask = useCallback(
    async (id: number | string, taskData?: ITask) => {
      if (!provider) {
        throw new Error('Data provider not initialized');
      }

      // Optimistic update
      setTasks((prevTasks) => prevTasks.filter((t) => t.id !== id));

      try {
        await provider.deleteTask(id);
      } catch (error) {
        console.error('Failed to delete task:', error);

        // Revert on error
        await sync();

        throw error;
      }
    },
    [provider, sync],
  );

  /**
   * Create a new link between two tasks
   */
  const createLink = useCallback(
    async (link: Partial<ILink>): Promise<ILink> => {
      if (!provider) {
        throw new Error('Data provider not initialized');
      }

      try {
        const createdLink = await provider.createLink(link);

        // Update links state
        setLinks((prevLinks) => [...prevLinks, createdLink]);

        return createdLink;
      } catch (error) {
        console.error('Failed to create link:', error);
        throw error;
      }
    },
    [provider],
  );

  /**
   * Delete a link
   *
   * @param linkId - The local link ID (used for optimistic update)
   * @param metadata - Provider-specific metadata needed for deletion
   */
  const deleteLink = useCallback(
    async (linkId: number | string, metadata?: unknown) => {
      if (!provider) {
        throw new Error('Data provider not initialized');
      }

      // Optimistic update
      setLinks((prevLinks) => prevLinks.filter((link) => link.id !== linkId));

      try {
        await provider.deleteLink(linkId, metadata);
      } catch (error) {
        console.error('Failed to delete link:', error);

        // Revert on error
        await sync();

        throw error;
      }
    },
    [provider, sync],
  );

  /**
   * Clear data when provider changes
   * NOTE: Does NOT auto-sync - caller is responsible for triggering initial sync
   * This allows caller to wait for other async operations before syncing
   *
   * Also cancels any in-flight sync requests to prevent stale data from overwriting
   */
  useEffect(() => {
    // Cancel any in-flight sync when provider changes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (provider) {
      // Clear old data immediately when provider changes
      setTasks([]);
      setLinks([]);
      setMetadata({});
      setSyncState({
        isLoading: true, // Show loading state, caller will trigger sync
        isSyncing: false,
        error: null,
        lastSyncTime: null,
        progress: null,
      });
      // Do NOT auto-sync - caller is responsible for calling sync()
    } else {
      // No provider, clear data and set loading to false
      setTasks([]);
      setLinks([]);
      setMetadata({});
      setSyncState((prev) => ({
        ...prev,
        isLoading: false,
        progress: null,
      }));
    }
  }, [provider]);

  /**
   * Auto-sync interval
   */
  useEffect(() => {
    if (autoSync && provider) {
      syncIntervalRef.current = setInterval(() => {
        sync();
      }, syncInterval);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [autoSync, provider, sync, syncInterval]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    // Set mounted to true on mount
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      // Cancel any in-flight sync on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return {
    tasks,
    links,
    metadata,
    syncState,
    sync,
    syncTask,
    reorderTaskLocal,
    createTask,
    deleteTask,
    createLink,
    deleteLink,
  };
}
