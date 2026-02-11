import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  KEYBOARD_SHORTCUTS_HELP,
} from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let mockApi: any;
  let mockUndoRedo: any;
  let mockHandlers: Record<string, () => void>;

  beforeEach(() => {
    mockHandlers = {};

    mockApi = {
      getState: vi.fn(() => ({
        _selected: [],
        cellWidth: 40,
        start: new Date('2024-01-01'),
      })),
      exec: vi.fn((cmd: string, args?: any) => {
        if (cmd === 'open-editor') {
          mockHandlers.openEditor?.();
        } else if (cmd === 'close-editor') {
          mockHandlers.closeEditor?.();
        } else if (cmd === 'clear-selection') {
          mockHandlers.clearSelection?.();
        } else if (cmd === 'scroll-chart') {
          mockHandlers.scrollToToday?.();
        }
      }),
      getTask: vi.fn(),
    };

    mockUndoRedo = {
      canUndo: true,
      canRedo: true,
      undo: vi.fn(() => mockHandlers.undo?.()),
      redo: vi.fn(() => mockHandlers.redo?.()),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return shortcuts list', () => {
    const { result } = renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        undoRedo: mockUndoRedo,
        enabled: true,
      }),
    );

    expect(result.current.shortcuts).toBeDefined();
    expect(result.current.shortcuts.length).toBeGreaterThan(0);
  });

  it('should handle Enter key to open editor', () => {
    const onOpenEditor = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        onOpenEditor,
        enabled: true,
      }),
    );

    mockApi.getState.mockReturnValue({
      _selected: [{ id: 1 }],
      cellWidth: 40,
      start: new Date('2024-01-01'),
    });

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    document.dispatchEvent(event);

    expect(onOpenEditor).toHaveBeenCalledWith(1);
  });

  it('should handle Escape key to close editor and clear selection', () => {
    const onCloseEditor = vi.fn();
    const onClearSelection = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        onCloseEditor,
        onClearSelection,
        enabled: true,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(onCloseEditor).toHaveBeenCalled();
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('should handle Ctrl+Z for undo', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        undoRedo: mockUndoRedo,
        enabled: true,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    document.dispatchEvent(event);

    expect(mockUndoRedo.undo).toHaveBeenCalled();
  });

  it('should handle Ctrl+Y for redo', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        undoRedo: mockUndoRedo,
        enabled: true,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true });
    document.dispatchEvent(event);

    expect(mockUndoRedo.redo).toHaveBeenCalled();
  });

  it('should handle Ctrl+F to focus search', () => {
    const onFocusSearch = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        onFocusSearch,
        enabled: true,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true });
    document.dispatchEvent(event);

    expect(onFocusSearch).toHaveBeenCalled();
  });

  it('should handle Ctrl+G to go to today', () => {
    const onGoToToday = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        onGoToToday,
        enabled: true,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: 'g', ctrlKey: true });
    document.dispatchEvent(event);

    expect(onGoToToday).toHaveBeenCalled();
  });

  it('should handle ? for help', () => {
    const onShowHelp = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        onShowHelp,
        enabled: true,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
    document.dispatchEvent(event);

    expect(onShowHelp).toHaveBeenCalled();
  });

  it('should handle / for help', () => {
    const onShowHelp = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        onShowHelp,
        enabled: true,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: '/' });
    document.dispatchEvent(event);

    expect(onShowHelp).toHaveBeenCalled();
  });

  it('should not trigger shortcuts when disabled', () => {
    const onShowHelp = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        onShowHelp,
        enabled: false,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
    document.dispatchEvent(event);

    expect(onShowHelp).not.toHaveBeenCalled();
  });

  it('should not trigger shortcuts in input fields', () => {
    const onShowHelp = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        onShowHelp,
        enabled: true,
      }),
    );

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
    Object.defineProperty(event, 'target', { value: input });
    input.dispatchEvent(event);

    expect(onShowHelp).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('should show managed message on Delete key', () => {
    const onShowManagedMessage = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        api: mockApi,
        onShowManagedMessage,
        enabled: true,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: 'Delete' });
    document.dispatchEvent(event);

    expect(onShowManagedMessage).toHaveBeenCalled();
  });
});

describe('KEYBOARD_SHORTCUTS_HELP', () => {
  it('should contain all expected shortcuts', () => {
    expect(KEYBOARD_SHORTCUTS_HELP).toBeDefined();
    expect(KEYBOARD_SHORTCUTS_HELP.length).toBeGreaterThan(0);

    const descriptions = KEYBOARD_SHORTCUTS_HELP.map((s) => s.description);
    expect(descriptions).toContain('Navigate between tasks');
    expect(descriptions).toContain('Open selected task editor');
    expect(descriptions).toContain('Toggle task selection');
    expect(descriptions).toContain('Close editor / deselect');
    expect(descriptions).toContain('Undo');
    expect(descriptions).toContain('Redo');
    expect(descriptions).toContain('Focus search');
    expect(descriptions).toContain('Go to today');
    expect(descriptions).toContain('Show this help');
  });

  it('should have descriptions for all shortcuts', () => {
    KEYBOARD_SHORTCUTS_HELP.forEach((shortcut) => {
      expect(shortcut.description).toBeDefined();
      expect(shortcut.description.length).toBeGreaterThan(0);
    });
  });
});
