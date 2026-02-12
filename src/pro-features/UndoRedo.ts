import type { ITask, ILink, TID } from '@svar-ui/gantt-store';
import type { IHistoryEntry, IUndoRedoState } from './types';

export function createUndoRedoState(maxHistory: number = 50): IUndoRedoState {
  return {
    past: [],
    future: [],
    maxHistory,
  };
}

export function recordChange(
  state: IUndoRedoState,
  type: 'task' | 'link',
  action: 'add' | 'update' | 'delete',
  before: ITask | ILink | undefined,
  after: ITask | ILink | undefined,
): IUndoRedoState {
  const entry: IHistoryEntry = {
    type,
    action,
    before: before ? { ...before } : undefined,
    after: after ? { ...after } : undefined,
    timestamp: Date.now(),
  };

  const newPast = [...state.past, entry];

  if (newPast.length > state.maxHistory) {
    newPast.shift();
  }

  return {
    ...state,
    past: newPast,
    future: [],
  };
}

export function recordTaskChange(
  state: IUndoRedoState,
  action: 'add' | 'update' | 'delete',
  before: ITask | undefined,
  after: ITask | undefined,
): IUndoRedoState {
  return recordChange(state, 'task', action, before, after);
}

export function recordLinkChange(
  state: IUndoRedoState,
  action: 'add' | 'update' | 'delete',
  before: ILink | undefined,
  after: ILink | undefined,
): IUndoRedoState {
  return recordChange(state, 'link', action, before, after);
}

export function canUndo(state: IUndoRedoState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: IUndoRedoState): boolean {
  return state.future.length > 0;
}

export function undo(state: IUndoRedoState): {
  state: IUndoRedoState;
  action: IHistoryEntry | null;
} {
  if (!canUndo(state)) {
    return { state, action: null };
  }

  const newPast = [...state.past];
  const entry = newPast.pop()!;

  const reversedEntry = reverseEntry(entry);

  return {
    state: {
      ...state,
      past: newPast,
      future: [reversedEntry, ...state.future],
    },
    action: entry,
  };
}

export function redo(state: IUndoRedoState): {
  state: IUndoRedoState;
  action: IHistoryEntry | null;
} {
  if (!canRedo(state)) {
    return { state, action: null };
  }

  const newFuture = [...state.future];
  const entry = newFuture.shift()!;

  const reversedEntry = reverseEntry(entry);

  return {
    state: {
      ...state,
      past: [...state.past, reversedEntry],
      future: newFuture,
    },
    action: entry,
  };
}

function reverseEntry(entry: IHistoryEntry): IHistoryEntry {
  const reverseAction = {
    add: 'delete' as const,
    update: 'update' as const,
    delete: 'add' as const,
  };

  return {
    ...entry,
    action: reverseAction[entry.action],
    before: entry.after ? { ...entry.after } : undefined,
    after: entry.before ? { ...entry.before } : undefined,
  };
}

export function getUndoDescription(state: IUndoRedoState): string | null {
  if (!canUndo(state)) return null;

  const lastEntry = state.past[state.past.length - 1];
  return describeEntry(lastEntry);
}

export function getRedoDescription(state: IUndoRedoState): string | null {
  if (!canRedo(state)) return null;

  const nextEntry = state.future[0];
  return describeEntry(nextEntry);
}

function describeEntry(entry: IHistoryEntry): string {
  const entityType = entry.type === 'task' ? 'Task' : 'Link';
  const actionVerb = {
    add: 'added',
    update: 'modified',
    delete: 'deleted',
  }[entry.action];

  const name =
    entry.type === 'task'
      ? (entry.before as ITask)?.text ||
        (entry.after as ITask)?.text ||
        'Unknown'
      : `${(entry.before as ILink)?.source || (entry.after as ILink)?.source} → ${(entry.before as ILink)?.target || (entry.after as ILink)?.target}`;

  return `${entityType} "${name}" ${actionVerb}`;
}

export function clearHistory(state: IUndoRedoState): IUndoRedoState {
  return {
    ...state,
    past: [],
    future: [],
  };
}

export function groupChanges(
  state: IUndoRedoState,
  entries: IHistoryEntry[],
): IUndoRedoState {
  const now = Date.now();
  const groupedEntry: IHistoryEntry = {
    type: 'task',
    action: 'update',
    before: entries[0]?.before,
    after: entries[entries.length - 1]?.after,
    timestamp: now,
  };

  return {
    ...state,
    past: [...state.past, groupedEntry],
    future: [],
  };
}
