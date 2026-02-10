import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DatePickerPopup from '../shared/DatePickerPopup.jsx';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import './DateEditCell.css';

/**
 * DateEditCell - Grid cell component for editing dates with clear support.
 *
 * Features:
 * - Displays date in YY/MM/DD format or 'None' if no date
 * - Click to open DatePicker popover (using Portal to avoid overflow clipping)
 * - Support clearing date (set to null)
 * - For milestones: Always shows the date (milestones always have dates)
 * - For regular tasks: Checks _gitlab.startDate/_gitlab.dueDate to determine if GitLab has the date
 *
 * NOTE: Uses Portal with position:fixed for popup positioning because Grid cells
 * have overflow:hidden which clips absolutely positioned elements.
 *
 * @param {Object} props
 * @param {Object} props.row - Task row data
 * @param {Object} props.column - Column configuration (id: 'start' | 'end')
 * @param {boolean} props.readonly - If true, disable editing
 * @param {Function} props.onDateChange - Callback when date changes: (rowId, columnId, value) => void
 */
function DateEditCell({ row, column, readonly = false, onDateChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const cellRef = useRef(null);
  const pickerRef = useRef(null);

  const isMilestone = row.$isMilestone || row._gitlab?.type === 'milestone';

  // Always use _gitlab.startDate/_gitlab.dueDate as the source of truth
  // This ensures we show "None" when GitLab has no date, regardless of what svar gantt does
  const gitlabFieldName = column.id === 'start' ? 'startDate' : 'dueDate';
  const gitlabDateValue = row._gitlab?.[gitlabFieldName]; // string like "2026-01-27" or null/undefined

  // For milestones: always show the date (milestones always have dates in GitLab)
  // For regular tasks: check _gitlab field
  let date = null;
  if (isMilestone) {
    // Milestones always have dates
    date = row[column.id];
  } else if (gitlabDateValue) {
    // GitLab has a date - parse it
    date = new Date(gitlabDateValue + 'T00:00:00');
  }
  // else: date remains null, will show "None"

  // Open picker
  const handleOpenPicker = useCallback(() => {
    if (readonly) return;
    setShowPicker(true);
  }, [readonly]);

  // Handle date selection
  const handleDateSelect = useCallback(
    (newDate) => {
      if (onDateChange) {
        onDateChange(row.id, column.id, newDate);
      }
      setShowPicker(false);
    },
    [row.id, column.id, onDateChange],
  );

  // Handle clear button click
  const handleClear = useCallback(() => {
    if (onDateChange) {
      onDateChange(row.id, column.id, null);
    }
    setShowPicker(false);
  }, [row.id, column.id, onDateChange]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (e) => {
      if (
        cellRef.current &&
        !cellRef.current.contains(e.target) &&
        pickerRef.current &&
        !pickerRef.current.contains(e.target)
      ) {
        setShowPicker(false);
      }
    };

    // Delay to avoid immediate close on open click
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

  const displayValue = formatDateDisplay(date);
  const isNone = displayValue === 'None';

  // Style for "None" text - using --wx-color-font-alt because --wx-color-secondary is transparent in willow theme
  const noneStyle = isNone
    ? { color: 'var(--wx-color-font-alt, #9fa1ae)' }
    : {};

  // Readonly mode - just display
  if (readonly) {
    return <span style={noneStyle}>{displayValue}</span>;
  }

  return (
    <>
      <span
        ref={cellRef}
        className="date-edit-cell-value"
        style={noneStyle}
        onClick={handleOpenPicker}
        title={date ? 'Click to edit' : 'Click to set date'}
      >
        {displayValue}
      </span>

      {showPicker &&
        createPortal(
          <DatePickerPopup
            value={date}
            onDateSelect={handleDateSelect}
            onClear={handleClear}
            popupRef={(el) => {
              pickerRef.current = el;
              // Position popup using fixed positioning
              // Fixed positioning is relative to viewport, matching getBoundingClientRect
              if (el && cellRef.current) {
                // Use requestAnimationFrame to wait for DOM to fully render
                // This ensures we measure the actual popup height correctly
                requestAnimationFrame(() => {
                  if (!el || !cellRef.current) return;

                  const rect = cellRef.current.getBoundingClientRect();
                  // Measure actual popup height after DOM is ready
                  const popupHeight =
                    el.offsetHeight || el.getBoundingClientRect().height || 0;

                  // For popup positioning, we use viewport boundaries
                  // The popup is rendered via Portal to document.body with position:fixed,
                  // so it's not clipped by any container's overflow
                  const spaceBelow = window.innerHeight - rect.bottom;
                  const spaceAbove = rect.top;

                  let top;
                  // Flip to above only if below space is insufficient AND above has enough space
                  if (spaceBelow < popupHeight && spaceAbove >= popupHeight) {
                    // Show above - popup bottom aligns at cell top
                    top = rect.top - popupHeight;
                  } else {
                    // Show below (default) - popup top aligns at cell top (overlapping cell)
                    top = rect.top;
                  }

                  el.style.position = 'fixed';
                  el.style.top = `${top}px`;
                  el.style.left = `${rect.left}px`;
                  el.style.zIndex = '10000';
                });
              }
            }}
          />,
          document.body,
        )}
    </>
  );
}

export default DateEditCell;
