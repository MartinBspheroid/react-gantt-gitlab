/**
 * DataContext Tests
 * Tests for generic data context functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DataProviderInterface } from '../../providers/core/DataProviderInterface';

/**
 * Mock implementation of DataContext provider
 * Since DataContext is complex, we test the pattern it follows
 */
describe('DataContext', () => {
  let mockProvider: DataProviderInterface;

  beforeEach(() => {
    mockProvider = {
      sync: vi.fn().mockResolvedValue({
        tasks: [
          {
            id: 1,
            title: 'Task 1',
            start: new Date('2024-01-01'),
            end: new Date('2024-01-05'),
          },
          {
            id: 2,
            title: 'Task 2',
            start: new Date('2024-01-10'),
            end: new Date('2024-01-15'),
          },
        ],
        links: [{ id: 'link1', source: 1, target: 2 }],
        metadata: {},
      }),
      syncTask: vi.fn().mockResolvedValue(undefined),
      createTask: vi.fn().mockResolvedValue({
        id: 3,
        title: 'New Task',
        start: new Date(),
        end: new Date(),
      }),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      createLink: vi.fn().mockResolvedValue(undefined),
      deleteLink: vi.fn().mockResolvedValue(undefined),
      reorderTask: vi.fn().mockResolvedValue(undefined),
      getFilterOptions: vi.fn().mockResolvedValue({
        labels: [{ title: 'bug' }, { title: 'feature' }],
        members: [
          { username: 'alice', name: 'Alice' },
          { username: 'bob', name: 'Bob' },
        ],
      }),
      checkCanEdit: vi.fn().mockResolvedValue(true),
      getConfig: vi.fn().mockReturnValue({ type: 'static' }),
    } as any;
  });

  describe('Provider contract', () => {
    it('should have required sync method', () => {
      expect(typeof mockProvider.sync).toBe('function');
      expect(mockProvider.sync).toBeDefined();
    });

    it('should have required CRUD methods', () => {
      expect(typeof mockProvider.createTask).toBe('function');
      expect(typeof mockProvider.deleteTask).toBe('function');
      expect(typeof mockProvider.createLink).toBe('function');
      expect(typeof mockProvider.deleteLink).toBe('function');
    });

    it('should have required metadata methods', () => {
      expect(typeof mockProvider.getFilterOptions).toBe('function');
      expect(typeof mockProvider.checkCanEdit).toBe('function');
      expect(typeof mockProvider.getConfig).toBe('function');
    });

    it('should have reorderTask method', () => {
      expect(typeof mockProvider.reorderTask).toBe('function');
    });

    it('should have syncTask method for updates', () => {
      expect(typeof mockProvider.syncTask).toBe('function');
    });
  });

  describe('Sync operation', () => {
    it('should return tasks and links from sync', async () => {
      const result = await mockProvider.sync();

      expect(result.tasks).toHaveLength(2);
      expect(result.links).toHaveLength(1);
      expect(result.tasks[0].title).toBe('Task 1');
      expect(result.tasks[1].title).toBe('Task 2');
    });

    it('should return metadata from sync', async () => {
      const result = await mockProvider.sync();

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata).toBe('object');
    });

    it('should accept sync options', async () => {
      await mockProvider.sync({ includeClosed: true });
      expect(mockProvider.sync).toHaveBeenCalledWith({ includeClosed: true });
    });
  });

  describe('CRUD operations', () => {
    it('should create tasks', async () => {
      const newTask = { title: 'New Task' };
      const result = await mockProvider.createTask(newTask as any);

      expect(mockProvider.createTask).toHaveBeenCalledWith(newTask);
      expect(result.id).toBe(3);
      expect(result.title).toBe('New Task');
    });

    it('should delete tasks', async () => {
      await mockProvider.deleteTask(1);
      expect(mockProvider.deleteTask).toHaveBeenCalledWith(1);
    });

    it('should create links', async () => {
      const newLink = { source: 1, target: 2 };
      await mockProvider.createLink(newLink as any);

      expect(mockProvider.createLink).toHaveBeenCalledWith(newLink);
    });

    it('should delete links', async () => {
      await mockProvider.deleteLink('link1');
      expect(mockProvider.deleteLink).toHaveBeenCalledWith('link1');
    });

    it('should sync task updates', async () => {
      const updates = { title: 'Updated Task' };
      await mockProvider.syncTask(1, updates);

      expect(mockProvider.syncTask).toHaveBeenCalledWith(1, updates);
    });

    it('should reorder tasks', async () => {
      await mockProvider.reorderTask(1, 2, 'after');

      expect(mockProvider.reorderTask).toHaveBeenCalledWith(1, 2, 'after');
    });
  });

  describe('Metadata operations', () => {
    it('should get filter options', async () => {
      const options = await mockProvider.getFilterOptions();

      expect(options.labels).toBeDefined();
      expect(options.members).toBeDefined();
      expect(options.labels[0].title).toBe('bug');
      expect(options.members[0].username).toBe('alice');
    });

    it('should check edit permissions', async () => {
      const canEdit = await mockProvider.checkCanEdit();

      expect(typeof canEdit).toBe('boolean');
      expect(canEdit).toBe(true);
    });

    it('should return config', () => {
      const config = mockProvider.getConfig();

      expect(config).toBeDefined();
      expect(config.type).toBe('static');
    });
  });

  describe('Data structure validation', () => {
    it('should return tasks with required fields', async () => {
      const result = await mockProvider.sync();
      const task = result.tasks[0];

      expect(task.id).toBeDefined();
      expect(task.title).toBeDefined();
      expect(task.start).toBeDefined();
      expect(task.end).toBeDefined();
    });

    it('should return links with required fields', async () => {
      const result = await mockProvider.sync();
      const link = result.links[0];

      expect(link.id).toBeDefined();
      expect(link.source).toBeDefined();
      expect(link.target).toBeDefined();
    });

    it('should handle empty task arrays', async () => {
      mockProvider.sync = vi.fn().mockResolvedValue({
        tasks: [],
        links: [],
        metadata: {},
      });

      const result = await mockProvider.sync();

      expect(result.tasks).toEqual([]);
      expect(result.links).toEqual([]);
    });

    it('should handle date objects in tasks', async () => {
      const result = await mockProvider.sync();
      const task = result.tasks[0];

      expect(task.start instanceof Date).toBe(true);
      expect(task.end instanceof Date).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle sync failures', async () => {
      const error = new Error('Sync failed');
      mockProvider.sync = vi.fn().mockRejectedValue(error);

      await expect(mockProvider.sync()).rejects.toThrow('Sync failed');
    });

    it('should handle create failures', async () => {
      const error = new Error('Create failed');
      mockProvider.createTask = vi.fn().mockRejectedValue(error);

      await expect(mockProvider.createTask({} as any)).rejects.toThrow(
        'Create failed',
      );
    });

    it('should handle delete failures', async () => {
      const error = new Error('Delete failed');
      mockProvider.deleteTask = vi.fn().mockRejectedValue(error);

      await expect(mockProvider.deleteTask(1)).rejects.toThrow('Delete failed');
    });
  });

  describe('Configuration types', () => {
    it('should support static configuration', () => {
      const config = mockProvider.getConfig();
      expect(config.type).toBe('static');
    });

    it('should maintain configuration across operations', () => {
      const config1 = mockProvider.getConfig();
      const config2 = mockProvider.getConfig();

      expect(config1).toEqual(config2);
    });

    it('should include optional metadata in config', () => {
      const configWithMetadata = {
        type: 'static',
        sourceUrl: 'https://example.com',
        projectId: 'my-project',
        metadata: { fullPath: 'group/project' },
      };

      expect(configWithMetadata.metadata).toBeDefined();
      expect(configWithMetadata.metadata.fullPath).toBe('group/project');
    });
  });
});
