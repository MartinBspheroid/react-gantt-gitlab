// @ts-nocheck
/**
 * Filter Preset Selector Component
 * Provides dropdown for selecting, creating, and managing filter presets
 * Features: Search, folder structure (using "/" delimiter), override save
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Toast } from './Toast.tsx';
import { ConfirmDialog } from './shared/dialogs/ConfirmDialog';
import './FilterPresetSelector.css';

/**
 * Simple dialog component for preset name input
 */
function PresetDialog({
  title,
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  saving,
  hint,
}) {
  return (
    <div className="preset-dialog-overlay" onClick={onCancel}>
      <div className="preset-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">{title}</div>
        <div className="dialog-body">
          <label>{label}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit();
              if (e.key === 'Escape') onCancel();
            }}
          />
          {hint && <div className="dialog-hint">{hint}</div>}
        </div>
        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-save"
            onClick={onSubmit}
            disabled={!value.trim() || saving}
          >
            {saving ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Parse preset name into folder path and display name
 * e.g., "ui/design/dark" -> { folders: ["ui", "design"], name: "dark" }
 */
function parsePresetPath(fullName) {
  const parts = fullName
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return { folders: [], name: fullName };
  }
  return {
    folders: parts.slice(0, -1),
    name: parts[parts.length - 1],
  };
}

/**
 * Build a tree structure from flat preset list
 * Handles case where a preset name matches a folder name (e.g., "unovel" when "unovel/xxx" exists)
 */
function buildPresetTree(presets) {
  const root = { folders: {}, presets: [] };

  // First pass: identify all folder names
  const folderNames = new Set();
  presets.forEach((preset) => {
    const { folders } = parsePresetPath(preset.name);
    if (folders.length > 0) {
      // Add top-level folder name
      folderNames.add(folders[0]);
    }
  });

  // Second pass: build the tree
  presets.forEach((preset) => {
    const { folders, name } = parsePresetPath(preset.name);

    // If this preset has no folder path but its name matches a folder name,
    // treat it as a special "root" preset inside that folder
    if (folders.length === 0 && folderNames.has(preset.name)) {
      // Ensure the folder exists
      if (!root.folders[preset.name]) {
        root.folders[preset.name] = { folders: {}, presets: [] };
      }
      // Add as a special root item with a distinctive display name
      root.folders[preset.name].presets.unshift({
        ...preset,
        displayName: `${preset.name}`,
        isRootPreset: true, // Mark as root preset for styling
      });
      return;
    }

    let current = root;
    folders.forEach((folderName) => {
      if (!current.folders[folderName]) {
        current.folders[folderName] = { folders: {}, presets: [] };
      }
      current = current.folders[folderName];
    });

    current.presets.push({ ...preset, displayName: name });
  });

  return root;
}

/**
 * Check if two filter objects are equal (shallow comparison for arrays, deep for values)
 */
function areFiltersEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  // Compare all known filter keys
  const filterKeys = [
    'milestoneIds',
    'epicIds',
    'labels',
    'assignees',
    'states',
    'search',
  ];

  for (const key of filterKeys) {
    const valA = a[key];
    const valB = b[key];

    // Handle arrays
    if (Array.isArray(valA) || Array.isArray(valB)) {
      const arrA = valA || [];
      const arrB = valB || [];
      if (arrA.length !== arrB.length) return false;
      if (!arrA.every((v, i) => v === arrB[i])) return false;
    } else if ((valA || '') !== (valB || '')) {
      // Handle strings (search field) - treat undefined/null as empty string
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
    filters.milestoneIds?.length > 0 ||
    filters.epicIds?.length > 0 ||
    filters.labels?.length > 0 ||
    filters.assignees?.length > 0 ||
    filters.states?.length > 0 ||
    filters.search?.length > 0
  );
}

/**
 * Folder component for tree view
 */
