// @ts-nocheck
/**
 * useGanttColumns Hook
 * Custom cell components and grid/editor configuration.
 * DateCell, WorkdaysCell, TaskTitleCell, columns, editorItems.
 */

import { useCallback, useMemo } from 'react';
import DateEditCell from '../grid/DateEditCell.tsx';
import { buildColumnsFromSettings } from '../ColumnSettingsDropdown.tsx';

export function useGanttColumns({
  api,
  columnSettings,
  labelColorMap,
  labelPriorityMap,
  dateEditable,
  countWorkdays,
}) {
  // Date cell component for custom formatting
  const DateCell = useCallback(({ row, column }) => {
    const isMilestone = row.$isMilestone || row._source?.type === 'milestone';

    if (!isMilestone) {
      const sourceFieldName = column.id === 'start' ? 'startDate' : 'dueDate';
      const hasSourceDate = row._source?.[sourceFieldName];

      if (!hasSourceDate) {
        return (
          <span style={{ color: 'var(--wx-color-secondary, #6e6e73)' }}>
            None
          </span>
        );
      }
    }

    const date = row[column.id];
    if (!date)
      return (
        <span style={{ color: 'var(--wx-color-secondary, #6e6e73)' }}>
          None
        </span>
      );

    const d = date instanceof Date ? date : new Date(date);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}/${mm}/${dd}`;
  }, []);

  // Workdays cell - dynamically calculates workdays from row's current start/end
  const WorkdaysCell = useCallback(
    ({ row }) => {
      if (!row.start || !row.end) return '';
      const days = countWorkdays(row.start, row.end);
      return days ? `${days}d` : '';
    },
    [countWorkdays],
  );

  // Custom cell component for Task Title with icons
  const TaskTitleCell = useCallback(({ row }) => {
    const data = row;
    let icon;
    let iconColor;

    // Check if this is a group header
    if (data.$groupHeader) {
      const groupIcon =
        data.$groupType === 'assignee'
          ? 'fa-user'
          : data.$groupType === 'epic'
            ? 'fa-layer-group'
            : data.$groupType === 'sprint'
              ? 'fa-repeat'
              : 'fa-folder';

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
            color: 'var(--wx-gantt-group-header-text, #5a4fcf)',
          }}
        >
          <i
            className={`fas ${groupIcon}`}
            style={{ marginRight: '8px', color: '#6c5ce7' }}
          ></i>
          <span>{data.$groupName}</span>
          <span
            style={{
              marginLeft: '8px',
              padding: '1px 6px',
              background: '#6c5ce7',
              color: 'white',
              borderRadius: 'var(--wx-radius-lg)',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            {data.$taskCount} tasks
          </span>
        </div>
      );
    }

    // Determine icon and color based on source type
    if (data.$isMilestone || data._source?.type === 'milestone') {
      icon = <i className="far fa-flag"></i>;
      iconColor = '#ad44ab';
    } else if (data._source?.workItemType === 'Task') {
      icon = <i className="far fa-square-check"></i>;
      iconColor = '#00ba94';
    } else {
      icon = <i className="far fa-clipboard"></i>;
      iconColor = '#3983eb';
    }

    const groupIndexStyle =
      data.$groupIndex !== undefined
        ? { '--group-index': data.$groupIndex }
        : {};

    return (
      <div
        style={{ display: 'flex', alignItems: 'center', ...groupIndexStyle }}
      >
        <span style={{ marginRight: '8px', color: iconColor }}>{icon}</span>
        <span>{data.text}</span>
      </div>
    );
  }, []);

  // Handler for date changes from Grid DateEditCell
  const handleGridDateChange = useCallback(
    (rowId, columnId, value) => {
      if (!api) return;

      api.exec('update-task', {
        id: rowId,
        task: {
          [columnId]: value,
        },
        _originalDateChange: { column: columnId, value },
      });
    },
    [api],
  );

  // Columns configuration with visibility and order control
  const columns = useMemo(() => {
    const configurableCols = buildColumnsFromSettings(columnSettings, {
      DateCell,
      DateEditCell,
      WorkdaysCell,
      labelColorMap,
      labelPriorityMap,
      dateEditable,
      onDateChange: handleGridDateChange,
    });

    return [
      {
        id: 'text',
        header: 'Task Title',
        width: 250,
        cell: TaskTitleCell,
      },
      ...configurableCols,
      {
        id: 'add-task',
        header: '',
        width: 50,
      },
    ];
  }, [
    DateCell,
    TaskTitleCell,
    WorkdaysCell,
    columnSettings,
    labelColorMap,
    labelPriorityMap,
    dateEditable,
    handleGridDateChange,
  ]);

  // Editor items configuration
  const editorItems = useMemo(() => {
    return [
      { key: 'text', comp: 'text', label: 'Title' },
      { key: 'details', comp: 'textarea', label: 'Description' },
      { key: 'start', comp: 'nullable-date', label: 'Start Date' },
      { key: 'end', comp: 'nullable-date', label: 'Due Date' },
      { key: 'workdays', comp: 'workdays', label: 'Workdays' },
      { key: 'links', comp: 'links', label: 'Links' },
    ];
  }, []);

  return {
    DateCell,
    WorkdaysCell,
    TaskTitleCell,
    columns,
    editorItems,
  };
}
