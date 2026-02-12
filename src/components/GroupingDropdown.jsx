import { useState, useRef, useEffect } from 'react';
import { DataFilters } from '../utils/DataFilters';
import './GroupingDropdown.css';

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
    </div>
  );
}
