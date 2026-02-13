// @ts-nocheck
/**
 * BulkRescheduleDialog Component
 *
 * Dialog for bulk rescheduling tasks (moving dates)
 */

import { useState, useCallback } from 'react';
import { BaseDialog } from './shared/dialogs/BaseDialog';
import './shared/dialogs/BaseDialog.css';
import './BulkOperationsBar.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onConfirm
 * @param {number} props.selectedCount
 * @param {boolean} props.processing
 */
export function BulkRescheduleDialog({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  processing = false,
}) {
  const [daysOffset, setDaysOffset] = useState(1);

  const handleConfirm = useCallback(() => {
    if (processing || daysOffset === 0) return;
    onConfirm(daysOffset);
    setDaysOffset(1);
  }, [processing, daysOffset, onConfirm]);

  const handleClose = useCallback(() => {
    if (!processing) {
      setDaysOffset(1);
      onClose();
    }
  }, [processing, onClose]);

  const handleQuickSelect = useCallback((days) => {
    setDaysOffset(days);
  }, []);

  const quickOptions = [
    { label: '-7 days', value: -7 },
    { label: '-3 days', value: -3 },
    { label: '-1 day', value: -1 },
    { label: '+1 day', value: 1 },
    { label: '+3 days', value: 3 },
    { label: '+7 days', value: 7 },
    { label: '+14 days', value: 14 },
    { label: '+30 days', value: 30 },
  ];

  const getActionLabel = () => {
    if (daysOffset > 0) return `Move forward ${daysOffset} day(s)`;
    if (daysOffset < 0) return `Move back ${Math.abs(daysOffset)} day(s)`;
    return 'No change';
  };

  const footer = (
    <>
      <button
        className="dialog-btn dialog-btn-secondary"
        onClick={handleClose}
        disabled={processing}
        type="button"
      >
        Cancel
      </button>
      <button
        className="dialog-btn dialog-btn-primary"
        onClick={handleConfirm}
        disabled={processing || daysOffset === 0}
        type="button"
      >
        {processing ? 'Rescheduling...' : getActionLabel()}
      </button>
    </>
  );

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Reschedule"
      width={420}
      footer={footer}
      closeOnEscape={!processing}
      closeOnOverlayClick={!processing}
    >
      <div className="bulk-dialog-info">
        <p>
          Move dates for <strong>{selectedCount}</strong> selected items
        </p>
        <p className="muted">Items without dates will be skipped</p>
      </div>

      <div className="bulk-days-input">
        <label htmlFor="bulk-days-offset">Move by:</label>
        <input
          id="bulk-days-offset"
          type="number"
          value={daysOffset}
          onChange={(e) => setDaysOffset(parseInt(e.target.value) || 0)}
          disabled={processing}
        />
        <span>days</span>
        <span className="muted">
          ({daysOffset >= 0 ? 'forward' : 'backward'})
        </span>
      </div>

      <div className="bulk-quick-buttons">
        {quickOptions.map((opt) => (
          <button
            key={opt.value}
            className={`bulk-quick-btn ${daysOffset === opt.value ? 'active' : ''}`}
            onClick={() => handleQuickSelect(opt.value)}
            disabled={processing}
            type="button"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </BaseDialog>
  );
}

export default BulkRescheduleDialog;
