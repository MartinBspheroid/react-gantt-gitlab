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
 * Count workdays between two dates (excluding weekends)
 * Note: This is a simple implementation that only excludes Sat/Sun.
 * For full holiday support, use the countWorkdays from useHighlightTime hook.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {number} Number of workdays (inclusive)
 */
const countSimpleWorkdays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start > end) return 0;

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

/**
 * @param {Object} props
 * @param {Date} props.startDate - Start date from the drawn range
 * @param {Date} props.endDate - End date from the drawn range
 * @param {number|string} props.taskId - ID of the task being modified
 * @param {(mode: 'overwrite' | 'end-only') => void} props.onConfirm - Confirm callback with mode
 * @param {() => void} props.onCancel - Cancel callback
 */
function DrawBarConfirmDialog({ startDate, endDate, taskId, onConfirm, onCancel }) {
  // Calculate duration in calendar days (inclusive of both start and end)
  const calendarDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - start.getTime();
    // +1 to include both start and end dates
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  // Calculate workdays (excluding weekends)
  const workdays = useMemo(() => {
    return countSimpleWorkdays(startDate, endDate);
  }, [startDate, endDate]);

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
              <span className="date-value">{formatDate(endDate)}</span>
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
