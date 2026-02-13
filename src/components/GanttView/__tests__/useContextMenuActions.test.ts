/**
 * useContextMenuActions Hook Tests
 * Tests for context menu option building, action handling, and Move In functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextMenuActions } from '../useContextMenuActions';

function createMockDeps(overrides: Record<string, any> = {}): any {
  return {
    api: {
      getState: vi.fn().mockReturnValue({ _selected: [] }),
      getTask: vi.fn(),
      exec: vi.fn(),
    },
    provider: {
      batchUpdateParent: vi.fn().mockResolvedValue({ success: [1], failed: [] }),
      batchUpdateMilestone: vi.fn().mockResolvedValue({ success: [1], failed: [] }),
      batchUpdateEpic: vi.fn().mockResolvedValue({ success: [1], failed: [] }),
    },
    syncTask: vi.fn().mockResolvedValue({}),
    sync: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
    setShowMoveInModal: vi.fn(),
    setShowSaveBlueprintModal: vi.fn(),
    setShowApplyBlueprintModal: vi.fn(),
    setSelectedMilestoneForBlueprint: vi.fn(),
    setMoveInProcessing: vi.fn(),
    ...overrides,
  };
}

describe('useContextMenuActions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // contextMenuOptions
  // =========================================================================

  describe('contextMenuOptions', () => {
    it('should include custom options: open-in-ado, change-state, assign-to', () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));
      const options = result.current.contextMenuOptions;

      const ids = options.filter((o) => o.id).map((o) => o.id);
      expect(ids).toContain('open-in-ado');
      expect(ids).toContain('change-state');
      expect(ids).toContain('assign-to');
    });

    it('should include move-in option', () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));
      const options = result.current.contextMenuOptions;

      const moveIn = options.find((o) => o.id === 'move-in')!;
      expect(moveIn).toBeDefined();
      expect(moveIn.text).toBe('Move In...');
    });

    it('should include split-task option', () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));
      const options = result.current.contextMenuOptions;

      const split = options.find((o) => o.id === 'split-task');
      expect(split).toBeDefined();
    });

    it('should include blueprint options', () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));
      const options = result.current.contextMenuOptions;

      const saveBlueprint = options.find((o) => o.id === 'save-as-blueprint');
      const createFromBlueprint = options.find((o) => o.id === 'create-from-blueprint');
      expect(saveBlueprint).toBeDefined();
      expect(createFromBlueprint).toBeDefined();
    });

    // Check functions for context menu items
    describe('check functions', () => {
      it('open-in-ado should require webUrl or url', () => {
        const deps = createMockDeps();
        const { result } = renderHook(() => useContextMenuActions(deps));
        const option: any = result.current.contextMenuOptions.find(
          (o) => o.id === 'open-in-ado',
        );

        expect(option.check({ _source: { webUrl: 'https://dev.azure.com' } })).toBeTruthy();
        expect(option.check({ _source: { url: 'https://dev.azure.com' } })).toBeTruthy();
        expect(option.check({ _source: {} })).toBeFalsy();
        expect(option.check(null)).toBeFalsy();
      });

      it('change-state should exclude milestones', () => {
        const deps = createMockDeps();
        const { result } = renderHook(() => useContextMenuActions(deps));
        const option: any = result.current.contextMenuOptions.find(
          (o) => o.id === 'change-state',
        );

        expect(option.check({ id: 1 })).toBeTruthy();
        expect(option.check({ id: 1, $isMilestone: true })).toBeFalsy();
        expect(option.check({ id: 1, _source: { type: 'milestone' } })).toBeFalsy();
      });

      it('split-task should exclude milestones, summaries, and already-split tasks', () => {
        const deps = createMockDeps();
        const { result } = renderHook(() => useContextMenuActions(deps));
        const option: any = result.current.contextMenuOptions.find(
          (o) => o.id === 'split-task',
        );

        expect(option.check(null)).toBe(false);
        expect(option.check({ type: 'milestone' })).toBe(false);
        expect(option.check({ type: 'summary' })).toBe(false);
        expect(
          option.check({ splitParts: [1, 2], start: new Date(), end: new Date() }),
        ).toBe(false);
        expect(
          option.check({ start: new Date(), end: new Date() }),
        ).toBe(true);
      });

      it('save-as-blueprint should only show for milestones', () => {
        const deps = createMockDeps();
        const { result } = renderHook(() => useContextMenuActions(deps));
        const option: any = result.current.contextMenuOptions.find(
          (o) => o.id === 'save-as-blueprint',
        );

        expect(option.check({ _source: { type: 'milestone' } })).toBeTruthy();
        expect(option.check({ _source: { type: 'issue' } })).toBeFalsy();
      });
    });
  });

  // =========================================================================
  // handleContextMenuClick
  // =========================================================================

  describe('handleContextMenuClick', () => {
    it('should open Move In modal on move-in action', async () => {
      const deps = createMockDeps();
      deps.api.getState.mockReturnValue({ _selected: [{ id: 1 }] });

      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleContextMenuClick({
          action: { id: 'move-in' },
          context: {},
        });
      });

      expect(deps.setShowMoveInModal).toHaveBeenCalledWith(true);
    });

    it('should open Save Blueprint modal for milestones', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      const milestoneCtx = { _source: { type: 'milestone' } };

      await act(async () => {
        await result.current.handleContextMenuClick({
          action: { id: 'save-as-blueprint' },
          context: milestoneCtx,
        });
      });

      expect(deps.setSelectedMilestoneForBlueprint).toHaveBeenCalledWith(milestoneCtx);
      expect(deps.setShowSaveBlueprintModal).toHaveBeenCalledWith(true);
    });

    it('should open Apply Blueprint modal', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleContextMenuClick({
          action: { id: 'create-from-blueprint' },
          context: {},
        });
      });

      expect(deps.setShowApplyBlueprintModal).toHaveBeenCalledWith(true);
    });

    it('should open in ADO via window.open', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      await act(async () => {
        await result.current.handleContextMenuClick({
          action: { id: 'open-in-ado' },
          context: { _source: { webUrl: 'https://dev.azure.com/item/1' } },
        });
      });

      expect(openSpy).toHaveBeenCalledWith(
        'https://dev.azure.com/item/1',
        '_blank',
        'noopener,noreferrer',
      );
      openSpy.mockRestore();
    });

    it('should change task state via syncTask', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleContextMenuClick({
          action: { id: 'change-state:closed' },
          context: { id: 42 },
        });
      });

      expect(deps.syncTask).toHaveBeenCalledWith(42, { state: 'closed' });
      expect(deps.showToast).toHaveBeenCalledWith(
        'State changed to closed',
        'success',
      );
      expect(deps.sync).toHaveBeenCalled();
    });

    it('should show error toast on state change failure', async () => {
      const deps = createMockDeps();
      deps.syncTask.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleContextMenuClick({
          action: { id: 'change-state:open' },
          context: { id: 1 },
        });
      });

      expect(deps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to change state'),
        'error',
      );
    });

    it('should assign task via syncTask', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleContextMenuClick({
          action: { id: 'assign-to:Alice' },
          context: { id: 42 },
        });
      });

      expect(deps.syncTask).toHaveBeenCalledWith(42, { assigned: 'Alice' });
      expect(deps.showToast).toHaveBeenCalledWith('Assigned to Alice', 'success');
    });

    it('should unassign task when selecting unassigned', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleContextMenuClick({
          action: { id: 'assign-to:unassigned' },
          context: { id: 42 },
        });
      });

      expect(deps.syncTask).toHaveBeenCalledWith(42, { assigned: '' });
      expect(deps.showToast).toHaveBeenCalledWith('Unassigned', 'success');
    });
  });

  // =========================================================================
  // handleMoveIn
  // =========================================================================

  describe('handleMoveIn', () => {
    it('should batch update parent for parent move type', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleMoveIn('parent', 10, [
          { id: '1' },
          { id: '2' },
        ]);
      });

      expect(deps.provider.batchUpdateParent).toHaveBeenCalledWith([1, 2], 10);
      expect(deps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Successfully moved'),
        'success',
      );
      expect(deps.setShowMoveInModal).toHaveBeenCalledWith(false);
    });

    it('should batch update milestone for milestone move type', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleMoveIn('milestone', 5, [{ id: '1' }]);
      });

      expect(deps.provider.batchUpdateMilestone).toHaveBeenCalledWith([1], 5);
    });

    it('should batch update epic for epic move type', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleMoveIn('epic', 7, [{ id: '1' }]);
      });

      expect(deps.provider.batchUpdateEpic).toHaveBeenCalledWith([1], 7);
    });

    it('should show warning toast for partial failure', async () => {
      const deps = createMockDeps();
      deps.provider.batchUpdateParent.mockResolvedValue({
        success: [1],
        failed: [{ iid: 2, error: 'Not found' }],
      });

      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleMoveIn('parent', 10, [
          { id: '1' },
          { id: '2' },
        ]);
      });

      expect(deps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('1 failed'),
        'warning',
      );
    });

    it('should show error toasts for complete failure', async () => {
      const deps = createMockDeps();
      deps.provider.batchUpdateParent.mockResolvedValue({
        success: [],
        failed: [{ iid: 1, error: 'Error 1' }],
      });

      const { result } = renderHook(() => useContextMenuActions(deps));

      await expect(
        act(async () => {
          await result.current.handleMoveIn('parent', 10, [{ id: '1' }]);
        }),
      ).rejects.toThrow('Move operation failed');

      expect(deps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('#1: Error 1'),
        'error',
      );
    });

    it('should do nothing when items is empty', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      await act(async () => {
        await result.current.handleMoveIn('parent', 10, []);
      });

      expect(deps.provider.batchUpdateParent).not.toHaveBeenCalled();
    });

    it('should throw for unknown move type', async () => {
      const deps = createMockDeps();
      const { result } = renderHook(() => useContextMenuActions(deps));

      await expect(
        act(async () => {
          await result.current.handleMoveIn('unknown', 10, [{ id: '1' }]);
        }),
      ).rejects.toThrow('Unknown move type');
    });

    it('should always reset processing state in finally', async () => {
      const deps = createMockDeps();
      deps.provider.batchUpdateParent.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useContextMenuActions(deps));

      try {
        await act(async () => {
          await result.current.handleMoveIn('parent', 10, [{ id: '1' }]);
        });
      } catch {
        // expected
      }

      expect(deps.setMoveInProcessing).toHaveBeenCalledWith(true);
      expect(deps.setMoveInProcessing).toHaveBeenCalledWith(false);
    });
  });
});
