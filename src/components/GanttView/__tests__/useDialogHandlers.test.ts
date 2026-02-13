/**
 * useDialogHandlers Hook Tests
 * Tests for create/delete/discard dialog confirmation handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDialogHandlers } from '../useDialogHandlers';

function createMockDeps(overrides: Record<string, any> = {}): any {
  return {
    api: {
      exec: vi.fn(),
    },
    allTasksRef: { current: [] as any[] },
    pendingEditorChangesRef: { current: new Map() },
    pendingAddTaskContextRef: { current: null as any },
    pendingDeleteTaskIdsRef: { current: [] as any[] },
    createMilestone: vi.fn().mockResolvedValue({}),
    createTask: vi.fn().mockResolvedValue({}),
    syncTask: vi.fn().mockResolvedValue({}),
    sync: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
    createItemDialogType: 'milestone',
    setCreateItemDialogOpen: vi.fn(),
    setDeleteDialogOpen: vi.fn(),
    setDeleteDialogItems: vi.fn(),
    setDiscardChangesDialogOpen: vi.fn(),
    ...overrides,
  };
}

describe('useDialogHandlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // handleCreateItemConfirm - Milestone creation
  // =========================================================================

  describe('handleCreateItemConfirm (milestone)', () => {
    it('should create a milestone with title and description', async () => {
      const deps = createMockDeps({ createItemDialogType: 'milestone' });
      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleCreateItemConfirm([
          { title: 'Sprint 1', description: 'First sprint' },
        ]);
      });

      expect(deps.createMilestone).toHaveBeenCalledWith({
        text: 'Sprint 1',
        details: 'First sprint',
        parent: 0,
      });
      expect(deps.setCreateItemDialogOpen).toHaveBeenCalledWith(false);
    });

    it('should handle empty description', async () => {
      const deps = createMockDeps({ createItemDialogType: 'milestone' });
      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleCreateItemConfirm([
          { title: 'Sprint 1' },
        ]);
      });

      expect(deps.createMilestone).toHaveBeenCalledWith(
        expect.objectContaining({ details: '' }),
      );
    });

    it('should show error toast on milestone creation failure', async () => {
      const deps = createMockDeps({
        createItemDialogType: 'milestone',
        createMilestone: vi.fn().mockRejectedValue(new Error('API error')),
      });
      const { result } = renderHook(() => useDialogHandlers(deps));

      await expect(
        act(async () => {
          await result.current.handleCreateItemConfirm([
            { title: 'Sprint 1' },
          ]);
        }),
      ).rejects.toThrow('API error');

      expect(deps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create milestone'),
        'error',
      );
    });
  });

  // =========================================================================
  // handleCreateItemConfirm - Issue/Task creation
  // =========================================================================

  describe('handleCreateItemConfirm (issue/task)', () => {
    it('should close dialog when no pending context', async () => {
      const deps = createMockDeps({
        createItemDialogType: 'issue',
      });
      deps.pendingAddTaskContextRef.current = null;

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleCreateItemConfirm([
          { title: 'New Issue' },
        ]);
      });

      expect(deps.createTask).not.toHaveBeenCalled();
      expect(deps.setCreateItemDialogOpen).toHaveBeenCalledWith(false);
    });

    it('should create an issue under a milestone', async () => {
      const deps = createMockDeps({ createItemDialogType: 'issue' });
      deps.pendingAddTaskContextRef.current = {
        baseTask: { text: '' },
        parentTask: {
          $isMilestone: true,
          _source: { globalId: 'gid://milestone/1' },
        },
        itemType: 'issue',
      };

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleCreateItemConfirm([
          { title: 'Issue 1', description: 'Desc' },
        ]);
      });

      expect(deps.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Issue 1',
          details: 'Desc',
          _source: expect.objectContaining({
            milestoneGlobalId: 'gid://milestone/1',
          }),
        }),
      );
      expect(deps.sync).toHaveBeenCalled();
      expect(deps.pendingAddTaskContextRef.current).toBeNull();
    });

    it('should create a task under an issue with parent set', async () => {
      const deps = createMockDeps({ createItemDialogType: 'task' });
      deps.pendingAddTaskContextRef.current = {
        baseTask: { text: '' },
        parentTask: { id: 42, $isIssue: true },
        itemType: 'task',
      };

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleCreateItemConfirm([
          { title: 'Task 1', assignees: ['Alice', 'Bob'] },
        ]);
      });

      expect(deps.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Task 1',
          parent: 42,
          assigned: 'Alice, Bob',
        }),
      );
    });

    it('should handle batch creation of multiple items', async () => {
      const deps = createMockDeps({ createItemDialogType: 'issue' });
      deps.pendingAddTaskContextRef.current = {
        baseTask: { text: '' },
        parentTask: null,
        itemType: 'issue',
      };

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleCreateItemConfirm([
          { title: 'Issue 1' },
          { title: 'Issue 2' },
          { title: 'Issue 3' },
        ]);
      });

      expect(deps.createTask).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // handleDiscardChangesConfirm
  // =========================================================================

  describe('handleDiscardChangesConfirm', () => {
    it('should clear pending changes and close editor', () => {
      const deps = createMockDeps();
      deps.pendingEditorChangesRef.current.set(1, { text: 'changed' });

      const { result } = renderHook(() => useDialogHandlers(deps));

      act(() => {
        result.current.handleDiscardChangesConfirm();
      });

      expect(deps.pendingEditorChangesRef.current.size).toBe(0);
      expect(deps.api.exec).toHaveBeenCalledWith('close-editor');
      expect(deps.sync).toHaveBeenCalled();
      expect(deps.setDiscardChangesDialogOpen).toHaveBeenCalledWith(false);
    });

    it('should handle missing api gracefully', () => {
      const deps = createMockDeps({ api: null });
      const { result } = renderHook(() => useDialogHandlers(deps));

      act(() => {
        result.current.handleDiscardChangesConfirm();
      });

      expect(deps.setDiscardChangesDialogOpen).toHaveBeenCalledWith(false);
    });
  });

  // =========================================================================
  // handleDeleteConfirm
  // =========================================================================

  describe('handleDeleteConfirm', () => {
    it('should close dialog when no pending task IDs', async () => {
      const deps = createMockDeps();
      deps.pendingDeleteTaskIdsRef.current = [];

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleDeleteConfirm('delete');
      });

      expect(deps.setDeleteDialogOpen).toHaveBeenCalledWith(false);
      expect(deps.api.exec).not.toHaveBeenCalled();
    });

    it('should execute delete-task for each task ID', async () => {
      const deps = createMockDeps();
      deps.pendingDeleteTaskIdsRef.current = [1, 2, 3];
      deps.allTasksRef.current = [
        { id: 1, parent: 0 },
        { id: 2, parent: 0 },
        { id: 3, parent: 0 },
      ];

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleDeleteConfirm('delete');
      });

      expect(deps.api.exec).toHaveBeenCalledTimes(3);
      expect(deps.api.exec).toHaveBeenCalledWith('delete-task', {
        id: expect.any(Number),
        skipHandler: true,
      });
      // Should clean up
      expect(deps.pendingDeleteTaskIdsRef.current).toEqual([]);
      expect(deps.setDeleteDialogItems).toHaveBeenCalledWith([]);
    });

    it('should expand to descendants when recursive is true', async () => {
      const deps = createMockDeps();
      deps.pendingDeleteTaskIdsRef.current = [1];
      deps.allTasksRef.current = [
        { id: 1, parent: 0 },
        { id: 2, parent: 1 },
        { id: 3, parent: 2 },
      ];

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleDeleteConfirm('delete', { recursive: true });
      });

      // Should delete 3 items (1 + 2 children), deepest first
      expect(deps.api.exec).toHaveBeenCalledTimes(3);
    });

    it('should close tasks via syncTask for close action', async () => {
      const deps = createMockDeps();
      deps.pendingDeleteTaskIdsRef.current = [1, 2];
      deps.allTasksRef.current = [
        { id: 1, parent: 0 },
        { id: 2, parent: 0 },
      ];

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleDeleteConfirm('close');
      });

      expect(deps.syncTask).toHaveBeenCalledWith(1, { state: 'closed' });
      expect(deps.syncTask).toHaveBeenCalledWith(2, { state: 'closed' });
      expect(deps.sync).toHaveBeenCalled();
      expect(deps.showToast).toHaveBeenCalledWith(
        '2 items closed successfully',
        'success',
      );
    });

    it('should skip milestones when closing', async () => {
      const deps = createMockDeps();
      deps.pendingDeleteTaskIdsRef.current = [1, 2];
      deps.allTasksRef.current = [
        { id: 1, parent: 0, $isMilestone: true },
        { id: 2, parent: 0 },
      ];

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleDeleteConfirm('close');
      });

      // Should only close task 2, skip milestone 1
      expect(deps.syncTask).toHaveBeenCalledTimes(1);
      expect(deps.syncTask).toHaveBeenCalledWith(2, { state: 'closed' });
    });

    it('should show error toast on failure', async () => {
      const deps = createMockDeps();
      deps.pendingDeleteTaskIdsRef.current = [1];
      deps.allTasksRef.current = [{ id: 1, parent: 0 }];
      deps.api.exec.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const { result } = renderHook(() => useDialogHandlers(deps));

      await act(async () => {
        await result.current.handleDeleteConfirm('delete');
      });

      expect(deps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete'),
        'error',
      );
    });
  });
});
