import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcutsConfig {
  api: any;
  undoRedo?: {
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
  };
  onOpenEditor?: (taskId: string | number) => void;
  onCloseEditor?: () => void;
  onToggleSelection?: (taskId: string | number) => void;
  onClearSelection?: () => void;
  onFocusSearch?: () => void;
  onGoToToday?: () => void;
  onShowManagedMessage?: () => void;
  onShowHelp?: () => void;
  enabled?: boolean;
}

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (ev: KeyboardEvent) => void;
  description: string;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const {
    api,
    undoRedo,
    onOpenEditor,
    onCloseEditor,
    onToggleSelection,
    onClearSelection,
    onFocusSearch,
    onGoToToday,
    onShowManagedMessage,
    onShowHelp,
    enabled = true,
  } = config;

  const configRef = useRef(config);
  configRef.current = config;

  const getSelectedTaskId = useCallback(() => {
    if (!api) return null;
    const state = api.getState();
    const selected = state?._selected;
    if (selected && selected.length > 0) {
      return selected[0].id;
    }
    return null;
  }, [api]);

  const shortcuts: ShortcutHandler[] = [
    {
      key: 'enter',
      handler: () => {
        const taskId = getSelectedTaskId();
        if (taskId && onOpenEditor) {
          onOpenEditor(taskId);
        } else if (taskId && api) {
          api.exec('open-editor', { id: taskId });
        }
      },
      description: 'Open selected task editor',
    },
    {
      key: ' ',
      handler: () => {
        const taskId = getSelectedTaskId();
        if (taskId && onToggleSelection) {
          onToggleSelection(taskId);
        }
      },
      description: 'Toggle task selection',
    },
    {
      key: 'escape',
      handler: () => {
        if (onCloseEditor) {
          onCloseEditor();
        } else if (api) {
          api.exec('close-editor');
        }
        if (onClearSelection) {
          onClearSelection();
        } else if (api) {
          api.exec('clear-selection');
        }
      },
      description: 'Close editor / deselect',
    },
    {
      key: 'z',
      ctrl: true,
      handler: () => {
        if (undoRedo?.canUndo && undoRedo.undo) {
          undoRedo.undo();
        }
      },
      description: 'Undo',
    },
    {
      key: 'y',
      ctrl: true,
      handler: () => {
        if (undoRedo?.canRedo && undoRedo.redo) {
          undoRedo.redo();
        }
      },
      description: 'Redo',
    },
    {
      key: 'f',
      ctrl: true,
      handler: () => {
        if (onFocusSearch) {
          onFocusSearch();
        } else {
          const searchInput = document.querySelector(
            '.filter-search-input',
          ) as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }
      },
      description: 'Focus search',
    },
    {
      key: 'g',
      ctrl: true,
      handler: () => {
        if (onGoToToday) {
          onGoToToday();
        } else if (api) {
          const now = new Date();
          const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          const state = api.getState();
          const cellWidth = state?.cellWidth || 40;
          const start = state?.start;

          if (start) {
            const daysDiff = Math.floor(
              (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
            );
            const scrollLeft = Math.max(0, daysDiff * cellWidth);
            api.exec('scroll-chart', { left: scrollLeft });
          }
        }
      },
      description: 'Go to today',
    },
    {
      key: 'delete',
      handler: () => {
        if (onShowManagedMessage) {
          onShowManagedMessage();
        }
      },
      description: 'Show managed in ADO message (blocked)',
    },
    {
      key: 'backspace',
      handler: () => {
        if (onShowManagedMessage) {
          onShowManagedMessage();
        }
      },
      description: 'Show managed in ADO message (blocked)',
    },
    {
      key: '?',
      shift: true,
      handler: () => {
        if (onShowHelp) {
          onShowHelp();
        }
      },
      description: 'Show keyboard shortcuts help',
    },
    {
      key: '/',
      handler: () => {
        if (onShowHelp) {
          onShowHelp();
        }
      },
      description: 'Show keyboard shortcuts help',
    },
  ];

  const handleKeyDown = useCallback(
    (ev: KeyboardEvent) => {
      if (!enabled) return;

      const target = ev.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() || '';
      const isInput =
        tagName === 'input' ||
        tagName === 'textarea' ||
        target?.isContentEditable;

      for (const shortcut of shortcuts) {
        const keyMatch = ev.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl
          ? ev.ctrlKey || ev.metaKey
          : !ev.ctrlKey && !ev.metaKey;
        const shiftMatch = shortcut.shift ? ev.shiftKey : !ev.shiftKey;
        const altMatch = shortcut.alt ? ev.altKey : !ev.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (shortcut.key === 'escape' || !isInput) {
            ev.preventDefault();
            shortcut.handler(ev);
            return;
          }
        }
      }
    },
    [enabled, shortcuts],
  );

  useEffect(() => {
    if (!enabled) return;

    const layoutEl = document.querySelector('.wx-layout');
    if (layoutEl) {
      layoutEl.addEventListener('keydown', handleKeyDown);
      return () => {
        layoutEl.removeEventListener('keydown', handleKeyDown);
      };
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: shortcuts.map((s) => ({
      key: s.key,
      ctrl: s.ctrl,
      shift: s.shift,
      description: s.description,
    })),
  };
}

export const KEYBOARD_SHORTCUTS_HELP = [
  { keys: ['↑', '↓'], description: 'Navigate between tasks' },
  { keys: ['Enter'], description: 'Open selected task editor' },
  { keys: ['Space'], description: 'Toggle task selection' },
  { keys: ['Escape'], description: 'Close editor / deselect' },
  { keys: ['Ctrl+Z'], description: 'Undo' },
  { keys: ['Ctrl+Y'], description: 'Redo' },
  { keys: ['Ctrl+F'], description: 'Focus search' },
  { keys: ['Ctrl+G'], description: 'Go to today' },
  { keys: ['?'], description: 'Show this help' },
];
