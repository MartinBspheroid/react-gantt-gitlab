import { useState, useCallback, useRef, useEffect } from 'react';
import DatePickerPopup from '../shared/DatePickerPopup.jsx';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import './NullableDatePicker.css';

/**
 * NullableDatePicker - Custom date picker for Editor that supports null/empty dates.
 *
 * This component replaces the default svar date picker because svar's DatePicker
 * always requires a date value and doesn't support clearing dates to null.
 *
 * Features:
 * - Displays date or "None" when empty
 * - Click to open date picker popover
 * - Clear button in popover to set date to null
 * - Works with the Editor's onChange/onchange pattern
 *
 * UI Design: Uses shared DatePickerPopup for consistency with DateEditCell (Grid)
 *
 * @param {Object} props
 * @param {Date|null} props.value - Current date value (can be null)
 * @param {Function} props.onChange - Change handler: ({ value: Date|null }) => void
 * @param {Function} props.onchange - Alternative change handler (svar convention)
 * @param {string} props.label - Field label
 * @param {boolean} props.disabled - If true, disable editing
 */
export default function NullableDatePicker(props) {
  const { value, onChange, onchange, label, disabled = false } = props;
  const onChangeHandler = onChange ?? onchange;

  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef(null);
  const pickerRef = useRef(null);

  // Check if we have a valid date
  const hasDate = value instanceof Date && !isNaN(value.getTime());

  // Handle date selection from DatePicker
  const handleDateSelect = useCallback(
    (newDate) => {
      if (onChangeHandler) {
        onChangeHandler({ value: newDate });
      }
      setShowPicker(false);
    },
    [onChangeHandler],
  );

  // Handle clear button (in popup)
  const handleClear = useCallback(() => {
    if (onChangeHandler) {
      onChangeHandler({ value: null });
    }
    setShowPicker(false);
  }, [onChangeHandler]);

  // Open picker
  const handleOpenPicker = useCallback(() => {
    if (!disabled) {
      setShowPicker(true);
    }
  }, [disabled]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (e) => {
      // Check if click is inside container or picker
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        pickerRef.current &&
        !pickerRef.current.contains(e.target)
      ) {
        setShowPicker(false);
      }
    };

    // Use setTimeout to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  // Close on Escape key
  useEffect(() => {
    if (!showPicker) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPicker(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showPicker]);

  const displayValue = formatDateDisplay(value);
  const isNone = !hasDate;

  // Inline style for "None" text - using --wx-color-font-alt because --wx-color-secondary is transparent in willow theme
  const noneStyle = isNone
    ? { color: 'var(--wx-color-font-alt, #9fa1ae)' }
    : {};

  if (disabled) {
    return (
      <div className="nullable-date-picker disabled">
        <span className="nullable-date-value" style={noneStyle}>
          {displayValue}
        </span>
      </div>
    );
  }

  return (
    <div className="nullable-date-picker" ref={containerRef}>
      {/* Clickable date display */}
      <span
        className="nullable-date-value clickable"
        style={noneStyle}
        onClick={handleOpenPicker}
        title={hasDate ? 'Click to edit date' : 'Click to set date'}
      >
        {displayValue}
      </span>

      {/* Picker popup - uses shared DatePickerPopup */}
      {showPicker && (
        <DatePickerPopup
          value={value}
          onDateSelect={handleDateSelect}
          onClear={handleClear}
          popupRef={pickerRef}
          className="nullable-date-picker-popup"
        />
      )}
    </div>
  );
}
