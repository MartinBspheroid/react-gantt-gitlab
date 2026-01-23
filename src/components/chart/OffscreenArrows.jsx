import { useContext, useMemo, useCallback, useState, useEffect } from 'react';
import storeContext from '../../context';
import { useStore } from '@svar-ui/lib-react';
import './OffscreenArrows.css';

/**
 * OffscreenArrows - Shows arrow labels for tasks whose bars are completely off-screen
 *
 * When a task's bar is entirely outside the visible viewport:
 * - If the bar is to the LEFT of the viewport → show arrow label on the LEFT edge
 * - If the bar is to the RIGHT of the viewport → show arrow label on the RIGHT edge
 *
 * The arrow label uses the same color as the task's bar.
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

  // Update chart container rect for fixed positioning (on scroll and resize)
  useEffect(() => {
    const chartEl = chartRef?.current;
    if (!chartEl) return;

    const updateContainerRect = () => {
      const rect = chartEl.getBoundingClientRect();
      setChartContainerRect(rect);
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

  // Get visible tasks based on virtual scroll area
  const visibleTasks = useMemo(() => {
    if (!areaValue || !Array.isArray(rTasksValue)) return [];
    const start = areaValue.start ?? 0;
    const end = areaValue.end ?? 0;
    return rTasksValue.slice(start, end);
  }, [rTasksValue, areaValue]);

  /**
   * Get the base color for a task (same logic as Bars.jsx)
   */
  const getTaskColor = useCallback((task) => {
    const isMilestone = task.$isMilestone || task._gitlab?.type === 'milestone' || task.type === 'milestone';
    if (isMilestone) {
      return '#ad44ab'; // Purple for milestones
    } else if (task.$isIssue) {
      return '#3983eb'; // Blue for issues
    }
    return '#00ba94'; // Default: green for tasks
  }, []);

  // Calculate which tasks have off-screen bars
  const offscreenTasks = useMemo(() => {
    if (!visibleTasks.length || viewportWidth <= 0) return [];

    const viewportRight = scrollLeft + viewportWidth;
    const result = [];

    visibleTasks.forEach((task) => {
      // Skip tasks without REAL date range from GitLab (not using created_at as fallback)
      // Check _gitlab.startDate and _gitlab.dueDate which contain the original GitLab values
      // If these are undefined/null, the task doesn't have real dates set
      const hasRealStartDate = task._gitlab?.startDate;
      const hasRealDueDate = task._gitlab?.dueDate;
      if (!hasRealStartDate || !hasRealDueDate) return;
      // Skip tasks without bars (no width means no visible bar)
      if (task.$w === undefined || task.$w <= 0) return;
      // Skip tasks without valid Y position
      if (task.$y === undefined) return;

      const barLeft = task.$x;
      const barRight = task.$x + task.$w;

      // Check if bar is completely off-screen to the left
      if (barRight <= scrollLeft) {
        result.push({
          task,
          // Use task.$y which is the pre-calculated Y position (already accounts for virtual scroll)
          taskY: task.$y,
          direction: 'left',
          displayName: truncateName(task.text || task.label || `#${task.id}`, 12),
          color: getTaskColor(task),
        });
      }
      // Check if bar is completely off-screen to the right
      else if (barLeft >= viewportRight) {
        result.push({
          task,
          taskY: task.$y,
          direction: 'right',
          displayName: truncateName(task.text || task.label || `#${task.id}`, 12),
          color: getTaskColor(task),
        });
      }
    });

    return result;
  }, [visibleTasks, scrollLeft, viewportWidth, getTaskColor]);

  // Handle arrow click - scroll to show the bar
  const handleArrowClick = useCallback((task, direction) => {
    if (!api) return;

    const barLeft = task.$x;
    const barRight = task.$x + task.$w;
    const padding = 50; // Some padding from the edge

    let targetScrollLeft;
    if (direction === 'left') {
      // Scroll so the bar's left edge is visible with padding
      targetScrollLeft = Math.max(0, barLeft - padding);
    } else {
      // Scroll so the bar's right edge is visible with padding
      targetScrollLeft = Math.max(0, barRight - viewportWidth + padding);
    }

    // Use the API to scroll
    api.exec('scroll-chart', { left: targetScrollLeft });
  }, [api, viewportWidth]);

  // Don't render if no arrows to show or container rect not ready
  if (!chartContainerRect || offscreenTasks.length === 0 || viewportWidth <= 0) {
    return null;
  }

  return (
    <>
      {offscreenTasks.map(({ task, taskY, direction, displayName, color }) => {
        // Calculate fixed position for this row
        // taskY is the pre-calculated Y position from the task (already accounts for virtual scroll offset)
        // We need to convert it from content-relative to viewport-relative coordinates
        // taskY is relative to the full content, scrollTop is how much we've scrolled
        const rowTopInChart = taskY - scrollTop;
        const fixedTop = chartContainerRect.top + rowTopInChart;
        const fixedLeft = chartContainerRect.left;
        const fixedRight = window.innerWidth - chartContainerRect.right;

        // Skip if the row would be outside the visible chart area
        if (fixedTop < chartContainerRect.top || fixedTop + cellHeight > chartContainerRect.bottom) {
          return null;
        }

        return (
          <div
            key={`${direction}-${task.id}`}
            className={`wx-offscreen-arrow-item wx-${direction}`}
            style={{
              position: 'fixed',
              top: `${fixedTop}px`,
              left: direction === 'left' ? `${fixedLeft + 4}px` : 'auto',
              right: direction === 'right' ? `${fixedRight + 4}px` : 'auto',
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
 * Truncate a name to specified length with ellipsis
 */
function truncateName(name, maxLength) {
  if (!name) return '';
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 1) + '…';
}

export default OffscreenArrows;
