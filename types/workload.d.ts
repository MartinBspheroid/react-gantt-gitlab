import type { FC } from 'react';

export interface IWorkloadTask {
  id: string | number;
  text: string;
  start_date: Date | string;
  end_date: Date | string;
  assigned?: string;
  labels?: string[];
  [key: string]: any;
}

export interface IWorkloadGroup {
  type: 'assignee' | 'label';
  name: string;
}

export declare const WorkloadView: FC<{
  tasks?: IWorkloadTask[];
  readonly?: boolean;
  onTaskDrag?: (
    task: IWorkloadTask,
    changes: { start?: Date; end?: Date },
  ) => void;
  onGroupChange?: (
    task: IWorkloadTask,
    params: { fromGroup: IWorkloadGroup; toGroup: IWorkloadGroup },
  ) => void;
}>;

export default WorkloadView;
