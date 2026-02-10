/**
 * WorkloadChart Component
 * Custom chart that displays multiple non-overlapping tasks on the same row
 * Reuses Gantt's time scale calculations but renders bars independently
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMiddleMouseDrag } from '../hooks/useMiddleMouseDrag';
import './WorkloadChart.css';
import './shared/TodayMarker.css';

/**
 * Calculate task position and width based on dates and scale
 */
function calculateTaskPosition(task, startDate, cellWidth, lengthUnit) {
  const taskStart =
    task.start instanceof Date ? task.start : new Date(task.start);

  // Determine task end date with proper fallback for tasks without end dates
  let taskEnd;
  if (task.end) {
    taskEnd = task.end instanceof Date ? task.end : new Date(task.end);
  } else {
    // If no end date, check if this is using created date as start
    // (tasks without startDate use createdAt, and should have a default 7-day duration)
    const isUsingCreatedDate = !task._gitlab?.startDate;
    if (isUsingCreatedDate) {
      // Default to 7 days for tasks using created date
      taskEnd = new Date(taskStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      // For tasks with explicit start but no end, use 1 day duration
      taskEnd = new Date(taskStart.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  // Calculate days from chart start
  const msPerDay = 24 * 60 * 60 * 1000;
  const startDiff = (taskStart - startDate) / msPerDay;
  const duration = Math.max(1, (taskEnd - taskStart) / msPerDay);

  // Adjust for different length units
  let unitMultiplier = 1;
  switch (lengthUnit) {
    case 'hour':
      unitMultiplier = 24; // 24 cells per day
      break;
    case 'week':
      unitMultiplier = 1 / 7;
      break;
    case 'month':
      unitMultiplier = 1 / 30;
      break;
    case 'quarter':
      unitMultiplier = 1 / 90;
      break;
    default:
      unitMultiplier = 1;
  }

  const x = startDiff * cellWidth * unitMultiplier;
  const width = Math.max(
    cellWidth * 0.5,
    duration * cellWidth * unitMultiplier,
  );

  return { x, width };
}

/**
 * Assign tasks to rows based on overlap detection
 */
function assignTasksToRows(tasks) {
  const rows = [];

  // Sort by start date
  const sorted = [...tasks].sort((a, b) => {
    const aStart = a.start instanceof Date ? a.start : new Date(a.start);
    const bStart = b.start instanceof Date ? b.start : new Date(b.start);
    return aStart.getTime() - bStart.getTime();
  });

  // Track end times for each row
  const rowEndTimes = [];

  for (const task of sorted) {
    const taskStart =
      task.start instanceof Date ? task.start : new Date(task.start);

    // Determine task end date with proper fallback for tasks without end dates
    let taskEnd;
    if (task.end) {
      taskEnd = task.end instanceof Date ? task.end : new Date(task.end);
    } else {
      // If no end date, check if this is using created date as start
      // (tasks without startDate use createdAt, and should have a default 7-day duration)
      const isUsingCreatedDate = !task._gitlab?.startDate;
      if (isUsingCreatedDate) {
        // Default to 7 days for tasks using created date
        taskEnd = new Date(taskStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        // For tasks with explicit start but no end, use 1 day duration
        taskEnd = new Date(taskStart.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    const effectiveEnd =
      taskEnd >= taskStart ? taskEnd : new Date(taskStart.getTime() + 86400000);

    // Find first row where this task doesn't overlap
    let rowIndex = -1;
    for (let i = 0; i < rowEndTimes.length; i++) {
      if (rowEndTimes[i] <= taskStart) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      rowIndex = rowEndTimes.length;
      rowEndTimes.push(effectiveEnd);
      rows.push([]);
    } else {
      rowEndTimes[rowIndex] = effectiveEnd;
    }

    rows[rowIndex].push({ ...task, $rowIndex: rowIndex });
  }

  return rows;
}

/**
 * Group tasks by assignee/label
 * @param {Array} allTasks - All tasks
 * @param {Array} selectedAssignees - Selected assignee names
 * @param {Array} selectedLabels - Selected label names
 * @param {boolean} showOthers - Whether to show "Others" category for uncategorized tasks
 */
function groupTasks(
  allTasks,
  selectedAssignees,
  selectedLabels,
  showOthers = false,
) {
  const groups = [];

  // Filter work items only
  const workItems = allTasks.filter((task) => {
    const isMilestone = task.$isMilestone || task._gitlab?.type === 'milestone';
    const isSummary = task.type === 'summary';
    return !isMilestone && !isSummary && task.start;
  });

  // Track which tasks have been categorized (for "Others" group)
  const categorizedTaskIds = new Set();

  // Group by assignee
  for (const assignee of selectedAssignees) {
    const assigneeTasks = workItems.filter((task) => {
      if (!task.assigned) return false;
      const taskAssignees =
        typeof task.assigned === 'string'
          ? task.assigned.split(',').map((a) => a.trim())
          : [String(task.assigned)];
      return taskAssignees.includes(assignee);
    });

    // Track categorized tasks
    assigneeTasks.forEach((task) => categorizedTaskIds.add(task.id));

    const rows = assignTasksToRows(assigneeTasks);
    groups.push({
      id: `assignee-${assignee}`,
      name: assignee,
      type: 'assignee',
      rows,
      taskCount: assigneeTasks.length,
    });
  }

  // Group by label
  for (const label of selectedLabels) {
    const labelTasks = workItems.filter((task) => {
      if (!task.labels) return false;
      const taskLabels =
        typeof task.labels === 'string'
          ? task.labels.split(',').map((l) => l.trim())
          : Array.isArray(task.labels)
            ? task.labels
            : [];
      return taskLabels.includes(label);
    });

    // Track categorized tasks
    labelTasks.forEach((task) => categorizedTaskIds.add(task.id));

    const rows = assignTasksToRows(labelTasks);
    groups.push({
      id: `label-${label}`,
      name: label,
      type: 'label',
      rows,
      taskCount: labelTasks.length,
    });
  }

  // Add "Others" group for uncategorized tasks
  if (
    showOthers &&
    (selectedAssignees.length > 0 || selectedLabels.length > 0)
  ) {
    const otherTasks = workItems.filter(
      (task) => !categorizedTaskIds.has(task.id),
    );

    if (otherTasks.length > 0) {
      const rows = assignTasksToRows(otherTasks);
      groups.push({
        id: 'others',
        name: 'Others',
        type: 'others',
        rows,
        taskCount: otherTasks.length,
      });
    }
  }

  return groups;
}

export function WorkloadChart({
  tasks = [],
  selectedAssignees = [],
  selectedLabels = [],
  startDate,
  endDate,
  cellWidth = 40,
  cellHeight = 38,
  lengthUnit = 'day',
  highlightTime,
  onTaskClick,
  onTaskDrag,
  onGroupChange,
  showOthers = false,
}) {
  const containerRef = useRef(null);
  const chartScrollRef = useRef(null);
  const [dragState, setDragState] = useState(null);

  // Middle mouse drag to scroll
  const { isDragging: isMiddleMouseDragging, onMouseDown: onMiddleMouseDown } =
    useMiddleMouseDrag(chartScrollRef);
  const [dropTargetGroup, setDropTargetGroup] = useState(null);

  // Optimistic updates - store local date overrides until server confirms
  const [localUpdates, setLocalUpdates] = useState({});

  // Apply local updates to tasks
  const tasksWithLocalUpdates = useMemo(() => {
    if (Object.keys(localUpdates).length === 0) return tasks;

    return tasks.map((task) => {
      const update = localUpdates[task.id];
      if (update) {
        return { ...task, start: update.start, end: update.end };
      }
      return task;
    });
  }, [tasks, localUpdates]);

  // Clear local updates when server data changes (task dates match our updates)
  useEffect(() => {
    if (Object.keys(localUpdates).length === 0) return;

    const newLocalUpdates = { ...localUpdates };
    let hasChanges = false;

    for (const [taskId, update] of Object.entries(localUpdates)) {
      const task = tasks.find((t) => String(t.id) === String(taskId));
      if (task) {
        const taskStart =
          task.start instanceof Date ? task.start : new Date(task.start);
        const taskEnd =
          task.end instanceof Date ? task.end : new Date(task.end);

        // If server data now matches our update, remove the local override
        if (
          Math.abs(taskStart.getTime() - update.start.getTime()) < 86400000 &&
          Math.abs(taskEnd.getTime() - update.end.getTime()) < 86400000
        ) {
          delete newLocalUpdates[taskId];
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      setLocalUpdates(newLocalUpdates);
    }
  }, [tasks, localUpdates]);

  // Group tasks (use tasks with local updates)
  const groups = useMemo(() => {
    return groupTasks(
      tasksWithLocalUpdates,
      selectedAssignees,
      selectedLabels,
      showOthers,
    );
  }, [tasksWithLocalUpdates, selectedAssignees, selectedLabels, showOthers]);

  // Spacing between groups
  const groupSpacing = 8;

  // Calculate group boundaries for drop target detection
  const groupBoundaries = useMemo(() => {
    const boundaries = [];
    let currentY = 0;

    for (const group of groups) {
      const rowCount = Math.max(1, group.rows.length);
      const groupHeight = rowCount * cellHeight;
      boundaries.push({
        group,
        startY: currentY,
        endY: currentY + groupHeight,
      });
      currentY += groupHeight + groupSpacing;
    }

    return boundaries;
  }, [groups, cellHeight, groupSpacing]);

  // Find group at Y position (relative to chart content)
  const findGroupAtY = useCallback(
    (y) => {
      for (const boundary of groupBoundaries) {
        if (y >= boundary.startY && y < boundary.endY) {
          return boundary.group;
        }
      }
      return null;
    },
    [groupBoundaries],
  );

  // Calculate chart dimensions
  const chartDimensions = useMemo(() => {
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((endDate - startDate) / msPerDay);

    let unitMultiplier = 1;
    switch (lengthUnit) {
      case 'hour':
        unitMultiplier = 24;
        break;
      case 'week':
        unitMultiplier = 1 / 7;
        break;
      case 'month':
        unitMultiplier = 1 / 30;
        break;
      case 'quarter':
        unitMultiplier = 1 / 90;
        break;
      default:
        unitMultiplier = 1;
    }

    const width = totalDays * cellWidth * unitMultiplier;

    // Calculate total height (task rows + spacing between groups)
    let totalRows = 0;
    for (const group of groups) {
      totalRows += Math.max(1, group.rows.length); // Task rows only
    }
    // Add spacing between groups (n-1 spacings for n groups)
    const totalSpacing =
      groups.length > 1 ? (groups.length - 1) * groupSpacing : 0;

    const height = totalRows * cellHeight + totalSpacing;

    return { width, height, totalDays };
  }, [
    startDate,
    endDate,
    cellWidth,
    cellHeight,
    lengthUnit,
    groups,
    groupSpacing,
  ]);

  // Handle task mouse down for dragging
  const handleTaskMouseDown = useCallback((e, task, group) => {
    if (e.button !== 0) return; // Only left click

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const taskWidth = rect.width;

    // Determine drag mode based on click position
    let mode = 'move';
    if (offsetX < 8) {
      mode = 'start';
    } else if (offsetX > taskWidth - 8) {
      mode = 'end';
    }

    // Get chart scroll container for Y position calculations
    const chartRect = chartScrollRef.current?.getBoundingClientRect();
    const scrollTop = chartScrollRef.current?.scrollTop || 0;

    setDragState({
      task,
      group,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      chartTop: chartRect?.top || 0,
      scrollTop,
      originalStart:
        task.start instanceof Date ? task.start : new Date(task.start),
      originalEnd:
        task.end instanceof Date ? task.end : new Date(task.end || task.start),
    });

    e.preventDefault();
  }, []);

  // Handle mouse move for dragging
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - dragState.startX;
      const msPerDay = 24 * 60 * 60 * 1000;

      let unitMultiplier = 1;
      switch (lengthUnit) {
        case 'hour':
          unitMultiplier = 24;
          break;
        case 'week':
          unitMultiplier = 1 / 7;
          break;
        case 'month':
          unitMultiplier = 1 / 30;
          break;
        case 'quarter':
          unitMultiplier = 1 / 90;
          break;
        default:
          unitMultiplier = 1;
      }

      const daysDelta = Math.round(dx / (cellWidth * unitMultiplier));
      const msDelta = daysDelta * msPerDay;

      let newStart = dragState.originalStart;
      let newEnd = dragState.originalEnd;

      if (dragState.mode === 'move') {
        newStart = new Date(dragState.originalStart.getTime() + msDelta);
        newEnd = new Date(dragState.originalEnd.getTime() + msDelta);

        // For move mode, also check for group change (vertical drag)
        const scrollTop = chartScrollRef.current?.scrollTop || 0;
        const relativeY = e.clientY - dragState.chartTop + scrollTop;
        const targetGroup = findGroupAtY(relativeY);

        // Update drop target if hovering over a different group
        if (targetGroup && targetGroup.id !== dragState.group.id) {
          // Allow dropping on "Others" group - this removes assignee/label from task
          // But only if dragging FROM an assignee or label group (not from Others itself)
          if (
            targetGroup.type === 'others' &&
            dragState.group.type === 'others'
          ) {
            setDropTargetGroup(null);
          } else {
            setDropTargetGroup(targetGroup);
          }
        } else {
          setDropTargetGroup(null);
        }
      } else if (dragState.mode === 'start') {
        newStart = new Date(dragState.originalStart.getTime() + msDelta);
        if (newStart >= newEnd) {
          newStart = new Date(newEnd.getTime() - msPerDay);
        }
      } else if (dragState.mode === 'end') {
        newEnd = new Date(dragState.originalEnd.getTime() + msDelta);
        if (newEnd <= newStart) {
          newEnd = new Date(newStart.getTime() + msPerDay);
        }
      }

      setDragState((prev) => ({
        ...prev,
        currentStart: newStart,
        currentEnd: newEnd,
      }));
    };

    const handleMouseUp = () => {
      // Use current values if dragged, otherwise use original values
      const finalStart = dragState.currentStart || dragState.originalStart;
      const finalEnd = dragState.currentEnd || dragState.originalEnd;

      const dateChanged =
        finalStart.getTime() !== dragState.originalStart.getTime() ||
        finalEnd.getTime() !== dragState.originalEnd.getTime();

      // Check if group changed (cross-group drag)
      const groupChanged =
        dropTargetGroup && dropTargetGroup.id !== dragState.group.id;

      if (dateChanged) {
        // Apply optimistic update immediately so UI doesn't snap back
        setLocalUpdates((prev) => ({
          ...prev,
          [dragState.task.id]: { start: finalStart, end: finalEnd },
        }));

        // Notify parent to sync with server
        if (onTaskDrag) {
          onTaskDrag(dragState.task, {
            start: finalStart,
            end: finalEnd,
          });
        }
      }

      // Handle group change
      if (groupChanged && onGroupChange) {
        onGroupChange(dragState.task, {
          fromGroup: dragState.group,
          toGroup: dropTargetGroup,
        });
      }

      setDragState(null);
      setDropTargetGroup(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    dragState,
    cellWidth,
    lengthUnit,
    onTaskDrag,
    onGroupChange,
    findGroupAtY,
    dropTargetGroup,
  ]);

  // Render a single task bar
  const renderTaskBar = (task, group, rowIndex) => {
    // Check if this task is being dragged
    const isDragging = dragState && dragState.task.id === task.id;
    const displayStart =
      isDragging && dragState.currentStart
        ? dragState.currentStart
        : task.start;
    const displayEnd =
      isDragging && dragState.currentEnd ? dragState.currentEnd : task.end;

    const { x, width } = calculateTaskPosition(
      { ...task, start: displayStart, end: displayEnd },
      startDate,
      cellWidth,
      lengthUnit,
    );

    const isTask = task._gitlab?.workItemType === 'Task';
    const barColor = isTask ? '#00ba94' : '#428fdc';

    // Generate tooltip text with proper date handling
    const startDateStr =
      displayStart?.toLocaleDateString?.() || 'No start date';
    let endDateStr;
    let dateRangeNote = '';

    if (displayEnd) {
      endDateStr = displayEnd.toLocaleDateString();
    } else {
      // Handle tasks without end dates
      const isUsingCreatedDate = !task._gitlab?.startDate;
      if (isUsingCreatedDate) {
        endDateStr = '(estimated +7 days)';
        dateRangeNote = '\n[Using created date as start]';
      } else {
        endDateStr = '(estimated +1 day)';
        dateRangeNote = '\n[No due date set]';
      }
    }

    // Build comprehensive tooltip
    const tooltipParts = [
      task.text,
      `${startDateStr} - ${endDateStr}${dateRangeNote}`,
    ];

    // Add assignee info if present
    if (task.assigned) {
      tooltipParts.push(`Assignee: ${task.assigned}`);
    }

    // Add labels if present
    if (task.labels) {
      const labelStr = Array.isArray(task.labels)
        ? task.labels.join(', ')
        : task.labels;
      tooltipParts.push(`Labels: ${labelStr}`);
    }

    // Add type info
    tooltipParts.push(`Type: ${task._gitlab?.workItemType || 'Issue'}`);

    const tooltipText = tooltipParts.join('\n');

    return (
      <div
        key={task.id}
        className={`workload-task-bar ${isDragging ? 'dragging' : ''}`}
        style={{
          left: `${x}px`,
          width: `${width}px`,
          backgroundColor: barColor,
        }}
        onMouseDown={(e) => handleTaskMouseDown(e, task, group)}
        onClick={() => onTaskClick && onTaskClick(task)}
        title={tooltipText}
      >
        <span className="task-bar-text">{task.text}</span>
        <div className="resize-handle resize-handle-left" />
        <div className="resize-handle resize-handle-right" />
      </div>
    );
  };

  // Note: renderedContent is no longer used - sidebar and chart are now synced separately

  // Generate time scale with months
  const { timeScaleCells, monthHeaders } = useMemo(() => {
    const cells = [];
    const months = [];
    const current = new Date(startDate);
    let currentMonth = null;
    let monthStartIdx = 0;
    let lastYear = null;

    while (current < endDate) {
      const dayOfWeek = current.getDay();
      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
      const isHolidayDay = highlightTime
        ? highlightTime(current, 'day') === 'wx-weekend'
        : false;

      // Track month changes
      const monthKey = `${current.getFullYear()}-${current.getMonth()}`;
      if (monthKey !== currentMonth) {
        if (currentMonth !== null) {
          const monthDate = new Date(cells[monthStartIdx].date);
          const isJanuary = monthDate.getMonth() === 0;
          const year = monthDate.getFullYear();
          // Show year on January or if it's the first month and year changed
          const showYear =
            isJanuary || (months.length === 0 && year !== lastYear);
          months.push({
            key: currentMonth,
            label: showYear
              ? monthDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                })
              : monthDate.toLocaleDateString('en-US', { month: 'short' }),
            startIdx: monthStartIdx,
            days: cells.length - monthStartIdx,
          });
          lastYear = year;
        }
        currentMonth = monthKey;
        monthStartIdx = cells.length;
      }

      cells.push({
        date: new Date(current),
        isWeekend: isWeekendDay || isHolidayDay,
        label: current.getDate(),
      });

      current.setDate(current.getDate() + 1);
    }

    // Push last month
    if (currentMonth !== null && cells.length > monthStartIdx) {
      const monthDate = new Date(cells[monthStartIdx].date);
      const isJanuary = monthDate.getMonth() === 0;
      const year = monthDate.getFullYear();
      const showYear = isJanuary || months.length === 0 || year !== lastYear;
      months.push({
        key: currentMonth,
        label: showYear
          ? monthDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
            })
          : monthDate.toLocaleDateString('en-US', { month: 'short' }),
        startIdx: monthStartIdx,
        days: cells.length - monthStartIdx,
      });
    }

    return { timeScaleCells: cells, monthHeaders: months };
  }, [startDate, endDate, highlightTime]);

  // Refs for syncing scroll (must be declared before any conditional returns)
  const timeScaleMonthRef = useRef(null);
  const timeScaleDayRef = useRef(null);
  const sidebarRef = useRef(null);
  // Note: chartScrollRef is declared earlier in the component

  // Handle chart scroll - sync with time scale and sidebar
  const handleChartScroll = useCallback((e) => {
    // Sync time scale horizontal scrolls
    if (timeScaleMonthRef.current) {
      timeScaleMonthRef.current.scrollLeft = e.target.scrollLeft;
    }
    if (timeScaleDayRef.current) {
      timeScaleDayRef.current.scrollLeft = e.target.scrollLeft;
    }
    // Sync sidebar vertical scroll
    if (sidebarRef.current) {
      sidebarRef.current.scrollTop = e.target.scrollTop;
    }
  }, []);

  // Handle sidebar scroll - sync with chart
  const handleSidebarScroll = useCallback((e) => {
    if (chartScrollRef.current) {
      chartScrollRef.current.scrollTop = e.target.scrollTop;
    }
  }, []);

  // Scroll to today on initial load
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today >= startDate && today <= endDate && chartScrollRef.current) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysDiff = (today - startDate) / msPerDay;

      let unitMultiplier = 1;
      switch (lengthUnit) {
        case 'hour':
          unitMultiplier = 24;
          break;
        case 'week':
          unitMultiplier = 1 / 7;
          break;
        case 'month':
          unitMultiplier = 1 / 30;
          break;
        case 'quarter':
          unitMultiplier = 1 / 90;
          break;
        default:
          unitMultiplier = 1;
      }

      const todayPosition = daysDiff * cellWidth * unitMultiplier;
      // Scroll to position today at the left edge of the view
      const scrollLeft = Math.max(0, todayPosition);

      chartScrollRef.current.scrollLeft = scrollLeft;
      // Also sync time scale
      if (timeScaleMonthRef.current) {
        timeScaleMonthRef.current.scrollLeft = scrollLeft;
      }
      if (timeScaleDayRef.current) {
        timeScaleDayRef.current.scrollLeft = scrollLeft;
      }
    }
  }, [startDate, endDate, cellWidth, lengthUnit]); // Run once when dates/scale change

  // Early return for empty state (after all hooks)
  if (groups.length === 0) {
    return (
      <div className="workload-chart-empty">
        <i className="fas fa-hand-pointer"></i>
        <p>Select assignees or labels to view workload</p>
      </div>
    );
  }

  return (
    <div className="workload-chart-container" ref={containerRef}>
      {/* Time scale header */}
      <div className="workload-time-scale">
        {/* Month row */}
        <div className="time-scale-row">
          <div className="time-scale-spacer">Year / Month</div>
          <div className="time-scale-scroll" ref={timeScaleMonthRef}>
            <div
              className="time-scale-months"
              style={{ width: `${chartDimensions.width}px` }}
            >
              {monthHeaders.map((month) => (
                <div
                  key={month.key}
                  className="time-scale-month"
                  style={{ width: `${month.days * cellWidth}px` }}
                >
                  {month.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Day row */}
        <div className="time-scale-row">
          <div className="time-scale-spacer">Day</div>
          <div className="time-scale-scroll" ref={timeScaleDayRef}>
            <div
              className="time-scale-content"
              style={{ width: `${chartDimensions.width}px` }}
            >
              {timeScaleCells.map((cell, idx) => (
                <div
                  key={idx}
                  className={`time-scale-cell ${cell.isWeekend ? 'weekend' : ''}`}
                  style={{ width: `${cellWidth}px` }}
                >
                  {cell.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart body */}
      <div className="workload-chart-body">
        {/* Left sidebar (group labels) */}
        <div
          className="workload-sidebar-column"
          ref={sidebarRef}
          onScroll={handleSidebarScroll}
        >
          {groups.map((group, groupIdx) => {
            const rowCount = Math.max(1, group.rows.length);
            const isLastGroup = groupIdx === groups.length - 1;
            // Add spacing after each group except the last one
            const groupHeight =
              rowCount * cellHeight + (isLastGroup ? 0 : groupSpacing);
            const isDropTarget =
              dropTargetGroup && dropTargetGroup.id === group.id;
            return (
              <div
                key={group.id}
                className={`sidebar-group ${isDropTarget ? 'drop-target' : ''}`}
                style={{ height: `${groupHeight}px` }}
              >
                {Array.from({ length: rowCount }).map((_, rowIdx) => (
                  <div
                    key={rowIdx}
                    className={`sidebar-row ${rowIdx === 0 ? 'first-row' : ''}`}
                    style={{ height: `${cellHeight}px` }}
                  >
                    {rowIdx === 0 ? (
                      <>
                        <span className="group-icon">
                          {group.type === 'assignee' ? (
                            <i
                              className="fas fa-user"
                              style={{ color: '#6b4fbb' }}
                            ></i>
                          ) : group.type === 'label' ? (
                            <i
                              className="fas fa-tag"
                              style={{ color: '#fc6d26' }}
                            ></i>
                          ) : (
                            <i
                              className="fas fa-folder-open"
                              style={{ color: '#6c757d' }}
                            ></i>
                          )}
                        </span>
                        <span className="group-name">{group.name}</span>
                        <span className="group-task-count">
                          ({group.taskCount})
                        </span>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Chart area */}
        <div
          className={`workload-chart-scroll${isMiddleMouseDragging ? ' wx-dragging' : ''}`}
          ref={chartScrollRef}
          onScroll={handleChartScroll}
          onMouseDown={onMiddleMouseDown}
        >
          <div
            className="workload-chart-content"
            style={{
              width: `${chartDimensions.width}px`,
              height: `${chartDimensions.height}px`,
            }}
          >
            {/* Grid background */}
            <div className="workload-grid-bg">
              {timeScaleCells.map((cell, idx) => (
                <div
                  key={idx}
                  className={`grid-column ${cell.isWeekend ? 'weekend' : ''}`}
                  style={{
                    left: `${idx * cellWidth}px`,
                    width: `${cellWidth}px`,
                    height: `${chartDimensions.height}px`,
                  }}
                />
              ))}
            </div>

            {/* Task bars */}
            {groups.map((group, groupIdx) => {
              // Calculate start Y with spacing between groups
              let groupStartY = 0;
              for (let i = 0; i < groupIdx; i++) {
                groupStartY += Math.max(1, groups[i].rows.length) * cellHeight;
                groupStartY += groupSpacing; // Add spacing after each group
              }

              const rowCount = Math.max(1, group.rows.length);
              return (
                <div key={group.id} className="chart-group">
                  {Array.from({ length: rowCount }).map((_, rowIdx) => (
                    <div
                      key={rowIdx}
                      className="chart-row"
                      style={{
                        top: `${groupStartY + rowIdx * cellHeight}px`,
                        height: `${cellHeight}px`,
                      }}
                    >
                      {(group.rows[rowIdx] || []).map((task) =>
                        renderTaskBar(task, group, rowIdx),
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Today marker */}
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (today >= startDate && today <= endDate) {
                const msPerDay = 24 * 60 * 60 * 1000;
                const daysDiff = (today - startDate) / msPerDay;
                return (
                  <div
                    className="today-marker"
                    style={{ left: `${daysDiff * cellWidth}px` }}
                  />
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkloadChart;
