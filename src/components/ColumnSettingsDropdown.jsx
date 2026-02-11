/**
 * Column Settings Dropdown Component
 * Provides a dropdown menu for toggling column visibility and reordering columns
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
} from 'react';
import ReactDOM from 'react-dom';
import { getGitLabLinkInfo } from '../utils/LinkUtils';

const STORAGE_KEY = 'gantt-column-settings';

// All available columns with their default configuration
// Order matters - this is the default order
const ALL_COLUMNS = [
  { key: 'displayOrder', label: 'Order', defaultVisible: false },
  { key: 'assignee', label: 'Assignee', defaultVisible: false },
  { key: 'issueId', label: 'Issue ID', defaultVisible: false },
  { key: 'iteration', label: 'Iteration', defaultVisible: false },
  { key: 'epic', label: 'Epic', defaultVisible: false },
  { key: 'priority', label: 'Priority', defaultVisible: true },
  { key: 'weight', label: 'Weight', defaultVisible: false },
  { key: 'labels', label: 'Labels', defaultVisible: false },
  { key: 'start', label: 'Start', defaultVisible: true },
  { key: 'end', label: 'Due', defaultVisible: true },
  { key: 'workdays', label: 'Workdays', defaultVisible: true },
];

// Default settings based on ALL_COLUMNS
const DEFAULT_SETTINGS = {
  columns: ALL_COLUMNS.map((col) => ({
    key: col.key,
    visible: col.defaultVisible,
  })),
};

/**
 * Hook for managing column settings (visibility + order) with localStorage persistence
 */
export function useColumnSettings() {
  const [columnSettings, setColumnSettings] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate from old format if needed
        if (!parsed.columns) {
          // Old format was just visibility object
          return {
            columns: ALL_COLUMNS.map((col) => ({
              key: col.key,
              visible: parsed[col.key] ?? col.defaultVisible,
            })),
          };
        }
        // Ensure all columns exist (for forward compatibility)
        const existingKeys = new Set(parsed.columns.map((c) => c.key));
        const mergedColumns = [...parsed.columns];
        for (const col of ALL_COLUMNS) {
          if (!existingKeys.has(col.key)) {
            mergedColumns.push({ key: col.key, visible: col.defaultVisible });
          }
        }
        return { columns: mergedColumns };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columnSettings));
  }, [columnSettings]);

  const toggleColumn = useCallback((key) => {
    setColumnSettings((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col,
      ),
    }));
  }, []);

  const reorderColumns = useCallback((fromIndex, toIndex) => {
    setColumnSettings((prev) => {
      const newColumns = [...prev.columns];
      const [removed] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, removed);
      return { ...prev, columns: newColumns };
    });
  }, []);

  return {
    columnSettings,
    setColumnSettings,
    toggleColumn,
    reorderColumns,
  };
}

/**
 * Draggable Column Item
 */
