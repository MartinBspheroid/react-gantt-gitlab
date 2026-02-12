/**
 * DeleteDialog
 *
 * 刪除確認對話框，支援：
 * - 單一或批次刪除確認
 * - Issue/Task 可選擇 Close 或 Delete
 * - Milestone 只能 Delete
 * - 遞迴刪除子項目（Milestone→Issues, Issue→Tasks）
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { BaseDialog } from './BaseDialog';
import './BaseDialog.css'; // 使用共用樣式
import './DeleteDialog.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否開啟
 * @param {Function} props.onClose - 關閉回調
 * @param {Function} props.onConfirm - 確認回調 (action: 'close' | 'delete', options: { recursive: boolean }) => Promise
 * @param {Array} props.items - 要刪除的項目 [{id, title, type: 'milestone'|'issue'|'task', children?: [...]}]
 */
export function DeleteDialog({ isOpen, onClose, onConfirm, items = [] }) {
  const [action, setAction] = useState('delete'); // 'close' | 'delete'
  const [recursive, setRecursive] = useState(false); // 是否遞迴刪除子項目
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // 檢查是否有可以 close 的項目（Issue 或 Task，大小寫不敏感）
  const hasClosableItems = useMemo(() => {
    return items.some((item) => {
      const type = item.type?.toLowerCase();
      return type === 'issue' || type === 'task';
    });
  }, [items]);

  // 檢查是否全部都是可 close 的項目
  const allClosable = useMemo(() => {
    return items.every((item) => {
      const type = item.type?.toLowerCase();
      return type === 'issue' || type === 'task';
    });
  }, [items]);

  // 檢查是否有子項目（可以遞迴刪除）
  const hasChildren = useMemo(() => {
    return items.some((item) => item.children && item.children.length > 0);
  }, [items]);

  // 計算子項目總數和類型統計
  const childrenSummary = useMemo(() => {
    if (!hasChildren) return null;

    let issueCount = 0;
    let taskCount = 0;

    for (const item of items) {
      if (!item.children) continue;
      for (const child of item.children) {
        const childType = child.type?.toLowerCase();
        if (childType === 'issue') issueCount++;
        else if (childType === 'task') taskCount++;
      }
    }

    const parts = [];
    if (issueCount > 0)
      parts.push(`${issueCount} issue${issueCount > 1 ? 's' : ''}`);
    if (taskCount > 0)
      parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`);

    return parts.join(', ');
  }, [items, hasChildren]);

  // 重置狀態
  useEffect(() => {
    if (isOpen) {
      // 如果有不可 close 的項目（Milestone），預設為 delete
      setAction(allClosable ? 'close' : 'delete');
      setRecursive(false); // 預設不遞迴
      setError(null);
      setProcessing(false);
    }
  }, [isOpen, allClosable]);

  // 處理確認
  const handleConfirm = useCallback(async () => {
    setError(null);
    setProcessing(true);

    try {
      await onConfirm(action, { recursive });
      onClose();
    } catch (err) {
      console.error('[DeleteDialog] Delete failed:', err);
      setError(err.message || 'Operation failed');
      setProcessing(false);
    }
  }, [action, recursive, onConfirm, onClose]);

  // Enter 鍵處理
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !processing) {
        e.preventDefault();
        handleConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleConfirm, processing]);

  // 取得項目類型的顯示名稱（大小寫不敏感）
  const getTypeName = (type) => {
    switch (type?.toLowerCase()) {
      case 'milestone':
        return 'Milestone';
      case 'issue':
        return 'Issue';
      case 'task':
        return 'Task';
      default:
        return 'Item';
    }
  };

  // 取得動作按鈕的文字
  const confirmButtonText = useMemo(() => {
    if (processing) return 'Processing...';
    const actionText = action === 'close' ? 'Close' : 'Delete';
    if (items.length === 1) {
      return `${actionText} ${getTypeName(items[0].type)}`;
    }
    return `${actionText} ${items.length} items`;
  }, [processing, action, items]);

  const footer = (
    <>
      <button
        className="dialog-btn dialog-btn-secondary"
        onClick={onClose}
        disabled={processing}
        type="button"
      >
        Cancel
      </button>
      <button
        className={`dialog-btn ${action === 'delete' ? 'dialog-btn-danger' : 'dialog-btn-primary'}`}
        onClick={handleConfirm}
        disabled={processing}
        type="button"
      >
        {confirmButtonText}
      </button>
    </>
  );

  const title =
    items.length === 1
      ? `${action === 'close' ? 'Close' : 'Delete'} ${getTypeName(items[0].type)}`
      : `${action === 'close' ? 'Close' : 'Delete'} ${items.length} items`;

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      width={440}
      footer={footer}
      className="delete-dialog"
      closeOnEscape={!processing}
      closeOnOverlayClick={!processing}
    >
      {/* 項目列表 */}
      <div className="delete-items-list">
        {items.slice(0, 5).map((item, index) => {
          const typeLower = item.type?.toLowerCase();
          return (
            <div key={item.id || index} className="delete-item">
              <i
                className={`fas ${
                  typeLower === 'milestone'
                    ? 'fa-flag'
                    : typeLower === 'issue'
                      ? 'fa-file'
                      : 'fa-check'
                }`}
              />
              <span className="delete-item-title">{item.title}</span>
              <span className="delete-item-type">{getTypeName(item.type)}</span>
            </div>
          );
        })}
        {items.length > 5 && (
          <div className="delete-items-more">
            +{items.length - 5} more items
          </div>
        )}
      </div>

      {/* Close/Delete 選項（僅當有可 close 的項目時顯示） */}
      {hasClosableItems && (
        <div className="delete-action-options">
          <label className="delete-action-option">
            <input
              type="radio"
              name="delete-action"
              value="close"
              checked={action === 'close'}
              onChange={() => setAction('close')}
              disabled={processing || !allClosable}
            />
            <div className="option-content">
              <span className="option-title">Close</span>
              <span className="option-desc">
                {allClosable
                  ? 'Mark as closed, can be reopened later'
                  : 'Not available (includes Milestone)'}
              </span>
            </div>
          </label>
          <label className="delete-action-option">
            <input
              type="radio"
              name="delete-action"
              value="delete"
              checked={action === 'delete'}
              onChange={() => setAction('delete')}
              disabled={processing}
            />
            <div className="option-content">
              <span className="option-title">Delete</span>
              <span className="option-desc">Permanently remove</span>
            </div>
          </label>
        </div>
      )}

      {/* 遞迴刪除選項（僅當有子項目時顯示） */}
      {hasChildren && (
        <label className="delete-recursive-option">
          <input
            type="checkbox"
            checked={recursive}
            onChange={(e) => setRecursive(e.target.checked)}
            disabled={processing}
          />
          <div className="option-content">
            <span className="option-title">
              Include children ({childrenSummary})
            </span>
            <span className="option-desc">
              {action === 'delete'
                ? 'Also delete all child items'
                : 'Also close all child items'}
            </span>
          </div>
        </label>
      )}

      {/* 警告訊息 */}
      <div
        className={`delete-warning ${action === 'delete' ? 'danger' : 'info'}`}
      >
        <i
          className={`fas ${action === 'delete' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`}
        />
        <span>
          {action === 'delete'
            ? 'This action cannot be undone. The item(s) will be permanently deleted.'
            : 'Closed items can be reopened if needed.'}
        </span>
      </div>

      {/* 錯誤訊息 */}
      {error && <div className="dialog-error">{error}</div>}
    </BaseDialog>
  );
}

export default DeleteDialog;
