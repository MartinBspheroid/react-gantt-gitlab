/**
 * BoardSettingsModal Component
 *
 * Modal for editing board settings. Uses BaseDialog for consistent modal behavior.
 * - Board name
 * - List management (add, edit, delete, reorder)
 * - Special list toggles (Others, Closed)
 * - Delete board
 */

import { useState, useEffect } from 'react';
import { BaseDialog } from '../shared/dialogs/BaseDialog';
import { SORT_OPTIONS, SORT_ORDER_OPTIONS } from './constants';
import './BoardSettingsModal.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {import('../../types/issueBoard').IssueBoard | null} props.board - Board to edit
 * @param {function} props.onClose - Callback to close modal
 * @param {function} props.onSave - Callback when changes are saved (updatedBoard) => void
 * @param {function} props.onDelete - Callback when board is deleted
 * @param {function} props.onEditList - Callback when edit list is clicked (list) => void
 * @param {boolean} props.saving - Whether a save operation is in progress
 */
export function BoardSettingsModal({
  isOpen,
  board,
  onClose,
  onSave,
  onDelete,
  onEditList,
  saving = false,
}) {
  const [name, setName] = useState('');
  const [showOthers, setShowOthers] = useState(true);
  const [showClosed, setShowClosed] = useState(true);
  const [othersSortBy, setOthersSortBy] = useState('position');
  const [othersSortOrder, setOthersSortOrder] = useState('asc');
  const [closedSortBy, setClosedSortBy] = useState('position');
  const [closedSortOrder, setClosedSortOrder] = useState('asc');
  const [lists, setLists] = useState([]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync state with board prop
  useEffect(() => {
    if (board) {
      setName(board.name);
      setShowOthers(board.showOthers);
      setShowClosed(board.showClosed);
      setOthersSortBy(board.othersSortBy || 'position');
      setOthersSortOrder(board.othersSortOrder || 'asc');
      setClosedSortBy(board.closedSortBy || 'position');
      setClosedSortOrder(board.closedSortOrder || 'asc');
      setLists([...board.lists]);
      setError('');
      setConfirmDelete(false);
    }
  }, [board]);

  if (!board) return null;

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a board name');
      return;
    }

    const updatedBoard = {
      ...board,
      name: trimmedName,
      showOthers,
      showClosed,
      othersSortBy,
      othersSortOrder,
      closedSortBy,
      closedSortOrder,
      lists,
    };

    onSave(updatedBoard);
  };

  const handleDeleteList = (listId) => {
    setLists((prev) => prev.filter((l) => l.id !== listId));
  };

  const handleMoveList = (listId, direction) => {
    const index = lists.findIndex((l) => l.id === listId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= lists.length) return;

    const newLists = [...lists];
    [newLists[index], newLists[newIndex]] = [newLists[newIndex], newLists[index]];
    setLists(newLists);
  };

  const handleDeleteBoard = () => {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
    }
  };

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  // Custom footer with delete on left, cancel/save on right
  const footer = (
    <div className="board-settings-footer-content">
      <button
        className={`dialog-btn dialog-btn-danger ${confirmDelete ? 'confirm' : ''}`}
        onClick={handleDeleteBoard}
        disabled={saving}
      >
        {confirmDelete ? 'Click again to confirm' : 'Delete Board'}
      </button>
      <div className="board-settings-footer-right">
        <button
          className="dialog-btn dialog-btn-secondary"
          onClick={handleClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          className="dialog-btn dialog-btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Board Settings"
      width={500}
      footer={footer}
      className="board-settings-modal"
    >
      {/* Name input */}
      <div className="dialog-form-group">
        <label htmlFor="board-settings-name">Name</label>
        <input
          id="board-settings-name"
          type="text"
          className={`dialog-input ${error ? 'error' : ''}`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          disabled={saving}
        />
        {error && <div className="dialog-error">{error}</div>}
      </div>

      {/* Lists section */}
      <div className="board-settings-section">
        <div className="board-settings-section-header">
          <label>Lists</label>
          <button
            className="board-settings-add-btn"
            onClick={() => onEditList(null)}
            disabled={saving}
          >
            <i className="fas fa-plus" />
            Add List
          </button>
        </div>

        <div className="board-settings-lists">
          {/* Others list (top) */}
          <div className={`board-settings-list-item board-settings-list-special${showOthers ? '' : ' board-settings-list-disabled'}`}>
            <div className="list-item-toggle">
              <input
                type="checkbox"
                checked={showOthers}
                onChange={(e) => setShowOthers(e.target.checked)}
                disabled={saving}
              />
            </div>
            <div className="list-item-info">
              <span className="list-item-name">Others</span>
              <span className="list-item-labels">Issues that don't match any list</span>
            </div>
            {showOthers && (
              <div className="list-item-sort">
                <select
                  className="list-item-sort-select"
                  value={othersSortBy}
                  onChange={(e) => setOthersSortBy(e.target.value)}
                  disabled={saving}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  className="list-item-sort-select"
                  value={othersSortOrder}
                  onChange={(e) => setOthersSortOrder(e.target.value)}
                  disabled={saving}
                >
                  {SORT_ORDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Regular lists */}
          {lists.map((list, index) => (
            <div key={list.id} className="board-settings-list-item">
              <div className="list-item-drag">
                <button
                  className="list-move-btn"
                  onClick={() => handleMoveList(list.id, 'up')}
                  disabled={index === 0 || saving}
                  title="Move up"
                >
                  <i className="fas fa-chevron-up" />
                </button>
                <button
                  className="list-move-btn"
                  onClick={() => handleMoveList(list.id, 'down')}
                  disabled={index === lists.length - 1 || saving}
                  title="Move down"
                >
                  <i className="fas fa-chevron-down" />
                </button>
              </div>
              <div className="list-item-info">
                <span className="list-item-name">{list.name}</span>
                <span className="list-item-labels">
                  {list.labels.length > 0
                    ? `Labels: ${list.labels.join(', ')}`
                    : 'No labels'}
                </span>
              </div>
              <div className="list-item-actions">
                <button
                  className="list-action-btn"
                  onClick={() => onEditList(list)}
                  disabled={saving}
                  title="Edit"
                >
                  <i className="fas fa-edit" />
                </button>
                <button
                  className="list-action-btn list-action-btn-delete"
                  onClick={() => handleDeleteList(list.id)}
                  disabled={saving}
                  title="Delete"
                >
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          ))}

          {/* Empty state for regular lists */}
          {lists.length === 0 && (
            <div className="board-settings-empty">
              No custom lists. Click "Add List" to create one.
            </div>
          )}

          {/* Closed list (bottom) */}
          <div className={`board-settings-list-item board-settings-list-special${showClosed ? '' : ' board-settings-list-disabled'}`}>
            <div className="list-item-toggle">
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(e) => setShowClosed(e.target.checked)}
                disabled={saving}
              />
            </div>
            <div className="list-item-info">
              <span className="list-item-name">Closed</span>
              <span className="list-item-labels">Closed issues</span>
            </div>
            {showClosed && (
              <div className="list-item-sort">
                <select
                  className="list-item-sort-select"
                  value={closedSortBy}
                  onChange={(e) => setClosedSortBy(e.target.value)}
                  disabled={saving}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  className="list-item-sort-select"
                  value={closedSortOrder}
                  onChange={(e) => setClosedSortOrder(e.target.value)}
                  disabled={saving}
                >
                  {SORT_ORDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseDialog>
  );
}
