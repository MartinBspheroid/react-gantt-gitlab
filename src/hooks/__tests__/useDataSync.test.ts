/**
 * useDataSync Hook Tests
 * Tests for data synchronization hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDataSync } from '../useDataSync';
import type { DataProviderInterface } from '../../providers/core/DataProviderInterface';

describe('useDataSync', () => {
  let mockProvider: DataProviderInterface;

  beforeEach(() => {
    mockProvider = {
      sync: vi.fn().mockResolvedValue({
        tasks: [{ id: 1, title: 'Task 1', start: new Date(), end: new Date() }],
        links: [],
        metadata: {},
      }),
      syncTask: vi.fn(),
      createTask: vi.fn(),
      deleteTask: vi.fn(),
      createLink: vi.fn(),
      deleteLink: vi.fn(),
      reorderTask: vi.fn(),
      getFilterOptions: vi.fn(),
      checkCanEdit: vi.fn(),
      getConfig: vi.fn(),
    } as any;
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useDataSync(mockProvider));

    expect(result.current.syncState.isLoading).toBe(true);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.links).toEqual([]);
  });

  it('should load data on sync', async () => {
    const { result } = renderHook(() => useDataSync(mockProvider));

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => {
      expect(result.current.syncState.isLoading).toBe(false);
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].title).toBe('Task 1');
    });
  });

  it('should handle sync errors', async () => {
    const error = new Error('Sync failed');
    mockProvider.sync = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useDataSync(mockProvider));

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => {
      expect(result.current.syncState.error).toBeTruthy();
      expect(result.current.syncState.isLoading).toBe(false);
    });
  });

  it('should create tasks', async () => {
    const newTask = { title: 'New Task' };
    const createdTask = {
      ...newTask,
      id: 2,
      start: new Date(),
      end: new Date(),
    };

    mockProvider.createTask = vi.fn().mockResolvedValue(createdTask);

    const { result } = renderHook(() => useDataSync(mockProvider));

    let createdResult: any;
    await act(async () => {
      createdResult = await result.current.createTask(newTask as any);
    });

    expect(mockProvider.createTask).toHaveBeenCalledWith(newTask);
    expect(createdResult.id).toBe(2);
  });

  it('should delete tasks', async () => {
    mockProvider.deleteTask = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useDataSync(mockProvider));

    await act(async () => {
      await result.current.deleteTask(1);
    });

    expect(mockProvider.deleteTask).toHaveBeenCalledWith(1);
  });

  it('should handle provider changes by clearing data', async () => {
    const { result, rerender } = renderHook(
      ({ provider }) => useDataSync(provider),
      { initialProps: { provider: mockProvider } },
    );

    // Change provider to null
    rerender({ provider: null });

    expect(result.current.tasks).toEqual([]);
    expect(result.current.links).toEqual([]);
    expect(result.current.syncState.isLoading).toBe(false);
  });

  it('should reorder tasks locally', () => {
    const initialTasks = [
      { id: 1, title: 'Task 1', _gitlab: { relativePosition: 1000 } } as any,
      { id: 2, title: 'Task 2', _gitlab: { relativePosition: 2000 } } as any,
      { id: 3, title: 'Task 3', _gitlab: { relativePosition: 3000 } } as any,
    ];

    const { result } = renderHook(() =>
      useDataSync(mockProvider, false, 60000, {}),
    );

    act(() => {
      // Set initial tasks
      result.current.sync();
    });

    // Reorder task
    const { rollback } = result.current.reorderTaskLocal(1, 3, 'after');

    expect(rollback).toBeDefined();
    expect(typeof rollback).toBe('function');
  });
});
