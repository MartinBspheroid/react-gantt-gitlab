import { useState, useCallback, useRef, useEffect } from 'react';
import type { ITask, ILink } from '@svar-ui/gantt-store';
import { GitLabDataProvider } from '../providers/GitLabDataProvider';
import { GitLabGraphQLProvider } from '../providers/GitLabGraphQLProvider';
import type {
  GitLabSyncOptions,
  GitLabMilestone,
  GitLabEpic,
} from '../types/gitlab';
import type { SyncProgress } from '../types/syncProgress';
import type { Sprint } from '../types/azure-devops';

export interface SyncState {
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSyncTime: Date | null;
  /** Sync progress info (available during sync) */
  progress: SyncProgress | null;
}

export interface UseGitLabSyncOptions {
  /** Callback for non-fatal warnings (e.g., subtask linking failed) */
  onWarning?: (message: string) => void;
}

export interface GitLabSyncResult {
  tasks: ITask[];
  links: ILink[];
  milestones: GitLabMilestone[];
  epics: GitLabEpic[];
  sprints: Sprint[];
  syncState: SyncState;
  sync: (options?: GitLabSyncOptions) => Promise<void>;
  syncTask: (id: number | string, updates: Partial<ITask>) => Promise<void>;
  reorderTaskLocal: (
    taskId: number | string,
    targetTaskId: number | string,
    position: 'before' | 'after',
  ) => { rollback: () => void };
  createTask: (task: Partial<ITask>) => Promise<ITask>;
  createMilestone: (milestone: Partial<ITask>) => Promise<ITask>;
  deleteTask: (id: number | string) => Promise<void>;
  createLink: (link: Partial<ILink>) => Promise<void>;
  deleteLink: (
    linkId: number | string,
    apiSourceIid: number | string,
    linkedWorkItemGlobalId: string,
  ) => Promise<void>;
}

