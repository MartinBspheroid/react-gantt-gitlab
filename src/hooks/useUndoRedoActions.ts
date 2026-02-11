import { useState, useCallback, useEffect, useRef } from 'react';
import type { ITask, ILink, IApi } from '@svar-ui/gantt-store';
import type { IHistoryEntry, IUndoRedoState } from '../pro-features/types';
import {
  createUndoRedoState,
  recordTaskChange,
  recordLinkChange,
  undo as undoAction,
  redo as redoAction,
  canUndo,
  canRedo,
  getUndoDescription,
  getRedoDescription,
  clearHistory,
} from '../pro-features/UndoRedo';

export interface IUseUndoRedoActionsOptions {
  enabled?: boolean;
  maxHistory?: number;
  api: IApi | null;
}

export interface IUseUndoRedoActionsResult {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  undo: () => void;
  redo: () => void;
  recordTaskAction: (
    action: 'add' | 'update' | 'delete',
    before: ITask | undefined,
    after: ITask | undefined,
  ) => void;
  recordLinkAction: (
    action: 'add' | 'update' | 'delete',
    before: ILink | undefined,
    after: ILink | undefined,
  ) => void;
  clearHistory: () => void;
}

export function useUndoRedoActions({
  enabled = false,
  maxHistory = 50,
  api,
}: IUseUndoRedoActionsOptions): IUseUndoRedoActionsResult {
  const stateRef = useRef<IUndoRedoState>(createUndoRedoState(maxHistory));
  const [, forceUpdate] = useState(0);

  const triggerUpdate = useCallback(() => forceUpdate((n) => n + 1), []);

  const handleRecordTaskAction = useCallback(
    (
      action: 'add' | 'update' | 'delete',
      before: ITask | undefined,
      after: ITask | undefined,
    ) => {
      if (!enabled) return;
      stateRef.current = recordTaskChange(
        stateRef.current,
        action,
        before,
        after,
      );
      triggerUpdate();
    },
    [enabled, triggerUpdate],
  );

  const handleRecordLinkAction = useCallback(
    (
      action: 'add' | 'update' | 'delete',
      before: ILink | undefined,
      after: ILink | undefined,
    ) => {
      if (!enabled) return;
      stateRef.current = recordLinkChange(
        stateRef.current,
        action,
        before,
        after,
      );
      triggerUpdate();
    },
    [enabled, triggerUpdate],
  );

  const applyHistoryEntry = useCallback(
    (entry: IHistoryEntry, isUndo: boolean) => {
      if (!api || !entry) return;

      const data = isUndo ? entry.before : entry.after;
      if (!data) return;

      if (entry.type === 'task') {
        const task = data as ITask;
        if (entry.action === 'add') {
          if (isUndo) {
            api.exec('delete-task', { id: task.id, skipUndo: true });
          } else {
            api.exec('add-task', { task, skipUndo: true });
          }
        } else if (entry.action === 'delete') {
          if (isUndo) {
            api.exec('add-task', { task, skipUndo: true });
          } else {
            api.exec('delete-task', { id: task.id, skipUndo: true });
          }
        } else {
          api.exec('update-task', { id: task.id, task, skipUndo: true });
        }
      } else if (entry.type === 'link') {
        const link = data as ILink;
        if (entry.action === 'add') {
          if (isUndo) {
            api.exec('delete-link', { id: link.id, skipUndo: true });
          } else {
            api.exec('add-link', { link, skipUndo: true });
          }
        } else if (entry.action === 'delete') {
          if (isUndo) {
            api.exec('add-link', { link, skipUndo: true });
          } else {
            api.exec('delete-link', { id: link.id, skipUndo: true });
          }
        } else {
          api.exec('update-link', { id: link.id, link, skipUndo: true });
        }
      }
    },
    [api],
  );

  const handleUndo = useCallback(() => {
    if (!enabled || !canUndo(stateRef.current)) return;

    const { state, action } = undoAction(stateRef.current);
    stateRef.current = state;
    triggerUpdate();

    if (action) {
      applyHistoryEntry(action, true);
    }
  }, [enabled, applyHistoryEntry, triggerUpdate]);

  const handleRedo = useCallback(() => {
    if (!enabled || !canRedo(stateRef.current)) return;

    const { state, action } = redoAction(stateRef.current);
    stateRef.current = state;
    triggerUpdate();

    if (action) {
      applyHistoryEntry(action, false);
    }
  }, [enabled, applyHistoryEntry, triggerUpdate]);

  const handleClearHistory = useCallback(() => {
    stateRef.current = clearHistory(stateRef.current);
    triggerUpdate();
  }, [triggerUpdate]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMetaOrCtrl = e.metaKey || e.ctrlKey;
      if (!isMetaOrCtrl) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleUndo, handleRedo]);

  return {
    canUndo: enabled && canUndo(stateRef.current),
    canRedo: enabled && canRedo(stateRef.current),
    undoDescription: enabled ? getUndoDescription(stateRef.current) : null,
    redoDescription: enabled ? getRedoDescription(stateRef.current) : null,
    undo: handleUndo,
    redo: handleRedo,
    recordTaskAction: handleRecordTaskAction,
    recordLinkAction: handleRecordLinkAction,
    clearHistory: handleClearHistory,
  };
}
