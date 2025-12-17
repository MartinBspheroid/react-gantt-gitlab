/**
 * Column Settings Dropdown Component
 * Provides a dropdown menu for toggling column visibility and reordering columns
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'gantt-column-settings';

// All available columns with their default configuration
// Order matters - this is the default order
const ALL_COLUMNS = [
  { key: 'assignee', label: 'Assignee', defaultVisible: false },
  { key: 'issueId', label: 'Issue ID', defaultVisible: false },
  { key: 'weight', label: 'Weight', defaultVisible: false },
  { key: 'start', label: 'Start', defaultVisible: true },
  { key: 'end', label: 'Due', defaultVisible: true },
  { key: 'workdays', label: 'Workdays', defaultVisible: true },
];

// Default settings based on ALL_COLUMNS
const DEFAULT_SETTINGS = {
  columns: ALL_COLUMNS.map(col => ({
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
            columns: ALL_COLUMNS.map(col => ({
              key: col.key,
              visible: parsed[col.key] ?? col.defaultVisible,
            })),
          };
        }
        // Ensure all columns exist (for forward compatibility)
        const existingKeys = new Set(parsed.columns.map(c => c.key));
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
    setColumnSettings(prev => ({
      ...prev,
      columns: prev.columns.map(col =>
        col.key === key ? { ...col, visible: !col.visible } : col
      ),
    }));
  }, []);

  const reorderColumns = useCallback((fromIndex, toIndex) => {
    setColumnSettings(prev => {
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
  const label = ALL_COLUMNS.find(c => c.key === column.key)?.label || column.key;

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
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      onReorderColumns(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, onReorderColumns]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    handleDragEnd();
  }, [handleDragEnd]);

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
 */
export const AssigneeCell = ({ row }) => {
  if (!row.assigned) return null;
  return <span title={row.assigned}>{row.assigned}</span>;
};

export const IssueIdCell = ({ row }) => {
  if (row.$isMilestone || row._gitlab?.type === 'milestone') return null;
  const iid = row._gitlab?.iid || row.id;
  return <span style={{ color: '#666' }}>#{iid}</span>;
};

export const WeightCell = ({ row }) => {
  if (row.weight === undefined || row.weight === null) return null;
  return <span>{row.weight}</span>;
};

/**
 * Column configurations
 * Note: start, end, workdays cells are provided externally (DateCell, WorkdaysCell)
 */
export const COLUMN_CONFIGS = {
  assignee: {
    id: 'assignee',
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
  weight: {
    id: 'weight',
    header: 'Weight',
    width: 60,
    cell: WeightCell,
  },
  start: {
    id: 'start',
    header: 'Start',
    width: 110,
    // cell provided externally
  },
  end: {
    id: 'end',
    header: 'Due',
    width: 110,
    // cell provided externally
  },
  workdays: {
    id: 'workdays',
    header: 'Workdays',
    width: 70,
    // cell provided externally
  },
};

/**
 * Build columns array based on settings and external cell components
 * @param {Object} columnSettings - Column settings from useColumnSettings
 * @param {Object} cellComponents - External cell components { DateCell, WorkdaysCell }
 * @returns {Array} Ordered array of visible column configs
 */
export function buildColumnsFromSettings(columnSettings, cellComponents) {
  const { DateCell, WorkdaysCell } = cellComponents;

  return columnSettings.columns
    .filter(col => col.visible)
    .map(col => {
      const config = { ...COLUMN_CONFIGS[col.key] };
      // Inject external cell components
      if (col.key === 'start' || col.key === 'end') {
        config.cell = DateCell;
      } else if (col.key === 'workdays') {
        config.cell = WorkdaysCell;
      }
      return config;
    });
}

export default ColumnSettingsDropdown;
