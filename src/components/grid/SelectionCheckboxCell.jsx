/**
 * SelectionCheckboxCell Component
 *
 * Checkbox cell for task selection in the grid.
 * Renders a checkbox that reflects the task's selection state.
 */

import { useCallback, useContext, useMemo } from 'react';
import storeContext from '../../context';
import './SelectionCheckboxCell.css';

/**
 * @param {Object} props
 * @param {Object} props.row - The row data (task)
 */
export function SelectionCheckboxCell({ row }) {
  const api = useContext(storeContext);
  const selectedIds = api?.getState?.()?.selected || [];
  const isSelected = useMemo(
    () => selectedIds.includes(row.id),
    [selectedIds, row.id],
  );

  const handleChange = useCallback(
    (e) => {
      e.stopPropagation();
      if (!api) return;

      api.exec('select-task', {
        id: row.id,
        toggle: true,
        show: false,
      });
    },
    [api, row.id],
  );

  const handleClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="selection-checkbox-cell" onClick={handleClick}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/**
 * SelectionHeaderCell Component
 *
 * Header cell with "select all" checkbox.
 * Shows a checkbox that selects/deselects all visible tasks.
 */
export function SelectionHeaderCell({ api, visibleTasks }) {
  const selectedIds = api?.getState?.()?.selected || [];
  const allSelected = useMemo(() => {
    if (!visibleTasks || visibleTasks.length === 0) return false;
    return visibleTasks.every((task) => selectedIds.includes(task.id));
  }, [selectedIds, visibleTasks]);

  const someSelected = useMemo(() => {
    if (!visibleTasks || visibleTasks.length === 0) return false;
    return visibleTasks.some((task) => selectedIds.includes(task.id));
  }, [selectedIds, visibleTasks]);

  const handleSelectAll = useCallback(
    (e) => {
      e.stopPropagation();
      if (!api || !visibleTasks) return;

      if (allSelected) {
        api.exec('clear-selection');
      } else {
        for (const task of visibleTasks) {
          api.exec('select-task', {
            id: task.id,
            toggle: true,
            show: false,
          });
        }
      }
    },
    [api, visibleTasks, allSelected],
  );

  return (
    <div className="selection-header-cell" onClick={handleSelectAll}>
      <input
        type="checkbox"
        checked={allSelected}
        ref={(el) => {
          if (el) {
            el.indeterminate = someSelected && !allSelected;
          }
        }}
        onChange={() => {}}
        title={allSelected ? 'Deselect all' : 'Select all visible'}
      />
    </div>
  );
}

export default SelectionCheckboxCell;
