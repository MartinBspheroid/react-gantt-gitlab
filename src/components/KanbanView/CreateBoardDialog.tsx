// @ts-nocheck
/**
 * CreateBoardDialog Component
 *
 * Simple dialog for creating a new Kanban board.
 * Uses BaseDialog for consistent modal behavior.
 */

import { useState } from 'react';
import { BaseDialog } from '../shared/dialogs/BaseDialog';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dialog is visible
 * @param {function} props.onClose - Callback to close dialog
 * @param {function} props.onCreate - Callback when board is created (boardData) => void
 * @param {boolean} props.saving - Whether a save operation is in progress
 */
export function CreateBoardDialog({
  isOpen,
  onClose,
  onCreate,
  saving = false,
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a board name');
      return;
    }

    onCreate({
      name: trimmedName,
      lists: [],
      showOthers: true,
      showClosed: true,
    });
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  const footer = (
    <>
      <button
        type="button"
        className="dialog-btn dialog-btn-secondary"
        onClick={handleClose}
        disabled={saving}
      >
        Cancel
      </button>
      <button
        type="button"
        className="dialog-btn dialog-btn-primary"
        onClick={handleSubmit}
        disabled={saving}
      >
        {saving ? 'Creating...' : 'Create Board'}
      </button>
    </>
  );

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Board"
      width={360}
      footer={footer}
    >
      <div className="dialog-form-group">
        <label htmlFor="board-name">Name</label>
        <input
          id="board-name"
          type="text"
          className={`dialog-input ${error ? 'error' : ''}`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="Enter board name..."
          disabled={saving}
          autoFocus
        />
        {error && <div className="dialog-error">{error}</div>}
      </div>
    </BaseDialog>
  );
}
