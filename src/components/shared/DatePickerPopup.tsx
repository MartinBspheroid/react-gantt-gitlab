// @ts-nocheck
import { Calendar } from '@svar-ui/react-core';
import './DatePickerPopup.css';

/**
 * DatePickerPopup - Shared popup component for date picking with clear support.
 *
 * Used by both DateEditCell (Grid) and NullableDatePicker (Editor) to provide
 * consistent UI and behavior for date selection and clearing.
 *
 * Uses Calendar instead of DatePicker to avoid nested popup issues.
 * DatePicker = Input + Popup + Calendar, but we already have our own popup container,
 * so using Calendar directly gives us full control over positioning and flip logic.
 *
 * Layout: Calendar on left, clear (×) button on right (only when has date)
 *
 * @param {Object} props
 * @param {Date|null} props.value - Current date value (can be null)
 * @param {Function} props.onDateSelect - Called when a date is selected: (date: Date) => void
 * @param {Function} props.onClear - Called when clear button is clicked: () => void
 * @param {React.Ref} props.popupRef - Ref to attach to the popup container (for click-outside detection)
 * @param {Object} props.style - Optional inline styles for positioning (used by Portal version)
 * @param {string} props.className - Optional additional CSS class
 */
export default function DatePickerPopup({
  value,
  onDateSelect,
  onClear,
  popupRef,
  style,
  className = '',
}) {
  const hasDate = value instanceof Date && !isNaN(value.getTime());

  const handleDateChange = (ev) => {
    if (onDateSelect) {
      onDateSelect(ev.value);
    }
  };

  const handleClearClick = (e) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    }
  };

  return (
    <div
      className={`date-picker-popup ${hasDate ? 'has-date' : ''} ${className}`}
      ref={popupRef}
      style={style}
    >
      <div className="date-picker-popup-content">
        <Calendar
          value={hasDate ? value : new Date()}
          onChange={handleDateChange}
          buttons={['today']}
        />
        {hasDate && (
          <button
            className="date-picker-popup-clear-btn"
            onClick={handleClearClick}
            type="button"
            title="Clear date"
          >
            <i className="fas fa-trash-can" />
          </button>
        )}
      </div>
    </div>
  );
}
