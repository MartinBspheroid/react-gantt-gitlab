/**
 * useFoldState Hook Tests
 * Tests for fold/collapse state management with localStorage persistence,
 * milestone ID migration, and group toggle events.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFoldState } from '../useFoldState';

describe('useFoldState', () => {
  let localStorageMock: Record<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    global.localStorage = localStorageMock as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderFoldState(overrides = {}) {
    const defaults = {
      api: null,
      currentConfig: null,
      allTasks: [],
      setCollapsedGroups: vi.fn(),
    };
    return renderHook(() => useFoldState({ ...defaults, ...overrides }));
  }

  // =========================================================================
  // Storage key generation
  // =========================================================================

  describe('storage key generation', () => {
    it('should use default key when no config', () => {
      renderFoldState({ currentConfig: null });

      // No localStorage call since config is null (early return in effect)
      expect(localStorageMock.getItem).not.toHaveBeenCalled();
    });

    it('should generate project-specific key', () => {
      renderFoldState({
        currentConfig: { type: 'project', projectId: 'abc123' },
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'gantt-foldstate-project-abc123',
      );
    });

    it('should generate group-specific key', () => {
      renderFoldState({
        currentConfig: { type: 'group', groupId: 'grp456' },
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'gantt-foldstate-group-grp456',
      );
    });

    it('should use default key for unknown config type', () => {
      renderFoldState({
        currentConfig: { type: 'unknown' },
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'gantt-foldstate-default',
      );
    });
  });

  // =========================================================================
  // Loading fold state from localStorage
  // =========================================================================

  describe('loading fold state', () => {
    it('should load saved fold state from localStorage', () => {
      localStorageMock.getItem.mockReturnValue(
        JSON.stringify({ '1': true, '2': false }),
      );

      const { result } = renderFoldState({
        currentConfig: { type: 'project', projectId: 'p1' },
      });

      expect(result.current.openStateRef.current.get('1')).toBe(true);
      expect(result.current.openStateRef.current.get('2')).toBe(false);
    });

    it('should handle empty localStorage gracefully', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderFoldState({
        currentConfig: { type: 'project', projectId: 'p1' },
      });

      expect(result.current.openStateRef.current.size).toBe(0);
    });

    it('should handle corrupted localStorage JSON', () => {
      localStorageMock.getItem.mockReturnValue('not-valid-json');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderFoldState({
        currentConfig: { type: 'project', projectId: 'p1' },
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // Legacy milestone ID migration
  // =========================================================================

  describe('milestone ID migration', () => {
    it('should migrate legacy milestone IDs (10000+) to m-{iid} format', () => {
      // Legacy IDs: 10001, 10002 → should become m-1, m-2
      localStorageMock.getItem.mockReturnValue(
        JSON.stringify({ '10001': true, '10002': false, '42': true }),
      );

      const { result } = renderFoldState({
        currentConfig: { type: 'project', projectId: 'p1' },
      });

      // Legacy IDs should be migrated
      expect(result.current.openStateRef.current.has('m-1')).toBe(true);
      expect(result.current.openStateRef.current.has('m-2')).toBe(true);
      // Non-legacy IDs should remain
      expect(result.current.openStateRef.current.has('42')).toBe(true);
      // Original legacy keys should not exist
      expect(result.current.openStateRef.current.has('10001')).toBe(false);
    });

    it('should save migrated state back to localStorage', () => {
      localStorageMock.getItem.mockReturnValue(
        JSON.stringify({ '10001': true }),
      );

      renderFoldState({
        currentConfig: { type: 'project', projectId: 'p1' },
      });

      // Should have saved the migrated state back
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'gantt-foldstate-project-p1',
        expect.stringContaining('m-1'),
      );
    });

    it('should not re-save when no migration needed', () => {
      localStorageMock.getItem.mockReturnValue(
        JSON.stringify({ '42': true, 'm-1': false }),
      );

      renderFoldState({
        currentConfig: { type: 'project', projectId: 'p1' },
      });

      // setItem should NOT be called since no migration was needed
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Group toggle events
  // =========================================================================

  describe('group toggle events', () => {
    it('should add group to collapsed set on collapse event', () => {
      const setCollapsedGroups = vi.fn();
      renderFoldState({ setCollapsedGroups });

      act(() => {
        window.dispatchEvent(
          new CustomEvent('gantt-group-toggle', {
            detail: { groupId: 'group-1', collapsed: true },
          }),
        );
      });

      expect(setCollapsedGroups).toHaveBeenCalled();
      // Call the updater function to verify behavior
      const updater = setCollapsedGroups.mock.calls[0][0];
      const result = updater(new Set());
      expect(result.has('group-1')).toBe(true);
    });

    it('should remove group from collapsed set on expand event', () => {
      const setCollapsedGroups = vi.fn();
      renderFoldState({ setCollapsedGroups });

      act(() => {
        window.dispatchEvent(
          new CustomEvent('gantt-group-toggle', {
            detail: { groupId: 'group-1', collapsed: false },
          }),
        );
      });

      expect(setCollapsedGroups).toHaveBeenCalled();
      const updater = setCollapsedGroups.mock.calls[0][0];
      const result = updater(new Set(['group-1', 'group-2']));
      expect(result.has('group-1')).toBe(false);
      expect(result.has('group-2')).toBe(true);
    });
  });

  // =========================================================================
  // registerFoldHandlers
  // =========================================================================

  describe('registerFoldHandlers', () => {
    it('should register open-task listener on gantt API', () => {
      const { result } = renderFoldState();
      const mockGanttApi = {
        on: vi.fn(),
        getTask: vi.fn(),
      };

      result.current.registerFoldHandlers(mockGanttApi);

      expect(mockGanttApi.on).toHaveBeenCalledWith(
        'open-task',
        expect.any(Function),
      );
    });

    it('should save fold state when a regular task is toggled', () => {
      const { result } = renderFoldState({
        currentConfig: { type: 'project', projectId: 'p1' },
      });

      const mockGanttApi = {
        on: vi.fn(),
        getTask: vi.fn().mockReturnValue({ id: 42, text: 'Task' }),
      };

      result.current.registerFoldHandlers(mockGanttApi);

      // Get the registered handler and call it
      const handler = mockGanttApi.on.mock.calls[0][1];
      handler({ id: 42, mode: true });

      // openStateRef should be updated
      expect(result.current.openStateRef.current.get('42')).toBe(true);
    });

    it('should dispatch group toggle event for group headers', () => {
      const { result } = renderFoldState();

      const mockGanttApi = {
        on: vi.fn(),
        getTask: vi.fn().mockReturnValue({ id: 'g1', $groupHeader: true }),
      };

      result.current.registerFoldHandlers(mockGanttApi);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const handler = mockGanttApi.on.mock.calls[0][1];
      handler({ id: 'g1', mode: true });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'gantt-group-toggle',
          detail: { groupId: 'g1', collapsed: false }, // !mode
        }),
      );

      dispatchSpy.mockRestore();
    });

    it('should use string keys for consistency with localStorage', () => {
      const { result } = renderFoldState({
        currentConfig: { type: 'project', projectId: 'p1' },
      });

      const mockGanttApi = {
        on: vi.fn(),
        getTask: vi.fn().mockReturnValue({ id: 123, text: 'Task' }),
      };

      result.current.registerFoldHandlers(mockGanttApi);

      const handler = mockGanttApi.on.mock.calls[0][1];
      handler({ id: 123, mode: false });

      // Should store as string key "123", not number 123
      expect(result.current.openStateRef.current.has('123')).toBe(true);
      expect(result.current.openStateRef.current.get('123')).toBe(false);
    });
  });
});