export function useGitLabSync(
  provider: GitLabDataProvider | GitLabGraphQLProvider | null,
  autoSync = false,
  syncInterval = 60000,
  options: UseGitLabSyncOptions = {},
): GitLabSyncResult {
  const { onWarning } = options;
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [links, setLinks] = useState<ILink[]>([]);
  const [milestones, setMilestones] = useState<GitLabMilestone[]>([]);
  const [epics, setEpics] = useState<GitLabEpic[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
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
   * Main sync function to fetch data from GitLab
   * Supports cancellation via AbortController when provider changes or new sync starts
   */
  const sync = useCallback(
    async (options: GitLabSyncOptions = {}) => {
      if (!provider) {
        setSyncState((prev) => ({
          ...prev,
          error: 'GitLab provider not initialized',
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
        const data = await provider.getData({
          ...options,
          signal: abortController.signal,
          onProgress,
        });

        console.log(
          '[useGitLabSync] Sync completed, received links:',
          data.links.map((l) => ({
            id: l.id,
            source: l.source,
            target: l.target,
            _gitlab: l._gitlab,
          })),
        );

        // Only update state if not aborted and still mounted
        if (isMountedRef.current && !abortController.signal.aborted) {
          setTasks(data.tasks);
          setLinks(data.links);
          setMilestones(data.milestones || []);
          setEpics(data.epics || []);
          setSprints((data as { sprints?: Sprint[] }).sprints || []);

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
          console.log('[useGitLabSync] Sync aborted');
          return;
        }

        console.error('GitLab sync error:', error);

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
   * Updates local state immediately, then syncs to GitLab.
   * On failure, reverts local state and throws error.
   */
  const syncTask = useCallback(
    async (id: number | string, updates: Partial<ITask>) => {
      if (!provider) {
        throw new Error('GitLab provider not initialized');
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
        // Sync to GitLab
        if (provider instanceof GitLabGraphQLProvider) {
          await provider.updateWorkItem(id, updates);
        } else {
          await provider.updateIssue(id, updates);
        }
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
   * ## Algorithm: Midpoint Calculation
   * Instead of modifying GitLab's relativePosition (which requires API sync),
   * we assign a temporary _localOrder value that positions the task correctly
   * in the sort order. The value is calculated as the midpoint between the
   * target and its neighbor:
   *
   * - Place after target: _localOrder = (target + next) / 2
   * - Place before target: _localOrder = (prev + target) / 2
   *
   * This ensures stable sorting during rapid consecutive drags without
   * waiting for GitLab API responses.
   *
   * ## Example
   * Tasks: A(1000), B(2000), C(3000)
   * 1. Move C after A: C._localOrder = (1000 + 2000) / 2 = 1500
   *    Result: A(1000), C(1500), B(2000)
   * 2. Move B before C: B._localOrder = (1000 + 1500) / 2 = 1250
   *    Result: A(1000), B(1250), C(1500)
   *
   * ## Cleanup
   * _localOrder is automatically cleared when sync() fetches fresh data
   * from GitLab, as the new task objects won't have this property.
   *
   * ## Limitation
   * JavaScript floating-point precision allows ~52 subdivisions before
   * values become indistinguishable. For typical usage this is sufficient;
   * a full sync resets the values. For unlimited precision, consider
   * string-based fractional indexing (e.g., Figma's approach).
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

      // Get sort value: prefer _localOrder (from previous drag), then relativePosition
      const getSortValue = (t: ITask): number =>
        t._localOrder ?? t._gitlab?.relativePosition ?? (t.id as number);

      // Sort all tasks (excluding the dragged one) to find correct neighbors
      const otherTasks = previousTasks
        .filter((t) => t.id !== taskId)
        .map((t) => ({ task: t, sortValue: getSortValue(t) }))
        .sort((a, b) => a.sortValue - b.sortValue);

      // Find target's position in sorted list
      const targetIdx = otherTasks.findIndex((t) => t.task.id === targetTaskId);
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
        throw new Error('GitLab provider not initialized');
      }

      try {
        // createIssue returns a complete ITask from GitLab
        const createdTask = await provider.createIssue(task);

        // For issues under milestones, set the milestone as parent for display
        // Check this FIRST before general parent check, as milestone issues have parent=0 for GitLab
        const milestoneGlobalId = task._gitlab?.milestoneGlobalId;

        if (milestoneGlobalId) {
          // Use tasksRef.current to get the latest tasks (avoid stale closure)
          const currentTasks = tasksRef.current;
          // Find the milestone task ID from the globalId
          const milestoneTask = currentTasks.find(
            (t) => t._gitlab?.globalId === milestoneGlobalId,
          );
          if (milestoneTask) {
            createdTask.parent = milestoneTask.id;
            // Also mark this as an Issue for proper styling
            createdTask.$isIssue = true;
          }
        } else if (task.parent && task.parent !== 0) {
          // Preserve parent relationship from input task
          // For subtasks (Issue->Task), the parent is the Issue's IID
          createdTask.parent = task.parent;
        }

        // Handle linking error: clear parent and notify user
        if (createdTask._gitlab?.linkingError) {
          createdTask.parent = 0;
          onWarningRef.current?.(createdTask._gitlab.linkingError);
        }

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
   * Create a new milestone
   */
  const createMilestone = useCallback(
    async (milestone: Partial<ITask>): Promise<ITask> => {
      if (!provider) {
        throw new Error('GitLab provider not initialized');
      }

      // Check if provider supports createMilestone
      if (!('createMilestone' in provider)) {
        throw new Error('Current provider does not support milestone creation');
      }

      try {
        const createdMilestone = await (provider as any).createMilestone(
          milestone,
        );

        // Add the new milestone to local state
        setTasks((prevTasks) => [...prevTasks, createdMilestone]);

        return createdMilestone;
      } catch (error) {
        console.error('Failed to create milestone:', error);
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
        throw new Error('GitLab provider not initialized');
      }

      // Find task data if not provided
      const task = taskData || tasks.find((t) => t.id === id);

      // Optimistic update
      setTasks((prevTasks) => prevTasks.filter((t) => t.id !== id));

      try {
        await provider.deleteIssue(id, task);
      } catch (error) {
        console.error('Failed to delete task:', error);

        // Revert on error
        await sync();

        throw error;
      }
    },
    [provider, sync, tasks],
  );

  /**
   * Create a new link
   *
   * For metadata links (Free tier): directly updates local state with returned metadata.
   * For native links (Premium/Ultimate): performs full sync to ensure proper metadata.
   *
   * NOTE: Gantt UI already adds the link to its internal store before calling this.
   * We update the existing link with GitLab metadata rather than adding a new one.
   */
  const createLink = useCallback(
    async (link: Partial<ILink>) => {
      if (!provider) {
        throw new Error('GitLab provider not initialized');
      }

      try {
        const result = await provider.createIssueLink(link);

        if (result.isNativeLink) {
          // Native links: full sync to ensure proper metadata
          // (Native link deletion requires precise global ID matching)
          await sync();
        } else {
          // Metadata links: we have all the info we need from the result
          // Build the _gitlab metadata for deletion
          const gitlabMeta = {
            apiSourceIid: result.sourceIid,
            linkedWorkItemGlobalId: undefined,
            isNativeLink: false as const,
            metadataRelation: result.metadataRelation,
            metadataTargetIid: result.targetIid,
          };

          // Update existing link with GitLab metadata, or add new if not found
          // Gantt UI may have already added the link, so we look for it by source/target
          setLinks((prevLinks) => {
            // Find existing link by source/target (either direction)
            const existingIndex = prevLinks.findIndex(
              (l) =>
                (l.source === link.source && l.target === link.target) ||
                (l.source === link.target && l.target === link.source),
            );

            if (existingIndex >= 0) {
              // Update existing link with _gitlab metadata
              const updatedLinks = [...prevLinks];
              updatedLinks[existingIndex] = {
                ...updatedLinks[existingIndex],
                _gitlab: gitlabMeta,
              };
              return updatedLinks;
            }

            // Link not found, add new one (shouldn't happen normally)
            const maxId = prevLinks.reduce(
              (max, l) => Math.max(max, typeof l.id === 'number' ? l.id : 0),
              0,
            );
            const newLink: ILink = {
              id: maxId + 1,
              source: result.sourceIid,
              target: result.targetIid,
              type: link.type || 'e2s',
              _gitlab: gitlabMeta,
            };
            return [...prevLinks, newLink];
          });
        }
      } catch (error) {
        console.error('Failed to create link:', error);
        throw error;
      }
    },
    [provider, sync],
  );

  /**
   * Delete a link
   *
   * Supports both native GitLab links and description metadata links.
   *
   * @param linkId - The local link ID (used for optimistic update)
   * @param apiSourceIid - The IID of the ORIGINAL API source work item
   *                       (from link._gitlab.apiSourceIid)
   * @param linkedWorkItemGlobalId - The global ID of the linked work item to unlink
   *                                 (from link._gitlab.linkedWorkItemGlobalId, undefined for metadata links)
   * @param options - Additional options for metadata links
   */
  const deleteLink = useCallback(
    async (
      linkId: number | string,
      apiSourceIid: number | string,
      linkedWorkItemGlobalId: string | undefined,
      options?: {
        isNativeLink?: boolean;
        metadataRelation?: 'blocks' | 'blocked_by';
        metadataTargetIid?: number;
      },
    ) => {
      if (!provider) {
        throw new Error('GitLab provider not initialized');
      }

      // Optimistic update
      setLinks((prevLinks) => prevLinks.filter((link) => link.id !== linkId));

      try {
        await provider.deleteIssueLink(
          apiSourceIid,
          linkedWorkItemGlobalId,
          options,
        );
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
   * This allows caller to wait for other async operations (e.g., preset loading) before syncing
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
      setMilestones([]);
      setEpics([]);
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
      setMilestones([]);
      setEpics([]);
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
    milestones,
    epics,
    sprints,
    syncState,
    sync,
    syncTask,
    reorderTaskLocal,
    createTask,
    createMilestone,
    deleteTask,
    createLink,
    deleteLink,
  };
}
