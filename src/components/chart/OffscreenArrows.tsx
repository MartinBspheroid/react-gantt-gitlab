// @ts-nocheck
import { useContext, useMemo, useCallback, useState, useEffect } from 'react';
import storeContext from '../../context';
import { useStore } from '@svar-ui/lib-react';
import './OffscreenArrows.css';

/**
 * 標題寬度估算常數
 */
const LABEL_CHAR_WIDTH = 7; // 每個字元約 7px
const LABEL_PADDING = 8; // 標題額外 padding

/**
 * Link 轉折常數（與 Links.jsx / Bars.jsx 保持一致）
 */
const LINK_OFFSET_MAX = 20; // link 水平偏移距離上限
const LABEL_GAP = 4; // 標題與 link 轉折點之間的緩衝
const ARROW_EDGE_PADDING = 4; // Padding from viewport edge
const SCROLL_PADDING = 50; // Padding when scrolling to bar
const DISPLAY_NAME_MAX_LENGTH = 12;

/**
 * OffscreenArrows - Shows arrow indicators for tasks whose bars are completely off-screen
 *
 * Features:
 * - Shows left arrow when bar + title are off-screen to the left
 * - Shows right arrow when bar is off-screen to the right
 * - Considers bar's external label width to avoid arrow overlapping with visible title
 * - Click arrow to scroll the bar into view
 *
 * NOTE: Uses fixed positioning to avoid being clipped by overflow:hidden on parent elements.
 */
