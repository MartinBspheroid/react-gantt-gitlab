// @ts-nocheck
/**
 * useFoldState Hook
 * Manages fold/collapse state with localStorage persistence.
 * Handles milestone ID migration and group toggle events.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  isLegacyMilestoneId,
  migrateLegacyMilestoneId,
} from '../../utils/MilestoneIdUtils.ts';
import { getTasksFromState } from './ganttTaskUtils.ts';

export function useFoldState({
  api,
  currentConfig,
  allTasks,
  setCollapsedGroups,
}) {
  // Ref to store fold state before data updates
  const openStateRef = useRef(new Map());

  // Generate a unique key for localStorage based on project/group
  const getStorageKey = useCallback(() => {
    if (!currentConfig) return 'gantt-foldstate-default';
    if (currentConfig.type === 'project' && currentConfig.projectId) {
      return `gantt-foldstate-project-${currentConfig.projectId}`;
    } else if (currentConfig.type === 'group' && currentConfig.groupId) {
      return `gantt-foldstate-group-${currentConfig.groupId}`;
    }
    return 'gantt-foldstate-default';
  }, [currentConfig]);

  // Load fold state from localStorage when config changes
  // Includes migration from legacy milestone IDs (10000+) to new format (m-{iid})
  useEffect(() => {
    if (!currentConfig) return;

    try {
      const storageKey = getStorageKey();
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        const parsed = JSON.parse(savedState);

        // Migrate legacy milestone IDs (10000+) to new format (m-{iid})
        let needsMigration = false;
        const migratedEntries = Object.entries(parsed).map(([key, value]) => {
          if (isLegacyMilestoneId(key)) {
            needsMigration = true;
            return [migrateLegacyMilestoneId(key), value];
          }
          return [key, value];
        });

        openStateRef.current = new Map(migratedEntries);

        // Save migrated state back to localStorage if migration occurred
        if (needsMigration) {
          const migratedState = Object.fromEntries(migratedEntries);
          localStorage.setItem(storageKey, JSON.stringify(migratedState));
        }
      } else {
        openStateRef.current = new Map();
      }
    } catch (error) {
      console.error(
        '[GanttView] Failed to load fold state from localStorage:',
        error,
      );
    }
  }, [currentConfig, getStorageKey]);

  // Save fold state to localStorage whenever it changes
  const saveFoldStateToStorage = useCallback(() => {
    try {
      const storageKey = getStorageKey();
      const stateObj = Object.fromEntries(openStateRef.current);
      localStorage.setItem(storageKey, JSON.stringify(stateObj));
    } catch (error) {
      console.error(
        '[GanttView] Failed to save fold state to localStorage:',
        error,
      );
    }
  }, [getStorageKey]);

  // Use ref to make saveFoldStateToStorage accessible in init callback
  const saveFoldStateRef = useRef(saveFoldStateToStorage);
  useEffect(() => {
    saveFoldStateRef.current = saveFoldStateToStorage;
  }, [saveFoldStateToStorage]);

  // Handle group header collapse/expand from Gantt events
  useEffect(() => {
    const handleGroupToggle = (event) => {
      const { groupId, collapsed } = event.detail;
      if (collapsed) {
        setCollapsedGroups((prev) => new Set([...prev, groupId]));
      } else {
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          next.delete(groupId);
          return next;
        });
      }
    };

    window.addEventListener('gantt-group-toggle', handleGroupToggle);
    return () => {
      window.removeEventListener('gantt-group-toggle', handleGroupToggle);
    };
  }, [setCollapsedGroups]);

  // Restore fold state after tasks update - separate effect to avoid timing issues
  useEffect(() => {
    if (!api || allTasks.length === 0 || openStateRef.current.size === 0) {
      return;
    }

    // Use requestAnimationFrame to ensure Gantt has processed the new tasks
    // This runs after React has committed the DOM updates
    const restoreFoldState = () => {
      try {
        const state = api.getState();
        const currentTasks = getTasksFromState(state);

        // If Gantt store hasn't processed the tasks yet, schedule another frame
        if (currentTasks.length === 0) {
          requestAnimationFrame(restoreFoldState);
          return;
        }

        // Restore open state from saved map
        currentTasks.forEach((task) => {
          // Skip tasks that don't have children (data property)
          // Opening a task without children causes Gantt store error
          if (!task.data || task.data.length === 0) {
            return;
          }

          // Check both string and number versions of the ID
          // localStorage keys are always strings, but Gantt task IDs can be numbers or strings (e.g., "m-1")
          const taskIdStr = String(task.id);
          const taskIdNum = Number(task.id);

          let savedOpen = null;
          if (openStateRef.current.has(taskIdStr)) {
            savedOpen = openStateRef.current.get(taskIdStr);
          } else if (openStateRef.current.has(taskIdNum)) {
            savedOpen = openStateRef.current.get(taskIdNum);
          } else if (openStateRef.current.has(task.id)) {
            savedOpen = openStateRef.current.get(task.id);
          }

          if (savedOpen !== null && task.open !== savedOpen) {
            api.exec('open-task', { id: task.id, mode: savedOpen });
          }
        });
      } catch (error) {
        console.error('[GanttView] Failed to restore fold state:', error);
      }
    };

    requestAnimationFrame(restoreFoldState);
  }, [allTasks, api]);

  /**
   * Register fold handlers on the Gantt API during init.
   * Called from useGanttInit to listen for open-task events.
   */
  const registerFoldHandlers = useCallback((ganttApi) => {
    // Listen to fold/unfold events to save state
    // This is the ONLY place where fold state is saved (user manually opens/closes)
    // We don't save during sync because Gantt store may have stale data
    ganttApi.on('open-task', (ev) => {
      // Check if this is a group header
      const task = ganttApi.getTask(ev.id);
      if (task?.$groupHeader) {
        // Group header collapse/expand - update collapsedGroups state
        // ev.mode is true when expanded, false when collapsed
        const groupId = String(ev.id);
        // We need to update the state, but can't do it directly from here
        // Instead, use a custom event to notify the component
        window.dispatchEvent(
          new CustomEvent('gantt-group-toggle', {
            detail: { groupId, collapsed: !ev.mode },
          }),
        );
        return;
      }

      // Update openStateRef with the new state
      if (ev.id && ev.mode !== undefined) {
        // Always use string keys to match localStorage (which serializes keys as strings)
        // This ensures consistency between numeric IDs (issues) and string IDs (milestones like "m-1")
        const idKey = String(ev.id);
        openStateRef.current.set(idKey, ev.mode);
        // Save to localStorage using ref
        saveFoldStateRef.current();
      }
    });
  }, []);

  return {
    openStateRef,
    saveFoldStateRef,
    registerFoldHandlers,
  };
}
