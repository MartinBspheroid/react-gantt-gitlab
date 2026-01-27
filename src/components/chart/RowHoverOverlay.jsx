import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { useRowHover } from '../../hooks/useRowHover';
import DrawBarConfirmDialog from './DrawBarConfirmDialog';
import './RowHoverOverlay.css';

/**
 * Overlay component for row hover interactions in the Gantt chart.
 *
 * Features:
 * 1. Draw mode indicator - for tasks without bars, shows a vertical line at cursor
 * 2. Draw preview - while dragging, shows the bar preview
 *
 * Note: Off-screen arrows are now handled by OffscreenArrows component (always visible, not hover-based).
 *
 * This component attaches mouse listeners to the parent areaRef element
 * to capture mouse events on the timeline grid area.
 */
function RowHoverOverlay({
  tasks,
  cellHeight,
  cellWidth,
  scrollLeft,
  scrollTop,
  readonly,
  api,
  scales,
  countWorkdays, // Function to count workdays between two dates (from useHighlightTime)
  areaRef, // Reference to the .wx-area element for mouse event handling
  chartRef, // Reference to the .wx-chart element (scroll container)
}) {
  const [dialogInfo, setDialogInfo] = useState(null);
  // Store the confirmed draw preview to keep showing it while dialog is open
  const [confirmedPreview, setConfirmedPreview] = useState(null);

  // Use the row hover hook for state management
  const {
    hoverState,
    hoveredTask,
    isDrawableRow,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    cancelDrawing,
  } = useRowHover({
    cellHeight,
    scrollLeft,
    scrollTop,
    tasks,
    api,
    readonly,
  });

  // Track chart container rect for fixed positioning
  const [chartContainerRect, setChartContainerRect] = useState(null);

  // Update chart container rect for fixed positioning (on scroll and resize)
  // NOTE: We use chartRef (scroll container) not areaRef (content area)
  // because mouse positions need to be relative to the fixed container
  useEffect(() => {
    const chartEl = chartRef?.current;
    if (!chartEl) return;

    const updateContainerRect = () => {
      setChartContainerRect(chartEl.getBoundingClientRect());
    };
    updateContainerRect();

    // Update on scroll since getBoundingClientRect changes with scroll
    chartEl.addEventListener('scroll', updateContainerRect);
    window.addEventListener('resize', updateContainerRect);

    const ro = new ResizeObserver(updateContainerRect);
    ro.observe(chartEl);

    return () => {
      chartEl.removeEventListener('scroll', updateContainerRect);
      window.removeEventListener('resize', updateContainerRect);
      ro.disconnect();
    };
  }, [chartRef]);

  /**
   * Convert pixel X position to date using scales
   * Uses floor to ensure position within a cell maps to that cell's date (not rounding to next day)
   */
  const pixelToDate = useCallback(
    (pixelX) => {
      if (!scales || !scales.start) return null;

      const lengthUnitWidth = scales.lengthUnitWidth || cellWidth;
      const lengthUnit = api?.getState?.().lengthUnit || 'day';
      const timelineStart = new Date(scales.start);

      // Use floor so that any position within a cell maps to that cell's date
      const unitOffset = Math.floor(pixelX / lengthUnitWidth);
      const result = new Date(timelineStart);

      switch (lengthUnit) {
        case 'hour':
          result.setHours(result.getHours() + unitOffset);
          break;
        case 'week':
          result.setDate(result.getDate() + unitOffset * 7);
          break;
        case 'month':
          result.setMonth(result.getMonth() + unitOffset);
          break;
        case 'quarter':
          result.setMonth(result.getMonth() + unitOffset * 3);
          break;
        case 'day':
        default:
          result.setDate(result.getDate() + unitOffset);
          break;
      }

      return result;
    },
    [scales, cellWidth, api],
  );

  /**
   * Snap pixel X to the nearest cell boundary
   */
  const getLengthUnitWidth = useCallback(() => {
    return scales?.lengthUnitWidth || cellWidth;
  }, [scales, cellWidth]);

  /**
   * Snap pixel X to the nearest cell boundary (left edge)
   */
  const snapToCell = useCallback(
    (pixelX) => {
      if (!scales) return pixelX;
      const lengthUnitWidth = getLengthUnitWidth();
      return Math.floor(pixelX / lengthUnitWidth) * lengthUnitWidth;
    },
    [scales, getLengthUnitWidth],
  );

  /**
   * Snap pixel X to the END of the cell (right edge)
   */
  const snapToCellEnd = useCallback(
    (pixelX) => {
      if (!scales) return pixelX;
      const lengthUnitWidth = getLengthUnitWidth();
      return (Math.floor(pixelX / lengthUnitWidth) + 1) * lengthUnitWidth;
    },
    [scales, getLengthUnitWidth],
  );

  /**
   * Handle mouse move event on the area element
   * NOTE: We pass chartContainerRect (scroll container) instead of chartRect (content area)
   * because the mouse position needs to be relative to the fixed scroll container,
   * not the scrollable content area which moves with scroll.
   */
  const onMouseMove = useCallback(
    (e) => {
      if (!chartContainerRect) return;
      handleMouseMove(e, chartContainerRect);
    },
    [handleMouseMove, chartContainerRect],
  );

  /**
   * Handle mouse down event for starting draw
   * NOTE: We pass chartContainerRect (scroll container) for consistent coordinate system
   */
  const onMouseDown = useCallback(
    (e) => {
      // Don't start drawing if clicking on a bar or arrow
      if (e.target.closest('.wx-bar') || e.target.closest('.wx-offscreen-arrow')) return;
      if (!chartContainerRect) return;
      handleMouseDown(e, chartContainerRect);
    },
    [handleMouseDown, chartContainerRect],
  );

  /**
   * Handle mouse up event for completing draw
   */
  const onMouseUp = useCallback(() => {
    const drawInfo = handleMouseUp();
    if (drawInfo) {
      // Snap positions to cell boundaries before converting to dates
      const snappedStartX = snapToCell(Math.min(drawInfo.startX, drawInfo.endX));
      let snappedEndX = snapToCellEnd(Math.max(drawInfo.startX, drawInfo.endX));

      // Ensure at least 1 cell width (for clicks without dragging)
      if (snappedEndX <= snappedStartX) {
        snappedEndX = snappedStartX + getLengthUnitWidth();
      }

      // Convert snapped pixel positions to dates
      // Note: endDate is the position AFTER the last cell (exclusive)
      const startDate = pixelToDate(snappedStartX);
      const endDate = pixelToDate(snappedEndX);

      if (startDate && endDate) {
        // Save preview position to keep showing it while dialog is open
        setConfirmedPreview({
          left: snappedStartX,
          width: snappedEndX - snappedStartX,
          rowIndex: hoverState.rowIndex,
        });

        setDialogInfo({
          taskId: drawInfo.taskId,
          startDate,
          endDate,
        });
      }
    }
  }, [handleMouseUp, pixelToDate, snapToCell, snapToCellEnd, getLengthUnitWidth, hoverState.rowIndex]);

  // Refs to hold the latest callback functions
  const onMouseMoveRef = useRef(onMouseMove);
  const onMouseDownRef = useRef(onMouseDown);
  const handleMouseLeaveRef = useRef(handleMouseLeave);

  // Update refs when callbacks change
  useEffect(() => {
    onMouseMoveRef.current = onMouseMove;
    onMouseDownRef.current = onMouseDown;
    handleMouseLeaveRef.current = handleMouseLeave;
  }, [onMouseMove, onMouseDown, handleMouseLeave]);

  // Attach mouse event listeners to the area element (only once when areaRef is available)
  useEffect(() => {
    const areaEl = areaRef?.current;
    if (!areaEl) {
      // areaRef not available yet, will retry on next render
      return;
    }

    // Listeners attached to area element for draw bar functionality

    // Use wrapper functions that call the refs
    const handleMove = (e) => onMouseMoveRef.current(e);
    const handleDown = (e) => onMouseDownRef.current(e);
    const handleLeave = () => handleMouseLeaveRef.current();

    areaEl.addEventListener('mousemove', handleMove);
    areaEl.addEventListener('mousedown', handleDown);
    areaEl.addEventListener('mouseleave', handleLeave);

    return () => {
      areaEl.removeEventListener('mousemove', handleMove);
      areaEl.removeEventListener('mousedown', handleDown);
      areaEl.removeEventListener('mouseleave', handleLeave);
    };
  }, [areaRef]); // Only re-attach when areaRef changes

  // Global mouseup listener for completing draw
  useEffect(() => {
    if (hoverState.isDrawing) {
      window.addEventListener('mouseup', onMouseUp);
      return () => window.removeEventListener('mouseup', onMouseUp);
    }
  }, [hoverState.isDrawing, onMouseUp]);

  /**
   * Convert exclusive end date to inclusive end date for Gantt storage.
   * - Input: exclusive endDate (the day AFTER the last selected day, at 00:00:00)
   * - Output: inclusive endDate (the actual last day, at 23:59:59)
   *
   * This conversion is needed because:
   * 1. Drawing uses half-open interval [start, end) for easier calculations
   * 2. Gantt storage uses inclusive end date with time set to end of day
   */
  const toInclusiveEndDate = useCallback((exclusiveEndDate) => {
    if (!exclusiveEndDate) return exclusiveEndDate;
    const result = new Date(exclusiveEndDate);
    result.setDate(result.getDate() - 1); // Convert exclusive to inclusive
    result.setHours(23, 59, 59, 999); // Set to end of day for proper Gantt display
    return result;
  }, []);

  /**
   * Handle dialog confirmation
   */
  const handleDialogConfirm = useCallback(
    (mode) => {
      if (!dialogInfo || !api) return;

      const { taskId, startDate, endDate } = dialogInfo;
      const adjustedEndDate = toInclusiveEndDate(endDate);
      let taskUpdate = {};

      if (mode === 'overwrite') {
        taskUpdate = { start: startDate, end: adjustedEndDate };
      } else if (mode === 'end-only') {
        taskUpdate = { end: adjustedEndDate };
      }

      if (Object.keys(taskUpdate).length > 0) {
        api.exec('update-task', {
          id: taskId,
          task: taskUpdate,
        });
      }

      setDialogInfo(null);
      setConfirmedPreview(null);
      cancelDrawing();
    },
    [dialogInfo, api, cancelDrawing, toInclusiveEndDate],
  );

  /**
   * Handle dialog cancel
   */
  const handleDialogCancel = useCallback(() => {
    setDialogInfo(null);
    setConfirmedPreview(null);
    cancelDrawing();
  }, [cancelDrawing]);

  // Calculate draw preview dimensions - snapped to cell boundaries
  // Use confirmedPreview when dialog is open, otherwise use live hover state
  const drawPreview = useMemo(() => {
    // If dialog is open, show the confirmed preview
    if (confirmedPreview) {
      return {
        left: confirmedPreview.left - scrollLeft,
        width: confirmedPreview.width,
        rowIndex: confirmedPreview.rowIndex,
      };
    }

    // Otherwise show live drawing preview
    if (!hoverState.isDrawing || !hoverState.drawStartX || !hoverState.drawEndX) {
      return null;
    }
    // Snap start to left edge of cell, end to right edge of cell
    const rawStartX = Math.min(hoverState.drawStartX, hoverState.drawEndX);
    const rawEndX = Math.max(hoverState.drawStartX, hoverState.drawEndX);
    const snappedStartX = snapToCell(rawStartX);
    const snappedEndX = snapToCellEnd(rawEndX);
    const width = snappedEndX - snappedStartX;
    return {
      left: snappedStartX - scrollLeft,
      width,
      rowIndex: hoverState.rowIndex,
    };
  }, [hoverState, scrollLeft, snapToCell, snapToCellEnd, confirmedPreview]);

  // Determine if we should show any overlay elements
  // Show overlay when hovering a drawable row, actively drawing, or dialog is open
  const showOverlay =
    (hoveredTask !== null && (isDrawableRow || hoverState.isDrawing)) || confirmedPreview !== null;

  // Calculate fixed position for overlay elements (relative to viewport)
  // Use rowIndex (global task index) calculated in handleMouseMove to get exact row position
  // This avoids the small offset that task.$y includes for bar vertical centering
  const fixedTop = useMemo(() => {
    // Use confirmedPreview.rowIndex when dialog is open, otherwise use hoverState.rowIndex
    const rowIndex = confirmedPreview?.rowIndex ?? hoverState.rowIndex;
    if (!chartContainerRect || rowIndex === null || !cellHeight) return 0;
    // Calculate row top from the global row index
    const rowTopInContent = rowIndex * cellHeight;
    const rowTopInChart = rowTopInContent - scrollTop;
    // Convert to viewport coordinates
    return chartContainerRect.top + rowTopInChart;
  }, [chartContainerRect, hoverState.rowIndex, scrollTop, cellHeight, confirmedPreview]);

  const fixedLeft = useMemo(() => {
    if (!chartContainerRect) return 0;
    return chartContainerRect.left;
  }, [chartContainerRect]);

  const fixedRight = useMemo(() => {
    if (!chartContainerRect) return 0;
    return window.innerWidth - chartContainerRect.right;
  }, [chartContainerRect]);

  // Don't render if we don't have the container rect yet
  if (!chartContainerRect) {
    return null;
  }

  return (
    <>
      {/* Visual overlay elements - uses fixed positioning relative to viewport */}
      {showOverlay && (
        <>
          {/* Row highlight background - still uses absolute within chart */}
          {(isDrawableRow || hoverState.isDrawing) && (
            <div
              className="wx-row-highlight"
              style={{
                position: 'fixed',
                top: `${fixedTop}px`,
                left: `${fixedLeft}px`,
                right: `${fixedRight}px`,
                height: `${cellHeight}px`,
                background: 'rgba(57, 131, 235, 0.08)',
                pointerEvents: 'none',
                zIndex: 50,
              }}
            />
          )}

          {/* Draw mode indicator - vertical line at cursor */}
          {isDrawableRow && !hoverState.isDrawing && (
            <div
              className="wx-draw-cursor-line"
              style={{
                position: 'fixed',
                left: `${fixedLeft + hoverState.mouseX - scrollLeft}px`,
                top: `${fixedTop}px`,
                width: '2px',
                height: `${cellHeight}px`,
                background: 'var(--wx-color-primary, #3983eb)',
                opacity: 0.7,
                pointerEvents: 'none',
                borderRadius: '1px',
                boxShadow: '0 0 4px rgba(57, 131, 235, 0.4)',
                zIndex: 51,
              }}
            />
          )}

          {/* Draw preview rectangle */}
          {drawPreview && (
            <div
              className="wx-draw-preview"
              style={{
                position: 'fixed',
                left: `${fixedLeft + drawPreview.left}px`,
                top: `${fixedTop}px`,
                width: `${drawPreview.width}px`,
                height: `${cellHeight}px`,
                background: 'rgba(57, 131, 235, 0.3)',
                border: '2px solid rgba(57, 131, 235, 0.6)',
                borderRadius: 'var(--wx-gantt-bar-border-radius, 4px)',
                pointerEvents: 'none',
                boxSizing: 'border-box',
                zIndex: 52,
              }}
            />
          )}

          {/* Off-screen arrows are now handled by OffscreenArrows component */}
        </>
      )}

      {/* Confirmation dialog */}
      {dialogInfo && (
        <DrawBarConfirmDialog
          startDate={dialogInfo.startDate}
          endDate={dialogInfo.endDate}
          countWorkdays={countWorkdays}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
        />
      )}
    </>
  );
}

export default RowHoverOverlay;
