/**
 * SaveBlueprintModal
 *
 * 將 Milestone 儲存為 Blueprint 的對話框
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
// Stub functions for blueprint creation (provider-specific implementations removed)
function createBlueprintFromMilestone() {
  return { name: '', items: [], links: [] };
}
function getBlueprintPreview() {
  return { issueCount: 0, taskCount: 0, linkCount: 0, items: [] };
}
import './SaveBlueprintModal.css';
import './shared/modal-close-button.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否開啟
 * @param {Function} props.onClose - 關閉回調
 * @param {Object} props.milestoneTask - 選中的 Milestone 任務
 * @param {Array} props.allTasks - 所有任務
 * @param {Array} props.allLinks - 所有連結
 * @param {Array} props.holidays - 假日列表
 * @param {Array} props.workdays - 補班日列表
 * @param {Function} props.onSave - 儲存回調 (blueprint) => Promise<void>
 * @param {boolean} props.canUseSnippet - 是否可以使用 Snippet 儲存
 */
export function SaveBlueprintModal({
  isOpen,
  onClose,
  milestoneTask,
  allTasks,
  allLinks,
  holidays,
  workdays,
  onSave,
  canUseSnippet,
}) {
  const [blueprintName, setBlueprintName] = useState('');
  const [storageType, setStorageType] = useState('localStorage');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // 用於追蹤 mousedown 是否發生在 overlay 上，避免拖曳選取文字時意外關閉
  const mouseDownOnOverlay = useRef(false);

  // 初始化名稱為 Milestone 標題
  useEffect(() => {
    if (isOpen && milestoneTask) {
      setBlueprintName(milestoneTask.text || '');
      setStorageType('localStorage');
      setError(null);
    }
  }, [isOpen, milestoneTask]);

  // 預覽資訊
  const preview = useMemo(() => {
    if (!milestoneTask || !allTasks) {
      return { issueCount: 0, taskCount: 0, linkCount: 0, items: [] };
    }
    return getBlueprintPreview(milestoneTask, allTasks, allLinks || []);
  }, [milestoneTask, allTasks, allLinks]);

  // 儲存處理
  const handleSave = useCallback(async () => {
    if (!blueprintName.trim()) {
      setError('Please enter a blueprint name');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const blueprint = createBlueprintFromMilestone(
        milestoneTask,
        allTasks,
        allLinks || [],
        holidays || [],
        workdays || [],
        blueprintName.trim(),
        storageType,
      );

      await onSave(blueprint);
      onClose();
    } catch (err) {
      console.error('[SaveBlueprintModal] Save failed:', err);
      setError(err.message || 'Failed to save blueprint');
    } finally {
      setSaving(false);
    }
  }, [
    blueprintName,
    milestoneTask,
    allTasks,
    allLinks,
    holidays,
    workdays,
    storageType,
    onSave,
    onClose,
  ]);

  // 鍵盤事件
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !saving && blueprintName.trim()) {
        handleSave();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSave, onClose, saving, blueprintName],
  );

  // Overlay 點擊處理：只有 mousedown 和 mouseup 都在 overlay 上時才關閉
  const handleOverlayMouseDown = useCallback((e) => {
    // 只有直接點擊 overlay 時才標記
    if (e.target === e.currentTarget) {
      mouseDownOnOverlay.current = true;
    }
  }, []);

  const handleOverlayClick = useCallback(
    (e) => {
      // 只有 mousedown 和 click 都在 overlay 上時才關閉
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
        className="blueprint-modal"
        onMouseDown={() => {
          mouseDownOnOverlay.current = false;
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <header className="modal-header">
          <h3>Save as Blueprint</h3>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            &times;
          </button>
        </header>

        {/* Body */}
        <section className="modal-body">
          {/* Blueprint Name */}
          <div className="form-group">
            <label htmlFor="blueprint-name">Blueprint Name</label>
            <input
              id="blueprint-name"
              type="text"
              value={blueprintName}
              onChange={(e) => setBlueprintName(e.target.value)}
              placeholder="Enter blueprint name"
              autoFocus
            />
          </div>

          {/* Storage Type */}
          <div className="form-group">
            <label>Storage Location</label>
            <div className="storage-options">
              <label className="storage-option">
                <input
                  type="radio"
                  name="storage-type"
                  value="localStorage"
                  checked={storageType === 'localStorage'}
                  onChange={() => setStorageType('localStorage')}
                />
                <div className="option-content">
                  <span className="option-title">Local Storage</span>
                  <span className="option-desc">
                    Personal use only, stored in browser
                  </span>
                </div>
              </label>
              <label
                className={`storage-option ${!canUseSnippet ? 'disabled' : ''}`}
              >
                <input
                  type="radio"
                  name="storage-type"
                  value="snippet"
                  checked={storageType === 'snippet'}
                  onChange={() => setStorageType('snippet')}
                  disabled={!canUseSnippet}
                />
                <div className="option-content">
                  <span className="option-title">Project Snippet</span>
                  <span className="option-desc">
                    {canUseSnippet
                      ? 'Team sharing, stored in project'
                      : 'Not available in Group mode'}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="form-group">
            <label>Preview</label>
            <div className="blueprint-preview">
              <div className="preview-header">
                <i className="fas fa-flag" />
                <span className="milestone-title">{milestoneTask?.text}</span>
              </div>
              <div className="preview-stats">
                <div className="stat">
                  <span className="stat-value">{preview.issueCount}</span>
                  <span className="stat-label">Issues</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{preview.taskCount}</span>
                  <span className="stat-label">Tasks</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{preview.linkCount}</span>
                  <span className="stat-label">Links</span>
                </div>
              </div>
              {preview.items.length > 0 && (
                <div className="preview-items">
                  {preview.items.slice(0, 5).map((item, index) => (
                    <div key={index} className="preview-item">
                      <i
                        className={
                          item.type === 'Task' ? 'fas fa-check' : 'fas fa-file'
                        }
                      />
                      <span className="item-title">{item.title}</span>
                      <span className="item-type">{item.type}</span>
                    </div>
                  ))}
                  {preview.items.length > 5 && (
                    <div className="preview-more">
                      +{preview.items.length - 5} more items
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && <div className="error-message">{error}</div>}
        </section>

        {/* Footer */}
        <footer className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !blueprintName.trim()}
          >
            {saving ? 'Saving...' : 'Save Blueprint'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default SaveBlueprintModal;
