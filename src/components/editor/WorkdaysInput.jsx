/**
 * WorkdaysInput Component
 *
 * A custom editor input for editing workdays count.
 * When the user changes the workdays value, the Editor component
 * recalculates the end date to maintain the specified number of workdays.
 *
 * Props:
 * - value: Current workdays count (number, calculated from start/end dates)
 * - onChange/onchange: Callback when value changes ({ value: number })
 * - min: Minimum allowed value (default: 1)
 * - max: Maximum allowed value (default: 365)
 * - disabled: Whether input is disabled
 * - readonly: Whether input is readonly
 */

import { useState, useEffect, useCallback } from 'react';
import './WorkdaysInput.css';

export default function WorkdaysInput({
  value,
  onChange,
  onchange,
  min = 1,
  max = 365,
  disabled = false,
  readonly = false,
}) {
  const onChangeHandler = onChange ?? onchange;
  // Use empty string for display when value is undefined/null (no dates set)
  const [localValue, setLocalValue] = useState(value ?? '');

  // Sync local value with prop when it changes externally
  useEffect(() => {
    const newValue = value ?? '';
    if (newValue !== localValue) {
      setLocalValue(newValue);
    }
    // Intentionally only depend on value - we want to sync from prop to local
  }, [value]);

  /**
   * Update value and notify parent
   * @param {number} newValue - The new workdays value
   */
  const updateValue = useCallback(
    (newValue) => {
      const clampedValue = Math.max(min, Math.min(max, newValue));
      setLocalValue(clampedValue);
      if (onChangeHandler) {
        onChangeHandler({ value: clampedValue });
      }
    },
    [min, max, onChangeHandler],
  );

  const handleInputChange = useCallback(
    (e) => {
      const parsed = parseInt(e.target.value, 10);
      if (isNaN(parsed)) {
        // Allow empty input while typing
        setLocalValue('');
        return;
      }
      // Clamp and update locally (don't notify parent until blur)
      setLocalValue(Math.max(min, Math.min(max, parsed)));
    },
    [min, max],
  );

  const handleBlur = useCallback(() => {
    // On blur, ensure valid value and notify parent
    const finalValue =
      typeof localValue === 'number' && localValue >= min ? localValue : min;
    if (finalValue !== value) {
      updateValue(finalValue);
    } else {
      // Reset to valid value if input was cleared
      setLocalValue(finalValue);
    }
  }, [localValue, value, min, updateValue]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateValue((localValue || 0) + 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateValue((localValue || 0) - 1);
      }
    },
    [localValue, updateValue],
  );

  const increment = useCallback(() => {
    updateValue((localValue || 0) + 1);
  }, [localValue, updateValue]);

  const decrement = useCallback(() => {
    updateValue((localValue || 0) - 1);
  }, [localValue, updateValue]);

  // Don't render if no value (task has no dates)
  if (value === undefined || value === null) {
    return <span className="workdays-input-empty">-</span>;
  }

  return (
    <div className="workdays-input-container">
      <button
        type="button"
        className="workdays-btn decrement"
        onClick={decrement}
        disabled={disabled || readonly || localValue <= min}
        tabIndex={-1}
        aria-label="Decrease workdays"
      >
        <i className="fas fa-minus"></i>
      </button>
      <input
        type="number"
        className="workdays-input"
        value={localValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        disabled={disabled}
        readOnly={readonly}
        aria-label="Workdays"
      />
      <span className="workdays-suffix">d</span>
      <button
        type="button"
        className="workdays-btn increment"
        onClick={increment}
        disabled={disabled || readonly || localValue >= max}
        tabIndex={-1}
        aria-label="Increase workdays"
      >
        <i className="fas fa-plus"></i>
      </button>
    </div>
  );
}
