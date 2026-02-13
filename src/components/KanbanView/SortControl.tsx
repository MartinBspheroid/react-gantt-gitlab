// @ts-nocheck
// src/components/KanbanView/SortControl.jsx

/**
 * SortControl
 *
 * Unified sort control component for Kanban list headers.
 * Combines sort field dropdown, sort order toggle, and reset button.
 *
 * Features:
 * - Marks default sort option with ★
 * - Shows reset button when current sort differs from default
 * - Dropdown border changes color when not using default sort
 */

import './SortControl.css';
import { SORT_OPTIONS } from './constants';

/**
 * @param {Object} props
 * @param {string} props.sortBy - Current sort field
 * @param {string} props.sortOrder - Current sort order ('asc' | 'desc')
 * @param {string} props.defaultSortBy - Default sort field from list config
 * @param {string} props.defaultSortOrder - Default sort order from list config
 * @param {function} props.onChange - Callback: (newSortBy, newSortOrder) => void
 * @param {string} [props.specialType] - 'others' | 'closed' | null for styling
 */
export function SortControl({
  sortBy,
  sortOrder,
  defaultSortBy,
  defaultSortOrder,
  onChange,
  specialType = null,
}) {
  // Check if current sort matches default
  const isDefault = sortBy === defaultSortBy && sortOrder === defaultSortOrder;

  // Handle sort field change
  const handleSortFieldChange = (e) => {
    const newSortBy = e.target.value;
    // When changing to default field, also reset order to default
    if (newSortBy === defaultSortBy) {
      onChange?.(newSortBy, defaultSortOrder);
    } else {
      onChange?.(newSortBy, sortOrder);
    }
  };

  // Handle sort order toggle
  const handleSortOrderToggle = (e) => {
    e.stopPropagation();
    const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    onChange?.(sortBy, newSortOrder);
  };

  // Handle reset to default
  const handleReset = (e) => {
    e.stopPropagation();
    onChange?.(defaultSortBy, defaultSortOrder);
  };

  // Build select class names
  const selectClassNames = ['sort-control-select'];
  if (!isDefault) {
    selectClassNames.push('sort-control-select-modified');
  }
  if (specialType) {
    selectClassNames.push(`sort-control-select-${specialType}`);
  }

  // Build container class names
  const containerClassNames = ['sort-control'];
  if (specialType) {
    containerClassNames.push(`sort-control-${specialType}`);
  }

  return (
    <div className={containerClassNames.join(' ')}>
      {/* Reset button - show only when not using default sort (left side) */}
      {!isDefault && (
        <button
          className={`sort-control-reset-btn${specialType ? ` sort-control-reset-btn-${specialType}` : ''}`}
          onClick={handleReset}
          title={`Reset to default (${SORT_OPTIONS.find((o) => o.value === defaultSortBy)?.label || defaultSortBy})`}
        >
          <i className="fas fa-rotate-left" />
        </button>
      )}

      {/* Sort field dropdown */}
      <select
        className={selectClassNames.join(' ')}
        value={sortBy}
        onChange={handleSortFieldChange}
        onClick={(e) => e.stopPropagation()}
        title="Sort by"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
            {opt.value === defaultSortBy ? ' ★' : ''}
          </option>
        ))}
      </select>

      {/* Sort order toggle - hide for position (manual) mode */}
      {sortBy !== 'position' && (
        <button
          className={`sort-control-order-btn${specialType ? ` sort-control-order-btn-${specialType}` : ''}`}
          onClick={handleSortOrderToggle}
          title={
            sortOrder === 'asc'
              ? 'Ascending (click to reverse)'
              : 'Descending (click to reverse)'
          }
        >
          <i
            className={`fas fa-arrow-${sortOrder === 'asc' ? 'up' : 'down'}-short-wide`}
          />
        </button>
      )}
    </div>
  );
}
