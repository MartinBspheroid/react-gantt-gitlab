/**
 * useGitLabSync Hook
 * React hook for managing GitLab data synchronization with Gantt
 */

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
  syncInterval = 60000, // 60 seconds
  options: UseGitLabSyncOptions = {},
): GitLabSyncResult {
  const { onWarning } = options;
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [links, setLinks] = useState<ILink[]>([]);
  const [milestones, setMilestones] = useState<GitLabMilestone[]>([]);
  const [epics, setEpics] = useState<GitLabEpic[]>([]);
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
   * Updates local state immediately and returns a rollback function.
   *
   * @param taskId - The ID of the task to move
   * @param targetTaskId - The ID of the target task
   * @param position - 'before' or 'after' the target
   * @returns Object with rollback function
   */
  const reorderTaskLocal = useCallback(
    (
      taskId: number | string,
      targetTaskId: number | string,
      position: 'before' | 'after',
    ): { rollback: () => void } => {
      const previousTasks = tasksRef.current;

      const taskIndex = previousTasks.findIndex((t) => t.id === taskId);
      const targetIndex = previousTasks.findIndex((t) => t.id === targetTaskId);

      if (taskIndex === -1 || targetIndex === -1) {
        return { rollback: () => {} };
      }

      const targetTask = previousTasks[targetIndex];

      // Calculate new relativePosition
      // Use a simple offset from target position for optimistic update.
      // The actual position will be determined by GitLab API - this is just
      // for immediate UI feedback to ensure the task appears near the target.
      const targetPos = targetTask._gitlab?.relativePosition ?? targetTask.id;

      // Simple offset: place slightly after or before target
      // Using small offset (1) so it appears adjacent to target in sort order
      const newPosition = position === 'after' ? targetPos + 1 : targetPos - 1;

      // Optimistic update: update the task's relativePosition
      const updatedTasks = previousTasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            _gitlab: {
              ...t._gitlab,
              relativePosition: newPosition,
            },
          };
        }
        return t;
      });

      setTasks(updatedTasks);
      tasksRef.current = updatedTasks;

      // Return rollback function
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
