// @ts-nocheck
/**
 * ListEditDialog Component
 *
 * Dialog for creating or editing a list within a board.
 * Uses BaseDialog for consistent modal behavior.
 * - List name (optional, auto-generated from labels)
 * - Label selection (multi-select using FilterMultiSelect)
 * - Display sort settings
 */

import { useState, useEffect, useMemo } from 'react';
import { BaseDialog } from '../shared/dialogs/BaseDialog';
import { FilterMultiSelect } from '../FilterMultiSelect';
import { SORT_OPTIONS, SORT_ORDER_OPTIONS } from './constants';
import './ListEditDialog.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dialog is visible
 * @param {import('../../types/issueBoard').IssueBoardList | null} props.list - List to edit (null for new)
 * @param {Array<{title: string, color?: string}>} props.availableLabels - List of available labels with colors
 * @param {function} props.onClose - Callback to close dialog
 * @param {function} props.onSave - Callback when changes are saved (listData) => void
 * @param {boolean} props.saving - Whether a save operation is in progress
 */
export function ListEditDialog({
  isOpen,
  list,
  availableLabels = [],
  onClose,
  onSave,
  saving = false,
}) {
  const [name, setName] = useState('');
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [sortBy, setSortBy] = useState('position');
  const [sortOrder, setSortOrder] = useState('asc');

  const isNewList = !list;

  // Sync state with list prop
  useEffect(() => {
    if (list) {
      setName(list.name);
      setSelectedLabels([...list.labels]);
      setSortBy(list.sortBy);
      setSortOrder(list.sortOrder);
    } else {
      setName('');
      setSelectedLabels([]);
      setSortBy('position');
      setSortOrder('asc');
    }
  }, [list, isOpen]);

  // Convert availableLabels to FilterMultiSelect options format
  const labelOptions = useMemo(() => {
    return availableLabels.map((label) => ({
      value: typeof label === 'string' ? label : label.title || label.name,
      label: typeof label === 'string' ? label : label.title || label.name,
      color: typeof label === 'string' ? undefined : label.color,
    }));
  }, [availableLabels]);

  // Generate default name from selected labels
  const getDefaultName = () => {
    if (selectedLabels.length === 0) return 'Untitled List';
    if (selectedLabels.length <= 3) return selectedLabels.join(' + ');
    return `${selectedLabels.slice(0, 2).join(' + ')} +${selectedLabels.length - 2}`;
  };

  const handleSave = () => {
    // Use custom name if provided, otherwise generate from labels
    const finalName = name.trim() || getDefaultName();

    const listData = {
      id: list?.id || '', // Will be generated if new
      name: finalName,
      labels: selectedLabels,
      sortBy,
      sortOrder,
    };

    onSave(listData);
  };

  const footer = (
    <>
      <button
        className="dialog-btn dialog-btn-secondary"
        onClick={onClose}
        disabled={saving}
      >
        Cancel
      </button>
      <button
        className="dialog-btn dialog-btn-primary"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving...' : isNewList ? 'Add List' : 'Save Changes'}
      </button>
    </>
  );

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isNewList ? 'Add New List' : 'Edit List'}
      width={440}
      footer={footer}
      className="list-edit-dialog"
    >
      {/* Name input (optional - will use labels if empty) */}
      <div className="dialog-form-group">
        <label htmlFor="list-name">Name (optional)</label>
        <input
          id="list-name"
          type="text"
          className="dialog-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={getDefaultName()}
          disabled={saving}
        />
        <span className="dialog-hint">
          Leave empty to auto-generate from labels
        </span>
      </div>

      {/* Labels selection */}
      <div className="dialog-form-group list-edit-labels-field">
        <label>Labels (issues must have ALL selected)</label>
        <FilterMultiSelect
          title=""
          options={labelOptions}
          selected={selectedLabels}
          onChange={setSelectedLabels}
          placeholder="Search labels..."
          emptyMessage="No labels available"
          showCount={false}
        />
      </div>

      {/* Sort settings */}
      <div className="dialog-form-group">
        <label>Display Sort (visual only, does not change server order)</label>
        <div className="list-edit-sort">
          <select
            className="dialog-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            disabled={saving}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="dialog-input"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            disabled={saving}
          >
            {SORT_ORDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </BaseDialog>
  );
}
