/**
 * Filter Preset Selector Component
 * Provides dropdown for selecting, creating, and managing filter presets
 */

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Check if two filter objects are equal
 */
function areFiltersEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    const valA = a[key];
    const valB = b[key];

    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (valA.length !== valB.length) return false;
      if (!valA.every((v, i) => v === valB[i])) return false;
    } else if (valA !== valB) {
      return false;
    }
  }

  return true;
}

/**
 * Check if filters have any active values
 */
function hasActiveFilters(filters) {
  if (!filters) return false;
  return (
    (filters.milestoneIds?.length > 0) ||
    (filters.epicIds?.length > 0) ||
    (filters.labels?.length > 0) ||
    (filters.assignees?.length > 0) ||
    (filters.states?.length > 0) ||
    (filters.search?.length > 0)
  );
}

export function FilterPresetSelector({
  presets,
  currentFilters,
  loading,
  saving,
  canEdit,
  onSelectPreset,
  onCreatePreset,
  onRenamePreset,
  onDeletePreset,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const menuButtonRefs = useRef({});

  // Find if current filters match any preset
  const matchingPreset = presets?.find(p => areFiltersEqual(p.filters, currentFilters));

  // Get active preset for menu actions
  const activePreset = activeMenuId ? presets?.find(p => p.id === activeMenuId) : null;

  // Close dropdown and menu when clicking outside
  useEffect(() => {
    if (!isOpen && !activeMenuId) return;

    const handleClickOutside = (e) => {
      // Check if click is inside dropdown
      const isInsideDropdown = dropdownRef.current?.contains(e.target);
      // Check if click is inside fixed menu
      const isInsideMenu = menuRef.current?.contains(e.target);

      if (!isInsideDropdown && !isInsideMenu) {
        setIsOpen(false);
        setActiveMenuId(null);
      } else if (isInsideDropdown && !isInsideMenu && activeMenuId) {
        // Click inside dropdown but outside menu - close only menu
        setActiveMenuId(null);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, activeMenuId]);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
    setActiveMenuId(null);
  }, []);

  const handleSelectPreset = useCallback((preset) => {
    onSelectPreset(preset.filters);
    setIsOpen(false);
  }, [onSelectPreset]);

  const handleOpenCreateDialog = useCallback(() => {
    setNewPresetName('');
    setShowCreateDialog(true);
    setIsOpen(false);
  }, []);

  const handleCreatePreset = useCallback(async () => {
    if (!newPresetName.trim()) return;
    await onCreatePreset(newPresetName.trim());
    setShowCreateDialog(false);
    setNewPresetName('');
  }, [newPresetName, onCreatePreset]);

  const handleOpenRenameDialog = useCallback((preset) => {
    setRenameTarget(preset);
    setNewPresetName(preset.name);
    setShowRenameDialog(true);
    setActiveMenuId(null);
  }, []);

  const handleRenamePreset = useCallback(async () => {
    if (!newPresetName.trim() || !renameTarget) return;
    await onRenamePreset(renameTarget.id, newPresetName.trim());
    setShowRenameDialog(false);
    setRenameTarget(null);
    setNewPresetName('');
  }, [newPresetName, renameTarget, onRenamePreset]);

  const handleDeletePreset = useCallback(async (preset) => {
    if (window.confirm(`Delete preset "${preset.name}"?`)) {
      await onDeletePreset(preset.id);
    }
    setActiveMenuId(null);
  }, [onDeletePreset]);

  const handleMenuToggle = useCallback((e, presetId) => {
    e.stopPropagation();
    if (activeMenuId === presetId) {
      setActiveMenuId(null);
    } else {
      // Calculate position based on button location
      const button = menuButtonRefs.current[presetId];
      if (button) {
        const rect = button.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 2,
          right: window.innerWidth - rect.right,
        });
      }
      setActiveMenuId(presetId);
    }
  }, [activeMenuId]);

  const canSaveCurrentFilters = hasActiveFilters(currentFilters) && !matchingPreset;

  return (
    <div className="filter-preset-container" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="btn-filter-preset"
        title="Filter Presets"
        disabled={loading}
      >
        <i className="fas fa-bookmark"></i>
        {matchingPreset && <span className="preset-name">{matchingPreset.name}</span>}
        {saving && <i className="fas fa-spinner fa-spin" style={{ marginLeft: 4 }}></i>}
      </button>

      {isOpen && (
        <div className="filter-preset-dropdown">
          <div className="preset-header">Presets</div>

          {loading ? (
            <div className="preset-loading">
              <i className="fas fa-spinner fa-spin"></i> Loading...
            </div>
          ) : (
            <>
              {presets && presets.length > 0 ? (
                <div className="preset-list">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`preset-item ${matchingPreset?.id === preset.id ? 'active' : ''}`}
                    >
                      <button
                        className="preset-select-btn"
                        onClick={() => handleSelectPreset(preset)}
                        title={preset.name}
                      >
                        <span className="preset-item-name">{preset.name}</span>
                        {matchingPreset?.id === preset.id && (
                          <i className="fas fa-check" style={{ color: '#28a745' }}></i>
                        )}
                      </button>

                      {canEdit && (
                        <button
                          ref={(el) => { menuButtonRefs.current[preset.id] = el; }}
                          className="preset-menu-btn"
                          onClick={(e) => handleMenuToggle(e, preset.id)}
                          title="More options"
                        >
                          <i className="fas fa-ellipsis-v"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="preset-empty">No presets saved</div>
              )}

              {canEdit && (
                <div className="preset-actions">
                  <button
                    className="btn-save-preset"
                    onClick={handleOpenCreateDialog}
                    disabled={!canSaveCurrentFilters}
                    title={canSaveCurrentFilters ? 'Save current filters as preset' : 'No active filters to save'}
                  >
                    <i className="fas fa-plus"></i> Save Current Filters
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Fixed position menu - rendered outside dropdown to avoid overflow clipping */}
      {activePreset && (
        <div
          ref={menuRef}
          className="preset-menu-fixed"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            right: menuPosition.right,
            zIndex: 2000,
          }}
        >
          <button onClick={() => handleOpenRenameDialog(activePreset)}>
            <i className="fas fa-edit"></i> Rename
          </button>
          <button onClick={() => handleDeletePreset(activePreset)} className="delete">
            <i className="fas fa-trash"></i> Delete
          </button>
        </div>
      )}

      {/* Create Preset Dialog */}
      {showCreateDialog && (
        <div className="preset-dialog-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="preset-dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">Save Filter Preset</div>
            <div className="dialog-body">
              <label>Preset Name</label>
              <input
                type="text"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                placeholder="Enter preset name..."
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreatePreset();
                  if (e.key === 'Escape') setShowCreateDialog(false);
                }}
              />
            </div>
            <div className="dialog-footer">
              <button className="btn-cancel" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleCreatePreset}
                disabled={!newPresetName.trim() || saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Preset Dialog */}
      {showRenameDialog && (
        <div className="preset-dialog-overlay" onClick={() => setShowRenameDialog(false)}>
          <div className="preset-dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">Rename Preset</div>
            <div className="dialog-body">
              <label>New Name</label>
              <input
                type="text"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                placeholder="Enter new name..."
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenamePreset();
                  if (e.key === 'Escape') setShowRenameDialog(false);
                }}
              />
            </div>
            <div className="dialog-footer">
              <button className="btn-cancel" onClick={() => setShowRenameDialog(false)}>
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleRenamePreset}
                disabled={!newPresetName.trim() || saving}
              >
                {saving ? 'Saving...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .filter-preset-container {
          position: relative;
          display: inline-block;
        }

        .btn-filter-preset {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: none;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          font-size: 13px;
          color: var(--wx-gitlab-filter-text);
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }

        .btn-filter-preset:hover:not(:disabled) {
          background: var(--wx-gitlab-filter-hover-background);
          border-color: var(--wx-gitlab-control-text);
        }

        .btn-filter-preset:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-filter-preset .preset-name {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .filter-preset-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          min-width: 220px;
          max-width: 280px;
          background: var(--wx-gitlab-filter-input-background);
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          overflow: hidden;
        }

        .preset-header {
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--wx-gitlab-control-text);
          border-bottom: 1px solid var(--wx-gitlab-filter-input-border);
          background: var(--wx-gitlab-filter-hover-background);
        }

        .preset-loading {
          padding: 16px;
          text-align: center;
          color: var(--wx-gitlab-control-text);
          font-size: 13px;
        }

        .preset-empty {
          padding: 16px;
          text-align: center;
          color: var(--wx-gitlab-control-text);
          font-size: 13px;
          font-style: italic;
        }

        .preset-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .preset-item {
          display: flex;
          align-items: center;
          padding: 0 4px 0 0;
          border-bottom: 1px solid var(--wx-gitlab-filter-input-border);
        }

        .preset-item:last-child {
          border-bottom: none;
        }

        .preset-item.active {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .preset-select-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 12px;
          background: none;
          border: none;
          font-size: 13px;
          color: var(--wx-gitlab-filter-text);
          cursor: pointer;
          text-align: left;
        }

        .preset-select-btn:hover {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .preset-item-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .preset-menu-btn {
          padding: 6px 8px;
          background: none;
          border: none;
          color: var(--wx-gitlab-control-text);
          cursor: pointer;
          border-radius: 4px;
        }

        .preset-menu-btn:hover {
          background: var(--wx-gitlab-filter-hover-background);
          color: var(--wx-gitlab-filter-text);
        }

        .preset-menu-fixed {
          background: var(--wx-gitlab-filter-input-background);
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          overflow: hidden;
        }

        .preset-menu-fixed button {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          background: none;
          border: none;
          font-size: 13px;
          color: var(--wx-gitlab-filter-text);
          cursor: pointer;
          white-space: nowrap;
        }

        .preset-menu-fixed button:hover {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .preset-menu-fixed button.delete {
          color: #dc3545;
        }

        .preset-menu-fixed button.delete:hover {
          background: rgba(220, 53, 69, 0.1);
        }

        .preset-actions {
          padding: 8px;
          border-top: 1px solid var(--wx-gitlab-filter-input-border);
        }

        .btn-save-preset {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 8px 12px;
          background: #1f75cb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-save-preset:hover:not(:disabled) {
          background: #1a65b3;
        }

        .btn-save-preset:disabled {
          background: var(--wx-gitlab-control-background);
          color: var(--wx-gitlab-control-text);
          cursor: not-allowed;
        }

        /* Dialog Overlay */
        .preset-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .preset-dialog {
          background: var(--wx-gitlab-filter-input-background);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          width: 320px;
          max-width: 90vw;
        }

        .dialog-header {
          padding: 16px;
          font-size: 16px;
          font-weight: 600;
          color: var(--wx-gitlab-filter-text);
          border-bottom: 1px solid var(--wx-gitlab-filter-input-border);
        }

        .dialog-body {
          padding: 16px;
        }

        .dialog-body label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          color: var(--wx-gitlab-control-text);
        }

        .dialog-body input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-background);
          color: var(--wx-gitlab-filter-text);
          font-size: 14px;
        }

        .dialog-body input:focus {
          outline: none;
          border-color: #1f75cb;
        }

        .dialog-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid var(--wx-gitlab-filter-input-border);
        }

        .btn-cancel {
          padding: 8px 16px;
          background: none;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          font-size: 13px;
          color: var(--wx-gitlab-filter-text);
          cursor: pointer;
        }

        .btn-cancel:hover {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .btn-save {
          padding: 8px 16px;
          background: #1f75cb;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          color: white;
          cursor: pointer;
        }

        .btn-save:hover:not(:disabled) {
          background: #1a65b3;
        }

        .btn-save:disabled {
          background: var(--wx-gitlab-control-background);
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default FilterPresetSelector;
