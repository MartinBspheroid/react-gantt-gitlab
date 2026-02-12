import type { ITask, ILink, TID } from '@svar-ui/gantt-store';

export interface ICalendar {
  workdays: number[];
  holidays: Date[];
  workHours?: { start: number; end: number };
}

export interface ICriticalPathTask extends ITask {
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  isCritical: boolean;
}

export interface IHistoryEntry {
  type: 'task' | 'link';
  action: 'add' | 'update' | 'delete';
  before?: ITask | ILink;
  after?: ITask | ILink;
  timestamp: number;
}

export interface IUndoRedoState {
  past: IHistoryEntry[];
  future: IHistoryEntry[];
  maxHistory: number;
}

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'mspx' | 'pdf' | 'png';

export interface IPDFExportOptions {
  pageSize?: 'a4' | 'letter' | 'legal' | 'a3';
  orientation?: 'portrait' | 'landscape';
  fitToPage?: boolean;
  quality?: number;
  margin?: number;
}

export interface IPNGExportOptions {
  quality?: number;
  scale?: number;
  backgroundColor?: string;
}

export interface IExcelExportOptions {
  sheetName?: string;
  includeLinks?: boolean;
  includeBaselines?: boolean;
  includeProgress?: boolean;
}

export interface IExportOptions {
  format: ExportFormat;
  fileName?: string;
  includeLinks?: boolean;
  includeBaselines?: boolean;
  includeProgress?: boolean;
  dateFormat?: string;
  pdf?: IPDFExportOptions;
  png?: IPNGExportOptions;
  excel?: IExcelExportOptions;
}

export interface IImportOptions {
  format?: 'json' | 'csv' | 'ms-xml';
  merge?: boolean;
  updateExisting?: boolean;
}

export interface ISplitTask {
  id: TID;
  parts: ISplitTaskPart[];
}

export interface ISplitTaskPart {
  id: TID;
  start: Date;
  end: Date;
  duration: number;
}

export interface ITaskSchedule {
  id: TID;
  scheduledStart: Date;
  scheduledEnd: Date;
  constraints?: ITaskConstraint[];
}

export interface ITaskConstraint {
  type:
    | 'start-no-earlier-than'
    | 'start-no-later-than'
    | 'finish-no-earlier-than'
    | 'finish-no-later-than'
    | 'must-start-on'
    | 'must-finish-on';
  date: Date;
}

export interface ICriticalPathConfig {
  type: 'strict' | 'flexible';
}

export interface IProFeaturesConfig {
  calendar?: ICalendar;
  criticalPath?: boolean | ICriticalPathConfig;
  undoRedo?: boolean;
  splitTasks?: boolean;
  autoSchedule?: boolean;
  schedule?: IScheduleOptions;
}

export interface IScheduleOptions {
  auto?: boolean;
  projectStart?: Date;
  projectEnd?: Date;
  respectCalendar?: boolean;
  onScheduleTask?: (taskId: TID, newStart: Date, newEnd: Date) => void;
}

export interface IScheduleConfig {
  auto?: boolean;
  projectStart?: Date;
  projectEnd?: Date;
  respectCalendar?: boolean;
}

export interface ILinkWithLag extends ILink {
  lag?: number;
}

export interface ISummaryConfig {
  autoProgress?: boolean;
  autoConvert?: boolean;
}
