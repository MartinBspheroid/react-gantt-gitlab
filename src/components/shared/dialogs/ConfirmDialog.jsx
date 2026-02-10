/**
 * ConfirmDialog
 *
 * 確認對話框，用於取代原生 confirm() 和 alert()
 * - confirm 模式：顯示確認/取消按鈕
 * - alert 模式：只顯示確認按鈕 (showCancel=false)
 */

import { useCallback, useEffect, useRef } from 'react';
import { BaseDialog } from './BaseDialog';
import './BaseDialog.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否開啟
 * @param {Function} props.onClose - 關閉回調
 * @param {Function} props.onConfirm - 確認回調
 * @param {string} props.title - 對話框標題
 * @param {string|React.ReactNode} props.message - 訊息內容
 * @param {'info'|'warning'|'danger'} props.severity - 嚴重程度，影響按鈕樣式 (預設 'warning')
 * @param {string} props.confirmLabel - 確認按鈕文字 (預設 'Confirm')
 * @param {string} props.cancelLabel - 取消按鈕文字 (預設 'Cancel')
 * @param {boolean} props.showCancel - 是否顯示取消按鈕 (預設 true)
 * @param {boolean} props.processing - 是否正在處理中
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  severity = 'warning',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  showCancel = true,
  processing = false,
}) {
  const confirmButtonRef = useRef(null);

  // Enter 鍵處理
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !processing) {
        e.preventDefault();
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, processing]);

  // 自動 focus 到確認按鈕
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    if (!processing) {
      onConfirm();
    }
  }, [onConfirm, processing]);

  // 決定確認按鈕的樣式
  const getConfirmButtonClass = () => {
    switch (severity) {
      case 'danger':
        return 'dialog-btn dialog-btn-danger';
      case 'info':
        return 'dialog-btn dialog-btn-primary';
      case 'warning':
      default:
        return 'dialog-btn dialog-btn-primary';
    }
  };

  const footer = (
    <>
      {showCancel && (
        <button
          className="dialog-btn dialog-btn-secondary"
          onClick={onClose}
          disabled={processing}
          type="button"
        >
          {cancelLabel}
        </button>
      )}
      <button
        ref={confirmButtonRef}
        className={getConfirmButtonClass()}
        onClick={handleConfirm}
        disabled={processing}
        type="button"
      >
        {processing ? 'Processing...' : confirmLabel}
      </button>
    </>
  );

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      width={400}
      footer={footer}
      closeOnEscape={!processing}
      closeOnOverlayClick={!processing}
    >
      <div className="dialog-message">{message}</div>
    </BaseDialog>
  );
}

export default ConfirmDialog;
