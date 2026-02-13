// @ts-nocheck
/**
 * BulkStateDialog Component
 *
 * Dialog for bulk changing task states (open/closed)
 */

import { useState, useCallback } from 'react';
import { BaseDialog } from './shared/dialogs/BaseDialog';
import './shared/dialogs/BaseDialog.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onConfirm
 * @param {number} props.selectedCount
 * @param {boolean} props.processing
 */
export function BulkStateDialog({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  processing = false,
}) {
  const [selectedState, setSelectedState] = useState('closed');

  const handleConfirm = useCallback(() => {
    if (processing) return;
    onConfirm(selectedState);
  }, [processing, selectedState, onConfirm]);

  const handleClose = useCallback(() => {
    if (!processing) {
      onClose();
    }
  }, [processing, onClose]);

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
        disabled={processing}
        type="button"
      >
        {processing ? 'Updating...' : 'Change State'}
      </button>
    </>
  );

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Change State"
      width={380}
      footer={footer}
      closeOnEscape={!processing}
      closeOnOverlayClick={!processing}
    >
      <div className="bulk-dialog-info">
        <p>
          Change state for <strong>{selectedCount}</strong> selected items
        </p>
        <p className="muted">Milestones are excluded from bulk operations</p>
      </div>

      <div className="bulk-state-options">
        <label
          className={`bulk-state-option ${selectedState === 'open' ? 'selected' : ''}`}
        >
          <input
            type="radio"
            name="state"
            value="open"
            checked={selectedState === 'open'}
            onChange={() => setSelectedState('open')}
            disabled={processing}
          />
          <span className="bulk-state-icon open">
            <i className="fas fa-circle"></i>
          </span>
          <span className="bulk-state-label">Open</span>
          <span className="bulk-state-desc">Reopen closed items</span>
        </label>

        <label
          className={`bulk-state-option ${selectedState === 'closed' ? 'selected' : ''}`}
        >
          <input
            type="radio"
            name="state"
            value="closed"
            checked={selectedState === 'closed'}
            onChange={() => setSelectedState('closed')}
            disabled={processing}
          />
          <span className="bulk-state-icon closed">
            <i className="fas fa-check-circle"></i>
          </span>
          <span className="bulk-state-label">Closed</span>
          <span className="bulk-state-desc">Close open items</span>
        </label>
      </div>
    </BaseDialog>
  );
}

export default BulkStateDialog;
