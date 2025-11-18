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

export interface GitLabSyncResult {
  tasks: ITask[];
  links: ILink[];
  milestones: GitLabMilestone[];
  epics: GitLabEpic[];
  syncState: SyncState;
  sync: (options?: GitLabSyncOptions) => Promise<void>;
  syncTask: (id: number | string, updates: Partial<ITask>) => Promise<void>;
  createTask: (task: Partial<ITask>) => Promise<ITask>;
  deleteTask: (id: number | string) => Promise<void>;
  createLink: (link: Partial<ILink>) => Promise<void>;
  deleteLink: (
    linkId: number | string,
    sourceId: number | string,
  ) => Promise<void>;
}

export function useGitLabSync(
  provider: GitLabDataProvider | GitLabGraphQLProvider | null,
  autoSync = false,
  syncInterval = 60000, // 60 seconds
): GitLabSyncResult {
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
        // Save current fold state before syncing
        const openStateMap = new Map(
          tasks.map((t) => [t.id, t.open !== undefined ? t.open : true]),
        );
        console.log('[useGitLabSync] Saved fold state for tasks:', {
          count: openStateMap.size,
          states: Array.from(openStateMap.entries()),
        });

        const data = await provider.getData(options);

        console.log('[useGitLabSync] Received data from provider:', {
          tasks: data.tasks.length,
          links: data.links.length,
          milestones: data.milestones?.length || 0,
          epics: data.epics?.length || 0,
        });
        console.log('[useGitLabSync] Tasks:', data.tasks);
        console.log(
          '[useGitLabSync] isMountedRef.current:',
          isMountedRef.current,
        );

        if (isMountedRef.current) {
          console.log('[useGitLabSync] Setting state...');

          // Merge fold state back to new tasks
          const tasksWithState = data.tasks.map((task) => ({
            ...task,
            open: openStateMap.has(task.id)
              ? openStateMap.get(task.id)
              : task.open !== undefined
                ? task.open
                : true,
          }));

          console.log('[useGitLabSync] Merged fold state into tasks:', {
            originalCount: data.tasks.length,
            mergedCount: tasksWithState.length,
            preserved: tasksWithState.filter((t) => openStateMap.has(t.id))
              .length,
          });

          setTasks(tasksWithState);
          setLinks(data.links);
          setMilestones(data.milestones || []);
          setEpics(data.epics || []);

          setSyncState({
            isLoading: false,
            isSyncing: false,
            error: null,
            lastSyncTime: new Date(),
          });
          console.log('[useGitLabSync] State updated successfully');
        } else {
          console.warn(
            '[useGitLabSync] Component unmounted, skipping state update',
          );
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

      console.log('[useGitLabSync] syncTask called with:', { id, updates });

      try {
        // Sync to GitLab only, don't update React state to avoid re-render
        if (provider instanceof GitLabGraphQLProvider) {
          console.log('[useGitLabSync] Calling provider.updateWorkItem');
          await provider.updateWorkItem(id, updates);
          console.log('[useGitLabSync] GraphQL update completed');
        } else {
          console.log('[useGitLabSync] Calling provider.updateIssue');
          await provider.updateIssue(id, updates);
          console.log('[useGitLabSync] REST update completed');
        }

        console.log(
          '[useGitLabSync] Task synced to GitLab (state NOT updated to avoid drag conflicts)',
        );
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

        console.log('[useGitLabSync] Task created from GitLab:', createdTask);

        // If this is a subtask, wait a bit for GitLab to process the parent-child relationship
        // then sync to get the updated hierarchy
        if (task.parent && task.parent !== 0) {
          console.log(
            '[useGitLabSync] Subtask created, waiting for GitLab to process hierarchy...',
          );
          // Wait 2 seconds for GitLab to process the hierarchy
          await new Promise((resolve) => setTimeout(resolve, 2000));
          // Sync to get the updated data from GitLab
          await sync();
          // Return the synced task with correct parent relationship
          const syncedTask = tasks.find((t) => t.id === createdTask.id);
          return syncedTask || createdTask;
        }

        // Add the new task to local state
        // This will cause Gantt to update via the tasks prop
        setTasks((prevTasks) => [...prevTasks, createdTask]);

        return createdTask;
      } catch (error) {
        console.error('Failed to create task:', error);
        throw error;
      }
    },
    [provider, sync, tasks],
  );

  /**
   * Delete a task
   */
  const deleteTask = useCallback(
    async (id: number | string) => {
      if (!provider) {
        throw new Error('GitLab provider not initialized');
      }

      // Optimistic update
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));

      try {
        await provider.deleteIssue(id);
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
   */
  const deleteLink = useCallback(
    async (linkId: number | string, sourceId: number | string) => {
      if (!provider) {
        throw new Error('GitLab provider not initialized');
      }

      // Optimistic update
      setLinks((prevLinks) => prevLinks.filter((link) => link.id !== linkId));

      try {
        await provider.deleteIssueLink(linkId, sourceId);
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
   * Initial sync on mount
   */
  useEffect(() => {
    if (provider) {
      sync();
    } else {
      // No provider, set loading to false immediately
      setSyncState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [provider, sync]);

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
    console.log('[useGitLabSync] Component mounted, isMountedRef set to true');

    return () => {
      console.log(
        '[useGitLabSync] Component unmounting, isMountedRef set to false',
      );
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
    deleteTask,
    createLink,
    deleteLink,
  };
}
