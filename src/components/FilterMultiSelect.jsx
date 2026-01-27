/**
 * FilterMultiSelect Component
 * Reusable multi-select component with search functionality for filter panels
 */

import { useState, useMemo } from 'react';

/**
 * @typedef {Object} FilterOption
 * @property {string|number} value - The value to store when selected
 * @property {string} label - Display text
 * @property {string} [color] - Optional color (for labels)
 * @property {string} [subtitle] - Optional subtitle (e.g., @username)
 */

/**
 * Multi-select filter component with search
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {FilterOption[]} props.options - Available options
 * @param {(string|number)[]} props.selected - Currently selected values
 * @param {(values: (string|number)[]) => void} props.onChange - Called when selection changes
 * @param {string} [props.placeholder] - Search placeholder text
 * @param {string} [props.emptyMessage] - Message when no options available
 * @param {boolean} [props.showCount] - Whether to show count in title
 * @param {boolean} [props.singleSelect] - Whether to allow only single selection (radio button style)
 * @param {boolean} [props.selectedFirst] - Whether to show selected items at the top (default: true)
 */
export function FilterMultiSelect({
  title,
  options = [],
  selected = [],
  onChange,
  placeholder = 'Search...',
  emptyMessage = 'No options available',
  showCount = true,
  singleSelect = false,
  selectedFirst = true,
}) {
  const [search, setSearch] = useState('');

  // Filter options by search term, then sort selected items to top if enabled
  const filteredOptions = useMemo(() => {
    let filtered = options;

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchLower) ||
          (opt.subtitle && opt.subtitle.toLowerCase().includes(searchLower)),
      );
    }

    // Sort selected items to top if enabled
    if (selectedFirst && selected.length > 0) {
      const selectedSet = new Set(selected);
      const selectedItems = filtered.filter((opt) => selectedSet.has(opt.value));
      const unselectedItems = filtered.filter((opt) => !selectedSet.has(opt.value));
      return [...selectedItems, ...unselectedItems];
    }

    return filtered;
  }, [options, search, selected, selectedFirst]);

  // Toggle selection
  const handleToggle = (value) => {
    if (singleSelect) {
      // Single select: toggle between selected and empty, or switch to new value
      const newSelected = selected.includes(value) ? [] : [value];
      onChange(newSelected);
    } else {
      // Multi select: add/remove from selection
      const newSelected = selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value];
      onChange(newSelected);
    }
  };

  // Select all visible options (only for multi-select)
  const handleSelectAll = () => {
    if (singleSelect) return;
    const visibleValues = filteredOptions.map(opt => opt.value);
    const newSelected = [...new Set([...selected, ...visibleValues])];
    onChange(newSelected);
  };

  // Clear all selections
  const handleClearAll = () => {
    if (singleSelect) {
      onChange([]);
    } else if (search.trim()) {
      // Only clear visible options
      const visibleValues = new Set(filteredOptions.map(opt => opt.value));
      const newSelected = selected.filter(v => !visibleValues.has(v));
      onChange(newSelected);
    } else {
      onChange([]);
    }
  };

  // Invert selection (only for multi-select)
  const handleInvert = () => {
    if (singleSelect) return;
    if (search.trim()) {
      // Only invert visible options, keep non-visible selections unchanged
      const visibleValues = new Set(filteredOptions.map(opt => opt.value));
      const newSelected = selected.filter(v => !visibleValues.has(v));
      // Add visible items that were NOT selected
      filteredOptions.forEach(opt => {
        if (!selected.includes(opt.value)) {
          newSelected.push(opt.value);
        }
      });
      onChange(newSelected);
    } else {
      // Invert all options
      const allValues = options.map(opt => opt.value);
      const newSelected = allValues.filter(v => !selected.includes(v));
      onChange(newSelected);
    }
  };

  const selectedCount = selected.length;
  const visibleSelectedCount = filteredOptions.filter(opt => selected.includes(opt.value)).length;

  return (
    <div className="filter-multi-select">
      <div className="fms-header">
        <span className="fms-title">
          {title}
          {showCount && <span className="fms-count">({options.length})</span>}
        </span>
        {selectedCount > 0 && (
          <span className="fms-selected-badge">{selectedCount}</span>
        )}
      </div>

      {options.length > 5 && (
        <div className="fms-search">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="fms-search-input"
          />
          {search && (
            <button
              className="fms-search-clear"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="fms-options">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => (
            <label
              key={opt.value}
              className={`fms-option ${selected.includes(opt.value) ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => handleToggle(opt.value)}
              />
              {opt.color ? (
                <span
                  className="fms-label-tag"
                  style={{ backgroundColor: opt.color }}
                >
                  {opt.label}
                </span>
              ) : (
                <span className="fms-option-text" title={opt.subtitle || opt.label}>
                  {opt.label}
                </span>
              )}
            </label>
          ))
        ) : (
          <div className="fms-empty">
            {options.length === 0 ? emptyMessage : 'No matches'}
          </div>
        )}
      </div>

      {filteredOptions.length > 0 && (
        <div className="fms-actions">
          <button
            className="fms-action-btn"
            onClick={handleSelectAll}
            disabled={visibleSelectedCount === filteredOptions.length}
          >
            All
          </button>
          <button
            className="fms-action-btn"
            onClick={handleClearAll}
            disabled={visibleSelectedCount === 0}
          >
            None
          </button>
          <button
            className="fms-action-btn"
            onClick={handleInvert}
            disabled={singleSelect || filteredOptions.length === 0}
          >
            Invert
          </button>
        </div>
      )}

      <style>{`
        .filter-multi-select {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .fms-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }

        .fms-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--wx-gitlab-filter-text);
        }

        .fms-count {
          font-weight: 400;
          color: var(--wx-gitlab-control-text);
          margin-left: 2px;
        }

        .fms-selected-badge {
          background: #1f75cb;
          color: white;
          font-size: 10px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 8px;
          min-width: 16px;
          text-align: center;
        }

        .fms-search {
          position: relative;
          margin-bottom: 4px;
        }

        .fms-search-input {
          width: 100%;
          padding: 4px 24px 4px 8px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 3px;
          background: var(--wx-gitlab-filter-input-background);
          color: var(--wx-gitlab-filter-text);
          font-size: 12px;
        }

        .fms-search-input:focus {
          outline: none;
          border-color: #1f75cb;
        }

        .fms-search-clear {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--wx-gitlab-control-text);
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          padding: 2px;
        }

        .fms-search-clear:hover {
          color: var(--wx-gitlab-filter-text);
        }

        .fms-options {
          max-height: 120px;
          overflow-y: auto;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 3px;
          background: var(--wx-gitlab-filter-input-background);
        }

        .fms-options::-webkit-scrollbar {
          width: 6px;
        }

        .fms-options::-webkit-scrollbar-track {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .fms-options::-webkit-scrollbar-thumb {
          background: var(--wx-gitlab-control-text);
          border-radius: 3px;
        }

        .fms-option {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 6px;
          cursor: pointer;
          font-size: 12px;
          color: var(--wx-gitlab-filter-text);
          transition: background 0.1s;
        }

        .fms-option:hover {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .fms-option.selected {
          background: rgba(31, 117, 203, 0.1);
        }

        .fms-option input[type="checkbox"] {
          margin: 0;
          cursor: pointer;
          flex-shrink: 0;
        }

        .fms-option-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fms-label-tag {
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 11px;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fms-empty {
          padding: 12px;
          text-align: center;
          color: var(--wx-gitlab-control-text);
          font-size: 11px;
          font-style: italic;
        }

        .fms-actions {
          display: flex;
          gap: 4px;
          margin-top: 4px;
        }

        .fms-action-btn {
          flex: 1;
          padding: 2px 6px;
          background: var(--wx-gitlab-filter-input-background);
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 3px;
          font-size: 10px;
          color: var(--wx-gitlab-filter-text);
          cursor: pointer;
          transition: background 0.1s;
        }

        .fms-action-btn:hover:not(:disabled) {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .fms-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default FilterMultiSelect;
