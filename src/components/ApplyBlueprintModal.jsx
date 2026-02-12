/**
 * ApplyBlueprintModal
 *
 * 從 Blueprint 建立新 Milestone 和任務的對話框
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
// Stub functions for blueprint naming (provider-specific implementations removed)
function getNewMilestoneTitle(blueprint, options) {
  const { mode, prefix, custom_title } = options.milestone_naming || {};
  if (mode === 'custom' && custom_title) return custom_title;
  const base = blueprint?.name || 'Untitled';
  return prefix ? `${prefix}${base}` : base;
}
function getNewItemTitle(title, options, type) {
  const { add_issue_prefix, add_task_prefix, prefix } =
    options.item_naming || {};
  const shouldPrefix =
    (type === 'Issue' && add_issue_prefix) ||
    (type === 'Task' && add_task_prefix);
  return shouldPrefix && prefix ? `${prefix}${title}` : title;
}
import './ApplyBlueprintModal.css';
import './shared/modal-close-button.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否開啟
 * @param {Function} props.onClose - 關閉回調
 * @param {Array} props.blueprints - 可用的 Blueprint 列表
 * @param {Function} props.onApply - 套用回調 (blueprint, options) => Promise<ApplyBlueprintResult>
 */
export function ApplyBlueprintModal({ isOpen, onClose, blueprints, onApply }) {
  // 選擇的 Blueprint
  const [selectedBlueprintId, setSelectedBlueprintId] = useState('');

  // 起始日期
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Milestone 命名
  const [milestoneNamingMode, setMilestoneNamingMode] = useState('prefix');
  const [milestonePrefix, setMilestonePrefix] = useState('');
  const [customMilestoneTitle, setCustomMilestoneTitle] = useState('');

  // Item 命名 (分開 Issue 和 Task)
  const [addIssuePrefix, setAddIssuePrefix] = useState(true);
  const [addTaskPrefix, setAddTaskPrefix] = useState(false);
  const [itemPrefix, setItemPrefix] = useState('');

  // Labels 和 Assignees
  const [applyLabels, setApplyLabels] = useState(true);
  const [applyAssignees, setApplyAssignees] = useState(true);

  // 狀態
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // 用於追蹤 mousedown 是否發生在 overlay 上，避免拖曳選取文字時意外關閉
  const mouseDownOnOverlay = useRef(false);

  // 重置表單
  useEffect(() => {
    if (isOpen) {
      setSelectedBlueprintId(blueprints.length > 0 ? blueprints[0].id : '');
      setStartDate(new Date().toISOString().split('T')[0]);
      setMilestoneNamingMode('prefix');
      setMilestonePrefix('');
      setCustomMilestoneTitle('');
      setAddIssuePrefix(true);
      setAddTaskPrefix(false);
      setItemPrefix('');
      setApplyLabels(true);
      setApplyAssignees(true);
      setApplying(false);
      setError(null);
      setResult(null);
    }
  }, [isOpen, blueprints]);

  // 選中的 Blueprint
  const selectedBlueprint = useMemo(() => {
    return blueprints.find((bp) => bp.id === selectedBlueprintId);
  }, [blueprints, selectedBlueprintId]);

  // 預覽 Milestone 標題
  const previewMilestoneTitle = useMemo(() => {
    if (!selectedBlueprint) return '';
    const options = {
      start_date: new Date(startDate),
      milestone_naming: {
        mode: milestoneNamingMode,
        prefix: milestonePrefix,
        custom_title: customMilestoneTitle,
      },
      item_naming: {
        add_issue_prefix: addIssuePrefix,
        add_task_prefix: addTaskPrefix,
        prefix: itemPrefix,
      },
      apply_labels: applyLabels,
      apply_assignees: applyAssignees,
    };
    return getNewMilestoneTitle(selectedBlueprint, options);
  }, [
    selectedBlueprint,
    startDate,
    milestoneNamingMode,
    milestonePrefix,
    customMilestoneTitle,
    addIssuePrefix,
    addTaskPrefix,
    itemPrefix,
    applyLabels,
    applyAssignees,
  ]);

  // 預覽 Item 標題 (第一個 Issue 和第一個 Task)
  const previewIssueTitle = useMemo(() => {
    if (!selectedBlueprint) return '';
    const firstIssue = selectedBlueprint.items.find(
      (item) => item.issue_type === 'Issue',
    );
    if (!firstIssue) return '';
    const options = {
      start_date: new Date(startDate),
      milestone_naming: {
        mode: milestoneNamingMode,
        prefix: milestonePrefix,
        custom_title: customMilestoneTitle,
      },
      item_naming: {
        add_issue_prefix: addIssuePrefix,
        add_task_prefix: addTaskPrefix,
        prefix: itemPrefix,
      },
      apply_labels: applyLabels,
      apply_assignees: applyAssignees,
    };
    return getNewItemTitle(firstIssue.title, options, 'Issue');
  }, [
    selectedBlueprint,
    startDate,
    milestoneNamingMode,
    milestonePrefix,
    customMilestoneTitle,
    addIssuePrefix,
    addTaskPrefix,
    itemPrefix,
    applyLabels,
    applyAssignees,
  ]);

  const previewTaskTitle = useMemo(() => {
    if (!selectedBlueprint) return '';
    const firstTask = selectedBlueprint.items.find(
      (item) => item.issue_type === 'Task',
    );
    if (!firstTask) return '';
    const options = {
      start_date: new Date(startDate),
      milestone_naming: {
        mode: milestoneNamingMode,
        prefix: milestonePrefix,
        custom_title: customMilestoneTitle,
      },
      item_naming: {
        add_issue_prefix: addIssuePrefix,
        add_task_prefix: addTaskPrefix,
        prefix: itemPrefix,
      },
      apply_labels: applyLabels,
      apply_assignees: applyAssignees,
    };
    return getNewItemTitle(firstTask.title, options, 'Task');
  }, [
    selectedBlueprint,
    startDate,
    milestoneNamingMode,
    milestonePrefix,
    customMilestoneTitle,
    addIssuePrefix,
    addTaskPrefix,
    itemPrefix,
    applyLabels,
    applyAssignees,
  ]);

  // 套用處理
  const handleApply = useCallback(async () => {
    if (!selectedBlueprint) return;

    setApplying(true);
    setError(null);
    setResult(null);

    try {
      const options = {
        start_date: new Date(startDate),
        milestone_naming: {
          mode: milestoneNamingMode,
          prefix: milestonePrefix,
          custom_title: customMilestoneTitle,
        },
        item_naming: {
          add_issue_prefix: addIssuePrefix,
          add_task_prefix: addTaskPrefix,
          prefix: itemPrefix,
        },
        apply_labels: applyLabels,
        apply_assignees: applyAssignees,
      };

      const applyResult = await onApply(selectedBlueprint, options);
      setResult(applyResult);
    } catch (err) {
      console.error('[ApplyBlueprintModal] Apply failed:', err);
      setError(err.message || 'Failed to apply blueprint');
    } finally {
      setApplying(false);
    }
  }, [
    selectedBlueprint,
    startDate,
    milestoneNamingMode,
    milestonePrefix,
    customMilestoneTitle,
    addIssuePrefix,
    addTaskPrefix,
    itemPrefix,
    applyLabels,
    applyAssignees,
    onApply,
  ]);

  // 關閉處理
  const handleClose = useCallback(() => {
    if (applying) return;
    onClose();
  }, [applying, onClose]);

  // Overlay 點擊處理：只有 mousedown 和 mouseup 都在 overlay 上時才關閉
  const handleOverlayMouseDown = useCallback((e) => {
    if (e.target === e.currentTarget) {
      mouseDownOnOverlay.current = true;
    }
  }, []);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && mouseDownOnOverlay.current) {
        handleClose();
      }
      mouseDownOnOverlay.current = false;
    },
    [handleClose],
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
        className="blueprint-modal apply-blueprint-modal"
        onMouseDown={() => {
          mouseDownOnOverlay.current = false;
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h3>Create from Blueprint</h3>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            title="Close"
            disabled={applying}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* 結果顯示 */}
          {result ? (
            <ApplyResultView result={result} />
          ) : (
            <>
              {/* Blueprint 選擇 */}
              <div className="form-group">
                <label htmlFor="blueprint-select">Select Blueprint</label>
                {blueprints.length === 0 ? (
                  <div className="empty-message">
                    No blueprints available. Create one by right-clicking a
                    Milestone.
                  </div>
                ) : (
                  <select
                    id="blueprint-select"
                    value={selectedBlueprintId}
                    onChange={(e) => setSelectedBlueprintId(e.target.value)}
                  >
                    {blueprints.map((bp) => (
                      <option key={bp.id} value={bp.id}>
                        {bp.name} ({bp.items.length} items)
                        {bp.storage_type === 'snippet'
                          ? ' [Shared]'
                          : ' [Local]'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedBlueprint && (
                <>
                  {/* 起始日期 */}
                  <div className="form-group">
                    <label htmlFor="start-date">Start Date</label>
                    <input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="form-hint">
                      New milestone will start from this date
                    </span>
                  </div>

                  {/* Milestone 命名 */}
                  <div className="form-group">
                    <label>Milestone Name</label>
                    <div className="naming-options">
                      <label className="naming-option">
                        <input
                          type="radio"
                          name="milestone-naming"
                          value="prefix"
                          checked={milestoneNamingMode === 'prefix'}
                          onChange={() => setMilestoneNamingMode('prefix')}
                        />
                        <span>Prefix + Original</span>
                      </label>
                      <label className="naming-option">
                        <input
                          type="radio"
                          name="milestone-naming"
                          value="custom"
                          checked={milestoneNamingMode === 'custom'}
                          onChange={() => setMilestoneNamingMode('custom')}
                        />
                        <span>Custom Name</span>
                      </label>
                    </div>
                    {milestoneNamingMode === 'prefix' && (
                      <input
                        type="text"
                        placeholder="Prefix (e.g., 'Q2 - ')"
                        value={milestonePrefix}
                        onChange={(e) => setMilestonePrefix(e.target.value)}
                      />
                    )}
                    {milestoneNamingMode === 'custom' && (
                      <input
                        type="text"
                        placeholder="Enter custom milestone name"
                        value={customMilestoneTitle}
                        onChange={(e) =>
                          setCustomMilestoneTitle(e.target.value)
                        }
                      />
                    )}
                    {previewMilestoneTitle && (
                      <div className="name-preview">
                        <span className="preview-label">Preview:</span>
                        <span className="preview-value">
                          {previewMilestoneTitle}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Item 命名 (分開 Issue 和 Task) */}
                  <div className="form-group">
                    <label>Add prefix to Items</label>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={addIssuePrefix}
                          onChange={(e) => setAddIssuePrefix(e.target.checked)}
                        />
                        <span>Issues</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={addTaskPrefix}
                          onChange={(e) => setAddTaskPrefix(e.target.checked)}
                        />
                        <span>Tasks</span>
                      </label>
                    </div>
                    {(addIssuePrefix || addTaskPrefix) && (
                      <>
                        <input
                          type="text"
                          placeholder="Prefix (e.g., '[Q2] ')"
                          value={itemPrefix}
                          onChange={(e) => setItemPrefix(e.target.value)}
                        />
                        {addIssuePrefix && previewIssueTitle && (
                          <div className="name-preview">
                            <span className="preview-label">
                              Issue Preview:
                            </span>
                            <span className="preview-value">
                              {previewIssueTitle}
                            </span>
                          </div>
                        )}
                        {addTaskPrefix && previewTaskTitle && (
                          <div className="name-preview">
                            <span className="preview-label">Task Preview:</span>
                            <span className="preview-value">
                              {previewTaskTitle}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Labels 和 Assignees */}
                  <div className="form-group">
                    <label>Apply from Blueprint</label>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={applyLabels}
                          onChange={(e) => setApplyLabels(e.target.checked)}
                        />
                        <span>Labels</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={applyAssignees}
                          onChange={(e) => setApplyAssignees(e.target.checked)}
                        />
                        <span>Assignees</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Error */}
              {error && <div className="error-message">{error}</div>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {result ? (
            <button className="btn btn-primary" onClick={handleClose}>
              Close
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={applying}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleApply}
                disabled={
                  applying ||
                  !selectedBlueprint ||
                  (milestoneNamingMode === 'custom' &&
                    !customMilestoneTitle.trim())
                }
              >
                {applying ? 'Creating...' : 'Create'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 套用結果顯示元件
 */
function ApplyResultView({ result }) {
  const { success, milestone, created, failed, links_created, links_failed } =
    result;

  return (
    <div className="apply-result">
      {/* 整體狀態 */}
      <div className={`result-status ${success ? 'success' : 'partial'}`}>
        <i
          className={
            success ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'
          }
        />
        <span>
          {success
            ? 'Blueprint applied successfully!'
            : 'Blueprint applied with some issues'}
        </span>
      </div>

      {/* Milestone */}
      {milestone && (
        <div className="result-section">
          <h4>Milestone</h4>
          <div className="result-item milestone">
            <i className="fas fa-flag" />
            <span>{milestone.title}</span>
            {milestone.web_url && (
              <a
                href={milestone.web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="item-link"
              >
                <i className="fas fa-external-link-alt" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* 成功建立的項目 */}
      {created.length > 0 && (
        <div className="result-section">
          <h4>Created ({created.length})</h4>
          <div className="result-list">
            {created.slice(0, 10).map((item) => (
              <div key={item.new_iid} className="result-item success">
                <i
                  className={
                    item.issue_type === 'Task' ? 'fas fa-check' : 'fas fa-file'
                  }
                />
                <span>{item.title}</span>
                <span className="item-type">{item.issue_type}</span>
              </div>
            ))}
            {created.length > 10 && (
              <div className="result-more">
                +{created.length - 10} more items
              </div>
            )}
          </div>
        </div>
      )}

      {/* 失敗的項目 */}
      {failed.length > 0 && (
        <div className="result-section">
          <h4>Failed ({failed.length})</h4>
          <div className="result-list">
            {failed.map((item) => (
              <div key={item.original_iid} className="result-item failed">
                <i className="fas fa-times-circle" />
                <span>{item.title}</span>
                <span className="item-error">{item.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {(links_created > 0 || links_failed > 0) && (
        <div className="result-section">
          <h4>Dependencies</h4>
          <div className="result-stats">
            <span className="stat-success">{links_created} created</span>
            {links_failed > 0 && (
              <span className="stat-failed">{links_failed} failed</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApplyBlueprintModal;
