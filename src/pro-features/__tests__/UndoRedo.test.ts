import { describe, it, expect } from 'vitest';
import {
  createUndoRedoState,
  recordTaskChange,
  recordLinkChange,
  undo,
  redo,
  canUndo,
  canRedo,
  getUndoDescription,
  getRedoDescription,
  clearHistory,
} from '../UndoRedo';
import type { ITask, ILink } from '@svar-ui/gantt-store';

describe('UndoRedo', () => {
  const createTask = (id: string, text: string): ITask => ({
    id,
    text,
    start: new Date('2024-01-01'),
    end: new Date('2024-01-05'),
  });

  const createLink = (source: string, target: string): ILink => ({
    id: 'link-1',
    source,
    target,
    type: 'e2s',
  });

  describe('createUndoRedoState', () => {
    it('should create empty undo/redo state', () => {
      const state = createUndoRedoState();
      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(0);
    });

    it('should respect maxHistory parameter', () => {
      const state = createUndoRedoState(10);
      expect(state.maxHistory).toBe(10);
    });
  });

  describe('recordTaskChange', () => {
    it('should record task add', () => {
      const state = createUndoRedoState();
      const task = createTask('1', 'Task 1');

      const newState = recordTaskChange(state, 'add', undefined, task);

      expect(newState.past).toHaveLength(1);
      expect(newState.past[0].type).toBe('task');
      expect(newState.past[0].action).toBe('add');
      expect(newState.past[0].after).toEqual(task);
    });

    it('should record task update', () => {
      const state = createUndoRedoState();
      const before = createTask('1', 'Task 1');
      const after = createTask('1', 'Task 1 Updated');

      const newState = recordTaskChange(state, 'update', before, after);

      expect(newState.past[0].action).toBe('update');
      expect(newState.past[0].before).toEqual(before);
      expect(newState.past[0].after).toEqual(after);
    });

    it('should record task delete', () => {
      const state = createUndoRedoState();
      const task = createTask('1', 'Task 1');

      const newState = recordTaskChange(state, 'delete', task, undefined);

      expect(newState.past[0].action).toBe('delete');
      expect(newState.past[0].before).toEqual(task);
    });

    it('should clear future on new change', () => {
      let state = createUndoRedoState();
      state = recordTaskChange(
        state,
        'add',
        undefined,
        createTask('1', 'Task 1'),
      );
      state = undo(state).state;

      expect(state.future).toHaveLength(1);

      state = recordTaskChange(
        state,
        'add',
        undefined,
        createTask('2', 'Task 2'),
      );
      expect(state.future).toHaveLength(0);
    });
  });

  describe('recordLinkChange', () => {
    it('should record link changes', () => {
      const state = createUndoRedoState();
      const link = createLink('1', '2');

      const newState = recordLinkChange(state, 'add', undefined, link);

      expect(newState.past[0].type).toBe('link');
      expect(newState.past[0].action).toBe('add');
    });
  });

  describe('undo', () => {
    it('should undo last change', () => {
      const task = createTask('1', 'Task 1');
      let state = createUndoRedoState();
      state = recordTaskChange(state, 'add', undefined, task);

      const result = undo(state);

      expect(result.action).not.toBeNull();
      expect(result.state.past).toHaveLength(0);
      expect(result.state.future).toHaveLength(1);
    });

    it('should return null when nothing to undo', () => {
      const state = createUndoRedoState();
      const result = undo(state);

      expect(result.action).toBeNull();
    });
  });

  describe('redo', () => {
    it('should redo undone change', () => {
      const task = createTask('1', 'Task 1');
      let state = createUndoRedoState();
      state = recordTaskChange(state, 'add', undefined, task);
      state = undo(state).state;

      const result = redo(state);

      expect(result.action).not.toBeNull();
      expect(result.state.past).toHaveLength(1);
      expect(result.state.future).toHaveLength(0);
    });

    it('should return null when nothing to redo', () => {
      const state = createUndoRedoState();
      const result = redo(state);

      expect(result.action).toBeNull();
    });
  });

  describe('canUndo/canRedo', () => {
    it('should correctly report undo availability', () => {
      const task = createTask('1', 'Task 1');
      let state = createUndoRedoState();

      expect(canUndo(state)).toBe(false);

      state = recordTaskChange(state, 'add', undefined, task);
      expect(canUndo(state)).toBe(true);
    });

    it('should correctly report redo availability', () => {
      const task = createTask('1', 'Task 1');
      let state = createUndoRedoState();
      state = recordTaskChange(state, 'add', undefined, task);
      state = undo(state).state;

      expect(canRedo(state)).toBe(true);
    });
  });

  describe('getUndoDescription/getRedoDescription', () => {
    it('should return description for undo', () => {
      const task = createTask('1', 'My Task');
      let state = createUndoRedoState();
      state = recordTaskChange(state, 'add', undefined, task);

      const description = getUndoDescription(state);
      expect(description).toContain('My Task');
    });

    it('should return null when no undo available', () => {
      const state = createUndoRedoState();
      expect(getUndoDescription(state)).toBeNull();
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      const task = createTask('1', 'Task 1');
      let state = createUndoRedoState();
      state = recordTaskChange(state, 'add', undefined, task);
      state = undo(state).state;

      state = clearHistory(state);

      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(0);
    });
  });

  describe('maxHistory', () => {
    it('should limit history size', () => {
      let state = createUndoRedoState(3);

      for (let i = 0; i < 5; i++) {
        state = recordTaskChange(
          state,
          'add',
          undefined,
          createTask(`${i}`, `Task ${i}`),
        );
      }

      expect(state.past).toHaveLength(3);
    });
  });
});
