import { useMemo } from 'react';
import {
  calculateCriticalPath,
  getCriticalTaskIds,
} from '../pro-features/CriticalPath';
import type { ICriticalPathOptions } from '../pro-features/CriticalPath';
import type { ITask, ILink } from '@svar-ui/gantt-store';

export interface UseCriticalPathOptions {
  enabled?: boolean;
  config?: ICriticalPathOptions['config'];
  projectStart?: Date;
  projectEnd?: Date;
}

export interface CriticalPathResult {
  criticalTasks: Map<string | number, { isCritical: boolean; slack: number }>;
  criticalTaskIds: (string | number)[];
  enrichedTasks: ReturnType<typeof calculateCriticalPath>;
}

export function useCriticalPath(
  tasks: ITask[],
  links: ILink[],
  options: UseCriticalPathOptions = {},
): CriticalPathResult {
  const { enabled = true, config, projectStart, projectEnd } = options;

  const enrichedTasks = useMemo(() => {
    if (!enabled || tasks.length === 0) {
      return [];
    }

    return calculateCriticalPath(tasks, links, {
      config,
      projectStart,
      projectEnd,
    });
  }, [enabled, tasks, links, config, projectStart, projectEnd]);

  const criticalTasks = useMemo(() => {
    const map = new Map<
      string | number,
      { isCritical: boolean; slack: number }
    >();
    enrichedTasks.forEach((task) => {
      map.set(task.id!, {
        isCritical: task.isCritical,
        slack: task.slack,
      });
    });
    return map;
  }, [enrichedTasks]);

  const criticalTaskIds = useMemo(() => {
    return getCriticalTaskIds(enrichedTasks);
  }, [enrichedTasks]);

  return {
    criticalTasks,
    criticalTaskIds,
    enrichedTasks,
  };
}