function OffscreenArrows({ scrollLeft, viewportWidth, cellHeight, chartRef }) {
  const api = useContext(storeContext);

  // Track chart container rect for fixed positioning
  const [chartContainerRect, setChartContainerRect] = useState(null);

  // Get visible tasks (virtual scroll range)
  const rTasksValue = useStore(api, '_tasks');
  const areaValue = useStore(api, 'area');
  const scrollTop = useStore(api, 'scrollTop');
  const cellWidth = useStore(api, 'cellWidth');

  // Update chart container rect for fixed positioning (on scroll and resize)
  useEffect(() => {
    const chartEl = chartRef?.current;
    if (!chartEl) return;

    const updateContainerRect = () => {
      setChartContainerRect(chartEl.getBoundingClientRect());
    };
    updateContainerRect();

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

  // Get visible tasks based on virtual scroll area
  const visibleTasks = useMemo(() => {
    if (!areaValue || !Array.isArray(rTasksValue)) return [];
    const start = areaValue.start ?? 0;
    const end = areaValue.end ?? 0;
    return rTasksValue.slice(start, end);
  }, [rTasksValue, areaValue]);

  // Calculate which tasks have off-screen bars (considering external labels)
  const offscreenTasks = useMemo(() => {
    if (!visibleTasks.length || viewportWidth <= 0) return [];

    const viewportRight = scrollLeft + viewportWidth;
    const result = [];

    visibleTasks.forEach((task) => {
      // Skip tasks without valid bar dimensions
      if (task.$w === undefined || task.$w <= 0) return;
      if (task.$x === undefined || task.$y === undefined) return;

      // Check if task has valid dates for showing arrows
      // Milestones: dates stored directly on task.start/end
      // Regular tasks: need at least dueDate
      // (if no startDate, system uses createdAt as fallback to display bar)
      const isMilestone = task.$isMilestone || task.type === 'milestone';
      if (!isMilestone) {
        if (!task.dueDate) return;
      }

      const barLeft = task.$x;
      const barRight = task.$x + task.$w;

      // All items display title to the RIGHT of the bar
      // Include label width when checking if visual element is off-screen
      const labelWidth = estimateLabelWidth(task.text || task.label, cellWidth);
      const visualRight = barRight + labelWidth;

      // Determine off-screen direction
      // Left: bar AND label must both be off-screen (to avoid overlapping with visible label)
      // Right: only check bar position
      if (visualRight <= scrollLeft) {
        result.push(createOffscreenTask(task, 'left'));
      } else if (barLeft >= viewportRight) {
        result.push(createOffscreenTask(task, 'right'));
      }
    });

    return result;
  }, [visibleTasks, scrollLeft, viewportWidth, cellWidth]);

  // Handle arrow click - scroll to show the bar
  const handleArrowClick = useCallback(
    (task, direction) => {
      if (!api) return;

      const barLeft = task.$x;
      const barRight = task.$x + task.$w;

      const targetScrollLeft =
        direction === 'left'
          ? Math.max(0, barLeft - SCROLL_PADDING)
          : Math.max(0, barRight - viewportWidth + SCROLL_PADDING);

      api.exec('scroll-chart', { left: targetScrollLeft });
    },
    [api, viewportWidth],
  );

  // Don't render if no arrows to show or container rect not ready
  if (
    !chartContainerRect ||
    offscreenTasks.length === 0 ||
    viewportWidth <= 0
  ) {
    return null;
  }

  return (
    <>
      {offscreenTasks.map(({ task, taskY, direction, displayName, color }) => {
        // Convert content-relative Y to viewport-relative coordinates
        const rowTopInChart = taskY - scrollTop;
        const fixedTop = chartContainerRect.top + rowTopInChart;
        const fixedLeft = chartContainerRect.left;
        const fixedRight = window.innerWidth - chartContainerRect.right;

        // Skip if row is outside visible chart area
        if (
          fixedTop < chartContainerRect.top ||
          fixedTop + cellHeight > chartContainerRect.bottom
        ) {
          return null;
        }

        return (
          <div
            key={`${direction}-${task.id}`}
            className={`wx-offscreen-arrow-item wx-${direction}`}
            style={{
              position: 'fixed',
              top: `${fixedTop}px`,
              left:
                direction === 'left'
                  ? `${fixedLeft + ARROW_EDGE_PADDING}px`
                  : 'auto',
              right:
                direction === 'right'
                  ? `${fixedRight + ARROW_EDGE_PADDING}px`
                  : 'auto',
              height: `${cellHeight}px`,
              '--arrow-color': color,
              zIndex: 100,
            }}
            onClick={() => handleArrowClick(task, direction)}
            title={`Click to view: ${task.text || task.label || task.id}`}
          >
            {direction === 'left' ? (
              <>
                <span className="wx-arrow-triangle wx-left" />
                <span className="wx-arrow-label">{displayName}</span>
              </>
            ) : (
              <>
                <span className="wx-arrow-label">{displayName}</span>
                <span className="wx-arrow-triangle wx-right" />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

/**
 * 計算標題的動態偏移量（與 Bars.jsx 的 getLabelOffset 一致）
 * @param {number} cellWidth - 當前格子寬度
 * @returns {number} 標題相對於 bar 結束位置的偏移 (px)
 */
function getLabelOffset(cellWidth) {
  const linkOffset = Math.min(cellWidth / 2, LINK_OFFSET_MAX);
  return linkOffset + LABEL_GAP;
}

/**
 * Estimate the pixel width of a label text (including the gap from bar end)
 * @param {string} text - 標題文字
 * @param {number} cellWidth - 當前格子寬度
 */
function estimateLabelWidth(text, cellWidth) {
  const labelOffset = getLabelOffset(cellWidth);
  if (!text) return labelOffset;
  return labelOffset + text.length * LABEL_CHAR_WIDTH + LABEL_PADDING;
}

/**
 * Get the bar color based on task type (same logic as Bars.jsx)
 */
function getTaskColor(task) {
  if (task.$isMilestone || task.type === 'milestone') {
    return '#ad44ab'; // Purple for milestones
  }
  if (task.$isIssue) {
    return '#3983eb'; // Blue for issues
  }
  return '#00ba94'; // Default: green for tasks
}

/**
 * Truncate text to specified length with ellipsis
 */
function truncateName(name, maxLength) {
  if (!name) return '';
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 1) + '…';
}

/**
 * Create an off-screen task entry for rendering
 */
function createOffscreenTask(task, direction) {
  return {
    task,
    taskY: task.$y,
    direction,
    displayName: truncateName(
      task.text || task.label || `#${task.id}`,
      DISPLAY_NAME_MAX_LENGTH,
    ),
    color: getTaskColor(task),
  };
}

export default OffscreenArrows;
