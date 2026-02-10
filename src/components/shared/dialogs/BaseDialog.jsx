/**
 * BaseDialog
 *
 * 基礎對話框元件，提供共用的 overlay、keyboard handling、close 功能
 * 其他對話框元件應該基於此元件建構
 */

import { useCallback, useRef, useEffect } from 'react';
import './BaseDialog.css';
import '../modal-close-button.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否開啟
 * @param {Function} props.onClose - 關閉回調
 * @param {string} props.title - 對話框標題
 * @param {number|string} props.width - 對話框寬度 (預設 400)
 * @param {React.ReactNode} props.children - 對話框內容
 * @param {React.ReactNode} props.footer - 對話框底部按鈕區
 * @param {string} props.className - 額外的 CSS class
 * @param {boolean} props.closeOnOverlayClick - 點擊 overlay 是否關閉 (預設 true)
 * @param {boolean} props.closeOnEscape - 按 Escape 是否關閉 (預設 true)
 * @param {boolean} props.showCloseButton - 是否顯示關閉按鈕 (預設 true)
 */
export function BaseDialog({
  isOpen,
  onClose,
  title,
  width = 400,
  children,
  footer,
  className = '',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
}) {
  // 用於追蹤 mousedown 是否發生在 overlay 上，避免拖曳選取文字時意外關閉
  const mouseDownOnOverlay = useRef(false);
  const dialogRef = useRef(null);

  // Escape 鍵處理
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // 自動 focus 到對話框
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  // Overlay 點擊處理：只有 mousedown 和 mouseup 都在 overlay 上時才關閉
  const handleOverlayMouseDown = useCallback((e) => {
    if (e.target === e.currentTarget) {
      mouseDownOnOverlay.current = true;
    }
  }, []);

  const handleOverlayClick = useCallback(
    (e) => {
      if (
        closeOnOverlayClick &&
        e.target === e.currentTarget &&
        mouseDownOnOverlay.current
      ) {
        onClose();
      }
      mouseDownOnOverlay.current = false;
    },
    [closeOnOverlayClick, onClose],
  );

  // 阻止 modal 內部點擊事件冒泡到 overlay
  const handleModalMouseDown = useCallback(() => {
    mouseDownOnOverlay.current = false;
  }, []);

  if (!isOpen) {
    return null;
  }

  const modalStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
  };

  return (
    <div
      className="base-dialog-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`base-dialog ${className}`}
        style={modalStyle}
        onMouseDown={handleModalMouseDown}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="base-dialog-header">
          <h3 id="dialog-title">{title}</h3>
          {showCloseButton && (
            <button
              className="modal-close-btn"
              onClick={onClose}
              title="Close"
              type="button"
            >
              &times;
            </button>
          )}
        </div>

        {/* Body */}
        <div className="base-dialog-body">{children}</div>

        {/* Footer */}
        {footer && <div className="base-dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default BaseDialog;
