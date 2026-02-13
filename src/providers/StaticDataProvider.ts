/**
 * StaticDataProvider
 *
 * In-memory data provider for demos and testing.
 * Implements DataProviderInterface with pre-loaded data.
 * No API calls - works standalone in the browser.
 */

import type { ITask, ILink } from '@svar-ui/gantt-store';
import type {
  DataProviderInterface,
  DataProviderConfig,
  DataResponse,
  SyncOptions,
  FilterOptionsData,
  BatchOperationResult,
} from './core/DataProviderInterface';

export interface StaticDataProviderOptions {
  tasks: ITask[];
  links: ILink[];
  canEdit?: boolean;
}

export class StaticDataProvider implements DataProviderInterface {
  private tasks: ITask[];
  private links: ILink[];
  private _canEdit: boolean;
  private config: DataProviderConfig;

  constructor(options: StaticDataProviderOptions) {
    this.tasks = [...options.tasks];
    this.links = [...options.links];
    this._canEdit = options.canEdit ?? true;
    this.config = { type: 'custom' };
  }

  async sync(_options?: SyncOptions): Promise<DataResponse> {
    return {
      tasks: [...this.tasks],
      links: [...this.links],
      metadata: {},
    };
  }

  async syncTask(id: string | number, updates: Partial<ITask>): Promise<ITask> {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`Task ${id} not found`);
    this.tasks[idx] = { ...this.tasks[idx], ...updates };
    return this.tasks[idx];
  }

  async createTask(task: Partial<ITask>): Promise<ITask> {
    const maxId = this.tasks.reduce(
      (max, t) => Math.max(max, typeof t.id === 'number' ? t.id : 0),
      0,
    );
    const newTask = {
      id: maxId + 1,
      text: task.text || 'New Task',
      start: task.start || new Date(),
      end: task.end || new Date(),
      progress: task.progress || 0,
      parent: task.parent || 0,
      ...task,
    } as ITask;
    this.tasks.push(newTask);
    return newTask;
  }

  async deleteTask(id: string | number): Promise<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.links = this.links.filter((l) => l.source !== id && l.target !== id);
  }

  async createLink(link: Partial<ILink>): Promise<ILink> {
    const maxId = this.links.reduce(
      (max, l) => Math.max(max, typeof l.id === 'number' ? l.id : 0),
      0,
    );
    const newLink = {
      id: maxId + 1,
      source: link.source!,
      target: link.target!,
      type: link.type || 'e2s',
      ...link,
    } as ILink;
    this.links.push(newLink);
    return newLink;
  }

  async deleteLink(linkId: string | number): Promise<void> {
    this.links = this.links.filter((l) => l.id !== linkId);
  }

  async reorderTask(
    taskId: string | number,
    targetId: string | number,
    position: 'before' | 'after',
  ): Promise<void> {
    const taskIdx = this.tasks.findIndex((t) => t.id === taskId);
    const targetIdx = this.tasks.findIndex((t) => t.id === targetId);
    if (taskIdx === -1 || targetIdx === -1) return;

    const [task] = this.tasks.splice(taskIdx, 1);
    const newTargetIdx = this.tasks.findIndex((t) => t.id === targetId);
    const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;
    this.tasks.splice(insertIdx, 0, task);
  }

  async getFilterOptions(): Promise<FilterOptionsData> {
    const members = new Map<string, string>();
    const labelsSet = new Set<string>();

    for (const task of this.tasks) {
      if (task.assigned) {
        const assignees =
          typeof task.assigned === 'string'
            ? task.assigned.split(',').map((a) => a.trim())
            : [task.assigned];
        for (const a of assignees) {
          if (a && !members.has(a)) {
            members.set(
              a,
              a
                .replace('.', ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase()),
            );
          }
        }
      }
      if (task.labels) {
        const taskLabels =
          typeof task.labels === 'string'
            ? task.labels.split(',').map((l) => l.trim())
            : task.labels;
        for (const l of taskLabels) {
          if (l) labelsSet.add(l);
        }
      }
    }

    return {
      members: Array.from(members.entries()).map(([username, name]) => ({
        username,
        name,
      })),
      labels: Array.from(labelsSet)
        .sort()
        .map((title) => ({ title })),
      milestones: [],
    };
  }

  async reorderWorkItem(
    _taskId: string | number,
    _targetId: string | number,
    _position: 'before' | 'after',
  ): Promise<void> {
    // Static provider doesn't support source-system ordering
    throw new Error('reorderWorkItem not supported in StaticDataProvider');
  }

  async batchUpdateParent(
    _iids: number[],
    _parentId: string | number,
  ): Promise<BatchOperationResult> {
    throw new Error('batchUpdateParent not supported in StaticDataProvider');
  }

  async batchUpdateMilestone(
    _iids: number[],
    _milestoneId: string | number,
  ): Promise<BatchOperationResult> {
    throw new Error('batchUpdateMilestone not supported in StaticDataProvider');
  }

  async batchUpdateEpic(
    _iids: number[],
    _epicId: string | number,
  ): Promise<BatchOperationResult> {
    throw new Error('batchUpdateEpic not supported in StaticDataProvider');
  }

  async checkCanEdit(): Promise<boolean> {
    return this._canEdit;
  }

  getConfig(): DataProviderConfig {
    return this.config;
  }
}
