import { describe, it, expect } from 'vitest';
import {
  getWorkItemIconConfig,
  renderWorkItemIcon,
} from '../WorkItemTypeIcons';

describe('WorkItemTypeIcons', () => {
  describe('getWorkItemIconConfig', () => {
    describe('ADO types', () => {
      it('should return User Story icon for ADO tasks with User Story type', () => {
        const task = { _ado: { workItemType: 'User Story' } };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#3983eb');
      });

      it('should return Bug icon for ADO tasks with Bug type', () => {
        const task = { _ado: { workItemType: 'Bug' } };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#dc3545');
      });

      it('should return Task icon for ADO tasks with Task type', () => {
        const task = { _ado: { workItemType: 'Task' } };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#00ba94');
      });

      it('should return Feature icon for ADO tasks with Feature type', () => {
        const task = { _ado: { workItemType: 'Feature' } };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#fd7e14');
      });

      it('should return Epic icon for ADO tasks with Epic type', () => {
        const task = { _ado: { workItemType: 'Epic' } };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#6f42c1');
      });

      it('should handle case-insensitive ADO types', () => {
        const task = { _ado: { workItemType: 'USER STORY' } };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#3983eb');
      });
    });

    describe('GitLab types', () => {
      it('should return Milestone icon for GitLab milestones', () => {
        const task = { _gitlab: { type: 'milestone' } };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#ad44ab');
      });

      it('should return Milestone icon for tasks with $isMilestone', () => {
        const task = { $isMilestone: true };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#ad44ab');
      });

      it('should return Task icon for GitLab Tasks', () => {
        const task = { _gitlab: { workItemType: 'Task' } };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#00ba94');
      });

      it('should return Issue icon for GitLab Issues', () => {
        const task = { _gitlab: {} };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#3983eb');
      });
    });

    describe('fallback', () => {
      it('should return null for tasks without type metadata', () => {
        const task = {};
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).toBeNull();
      });

      it('should use workItemType property for generic tasks', () => {
        const task = { workItemType: 'Bug' };
        const config = getWorkItemIconConfig(task, 'fontawesome');
        expect(config).not.toBeNull();
        expect(config?.color).toBe('#dc3545');
      });
    });

    describe('emoji mode', () => {
      it('should return emoji icons in emoji mode', () => {
        const task = { _ado: { workItemType: 'Bug' } };
        const config = getWorkItemIconConfig(task, 'emoji');
        expect(config).not.toBeNull();
        expect(config?.icon).toBe('🐛');
      });

      it('should return emoji for User Story', () => {
        const task = { _ado: { workItemType: 'User Story' } };
        const config = getWorkItemIconConfig(task, 'emoji');
        expect(config).not.toBeNull();
        expect(config?.icon).toBe('📖');
      });

      it('should return emoji for Feature', () => {
        const task = { _ado: { workItemType: 'Feature' } };
        const config = getWorkItemIconConfig(task, 'emoji');
        expect(config).not.toBeNull();
        expect(config?.icon).toBe('⭐');
      });
    });
  });

  describe('renderWorkItemIcon', () => {
    it('should render FontAwesome icon for ADO User Story', () => {
      const task = { _ado: { workItemType: 'User Story' } };
      const icon = renderWorkItemIcon(task, 'fontawesome');
      expect(icon).not.toBeNull();
    });

    it('should render emoji for Bug in emoji mode', () => {
      const task = { _ado: { workItemType: 'Bug' } };
      const icon = renderWorkItemIcon(task, 'emoji');
      expect(icon).not.toBeNull();
    });

    it('should return null for tasks without type metadata', () => {
      const task = {};
      const icon = renderWorkItemIcon(task, 'fontawesome');
      expect(icon).toBeNull();
    });
  });
});
