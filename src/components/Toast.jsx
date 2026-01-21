/**
 * Reusable Toast Component
 * Displays temporary notifications with auto-dismiss functionality
 * Supports multiple stacked toasts
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Toast types with corresponding styles
 */
const TOAST_TYPES = {
  error: {
    icon: 'fa-exclamation-circle',
    className: 'toast-error',
  },
  success: {
    icon: 'fa-check-circle',
    className: 'toast-success',
  },
  warning: {
    icon: 'fa-exclamation-triangle',
    className: 'toast-warning',
  },
  info: {
    icon: 'fa-info-circle',
    className: 'toast-info',
  },
};

/**
 * Single Toast Item Component
 */
function ToastItem({ id, message, type, onClose, duration }) {
  const toastConfig = TOAST_TYPES[type] || TOAST_TYPES.error;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div className={`toast ${toastConfig.className}`}>
      <i className={`fas ${toastConfig.icon}`}></i>
      <span className="toast-message">{message}</span>
      <button onClick={() => onClose(id)} className="toast-close-btn">
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
}

/**
 * Toast Container Component - manages multiple toasts
 * @param {Array} toasts - Array of toast objects { id, message, type }
 * @param {function} onRemove - Callback to remove a toast by id
 * @param {number} duration - Auto-dismiss duration in ms (0 to disable)
 * @param {string} position - Position: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'
 */
export function ToastContainer({
  toasts = [],
  onRemove,
  duration = 5000,
  position = 'top-right',
}) {
  if (toasts.length === 0) return null;

  const toastContent = (
    <div className={`toast-container toast-${position}`}>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={onRemove}
          duration={duration}
        />
      ))}

      <style>{`
        .toast-container {
          position: fixed;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: none;
        }

        .toast-container.toast-top-right {
          top: 16px;
          right: 16px;
        }

        .toast-container.toast-top-center {
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
        }

        .toast-container.toast-bottom-right {
          bottom: 16px;
          right: 16px;
        }

        .toast-container.toast-bottom-center {
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
        }

        .toast {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          font-size: 14px;
          min-width: 280px;
          max-width: 450px;
          pointer-events: auto;
          animation: toastSlideIn 0.3s ease-out;
        }

        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .toast i:first-child {
          flex-shrink: 0;
          font-size: 16px;
        }

        .toast-message {
          flex: 1;
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .toast-close-btn {
          padding: 4px 8px;
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.7;
          flex-shrink: 0;
          transition: opacity 0.2s;
        }

        .toast-close-btn:hover {
          opacity: 1;
        }

        /* Error Toast */
        .toast-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
        }

        .toast-error .toast-close-btn {
          color: #dc2626;
        }

        /* Success Toast */
        .toast-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #16a34a;
        }

        .toast-success .toast-close-btn {
          color: #16a34a;
        }

        /* Warning Toast */
        .toast-warning {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #d97706;
        }

        .toast-warning .toast-close-btn {
          color: #d97706;
        }

        /* Info Toast */
        .toast-info {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #2563eb;
        }

        .toast-info .toast-close-btn {
          color: #2563eb;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .toast-error {
            background: #450a0a;
            border-color: #7f1d1d;
            color: #fca5a5;
          }
          .toast-error .toast-close-btn {
            color: #fca5a5;
          }

          .toast-success {
            background: #052e16;
            border-color: #166534;
            color: #86efac;
          }
          .toast-success .toast-close-btn {
            color: #86efac;
          }

          .toast-warning {
            background: #451a03;
            border-color: #92400e;
            color: #fcd34d;
          }
          .toast-warning .toast-close-btn {
            color: #fcd34d;
          }

          .toast-info {
            background: #1e3a8a;
            border-color: #1d4ed8;
            color: #93c5fd;
          }
          .toast-info .toast-close-btn {
            color: #93c5fd;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(toastContent, document.body);
}

/**
 * Legacy Toast Component (single toast) - for backward compatibility
 * @deprecated Use ToastContainer with useToast hook instead
 */
export function Toast({
  message,
  type = 'error',
  onClose,
  duration = 5000,
  position = 'top-right',
}) {
  const toasts = message ? [{ id: 'single', message, type }] : [];
  return (
    <ToastContainer
      toasts={toasts}
      onRemove={onClose}
      duration={duration}
      position={position}
    />
  );
}

/**
 * Hook for managing multiple toasts
 * @returns {{ toasts, showToast, removeToast, clearToasts }}
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);

  const showToast = useCallback((message, type = 'error') => {
    const id = ++idCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return { toasts, showToast, removeToast, clearToasts };
}

export default Toast;
