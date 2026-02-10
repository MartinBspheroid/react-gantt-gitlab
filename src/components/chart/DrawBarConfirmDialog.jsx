/**
 * DrawBarConfirmDialog Component
 * Dialog shown after dragging to draw a bar on a task without dates.
 * Provides options to overwrite dates, set only end date, or cancel.
 */

import { useMemo } from 'react';
import './DrawBarConfirmDialog.css';

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

/**
 * @param {Object} props
 * @param {Date} props.startDate - Start date from the drawn range
 * @param {Date} props.endDate - End date from the drawn range (exclusive - day after last selected day)
 * @param {(startDate: Date, endDate: Date) => number} props.countWorkdays - Function to count workdays (from useHighlightTime)
 * @param {(mode: 'overwrite' | 'end-only') => void} props.onConfirm - Confirm callback with mode
 * @param {() => void} props.onCancel - Cancel callback
 */
function DrawBarConfirmDialog({
  startDate,
  endDate,
  countWorkdays,
  onConfirm,
  onCancel,
}) {
  // Display end date (endDate is exclusive, so show the day before)
  const displayEndDate = useMemo(() => {
    if (!endDate) return null;
    const end = new Date(endDate);
    end.setDate(end.getDate() - 1);
    return end;
  }, [endDate]);

  // Calculate duration in calendar days
  // endDate is EXCLUSIVE (the day after the last selected day)
  const calendarDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - start.getTime();
    // endDate is exclusive, so no +1 needed
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  // Calculate workdays (excluding weekends and holidays)
  // Uses countWorkdays from useHighlightTime which properly handles holidays
  const workdays = useMemo(() => {
    if (!countWorkdays || !startDate || !displayEndDate) return calendarDays;
    return countWorkdays(startDate, displayEndDate);
  }, [countWorkdays, startDate, displayEndDate, calendarDays]);

  // Handle overlay click (close dialog)
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="draw-bar-dialog-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-bar-dialog-title"
    >
      <div className="draw-bar-dialog">
        <div className="draw-bar-dialog-header">
          <h3 id="draw-bar-dialog-title">Set Task Dates</h3>
          <button
            className="draw-bar-dialog-close"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <div className="draw-bar-dialog-body">
          {/* Date Range Preview */}
          <div className="draw-bar-date-preview">
            <div className="date-range-row">
              <span className="date-label">Start:</span>
              <span className="date-value">{formatDate(startDate)}</span>
            </div>
            <div className="date-range-row">
              <span className="date-label">End:</span>
              <span className="date-value">{formatDate(displayEndDate)}</span>
            </div>
            <div className="date-range-row duration">
              <span className="date-label">Duration:</span>
              <span className="date-value">
                {calendarDays} days ({workdays} workdays)
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="draw-bar-description">
            How would you like to apply these dates to the task?
          </p>
        </div>

        <div className="draw-bar-dialog-footer">
          <button
            className="draw-bar-btn draw-bar-btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="draw-bar-btn draw-bar-btn-outline"
            onClick={() => onConfirm('end-only')}
            title="Keep the existing start date, only set the end date"
          >
            Only Set End
          </button>
          <button
            className="draw-bar-btn draw-bar-btn-primary"
            onClick={() => onConfirm('overwrite')}
            title="Replace both start and end dates with the drawn range"
          >
            Overwrite Dates
          </button>
        </div>
      </div>
    </div>
  );
}

export default DrawBarConfirmDialog;