function PresetFolder({
  name,
  node,
  level,
  matchingPresetId,
  canEdit,
  onSelectPreset,
  onMenuToggle,
  menuButtonRefs,
  searchQuery,
  expandedFolders,
  toggleFolder,
}) {
  const folderPath = name;
  const isExpanded = expandedFolders.has(folderPath);
  const hasContent =
    Object.keys(node.folders).length > 0 || node.presets.length > 0;

  // Filter presets based on search
  const filteredPresets = searchQuery
    ? node.presets.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : node.presets;

  // Check if any child matches search (for folders)
  const hasMatchingChildren = searchQuery
    ? filteredPresets.length > 0 ||
      Object.entries(node.folders).some(([_key, childNode]) =>
        childNode.presets.some((p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      )
    : true;

  if (!hasContent || (searchQuery && !hasMatchingChildren)) return null;

  return (
    <div className="preset-folder">
      <button
        className="preset-folder-header"
        onClick={() => toggleFolder(folderPath)}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <i
          className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} folder-arrow`}
        ></i>
        <i className="fas fa-folder folder-icon"></i>
        <span className="folder-name">{name}</span>
        <span className="folder-count">{node.presets.length}</span>
      </button>

      {isExpanded && (
        <div className="preset-folder-content">
          {/* Subfolders */}
          {Object.entries(node.folders).map(([subName, subNode]) => (
            <PresetFolder
              key={subName}
              name={subName}
              node={subNode}
              level={level + 1}
              matchingPresetId={matchingPresetId}
              canEdit={canEdit}
              onSelectPreset={onSelectPreset}
              onMenuToggle={onMenuToggle}
              menuButtonRefs={menuButtonRefs}
              searchQuery={searchQuery}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}

          {/* Presets in this folder */}
          {filteredPresets.map((preset) => (
            <PresetItem
              key={preset.id}
              preset={preset}
              level={level + 1}
              isActive={matchingPresetId === preset.id}
              canEdit={canEdit}
              onSelect={onSelectPreset}
              onMenuToggle={onMenuToggle}
              menuButtonRefs={menuButtonRefs}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual preset item component
 */
function PresetItem({
  preset,
  level,
  isActive,
  canEdit,
  onSelect,
  onMenuToggle,
  menuButtonRefs,
}) {
  return (
    <div className={`preset-item ${isActive ? 'active' : ''}`}>
      <button
        className="preset-select-btn"
        onClick={() => onSelect(preset)}
        title={preset.name}
        style={{ paddingLeft: `${12 + (level || 0) * 16}px` }}
      >
        <span className="preset-item-name">
          {preset.displayName || preset.name}
        </span>
        {isActive && <i className="fas fa-check preset-check"></i>}
      </button>

      {canEdit && (
        <button
          ref={(el) => {
            menuButtonRefs.current[preset.id] = el;
          }}
          className="preset-menu-btn"
          onClick={(e) => onMenuToggle(e, preset.id)}
          title="More options"
        >
          <i className="fas fa-ellipsis-v"></i>
        </button>
      )}
    </div>
  );
}

export function FilterPresetSelector({
  presets,
  currentFilters,
  currentServerFilters: _currentServerFilters,
  activeTab: _activeTab = 'client',
  loading,
  saving,
  canEdit,
  onSelectPreset,
  onCreatePreset,
  onUpdatePreset: _onUpdatePreset,
  onRenamePreset,
  onDeletePreset,
  selectedPresetId, // Explicit selected preset ID (preferred over filter matching)
  serverFilterCount = 0, // Count of active server filters (for enabling save button)
  isGroupMode = false, // Whether current config is a Group (Presets not supported)
  isDirty = false, // Whether the selected preset has been modified
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [errorMessage, setErrorMessage] = useState(null);

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const menuButtonRefs = useRef({});
  const searchInputRef = useRef(null);

  // Clear error handler
  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  // Build tree structure from presets
  const presetTree = useMemo(() => buildPresetTree(presets || []), [presets]);

  // Get root-level presets (no folder)
  const rootPresets = useMemo(() => {
    const filtered = presetTree.presets.filter(
      (p) =>
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    return filtered;
  }, [presetTree, searchQuery]);

  // Use explicit selectedPresetId if provided (including null to indicate no selection)
  // Only fall back to filter matching if selectedPresetId is undefined (not passed)
  const matchingPreset =
    selectedPresetId !== undefined
      ? selectedPresetId
        ? presets?.find((p) => p.id === selectedPresetId)
        : null
      : presets?.find((p) => areFiltersEqual(p.filters, currentFilters));

  // Get active preset for menu actions
  const activePreset = activeMenuId
    ? presets?.find((p) => p.id === activeMenuId)
    : null;

  // Toggle folder expansion
  const toggleFolder = useCallback((folderPath) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  // Expand all folders that contain the selected preset
  useEffect(() => {
    if (matchingPreset) {
      const { folders } = parsePresetPath(matchingPreset.name);
      if (folders.length > 0) {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          folders.forEach((_, idx) => {
            next.add(folders.slice(0, idx + 1).join('/'));
          });
          return next;
        });
      }
    }
  }, [matchingPreset]);

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
        setSearchQuery('');
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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    setActiveMenuId(null);
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelectPreset = useCallback(
    (preset) => {
      onSelectPreset(preset);
      setIsOpen(false);
      setSearchQuery('');
    },
    [onSelectPreset],
  );

  const handleOpenCreateDialog = useCallback(() => {
    // If a preset is selected, use its folder path as default
    if (matchingPreset) {
      const { folders } = parsePresetPath(matchingPreset.name);
      setNewPresetName(folders.length > 0 ? folders.join('/') + '/' : '');
    } else {
      setNewPresetName('');
    }
    setShowCreateDialog(true);
    setIsOpen(false);
  }, [matchingPreset]);

  const handleCreatePreset = useCallback(async () => {
    if (!newPresetName.trim()) return;
    try {
      await onCreatePreset(newPresetName.trim());
      setShowCreateDialog(false);
      setNewPresetName('');
    } catch (err) {
      const message = err?.message || 'Failed to save preset';
      setErrorMessage(
        message.includes('403')
          ? 'Permission denied: You may not have write access to this project'
          : message,
      );
      setShowCreateDialog(false);
    }
  }, [newPresetName, onCreatePreset]);

  const handleOpenRenameDialog = useCallback((preset) => {
    setRenameTarget(preset);
    setNewPresetName(preset.name);
    setShowRenameDialog(true);
    setActiveMenuId(null);
  }, []);

  const handleRenamePreset = useCallback(async () => {
    if (!newPresetName.trim() || !renameTarget) return;
    try {
      await onRenamePreset(renameTarget.id, newPresetName.trim());
      setShowRenameDialog(false);
      setRenameTarget(null);
      setNewPresetName('');
    } catch (err) {
      const message = err?.message || 'Failed to rename preset';
      setErrorMessage(
        message.includes('403')
          ? 'Permission denied: You may not have write access to this project'
          : message,
      );
      setShowRenameDialog(false);
    }
  }, [newPresetName, renameTarget, onRenamePreset]);

  const handleDeletePreset = useCallback((preset) => {
    setPresetToDelete(preset);
    setDeleteConfirmOpen(true);
    setActiveMenuId(null);
  }, []);

  const confirmDeletePreset = useCallback(async () => {
    if (!presetToDelete) return;

    try {
      await onDeletePreset(presetToDelete.id);
    } catch (err) {
      const message = err?.message || 'Failed to delete preset';
      setErrorMessage(
        message.includes('403')
          ? 'Permission denied: You may not have write access to this project'
          : message,
      );
    }

    setDeleteConfirmOpen(false);
    setPresetToDelete(null);
  }, [presetToDelete, onDeletePreset]);

  const handleMenuToggle = useCallback(
    (e, presetId) => {
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
    },
    [activeMenuId],
  );

  // Can save if there are active client filters OR server filters, and no preset currently matches
  const canSaveCurrentFilters =
    (hasActiveFilters(currentFilters) || serverFilterCount > 0) &&
    !matchingPreset;

  // Get display name for the selected preset
  const selectedDisplayName = matchingPreset
    ? parsePresetPath(matchingPreset.name).name
    : null;

  return (
    <div className="filter-preset-container" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={`btn-filter-preset ${matchingPreset ? 'has-preset' : ''}`}
        title={matchingPreset ? matchingPreset.name : 'Filter Presets'}
        disabled={loading}
      >
        <i className="fas fa-bookmark"></i>
        {matchingPreset && (
          <span className="preset-name">{selectedDisplayName}</span>
        )}
        {saving && <i className="fas fa-spinner fa-spin preset-spinner"></i>}
        <i
          className={`fas fa-chevron-${isOpen ? 'up' : 'down'} preset-chevron`}
        ></i>
      </button>

      {/* Error Toast - rendered via portal */}
      {errorMessage && (
        <Toast
          message={errorMessage}
          type="error"
          onClose={clearError}
          duration={5000}
          position="top-right"
        />
      )}

      {isOpen && (
        <div className="filter-preset-dropdown">
          {/* Search Input */}
          <div className="preset-search">
            <i className="fas fa-search search-icon"></i>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search presets..."
              className="preset-search-input"
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => setSearchQuery('')}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>

          {loading ? (
            <div className="preset-loading">
              <i className="fas fa-spinner fa-spin"></i> Loading...
            </div>
          ) : (
            <>
              {presets && presets.length > 0 ? (
                <div className="preset-list">
                  {/* Folders */}
                  {Object.entries(presetTree.folders).map(
                    ([folderName, node]) => (
                      <PresetFolder
                        key={folderName}
                        name={folderName}
                        node={node}
                        level={0}
                        matchingPresetId={matchingPreset?.id}
                        canEdit={canEdit}
                        onSelectPreset={handleSelectPreset}
                        onMenuToggle={handleMenuToggle}
                        menuButtonRefs={menuButtonRefs}
                        searchQuery={searchQuery}
                        expandedFolders={expandedFolders}
                        toggleFolder={toggleFolder}
                      />
                    ),
                  )}

                  {/* Root-level presets */}
                  {rootPresets.map((preset) => (
                    <PresetItem
                      key={preset.id}
                      preset={preset}
                      level={0}
                      isActive={matchingPreset?.id === preset.id}
                      canEdit={canEdit}
                      onSelect={handleSelectPreset}
                      onMenuToggle={handleMenuToggle}
                      menuButtonRefs={menuButtonRefs}
                    />
                  ))}

                  {/* No results message */}
                  {searchQuery &&
                    rootPresets.length === 0 &&
                    Object.keys(presetTree.folders).length === 0 && (
                      <div className="preset-empty">
                        No presets match "{searchQuery}"
                      </div>
                    )}
                </div>
              ) : (
                <div className="preset-empty">No presets saved</div>
              )}

              {canEdit ? (
                <div className="preset-actions">
                  <button
                    className="btn-save-preset"
                    onClick={handleOpenCreateDialog}
                    disabled={!canSaveCurrentFilters && !isDirty}
                    title={
                      canSaveCurrentFilters
                        ? 'Save current filters as new preset'
                        : isDirty
                          ? 'Save modified filters as new preset'
                          : 'No active filters to save'
                    }
                  >
                    <i className="fas fa-plus"></i> Save as New Preset
                  </button>
                </div>
              ) : (
                <div className="preset-permission-notice">
                  <i className="fas fa-lock"></i>
                  <span>
                    {isGroupMode
                      ? 'Filter Presets not available for Groups'
                      : 'Create Snippet permission required to save presets'}
                  </span>
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
          <button
            onClick={() => handleDeletePreset(activePreset)}
            className="delete"
          >
            <i className="fas fa-trash"></i> Delete
          </button>
        </div>
      )}

      {/* Create Preset Dialog */}
      {showCreateDialog && (
        <PresetDialog
          title="Save Filter Preset"
          label="Preset Name"
          placeholder="e.g., ui/design/dark-theme"
          value={newPresetName}
          onChange={setNewPresetName}
          onSubmit={handleCreatePreset}
          onCancel={() => setShowCreateDialog(false)}
          submitLabel="Save"
          saving={saving}
          hint="Use '/' to organize into folders (e.g., ui/buttons)"
        />
      )}

      {/* Rename Preset Dialog */}
      {showRenameDialog && (
        <PresetDialog
          title="Rename Preset"
          label="New Name"
          placeholder="e.g., ui/design/light-theme"
          value={newPresetName}
          onChange={setNewPresetName}
          onSubmit={handleRenamePreset}
          onCancel={() => setShowRenameDialog(false)}
          submitLabel="Rename"
          saving={saving}
          hint="Use '/' to organize into folders"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setPresetToDelete(null);
        }}
        onConfirm={confirmDeletePreset}
        title="Delete Preset"
        message={`Are you sure you want to delete "${presetToDelete?.name}"?`}
        severity="danger"
        confirmLabel="Delete"
      />
    </div>
  );
}

export default FilterPresetSelector;
