// @ts-nocheck
/**
 * BulkAssignDialog Component
 *
 * Dialog for bulk assigning tasks to users
 */

import { useState, useCallback } from 'react';
import { BaseDialog } from './shared/dialogs/BaseDialog';
import { AssigneeSelector } from './shared/AssigneeSelector';
import './shared/dialogs/BaseDialog.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onConfirm
 * @param {number} props.selectedCount
 * @param {Array} props.assigneeOptions
 * @param {boolean} props.processing
 */
export function BulkAssignDialog({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  assigneeOptions = [],
  processing = false,
}) {
  const [selected, setSelected] = useState([]);

  const handleConfirm = useCallback(() => {
    if (selected.length === 0 || processing) return;
    onConfirm(selected);
    setSelected([]);
  }, [selected, processing, onConfirm]);

  const handleClose = useCallback(() => {
    if (!processing) {
      setSelected([]);
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
        disabled={processing || selected.length === 0}
        type="button"
      >
        {processing ? 'Assigning...' : `Assign to ${selected.length} user(s)`}
      </button>
    </>
  );

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Assign"
      width={400}
      footer={footer}
      closeOnEscape={!processing}
      closeOnOverlayClick={!processing}
    >
      <div className="bulk-dialog-info">
        <p>
          Assign <strong>{selectedCount}</strong> selected items
        </p>
        <p className="muted">Milestones are excluded from bulk operations</p>
      </div>

      <label className="dialog-label">Select Assignees</label>
      <AssigneeSelector
        options={assigneeOptions}
        selected={selected}
        onChange={setSelected}
        multiSelect={true}
        maxHeight={200}
        placeholder="Search members..."
      />
    </BaseDialog>
  );
}

export default BulkAssignDialog;
