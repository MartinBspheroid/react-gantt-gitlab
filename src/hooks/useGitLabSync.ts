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

export interface SyncState {
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSyncTime: Date | null;
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
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const tasksRef = useRef<ITask[]>(tasks);
  const onWarningRef = useRef(onWarning);

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

      setSyncState((prev) => ({
        ...prev,
        isSyncing: true,
        error: null,
      }));

      try {
        const data = await provider.getData(options);

        console.log(
          '[useGitLabSync] Sync completed, received links:',
          data.links.map((l) => ({
            id: l.id,
            source: l.source,
            target: l.target,
            _gitlab: l._gitlab,
          })),
        );

        if (isMountedRef.current) {
          setTasks(data.tasks);
          setLinks(data.links);
          setMilestones(data.milestones || []);
          setEpics(data.epics || []);

          setSyncState({
            isLoading: false,
            isSyncing: false,
            error: null,
            lastSyncTime: new Date(),
          });
        } else {
        }
      } catch (error) {
        console.error('GitLab sync error:', error);

        if (isMountedRef.current) {
          setSyncState((prev) => ({
            ...prev,
            isLoading: false,
            isSyncing: false,
            error: error instanceof Error ? error.message : 'Sync failed',
          }));
        }
      }
    },
    [provider],
  );

  /**
   * Sync a single task update
   * Only sync to GitLab, don't update React state
   * Caller should manually call sync() after drag ends to refresh from GitLab
   */
  const syncTask = useCallback(
    async (id: number | string, updates: Partial<ITask>) => {
      if (!provider) {
        throw new Error('GitLab provider not initialized');
      }

      try {
        // Sync to GitLab only, don't update React state to avoid re-render
        if (provider instanceof GitLabGraphQLProvider) {
          await provider.updateWorkItem(id, updates);
        } else {
          await provider.updateIssue(id, updates);
        }
      } catch (error) {
        console.error('Failed to sync task update:', error);

        // Reload from GitLab on error
        await sync();

        throw error;
      }
    },
    [provider, sync],
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
   */
  const createLink = useCallback(
    async (link: Partial<ILink>) => {
      if (!provider) {
        throw new Error('GitLab provider not initialized');
      }

      try {
        await provider.createIssueLink(link);

        // Re-sync to get the actual link ID from GitLab
        // This prevents duplicate links with different IDs
        await sync();
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
   * @param linkId - The local link ID (used for optimistic update)
   * @param apiSourceIid - The IID of the ORIGINAL API source work item
   *                       (from link._gitlab.apiSourceIid)
   * @param linkedWorkItemGlobalId - The global ID of the linked work item to unlink
   *                                 (from link._gitlab.linkedWorkItemGlobalId)
   */
  const deleteLink = useCallback(
    async (
      linkId: number | string,
      apiSourceIid: number | string,
      linkedWorkItemGlobalId: string,
    ) => {
      if (!provider) {
        throw new Error('GitLab provider not initialized');
      }

      // Optimistic update
      setLinks((prevLinks) => prevLinks.filter((link) => link.id !== linkId));

      try {
        await provider.deleteIssueLink(apiSourceIid, linkedWorkItemGlobalId);
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
   */
  useEffect(() => {
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
    createTask,
    createMilestone,
    deleteTask,
    createLink,
    deleteLink,
  };
}
