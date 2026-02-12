/**
 * Reusable Toast Component
 * Displays temporary notifications with auto-dismiss functionality
 * Supports multiple stacked toasts
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

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