function DraggableColumnItem({
  column,
  index,
  onToggle,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  dragOverIndex,
}) {
  const label =
    ALL_COLUMNS.find((c) => c.key === column.key)?.label || column.key;

  // Determine drop position indicator based on cursor position
  const showDropBefore = dragOverIndex === index;

  return (
    <div
      className={`column-item ${isDragging ? 'dragging' : ''} ${showDropBefore ? 'drag-over' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
    >
      <span className="drag-handle">
        <i className="fas fa-grip-vertical"></i>
      </span>
      <label className="column-checkbox">
        <input
          type="checkbox"
          checked={column.visible}
          onChange={() => onToggle(column.key)}
        />
        <span>{label}</span>
      </label>
    </div>
  );
}

/**
 * Drop zone at the end of the list
 */
function DropZoneEnd({ onDragOver, onDrop, isActive, itemCount }) {
  return (
    <div
      className={`column-drop-zone-end ${isActive ? 'active' : ''}`}
      onDragOver={(e) => onDragOver(e, itemCount)}
      onDrop={onDrop}
    />
  );
}

/**
 * Column Settings Dropdown Component
 */
export function ColumnSettingsDropdown({
  isOpen,
  onToggle,
  columnSettings,
  onToggleColumn,
  onReorderColumns,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onToggle();
      }
    };

    // Delay to avoid immediate close on button click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (
      dragIndex !== null &&
      dragOverIndex !== null &&
      dragIndex !== dragOverIndex
    ) {
      onReorderColumns(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, onReorderColumns]);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      handleDragEnd();
    },
    [handleDragEnd],
  );

  return (
    <div className="column-settings-container" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="btn-column-settings"
        title="Column Settings"
      >
        <i className="fas fa-table-columns"></i>
      </button>

      {isOpen && (
        <div className="column-settings-dropdown">
          <div className="column-settings-header">Columns</div>
          <div className="column-settings-hint">Drag to reorder</div>
          <div className="column-settings-list">
            {columnSettings.columns.map((column, index) => (
              <DraggableColumnItem
                key={column.key}
                column={column}
                index={index}
                onToggle={onToggleColumn}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                isDragging={dragIndex === index}
                dragOverIndex={dragOverIndex}
              />
            ))}
            {/* Drop zone at the end to allow dropping after the last item */}
            <DropZoneEnd
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isActive={dragOverIndex === columnSettings.columns.length}
              itemCount={columnSettings.columns.length}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cell components for columns
 *
 * SORTING SUPPORT:
 * SVAR Gantt sorts using task[columnId], so column id must match task property name.
 * - Strings: use localeCompare, empty string '' sorts first
 * - Numbers: use (a??0)-(b??0), 0 sorts first
 * - Dates: use getTime() comparison
 *
 * Default values for sorting (set in GitLabGraphQLProvider):
 * - displayOrder: 0 for milestones, relativePosition for issues (sort by this to restore original order)
 * - assigned: '' (empty string)
 * - weight: 0
 * - issueId: 0 for milestones, actual IID for issues
 * - iteration: '' (empty string)
 * - epic: '' (empty string, title of parent Epic if exists)
 * - workdays: calculated in GitLabGantt tasksWithWorkdays
 */
export const AssigneeCell = ({ row }) => {
  if (!row.assigned) return null;
  return <span title={row.assigned}>{row.assigned}</span>;
};

export const IssueIdCell = ({ row }) => {
  const linkInfo = getGitLabLinkInfo(row);

  if (!linkInfo.displayId) return null;

  if (linkInfo.url) {
    return (
      <a
        href={linkInfo.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ color: '#3983eb', textDecoration: 'none' }}
        title={linkInfo.title}
      >
        {linkInfo.displayId}
      </a>
    );
  }

  return <span style={{ color: '#666' }}>{linkInfo.displayId}</span>;
};

export const WeightCell = ({ row }) => {
  if (!row.weight) return null;
  return <span>{row.weight}</span>;
};

export const IterationCell = ({ row }) => {
  if (!row.iteration) return null;
  return <span title={row.iteration}>{row.iteration}</span>;
};

export const EpicCell = ({ row }) => {
  if (!row.epic) return null;
  return <span title={row.epic}>{row.epic}</span>;
};

const PRIORITY_COLORS = {
  0: { bg: '#fee2e2', text: '#991b1b', border: '#dc2626' }, // P0 - red (critical)
  1: { bg: '#ffedd5', text: '#9a3412', border: '#ea580c' }, // P1 - orange (high)
  2: { bg: '#fef9c3', text: '#854d0e', border: '#ca8a04' }, // P2 - yellow (medium)
  3: { bg: '#dbeafe', text: '#1e40af', border: '#2563eb' }, // P3 - blue (low)
  4: { bg: '#f3f4f6', text: '#4b5563', border: '#9ca3af' }, // P4 - grey (none)
};

export const PriorityCell = ({ row }) => {
  const priority = row.priority;
  if (priority === undefined || priority === null) return null;

  const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS[4];
  const label = `P${priority}`;

  return (
    <span
      className="priority-badge"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderLeft: `3px solid ${colors.border}`,
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: 600,
        display: 'inline-block',
      }}
      title={`Priority ${label}`}
    >
      {label}
    </span>
  );
};

// LabelCell style constants (must match LabelCell.css)
const LABEL_STYLE = {
  GAP: 3,
  PADDING_X: 4,
  PADDING_Y: 1,
  FONT_SIZE: 10,
  MORE_INDICATOR_WIDTH: 24,
  CELL_PADDING: 16, // td padding to subtract from available width
};

/**
 * Measure label tag widths using a hidden DOM element
 * @param {string[]} labels - Array of label titles
 * @returns {number[]} Array of measured widths
 */
const measureLabelWidths = (labels) => {
  const measureDiv = document.createElement('div');
  measureDiv.style.cssText = `position:absolute;visibility:hidden;display:flex;gap:${LABEL_STYLE.GAP}px;`;
  document.body.appendChild(measureDiv);

  const widths = labels.map((title) => {
    const span = document.createElement('span');
    span.style.cssText = `padding:${LABEL_STYLE.PADDING_Y}px ${LABEL_STYLE.PADDING_X}px;font-size:${LABEL_STYLE.FONT_SIZE}px;white-space:nowrap;`;
    span.textContent = title;
    measureDiv.appendChild(span);
    const width = span.offsetWidth;
    measureDiv.removeChild(span);
    return width;
  });

  document.body.removeChild(measureDiv);
  return widths;
};

/**
 * Calculate how many labels fit within available width
 * @param {number[]} widths - Array of label widths
 * @param {number} availableWidth - Container width
 * @returns {number} Number of labels that fit
 */
const calculateVisibleCount = (widths, availableWidth) => {
  if (widths.length === 0 || availableWidth <= 0) return 1;

  const { GAP, MORE_INDICATOR_WIDTH } = LABEL_STYLE;
  let usedWidth = 0;
  let count = 0;

  for (let i = 0; i < widths.length; i++) {
    const isLast = i === widths.length - 1;
    // Reserve space for "+N" indicator if not showing all labels
    const reservedWidth = isLast ? 0 : MORE_INDICATOR_WIDTH + GAP;

    if (usedWidth + widths[i] + reservedWidth <= availableWidth) {
      usedWidth += widths[i] + GAP;
      count++;
    } else {
      break;
    }
  }

  return Math.max(1, count);
};

/**
 * LabelCell - Renders labels with GitLab colors
 * Supports dynamic collapsing based on available width and priority-based sorting.
 * @param {Object} row - Task row data with labels as comma-separated string
 * @param {Map} labelColorMap - Map of label title to color
 * @param {Map} labelPriorityMap - Map of label title to priority number (lower = higher priority)
 */
export const LabelCell = ({ row, labelColorMap, labelPriorityMap }) => {
  const containerRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(1);
  const [showTooltip, setShowTooltip] = useState(false);
  const tagWidthsRef = useRef([]);

  // Parse and sort labels by priority (lower number = higher priority)
  const labelTitles = useMemo(() => {
    const titles = row.labels?.split(', ').filter(Boolean) || [];
    return titles.sort((a, b) => {
      const priorityA = labelPriorityMap?.get(a) ?? Number.MAX_SAFE_INTEGER;
      const priorityB = labelPriorityMap?.get(b) ?? Number.MAX_SAFE_INTEGER;
      return priorityA - priorityB;
    });
  }, [row.labels, labelPriorityMap]);

  // Measure tag widths when labels change
  useLayoutEffect(() => {
    if (labelTitles.length === 0) return;
    tagWidthsRef.current = measureLabelWidths(labelTitles);
  }, [labelTitles]);

  // Recalculate visible count on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container || labelTitles.length === 0) return;

    const updateVisibleCount = () => {
      const cell = container.closest('td') || container.parentElement;
      const availableWidth = cell
        ? cell.clientWidth - LABEL_STYLE.CELL_PADDING
        : container.offsetWidth;

      const count = calculateVisibleCount(tagWidthsRef.current, availableWidth);
      setVisibleCount(count);
    };

    // Observe parent cell for resize
    const cell = container.closest('td') || container.parentElement;
    const observer = new ResizeObserver(updateVisibleCount);
    if (cell) observer.observe(cell);

    // Initial calculation with delay for layout stability
    updateVisibleCount();
    const timer = setTimeout(updateVisibleCount, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [labelTitles]);

  if (!row.labels || labelTitles.length === 0) return null;

  const displayLabels = labelTitles.slice(0, visibleCount);
  const hiddenCount = labelTitles.length - visibleCount;
  const defaultColor = '#6b7280';

  return (
    <div
      className="label-cell-container"
      ref={containerRef}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {displayLabels.map((title, index) => (
        <span
          key={index}
          className="label-cell-tag"
          style={{ backgroundColor: labelColorMap?.get(title) || defaultColor }}
        >
          {title}
        </span>
      ))}

      {hiddenCount > 0 && (
        <span className="label-cell-more">+{hiddenCount}</span>
      )}

      {showTooltip && (
        <LabelTooltip
          anchorRef={containerRef}
          labels={labelTitles}
          colorMap={labelColorMap}
        />
      )}
    </div>
  );
};

/**
 * LabelTooltip - Portal-rendered tooltip showing all labels
 * Uses position:fixed with viewport-based flip logic (same approach as DateEditCell)
 */
const LabelTooltip = ({ anchorRef, labels, colorMap }) => {
  const tooltipRef = useRef(null);
  const defaultColor = '#6b7280';

  // Position the tooltip after render using requestAnimationFrame
  // to ensure accurate height measurement for flip logic
  useLayoutEffect(() => {
    if (!anchorRef.current || !tooltipRef.current) return;

    const positionTooltip = () => {
      const el = tooltipRef.current;
      const anchor = anchorRef.current;
      if (!el || !anchor) return;

      const rect = anchor.getBoundingClientRect();
      const tooltipHeight =
        el.offsetHeight || el.getBoundingClientRect().height || 0;

      // Viewport boundaries for flip calculation
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top;
      // Flip to above if below space is insufficient AND above has enough space
      if (spaceBelow < tooltipHeight + 4 && spaceAbove >= tooltipHeight + 4) {
        // Show above - tooltip bottom aligns above cell top
        top = rect.top - tooltipHeight - 4;
      } else {
        // Show below (default) - overlapping cell top
        top = rect.top;
      }

      el.style.position = 'fixed';
      el.style.top = `${top}px`;
      el.style.left = `${rect.left}px`;
      el.style.zIndex = '99999';
    };

    // Use requestAnimationFrame to wait for DOM to render
    requestAnimationFrame(positionTooltip);
  }, [anchorRef]);

  return ReactDOM.createPortal(
    <div ref={tooltipRef} className="label-cell-tooltip-portal">
      {labels.map((title, index) => (
        <span
          key={index}
          className="label-cell-tooltip-tag"
          style={{ backgroundColor: colorMap?.get(title) || defaultColor }}
        >
          {title}
        </span>
      ))}
    </div>,
    document.body,
  );
};

/**
 * Column configurations
 * IMPORTANT: Column id must match task property name for sorting to work
 */
export const COLUMN_CONFIGS = {
  displayOrder: {
    id: 'displayOrder',
    header: '#',
    width: 50,
    // No cell - column is hidden, only used for sorting to restore original order
  },
  assignee: {
    id: 'assigned',
    header: 'Assignee',
    width: 120,
    cell: AssigneeCell,
  },
  issueId: {
    id: 'issueId',
    header: 'ID',
    width: 60,
    cell: IssueIdCell,
  },
  iteration: {
    id: 'iteration',
    header: 'Iteration',
    width: 120,
    cell: IterationCell,
  },
  epic: {
    id: 'epic',
    header: 'Epic',
    width: 120,
    cell: EpicCell,
  },
  priority: {
    id: 'priority',
    header: 'Priority',
    width: 60,
    cell: PriorityCell,
  },
  weight: {
    id: 'weight',
    header: 'Weight',
    width: 60,
    cell: WeightCell,
  },
  labels: {
    id: 'labelPriority', // Sort by labelPriority field (lowest priority number = highest priority)
    header: 'Labels',
    width: 150,
    // cell is injected by buildColumnsFromSettings with labelColorMap
  },
  start: {
    id: 'start',
    header: 'Start',
    width: 110,
  },
  end: {
    id: 'end',
    header: 'Due',
    width: 110,
  },
  workdays: {
    id: 'workdays',
    header: 'Workdays',
    width: 70,
  },
};

/**
 * Build columns array based on settings and external cell components
 * @param {Object} columnSettings - Column settings from useColumnSettings
 * @param {Object} cellComponents - External cell components
 *   { DateCell, DateEditCell, WorkdaysCell, labelColorMap, labelPriorityMap, dateEditable, onDateChange }
 * @returns {Array} Ordered array of visible column configs
 */
export function buildColumnsFromSettings(columnSettings, cellComponents) {
  const {
    DateCell,
    DateEditCell,
    WorkdaysCell,
    labelColorMap,
    labelPriorityMap,
    dateEditable = false,
    onDateChange,
  } = cellComponents;

  return columnSettings.columns
    .filter((col) => col.visible)
    .map((col) => {
      const config = { ...COLUMN_CONFIGS[col.key] };
      // Inject external cell components
      if (col.key === 'start' || col.key === 'end') {
        // Use DateEditCell when editable, otherwise use DateCell (readonly)
        if (dateEditable && DateEditCell) {
          config.cell = (props) => (
            <DateEditCell
              {...props}
              readonly={false}
              onDateChange={onDateChange}
            />
          );
        } else {
          config.cell = DateCell;
        }
      } else if (col.key === 'workdays') {
        config.cell = WorkdaysCell;
      } else if (col.key === 'labels') {
        // Inject LabelCell with labelColorMap and labelPriorityMap for colored, priority-sorted label tags
        config.cell = (props) => (
          <LabelCell
            {...props}
            labelColorMap={labelColorMap}
            labelPriorityMap={labelPriorityMap}
          />
        );
      }
      return config;
    });
}

export default ColumnSettingsDropdown;
