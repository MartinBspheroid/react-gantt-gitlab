/**
 * useGanttState Hook Tests
 * Tests for Gantt state management: localStorage persistence, debounced updates,
 * and effective cell width calculation per unit.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGanttState } from '../useGanttState';

describe('useGanttState', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    // Re-initialize localStorage mock after restoreAllMocks clears it
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    global.localStorage = localStorageMock as any;
    // Reset localStorage mock to return null by default (no saved values)
    (localStorage.getItem as any).mockReturnValue(null);
    (localStorage.setItem as any).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // localStorage persistence
  // =========================================================================

  describe('localStorage persistence', () => {
    it('should load cellWidth from localStorage on initialization', () => {
      (localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'gantt-cell-width') return '60';
        return null;
      });

      const { result } = renderHook(() => useGanttState());

      expect(result.current.cellWidth).toBe(60);
      expect(localStorage.getItem).toHaveBeenCalledWith('gantt-cell-width');
    });

    it('should use default cellWidth (40) when localStorage is empty', () => {
      const { result } = renderHook(() => useGanttState());
      expect(result.current.cellWidth).toBe(40);
    });

    it('should load cellHeight from localStorage on initialization', () => {
      (localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'gantt-cell-height') return '50';
        return null;
      });

      const { result } = renderHook(() => useGanttState());

      expect(result.current.cellHeight).toBe(50);
      expect(localStorage.getItem).toHaveBeenCalledWith('gantt-cell-height');
    });

    it('should use default cellHeight (38) when localStorage is empty', () => {
      const { result } = renderHook(() => useGanttState());
      expect(result.current.cellHeight).toBe(38);
    });

    it('should load lengthUnit from localStorage on initialization', () => {
      (localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'gantt-length-unit') return 'week';
        return null;
      });

      const { result } = renderHook(() => useGanttState());

      expect(result.current.lengthUnit).toBe('week');
      expect(localStorage.getItem).toHaveBeenCalledWith('gantt-length-unit');
    });

    it('should use default lengthUnit (day) when localStorage is empty', () => {
      const { result } = renderHook(() => useGanttState());
      expect(result.current.lengthUnit).toBe('day');
    });

    it('should save cellWidth to localStorage when it changes', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.setCellWidth(55);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'gantt-cell-width',
        '55',
      );
    });

    it('should save cellHeight to localStorage when it changes', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.setCellHeight(42);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'gantt-cell-height',
        '42',
      );
    });

    it('should save lengthUnit to localStorage when it changes', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.setLengthUnit('month');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'gantt-length-unit',
        'month',
      );
    });
  });

  // =========================================================================
  // Debounced updates
  // =========================================================================

  describe('debounced updates', () => {
    it('should update cellWidthDisplay immediately but debounce cellWidth', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.handleCellWidthChange(70);
      });

      // Display updates immediately
      expect(result.current.cellWidthDisplay).toBe(70);
      // Actual cellWidth not yet updated (debounced)
      expect(result.current.cellWidth).toBe(40); // still default

      // Advance past debounce timeout (100ms)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Now cellWidth should be updated
      expect(result.current.cellWidth).toBe(70);
    });

    it('should update cellHeightDisplay immediately but debounce cellHeight', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.handleCellHeightChange(50);
      });

      // Display updates immediately
      expect(result.current.cellHeightDisplay).toBe(50);
      // Actual cellHeight not yet updated (debounced)
      expect(result.current.cellHeight).toBe(38); // still default

      // Advance past debounce timeout (100ms)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Now cellHeight should be updated
      expect(result.current.cellHeight).toBe(50);
    });

    it('should cancel previous debounce when called rapidly', () => {
      const { result } = renderHook(() => useGanttState());

      // Rapidly call handleCellWidthChange multiple times
      act(() => {
        result.current.handleCellWidthChange(50);
      });
      act(() => {
        result.current.handleCellWidthChange(60);
      });
      act(() => {
        result.current.handleCellWidthChange(70);
      });

      // Display should reflect the latest call
      expect(result.current.cellWidthDisplay).toBe(70);

      // Before timeout, cellWidth should still be default
      expect(result.current.cellWidth).toBe(40);

      // After timeout, only the latest value should be applied
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.cellWidth).toBe(70);
    });
  });

  // =========================================================================
  // Effective cell width
  // =========================================================================

  describe('effective cell width', () => {
    it('should return user-controlled cellWidth when unit is day', () => {
      const { result } = renderHook(() => useGanttState());

      // Default unit is 'day', default cellWidth is 40
      expect(result.current.effectiveCellWidth).toBe(40);

      // Change cellWidth - effective should follow
      act(() => {
        result.current.setCellWidth(55);
      });

      expect(result.current.effectiveCellWidth).toBe(55);
    });

    it('should return 80 for hour unit regardless of cellWidth', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.setLengthUnit('hour');
      });

      expect(result.current.effectiveCellWidth).toBe(80);
    });

    it('should return 100 for week unit regardless of cellWidth', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.setLengthUnit('week');
      });

      expect(result.current.effectiveCellWidth).toBe(100);
    });

    it('should return 120 for month unit regardless of cellWidth', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.setLengthUnit('month');
      });

      expect(result.current.effectiveCellWidth).toBe(120);
    });

    it('should return 150 for quarter unit regardless of cellWidth', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.setLengthUnit('quarter');
      });

      expect(result.current.effectiveCellWidth).toBe(150);
    });

    it('should revert to user cellWidth when switching back to day unit', () => {
      const { result } = renderHook(() => useGanttState());

      act(() => {
        result.current.setCellWidth(55);
      });

      act(() => {
        result.current.setLengthUnit('month');
      });

      expect(result.current.effectiveCellWidth).toBe(120);

      act(() => {
        result.current.setLengthUnit('day');
      });

      expect(result.current.effectiveCellWidth).toBe(55);
    });
  });

  // =========================================================================
  // Initial state
  // =========================================================================

  describe('initial state', () => {
    it('should initialize modal states to false/empty', () => {
      const { result } = renderHook(() => useGanttState());

      expect(result.current.showMoveInModal).toBe(false);
      expect(result.current.showSaveBlueprintModal).toBe(false);
      expect(result.current.showApplyBlueprintModal).toBe(false);
      expect(result.current.showBlueprintManager).toBe(false);
      expect(result.current.createItemDialogOpen).toBe(false);
      expect(result.current.deleteDialogOpen).toBe(false);
      expect(result.current.discardChangesDialogOpen).toBe(false);
    });

    it('should initialize dateEditable to true', () => {
      const { result } = renderHook(() => useGanttState());
      expect(result.current.dateEditable).toBe(true);
    });
  });
});
