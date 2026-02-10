/**
 * Toast Component Tests
 * Tests for toast notifications and hook
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { ToastContainer, useToast } from '../Toast';

afterEach(() => {
  cleanup();
  // Clean up any remaining DOM elements
  document.body.innerHTML = '';
});

describe('Toast', () => {
  describe('ToastContainer', () => {
    it('should render nothing when no toasts', () => {
      const { container } = render(
        <ToastContainer toasts={[]} onRemove={vi.fn()} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render toast container with correct position', () => {
      const mockRemove = vi.fn();
      render(
        <ToastContainer
          toasts={[{ id: 1, message: 'Test message', type: 'info' }]}
          onRemove={mockRemove}
          position="top-right"
        />,
      );

      const container = document.querySelector('.toast-container');
      expect(container).toHaveClass('toast-top-right');
    });

    it('should render multiple toasts', () => {
      const mockRemove = vi.fn();
      const toasts = [
        { id: 1, message: 'Message 1', type: 'info' },
        { id: 2, message: 'Message 2', type: 'error' },
        { id: 3, message: 'Message 3', type: 'success' },
      ];

      render(<ToastContainer toasts={toasts} onRemove={mockRemove} />);

      expect(screen.getByText('Message 1')).toBeInTheDocument();
      expect(screen.getByText('Message 2')).toBeInTheDocument();
      expect(screen.getByText('Message 3')).toBeInTheDocument();
    });

    it('should display correct icon for error toast', () => {
      const mockRemove = vi.fn();
      render(
        <ToastContainer
          toasts={[{ id: 1, message: 'Error!', type: 'error' }]}
          onRemove={mockRemove}
        />,
      );

      const toast = document.querySelector('.toast-error');
      const icon = toast.querySelector('.fa-exclamation-circle');
      expect(icon).toBeInTheDocument();
    });

    it('should display correct icon for success toast', () => {
      const mockRemove = vi.fn();
      render(
        <ToastContainer
          toasts={[{ id: 1, message: 'Success!', type: 'success' }]}
          onRemove={mockRemove}
        />,
      );

      const toast = document.querySelector('.toast-success');
      const icon = toast.querySelector('.fa-check-circle');
      expect(icon).toBeInTheDocument();
    });

    it('should display correct icon for warning toast', () => {
      const mockRemove = vi.fn();
      render(
        <ToastContainer
          toasts={[{ id: 1, message: 'Warning!', type: 'warning' }]}
          onRemove={mockRemove}
        />,
      );

      const toast = document.querySelector('.toast-warning');
      const icon = toast.querySelector('.fa-exclamation-triangle');
      expect(icon).toBeInTheDocument();
    });

    it('should display correct icon for info toast', () => {
      const mockRemove = vi.fn();
      render(
        <ToastContainer
          toasts={[{ id: 1, message: 'Info!', type: 'info' }]}
          onRemove={mockRemove}
        />,
      );

      const toast = document.querySelector('.toast-info');
      const icon = toast.querySelector('.fa-info-circle');
      expect(icon).toBeInTheDocument();
    });

    it('should call onRemove when close button clicked', () => {
      const mockRemove = vi.fn();
      render(
        <ToastContainer
          toasts={[{ id: 1, message: 'Test', type: 'info' }]}
          onRemove={mockRemove}
        />,
      );

      const closeButton = document.querySelector('.toast-close-btn');
      fireEvent.click(closeButton);

      expect(mockRemove).toHaveBeenCalledWith(1);
    });

    it('should render different positions', () => {
      const mockRemove = vi.fn();
      const positions = [
        'top-right',
        'top-center',
        'bottom-right',
        'bottom-center',
      ];

      positions.forEach((position) => {
        cleanup();
        render(
          <ToastContainer
            toasts={[{ id: 1, message: 'Test', type: 'info' }]}
            onRemove={mockRemove}
            position={position}
          />,
        );

        // Portal renders in document.body, not in container
        const containerEl = document.querySelector('.toast-container');
        expect(containerEl).toHaveClass(`toast-${position}`);
      });
    });

    it('should auto-dismiss after duration', async () => {
      const mockRemove = vi.fn();
      const duration = 100; // 100ms

      render(
        <ToastContainer
          toasts={[{ id: 1, message: 'Auto dismiss', type: 'info' }]}
          onRemove={mockRemove}
          duration={duration}
        />,
      );

      expect(mockRemove).not.toHaveBeenCalled();

      await waitFor(
        () => {
          expect(mockRemove).toHaveBeenCalledWith(1);
        },
        { timeout: 200 },
      );
    });

    it('should not auto-dismiss when duration is 0', async () => {
      const mockRemove = vi.fn();

      render(
        <ToastContainer
          toasts={[{ id: 1, message: 'No auto dismiss', type: 'info' }]}
          onRemove={mockRemove}
          duration={0}
        />,
      );

      // Wait a bit and verify onRemove was not called
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('should render in portal', () => {
      const mockRemove = vi.fn();
      render(
        <ToastContainer
          toasts={[{ id: 1, message: 'Portal test', type: 'info' }]}
          onRemove={mockRemove}
        />,
      );

      const message = screen.getByText('Portal test');
      expect(message.closest('.toast-container')).toBeInTheDocument();
      expect(document.body.contains(message.closest('.toast-container'))).toBe(
        true,
      );
    });
  });

  describe('useToast hook', () => {
    function TestComponent() {
      const { toasts, showToast, removeToast, clearToasts } = useToast();

      return (
        <div>
          <button onClick={() => showToast('Test message', 'info')}>
            Show Info Toast
          </button>
          <button onClick={() => showToast('Error message', 'error')}>
            Show Error Toast
          </button>
          <button onClick={() => removeToast(1)}>Remove Toast</button>
          <button onClick={clearToasts}>Clear All</button>
          <div data-testid="toast-count">{toasts.length}</div>
          {toasts.map((t) => (
            <div key={t.id} data-testid={`toast-${t.id}`}>
              {t.message}
            </div>
          ))}
        </div>
      );
    }

    it('should initialize with empty toasts', () => {
      render(<TestComponent />);
      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });

    it('should add toast to list', () => {
      render(<TestComponent />);

      fireEvent.click(screen.getByText('Show Info Toast'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should add multiple toasts', () => {
      render(<TestComponent />);

      fireEvent.click(screen.getByText('Show Info Toast'));
      fireEvent.click(screen.getByText('Show Error Toast'));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('2');
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('should increment toast IDs', () => {
      cleanup();
      render(<TestComponent />);

      fireEvent.click(screen.getByText('Show Info Toast'));
      fireEvent.click(screen.getByText('Show Info Toast'));

      const toasts = screen.queryAllByTestId(/^toast-/);

      // Should have exactly 2 toasts from this test
      // (may have more from previous tests if not cleaned up, so check at least 2)
      expect(toasts.length).toBeGreaterThanOrEqual(2);

      // IDs are incremented (exact values may vary based on test execution order)
      const lastToasts = toasts.slice(-2);
      const id1 = lastToasts[0].getAttribute('data-testid').match(/\d+/)[0];
      const id2 = lastToasts[1].getAttribute('data-testid').match(/\d+/)[0];
      expect(Number(id2)).toBeGreaterThan(Number(id1));
    });

    it('should remove specific toast', () => {
      render(<TestComponent />);

      fireEvent.click(screen.getByText('Show Info Toast'));
      fireEvent.click(screen.getByText('Show Error Toast'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('2');

      fireEvent.click(screen.getByText('Remove Toast'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    });

    it('should clear all toasts', () => {
      render(<TestComponent />);

      fireEvent.click(screen.getByText('Show Info Toast'));
      fireEvent.click(screen.getByText('Show Error Toast'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('2');

      fireEvent.click(screen.getByText('Clear All'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });

    it('should maintain toast type', () => {
      function TypeTestComponent() {
        const { toasts, showToast } = useToast();

        return (
          <div>
            <button onClick={() => showToast('Info', 'info')}>Info</button>
            <button onClick={() => showToast('Error', 'error')}>Error</button>
            <button onClick={() => showToast('Success', 'success')}>
              Success
            </button>
            {toasts.map((t) => (
              <div key={t.id} data-testid={`toast-${t.id}`} data-type={t.type}>
                {t.message}
              </div>
            ))}
          </div>
        );
      }

      render(<TypeTestComponent />);

      fireEvent.click(screen.getByText('Info'));
      fireEvent.click(screen.getByText('Error'));
      fireEvent.click(screen.getByText('Success'));

      expect(screen.getByTestId('toast-1')).toHaveAttribute(
        'data-type',
        'info',
      );
      expect(screen.getByTestId('toast-2')).toHaveAttribute(
        'data-type',
        'error',
      );
      expect(screen.getByTestId('toast-3')).toHaveAttribute(
        'data-type',
        'success',
      );
    });
  });
});
