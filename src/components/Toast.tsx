/**
 * Reusable Toast Component
 * Displays temporary notifications with auto-dismiss functionality
 * Supports multiple stacked toasts
 */

import { useEffect, useCallback, useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface ToastItemData {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastItemProps {
  id: number;
  message: string;
  type: ToastType;
  onClose: (id: number) => void;
  duration: number;
}

interface ToastContainerProps {
  toasts: ToastItemData[];
  onRemove: (id: number) => void;
  duration?: number;
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
}

interface ToastProps {
  message?: string;
  type?: ToastType;
  onClose: (id: number) => void;
  duration?: number;
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
}

interface ToastHookReturn {
  toasts: ToastItemData[];
  showToast: (message: string, type?: ToastType) => number;
  removeToast: (id: number) => void;
  clearToasts: () => void;
}

/**
 * Toast types with corresponding styles
 */
const TOAST_TYPES: Record<ToastType, { icon: string; className: string }> = {
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
function ToastItem({ id, message, type, onClose, duration }: ToastItemProps): ReactNode {
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
 */
export function ToastContainer({
  toasts = [],
  onRemove,
  duration = 5000,
  position = 'top-right',
}: ToastContainerProps): ReactNode | null {
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
}: ToastProps): ReactNode | null {
  const toasts: ToastItemData[] = message ? [{ id: 1, message, type }] : [];
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
 */
export function useToast(): ToastHookReturn {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const idCounter = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'error'): number => {
    const id = ++idCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id: number): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback((): void => {
    setToasts([]);
  }, []);

  return { toasts, showToast, removeToast, clearToasts };
}

export default Toast;
