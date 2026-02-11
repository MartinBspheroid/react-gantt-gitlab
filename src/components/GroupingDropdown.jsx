import { useState, useRef, useEffect } from 'react';
import { DataFilters } from '../utils/DataFilters';

export function GroupingDropdown({
  value = 'none',
  onChange,
  groupCount = 0,
  taskCount = 0,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange?.(optionValue);
    setIsOpen(false);
  };

  const selectedOption = DataFilters.GROUP_BY_OPTIONS.find(
    (opt) => opt.value === value,
  );

  return (
    <div className="grouping-dropdown" ref={dropdownRef}>
      <button
        className="grouping-dropdown-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        title="Group tasks by..."
      >
        <i className="fas fa-layer-group"></i>
        <span className="grouping-label">
          {selectedOption?.label || 'Group By'}
        </span>
        {groupCount > 0 && (
          <span className="grouping-count">
            {groupCount} groups, {taskCount} tasks
          </span>
        )}
        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} chevron`}></i>
      </button>

      {isOpen && (
        <div className="grouping-dropdown-menu">
          {DataFilters.GROUP_BY_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`grouping-dropdown-item ${value === option.value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
              {value === option.value && (
                <i className="fas fa-check check-icon"></i>
              )}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .grouping-dropdown {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .grouping-dropdown-trigger {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: var(--wx-gantt-background, #fff);
          border: 1px solid var(--wx-gantt-border-color, #ddd);
          border-radius: 4px;
          font-size: 12px;
          color: var(--wx-gantt-text-color, #333);
          cursor: pointer;
          transition: all 0.2s;
          min-height: 28px;
        }

        .grouping-dropdown-trigger:hover:not(:disabled) {
          background: var(--wx-gantt-hover-background, #f5f5f5);
          border-color: var(--wx-gantt-accent-color, #1f75cb);
        }

        .grouping-dropdown-trigger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .grouping-dropdown-trigger i {
          font-size: 11px;
          color: var(--wx-gantt-control-text, #666);
        }

        .grouping-label {
          font-weight: 500;
        }

        .grouping-count {
          font-size: 11px;
          color: var(--wx-gantt-control-text, #666);
          margin-left: 4px;
        }

        .chevron {
          font-size: 10px !important;
          margin-left: 2px;
        }

        .grouping-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          min-width: 160px;
          background: var(--wx-gantt-background, #fff);
          border: 1px solid var(--wx-gantt-border-color, #ddd);
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          overflow: hidden;
        }

        .grouping-dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 12px;
          background: none;
          border: none;
          font-size: 12px;
          color: var(--wx-gantt-text-color, #333);
          cursor: pointer;
          text-align: left;
          transition: background 0.15s;
        }

        .grouping-dropdown-item:hover {
          background: var(--wx-gantt-hover-background, #f5f5f5);
        }

        .grouping-dropdown-item.selected {
          background: var(--wx-gantt-selected-background, rgba(31, 117, 203, 0.1));
          color: var(--wx-gantt-accent-color, #1f75cb);
          font-weight: 500;
        }

        .check-icon {
          color: var(--wx-gantt-accent-color, #1f75cb);
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}
