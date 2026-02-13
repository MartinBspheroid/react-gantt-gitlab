// @ts-nocheck
/**
 * useGanttData Hook
 * All memoized data computations — pure derived state.
 * Label maps, assignee options, filtered/grouped tasks, stats, scales, markers.
 */

import { useMemo, useEffect } from 'react';
import { DataFilters } from '../../utils/DataFilters';

export function useGanttData({
  allTasks,
  filterOptions,
  serverFilterOptions,
  countWorkdays,
  lengthUnit,
  groupBy,
  collapsedGroups,
  api,
}) {
  // Create label priority map for sorting (lower number = higher priority)
  const labelPriorityMap = useMemo(() => {
    const map = new Map();
    (serverFilterOptions?.labels || []).forEach((label) => {
      if (label.priority != null) {
        map.set(label.title, label.priority);
      }
    });
    return map;
  }, [serverFilterOptions?.labels]);

  // Create label color map for LabelCell rendering
  const labelColorMap = useMemo(() => {
    const map = new Map();
    (serverFilterOptions?.labels || []).forEach((label) => {
      if (label.color) {
        map.set(label.title, label.color);
      }
    });
    return map;
  }, [serverFilterOptions?.labels]);

  // Build assignee options for CreateItemDialog (from server members)
  const assigneeOptions = useMemo(() => {
    const members = serverFilterOptions?.members || [];
    return members
      .map((member) => ({
        value: member.name,
        label: member.name,
        subtitle: `@${member.username}`,
        username: member.username,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [serverFilterOptions?.members]);

  // Add workdays and labelPriority to tasks for sorting support
  const tasksWithWorkdays = useMemo(() => {
    return allTasks.map((task) => {
      const taskLabels = task.labels
        ? task.labels.split(', ').filter(Boolean)
        : [];
      let labelPriority = Number.MAX_SAFE_INTEGER;

      taskLabels.forEach((labelTitle) => {
        const priority = labelPriorityMap.get(labelTitle);
        if (priority !== undefined && priority < labelPriority) {
          labelPriority = priority;
        }
      });

      return {
        ...task,
        workdays:
          task.start && task.end ? countWorkdays(task.start, task.end) : 0,
        labelPriority,
      };
    });
  }, [allTasks, countWorkdays, labelPriorityMap]);

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    return DataFilters.applyFilters(tasksWithWorkdays, filterOptions);
  }, [tasksWithWorkdays, filterOptions]);

  // Apply grouping to filtered tasks
  const { tasks: _groupedTasks, groupCount } = useMemo(() => {
    return DataFilters.groupTasks(filteredTasks, groupBy, collapsedGroups);
  }, [filteredTasks, groupBy, collapsedGroups]);

  // Calculate statistics
  const stats = useMemo(() => {
    return DataFilters.calculateStats(filteredTasks);
  }, [filteredTasks]);

  // Apply native SVAR filter-rows for better performance and animation
  useEffect(() => {
    if (!api || tasksWithWorkdays.length === 0) return;

    const tableAPI = api.getTable();
    if (!tableAPI) return;

    const hasFilters = DataFilters.hasActiveFilters(filterOptions);

    if (hasFilters) {
      const filterFn = DataFilters.createSvarFilterFunction(
        tasksWithWorkdays,
        filterOptions,
      );
      tableAPI.exec('filter-rows', { filter: filterFn });
    } else {
      tableAPI.exec('filter-rows', { filter: null });
    }
  }, [api, tasksWithWorkdays, filterOptions]);

  // Dynamic scales based on lengthUnit
  const scales = useMemo(() => {
    switch (lengthUnit) {
      case 'hour':
        return [
          { unit: 'day', step: 1, format: 'MMM d' },
          { unit: 'hour', step: 2, format: 'HH:mm' },
        ];
      case 'day':
        return [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'month', step: 1, format: 'MMMM' },
          { unit: 'day', step: 1, format: 'd' },
        ];
      case 'week':
        return [
          { unit: 'month', step: 1, format: 'MMM' },
          { unit: 'week', step: 1, format: 'w' },
        ];
      case 'month':
        return [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'month', step: 1, format: 'MMM' },
        ];
      case 'quarter':
        return [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'quarter', step: 1, format: 'QQQ' },
        ];
      default:
        return [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'month', step: 1, format: 'MMMM' },
          { unit: 'day', step: 1, format: 'd' },
        ];
    }
  }, [lengthUnit]);

  // Today marker
  const markers = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return [
      {
        start: today,
        css: 'today-marker',
      },
    ];
  }, []);

  return {
    labelPriorityMap,
    labelColorMap,
    assigneeOptions,
    tasksWithWorkdays,
    filteredTasks,
    groupCount,
    stats,
    scales,
    markers,
  };
}
