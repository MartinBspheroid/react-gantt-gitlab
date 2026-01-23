import { useState, useCallback, useMemo, useRef } from 'react';

/**
 * Hook for managing row hover interactions in the Gantt chart timeline.
 *
 * Provides state and handlers for:
 * 1. Detecting which row the mouse is hovering over
 * 2. Determining if a task needs a bar (missing dates)
 * 3. Managing draw mode state for creating new bars
 *
 * @param {Object} options - Configuration options
 * @param {number} options.cellHeight - Height of each row in pixels
 * @param {number} options.scrollLeft - Current horizontal scroll position
 * @param {number} options.scrollTop - Current vertical scroll position
 * @param {Array} options.tasks - Array of all tasks
 * @param {Object} options.api - Gantt store API
 * @param {boolean} options.readonly - Whether the chart is in readonly mode
 */
export function useRowHover({
  cellHeight,
  scrollLeft,
  scrollTop,
  tasks,
  api,
  readonly,
}) {
  const [hoverState, setHoverState] = useState({
    rowIndex: null,
    taskId: null,
    mouseX: 0,
    mouseY: 0,
    isDrawing: false,
    drawStartX: null,
    drawEndX: null,
  });

  // Ref to track if we're in drawing mode (to prevent state batching issues)
  const isDrawingRef = useRef(false);

  /**
   * Check if a task needs a bar (doesn't have real dates)
   * A task "needs bar" if it doesn't have explicit startDate AND dueDate.
   *
   * We check both:
   * 1. _gitlab.startDate/_gitlab.dueDate - original values from GitLab
   * 2. task.$w - if the task already has a rendered bar (width > minimum threshold)
   *
   * This handles the case where user just drew a bar but GitLab hasn't synced yet.
   */
  const taskNeedsBar = useCallback((task) => {
    if (!task) return false;
    // Skip milestones and summary tasks
    if (task.type === 'milestone' || task.type === 'summary') return false;

    // If task already has a visible bar with reasonable width, it doesn't need drawing
    // Use a threshold to distinguish real bars from created_at fallback tiny bars
    // A real bar should be at least a few days wide (e.g., > 20px at typical zoom)
    if (task.$w && task.$w > 20) {
      return false;
    }

    // Check _gitlab for original GitLab values (not the fallback values)
    // Task needs bar if it doesn't have BOTH startDate AND dueDate from GitLab
    const hasRealStartDate = task._gitlab?.startDate;
    const hasRealDueDate = task._gitlab?.dueDate;
    return !hasRealStartDate || !hasRealDueDate;
  }, []);

  /**
   * Handle mouse move over the chart area
   * NOTE: chartRect should be the scroll container (chartRef), not the content area (areaRef)
   */
  const handleMouseMove = useCallback(
    (e, chartRect) => {
      if (!chartRect || !cellHeight) {
        return;
      }

      // Calculate mouse position relative to the chart content
      // mouseX needs scrollLeft added because we're measuring from scroll container
      const mouseX = e.clientX - chartRect.left + scrollLeft;
      // mouseY relative to scroll container (for display purposes)
      const mouseY = e.clientY - chartRect.top;

      // Calculate which row the mouse is over
      // We need to add scrollTop to convert from viewport-relative to content-relative position
      // Then use that to find the actual task index in the full task list
      const contentY = mouseY + scrollTop;
      const globalRowIndex = Math.floor(contentY / cellHeight);

      // Get task directly by global index (not using area offset since we're calculating globally)
      const task = tasks && Array.isArray(tasks) ? tasks[globalRowIndex] : null;

      if (!task) {
        if (!isDrawingRef.current) {
          setHoverState((prev) => ({
            ...prev,
            rowIndex: null,
            taskId: null,
            mouseX,
            mouseY,
          }));
        }
        return;
      }

      // Update draw position if currently drawing
      if (isDrawingRef.current) {
        setHoverState((prev) => ({
          ...prev,
          mouseX,
          mouseY,
          drawEndX: mouseX,
        }));
      } else {
        setHoverState((prev) => ({
          ...prev,
          rowIndex: globalRowIndex,
          taskId: task.id,
          mouseX,
          mouseY,
        }));
      }
    },
    [cellHeight, scrollLeft, scrollTop, tasks],
  );

  /**
   * Handle mouse down to start drawing a bar
   */
  const handleMouseDown = useCallback(
    (e, chartRect) => {
      if (e.button !== 0) return; // Only left click
      if (readonly) return;

      const task = api?.getTask?.(hoverState.taskId);
      if (!task || !taskNeedsBar(task)) return;

      const startX = e.clientX - chartRect.left + scrollLeft;
      isDrawingRef.current = true;
      setHoverState((prev) => ({
        ...prev,
        isDrawing: true,
        drawStartX: startX,
        drawEndX: startX,
      }));

      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
    },
    [readonly, api, hoverState.taskId, scrollLeft, taskNeedsBar],
  );

  /**
   * Handle mouse up to complete drawing
   * Returns draw info if valid, null if cancelled
   */
  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return null;

    isDrawingRef.current = false;
    document.body.style.userSelect = '';

    const { drawStartX, drawEndX, taskId } = hoverState;

    // Calculate the range
    const minX = Math.min(drawStartX, drawEndX);
    const maxX = Math.max(drawStartX, drawEndX);
    const width = maxX - minX;

    // Minimum width threshold (10px)
    if (width < 10) {
      setHoverState((prev) => ({
        ...prev,
        isDrawing: false,
        drawStartX: null,
        drawEndX: null,
      }));
      return null;
    }

    // Return draw info for the confirmation dialog
    return {
      taskId,
      startX: minX,
      endX: maxX,
    };
  }, [hoverState]);

  /**
   * Cancel drawing mode
   */
  const cancelDrawing = useCallback(() => {
    isDrawingRef.current = false;
    document.body.style.userSelect = '';
    setHoverState((prev) => ({
      ...prev,
      isDrawing: false,
      drawStartX: null,
      drawEndX: null,
    }));
  }, []);

  /**
   * Handle mouse leave from chart area
   */
  const handleMouseLeave = useCallback(() => {
    if (!isDrawingRef.current) {
      setHoverState((prev) => ({
        ...prev,
        rowIndex: null,
        taskId: null,
      }));
    }
  }, []);

  /**
   * Get the current hovered task
   */
  const hoveredTask = useMemo(() => {
    if (!hoverState.taskId || !api?.getTask) return null;
    return api.getTask(hoverState.taskId);
  }, [hoverState.taskId, api]);

  /**
   * Check if current row is drawable (task without bar, not readonly)
   */
  const isDrawableRow = useMemo(() => {
    if (readonly) return false;
    return taskNeedsBar(hoveredTask);
  }, [readonly, hoveredTask, taskNeedsBar]);

  return {
    // State
    hoverState,
    hoveredTask,

    // Computed values
    isDrawableRow,

    // Handlers
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    cancelDrawing,

    // Utilities
    taskNeedsBar,
  };
}

export default useRowHover;
