/**
 * BlueprintManager
 *
 * Blueprint 管理面板，支援查看、重命名、刪除 Blueprint
 */

import { useState, useCallback, useRef } from 'react';
import './BlueprintManager.css';
import './shared/modal-close-button.css';
import { ConfirmDialog } from './shared/dialogs/ConfirmDialog';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否開啟
 * @param {Function} props.onClose - 關閉回調
 * @param {Array} props.blueprints - Blueprint 列表
 * @param {boolean} props.loading - 是否載入中
 * @param {Function} props.onDelete - 刪除回調 (blueprintId, storageType) => Promise<void>
 * @param {Function} props.onRename - 重命名回調 (blueprintId, newName, storageType) => Promise<void>
 * @param {Function} props.onApply - 套用回調 (blueprint) => void
 */
export function BlueprintManager({
  isOpen,
  onClose,
  blueprints,
  loading,
  onDelete,
  onRename,
  onApply,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [blueprintToDelete, setBlueprintToDelete] = useState(null);

  // 用於追蹤 mousedown 是否發生在 overlay 上，避免拖曳選取文字時意外關閉
  const mouseDownOnOverlay = useRef(false);

  // 開始編輯
  const startEditing = useCallback((blueprint) => {
    setEditingId(blueprint.id);
    setEditName(blueprint.name);
  }, []);

  // 取消編輯
  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditName('');
  }, []);

  // 儲存重命名
  const saveRename = useCallback(
    async (blueprint) => {
      if (!editName.trim() || editName.trim() === blueprint.name) {
        cancelEditing();
        return;
      }

      try {
        await onRename(blueprint.id, editName.trim(), blueprint.storage_type);
        cancelEditing();
      } catch (err) {
        console.error('[BlueprintManager] Rename failed:', err);
      }
    },
    [editName, onRename, cancelEditing],
  );

  // 開啟刪除確認對話框
  const handleDelete = useCallback(
    (blueprint) => {
      if (deletingId) return;
      setBlueprintToDelete(blueprint);
      setDeleteConfirmOpen(true);
    },
    [deletingId],
  );

  // 確認刪除
  const confirmDelete = useCallback(async () => {
    if (!blueprintToDelete) return;

    setDeletingId(blueprintToDelete.id);
    setDeleteConfirmOpen(false);

    try {
      await onDelete(blueprintToDelete.id, blueprintToDelete.storage_type);
    } catch (err) {
      console.error('[BlueprintManager] Delete failed:', err);
    } finally {
      setDeletingId(null);
      setBlueprintToDelete(null);
    }
  }, [blueprintToDelete, onDelete]);

  // 展開/收合詳情
  const toggleExpand = useCallback((blueprintId) => {
    setExpandedId((prev) => (prev === blueprintId ? null : blueprintId));
  }, []);

  // 格式化日期
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Overlay 點擊處理：只有 mousedown 和 mouseup 都在 overlay 上時才關閉
  const handleOverlayMouseDown = useCallback((e) => {
    if (e.target === e.currentTarget) {
      mouseDownOnOverlay.current = true;
    }
  }, []);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && mouseDownOnOverlay.current) {
        onClose();
      }
      mouseDownOnOverlay.current = false;
    },
    [onClose],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="blueprint-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div
        className="blueprint-modal blueprint-manager-modal"
        onMouseDown={(e) => {
          mouseDownOnOverlay.current = false;
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h3>Blueprints</h3>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <i className="fas fa-spinner fa-spin" />
              <span>Loading blueprints...</span>
            </div>
          ) : blueprints.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-layer-group" />
              <p>No blueprints yet</p>
              <span className="hint">
                Right-click a Milestone and select "Save as Blueprint" to create
                one.
              </span>
            </div>
          ) : (
            <div className="blueprint-list">
              {blueprints.map((blueprint) => (
                <div
                  key={blueprint.id}
                  className={`blueprint-item ${expandedId === blueprint.id ? 'expanded' : ''}`}
                >
                  {/* Main row */}
                  <div className="blueprint-main">
                    {/* Expand button */}
                    <button
                      className="expand-btn"
                      onClick={() => toggleExpand(blueprint.id)}
                      title={
                        expandedId === blueprint.id ? 'Collapse' : 'Expand'
                      }
                    >
                      <i
                        className={
                          expandedId === blueprint.id
                            ? 'fas fa-chevron-down'
                            : 'fas fa-chevron-right'
                        }
                      />
                    </button>

                    {/* Name */}
                    <div className="blueprint-info">
                      {editingId === blueprint.id ? (
                        <input
                          type="text"
                          className="edit-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => saveRename(blueprint)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(blueprint);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="blueprint-name">
                            {blueprint.name}
                          </span>
                          <span className="blueprint-meta">
                            {blueprint.items.length} items ·{' '}
                            {formatDate(blueprint.created_at)}
                            {blueprint.storage_type === 'snippet' && (
                              <span className="storage-badge shared">
                                Shared
                              </span>
                            )}
                            {blueprint.storage_type === 'localStorage' && (
                              <span className="storage-badge local">Local</span>
                            )}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="blueprint-actions">
                      <button
                        className="action-btn"
                        onClick={() => onApply(blueprint)}
                        title="Apply this blueprint"
                      >
                        <i className="fas fa-paste" />
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => startEditing(blueprint)}
                        title="Rename"
                        disabled={editingId !== null}
                      >
                        <i className="fas fa-pencil-alt" />
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDelete(blueprint)}
                        title="Delete"
                        disabled={deletingId === blueprint.id}
                      >
                        {deletingId === blueprint.id ? (
                          <i className="fas fa-spinner fa-spin" />
                        ) : (
                          <i className="fas fa-trash" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedId === blueprint.id && (
                    <div className="blueprint-details">
                      <div className="detail-section">
                        <span className="detail-label">Milestone:</span>
                        <span className="detail-value">
                          {blueprint.milestone.title}
                        </span>
                      </div>
                      {blueprint.milestone.description && (
                        <div className="detail-section">
                          <span className="detail-label">Description:</span>
                          <span className="detail-value description">
                            {blueprint.milestone.description}
                          </span>
                        </div>
                      )}
                      <div className="detail-section">
                        <span className="detail-label">Items:</span>
                        <div className="items-preview">
                          {blueprint.items.slice(0, 5).map((item) => (
                            <div key={item.iid} className="item-row">
                              <i
                                className={
                                  item.issue_type === 'Task'
                                    ? 'fas fa-check'
                                    : 'fas fa-file'
                                }
                              />
                              <span className="item-title">{item.title}</span>
                              {item.start_offset !== null && (
                                <span className="item-offset">
                                  Day {item.start_offset + 1}
                                  {item.workdays && ` (${item.workdays}d)`}
                                </span>
                              )}
                            </div>
                          ))}
                          {blueprint.items.length > 5 && (
                            <div className="items-more">
                              +{blueprint.items.length - 5} more items
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setBlueprintToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Blueprint"
        message={`Are you sure you want to delete "${blueprintToDelete?.name}"?`}
        severity="danger"
        confirmLabel="Delete"
      />
    </div>
  );
}

export default BlueprintManager;
