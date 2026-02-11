import { useState, useCallback, useMemo, useRef } from 'react';
import type { ITask, ILink, TID, IApi } from '@svar-ui/gantt-store';
import type {
  ICalendar,
  IUndoRedoState,
  ICriticalPathTask,
  IExportOptions,
  IImportOptions,
} from '../pro-features/types';
import {
  calculateCriticalPath,
  getCriticalTaskIds,
} from '../pro-features/CriticalPath';
import {
  createCalendar,
  isWorkday,
  countWorkdays,
  addWorkdays,
} from '../pro-features/Calendar';
import {
  createUndoRedoState,
  recordTaskChange,
  recordLinkChange,
  undo as undoAction,
  redo as redoAction,
  canUndo,
  canRedo,
  getUndoDescription,
  getRedoDescription,
} from '../pro-features/UndoRedo';
import {
  exportData,
  downloadExport,
  downloadBlob,
  importData,
  importFromFile,
  importFromMSProjectXML,
  exportToExcel,
  exportToMSProjectXML,
  exportToPNG,
  exportToPDF,
} from '../pro-features/DataIO';
import {
  scheduleTasks,
  rescheduleFromTask,
  getAffectedSuccessors,
  detectCircularDependencies,
  removeInvalidLinks,
} from '../pro-features/Schedule';
import {
  calculateSummaryProgress,
  calculateSummaryDateRange,
  updateSummaryProgress,
  updateSummaryDateRange,
  convertToSummary,
  convertToTask,
  shouldConvertToSummary,
  shouldConvertToTask,
  getSummaryChain,
} from '../pro-features/SummaryBehavior';
import type {
  IScheduleConfig,
  IScheduleOptions,
  ISummaryConfig,
} from '../pro-features/types';

export interface IUseCriticalPathResult {
  criticalTasks: ICriticalPathTask[];
  criticalTaskIds: TID[];
  isCritical: (taskId: TID) => boolean;
  recalculate: () => void;
}

export function useCriticalPath(
  tasks: ITask[],
  links: ILink[],
): IUseCriticalPathResult {
  const [criticalTasks, setCriticalTasks] = useState<ICriticalPathTask[]>([]);

  const recalculate = useCallback(() => {
    const result = calculateCriticalPath(tasks, links);
    setCriticalTasks(result);
  }, [tasks, links]);

  const criticalTaskIds = useMemo(
    () => getCriticalTaskIds(criticalTasks),
    [criticalTasks],
  );

  const isCritical = useCallback(
    (taskId: TID) => {
      return criticalTaskIds.includes(taskId);
    },
    [criticalTaskIds],
  );

  return { criticalTasks, criticalTaskIds, isCritical, recalculate };
}

export interface IUseCalendarResult {
  calendar: ICalendar;
  isWorkday: (date: Date) => boolean;
  countWorkdays: (start: Date, end: Date) => number;
  addWorkdays: (date: Date, days: number) => Date;
  setWorkdays: (workdays: number[]) => void;
  addHoliday: (date: Date) => void;
  removeHoliday: (date: Date) => void;
}

export function useCalendar(
  initialConfig?: Partial<ICalendar>,
): IUseCalendarResult {
  const [calendar, setCalendar] = useState<ICalendar>(() =>
    createCalendar(initialConfig),
  );

  const checkIsWorkday = useCallback(
    (date: Date) => isWorkday(date, calendar),
    [calendar],
  );
  const countWorkDaysInRange = useCallback(
    (start: Date, end: Date) => countWorkdays(start, end, calendar),
    [calendar],
  );
  const addWorkDays = useCallback(
    (date: Date, days: number) => addWorkdays(date, days, calendar),
    [calendar],
  );

  const setWorkdays = useCallback((workdays: number[]) => {
    setCalendar((prev) => ({ ...prev, workdays }));
  }, []);

  const addHoliday = useCallback((date: Date) => {
    setCalendar((prev) => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      if (prev.holidays.some((h) => h.getTime() === normalized.getTime())) {
        return prev;
      }
      return {
        ...prev,
        holidays: [...prev.holidays, normalized].sort(
          (a, b) => a.getTime() - b.getTime(),
        ),
      };
    });
  }, []);

  const removeHoliday = useCallback((date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    setCalendar((prev) => ({
      ...prev,
      holidays: prev.holidays.filter(
        (h) => h.getTime() !== normalized.getTime(),
      ),
    }));
  }, []);

  return {
    calendar,
    isWorkday: checkIsWorkday,
    countWorkdays: countWorkDaysInRange,
    addWorkdays: addWorkDays,
    setWorkdays,
    addHoliday,
    removeHoliday,
  };
}

export interface IUseUndoRedoResult {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  recordTaskChange: (
    action: 'add' | 'update' | 'delete',
    before: ITask | undefined,
    after: ITask | undefined,
  ) => void;
  recordLinkChange: (
    action: 'add' | 'update' | 'delete',
    before: ILink | undefined,
    after: ILink | undefined,
  ) => void;
  undo: () => {
    type: 'task' | 'link';
    action: string;
    data: ITask | ILink | undefined;
  } | null;
  redo: () => {
    type: 'task' | 'link';
    action: string;
    data: ITask | ILink | undefined;
  } | null;
  clearHistory: () => void;
}

export function useUndoRedo(maxHistory: number = 50): IUseUndoRedoResult {
  const stateRef = useRef<IUndoRedoState>(createUndoRedoState(maxHistory));
  const [, forceUpdate] = useState({});

  const triggerUpdate = useCallback(() => forceUpdate({}), []);

  const handleRecordTaskChange = useCallback(
    (
      action: 'add' | 'update' | 'delete',
      before: ITask | undefined,
      after: ITask | undefined,
    ) => {
      stateRef.current = recordTaskChange(
        stateRef.current,
        action,
        before,
        after,
      );
      triggerUpdate();
    },
    [triggerUpdate],
  );

  const handleRecordLinkChange = useCallback(
    (
      action: 'add' | 'update' | 'delete',
      before: ILink | undefined,
      after: ILink | undefined,
    ) => {
      stateRef.current = recordLinkChange(
        stateRef.current,
        action,
        before,
        after,
      );
      triggerUpdate();
    },
    [triggerUpdate],
  );

  const handleUndo = useCallback(() => {
    const { state, action } = undoAction(stateRef.current);
    stateRef.current = state;
    triggerUpdate();

    if (!action) return null;

    return {
      type: action.type,
      action: action.action,
      data: action.before as ITask | ILink | undefined,
    };
  }, [triggerUpdate]);

  const handleRedo = useCallback(() => {
    const { state, action } = redoAction(stateRef.current);
    stateRef.current = state;
    triggerUpdate();

    if (!action) return null;

    return {
      type: action.type,
      action: action.action,
      data: action.after as ITask | ILink | undefined,
    };
  }, [triggerUpdate]);

  const handleClearHistory = useCallback(() => {
    stateRef.current = createUndoRedoState(maxHistory);
    triggerUpdate();
  }, [maxHistory, triggerUpdate]);

  return {
    canUndo: canUndo(stateRef.current),
    canRedo: canRedo(stateRef.current),
    undoDescription: getUndoDescription(stateRef.current),
    redoDescription: getRedoDescription(stateRef.current),
    recordTaskChange: handleRecordTaskChange,
    recordLinkChange: handleRecordLinkChange,
    undo: handleUndo,
    redo: handleRedo,
    clearHistory: handleClearHistory,
  };
}

export interface IUseDataExportResult {
  exportToJSON: (
    tasks: ITask[],
    links: ILink[],
    options?: Partial<IExportOptions>,
  ) => string;
  exportToCSV: (
    tasks: ITask[],
    links: ILink[],
    options?: Partial<IExportOptions>,
  ) => string;
  exportToExcel: (
    tasks: ITask[],
    links: ILink[],
    options?: Partial<IExportOptions>,
  ) => Blob;
  exportToMSProjectXML: (
    tasks: ITask[],
    links: ILink[],
    options?: Partial<IExportOptions>,
  ) => string;
  exportToPNG: (
    element: HTMLElement,
    options?: Partial<IExportOptions>,
  ) => Promise<Blob>;
  exportToPDF: (
    element: HTMLElement,
    options?: Partial<IExportOptions>,
  ) => Promise<Blob>;
  downloadExport: (
    data: string | Blob,
    filename: string,
    format: 'json' | 'csv' | 'xlsx' | 'mspx' | 'pdf' | 'png',
  ) => void;
  downloadBlob: (blob: Blob | Promise<Blob>, filename: string) => Promise<void>;
  importFromJSON: (
    jsonString: string,
    options?: Partial<IImportOptions>,
  ) => { tasks: ITask[]; links: ILink[] };
  importFromCSV: (
    csvString: string,
    options?: Partial<IImportOptions>,
  ) => { tasks: ITask[]; links: ILink[] };
  importFromMSProjectXML: (
    xmlString: string,
    options?: Partial<IImportOptions>,
  ) => { tasks: ITask[]; links: ILink[] };
  importFromFile: (
    file: File,
    options?: Partial<IImportOptions>,
  ) => Promise<{ tasks: ITask[]; links: ILink[] }>;
}

export function useDataExport(): IUseDataExportResult {
  const handleExportToJSON = useCallback(
    (tasks: ITask[], links: ILink[], options?: Partial<IExportOptions>) =>
      exportData(tasks, links, { ...options, format: 'json' }) as string,
    [],
  );

  const handleExportToCSV = useCallback(
    (tasks: ITask[], links: ILink[], options?: Partial<IExportOptions>) =>
      exportData(tasks, links, { ...options, format: 'csv' }) as string,
    [],
  );

  const handleExportToExcel = useCallback(
    (tasks: ITask[], links: ILink[], options?: Partial<IExportOptions>) =>
      exportToExcel(tasks, links, { ...options, format: 'xlsx' }),
    [],
  );

  const handleExportToMSProjectXML = useCallback(
    (tasks: ITask[], links: ILink[], options?: Partial<IExportOptions>) =>
      exportToMSProjectXML(tasks, links, { ...options, format: 'mspx' }),
    [],
  );

  const handleExportToPNG = useCallback(
    (element: HTMLElement, options?: Partial<IExportOptions>) =>
      exportToPNG(element, { ...options, format: 'png' }),
    [],
  );

  const handleExportToPDF = useCallback(
    (element: HTMLElement, options?: Partial<IExportOptions>) =>
      exportToPDF(element, { ...options, format: 'pdf' }),
    [],
  );

  const handleDownload = useCallback(
    (
      data: string | Blob,
      filename: string,
      format: 'json' | 'csv' | 'xlsx' | 'mspx' | 'pdf' | 'png',
    ) => downloadExport(data, filename, format),
    [],
  );

  const handleDownloadBlob = useCallback(
    (blob: Blob | Promise<Blob>, filename: string) =>
      downloadBlob(blob, filename),
    [],
  );

  const handleImportJSON = useCallback(
    (jsonString: string, options?: Partial<IImportOptions>) =>
      importData(jsonString, { ...options, format: 'json' }),
    [],
  );

  const handleImportCSV = useCallback(
    (csvString: string, options?: Partial<IImportOptions>) =>
      importData(csvString, { ...options, format: 'csv' }),
    [],
  );

  const handleImportMSProjectXML = useCallback(
    (xmlString: string, options?: Partial<IImportOptions>) =>
      importFromMSProjectXML(xmlString, { ...options, format: 'ms-xml' }),
    [],
  );

  const handleImportFile = useCallback(
    (file: File, options?: Partial<IImportOptions>) =>
      importFromFile(file, options),
    [],
  );

  return {
    exportToJSON: handleExportToJSON,
    exportToCSV: handleExportToCSV,
    exportToExcel: handleExportToExcel,
    exportToMSProjectXML: handleExportToMSProjectXML,
    exportToPNG: handleExportToPNG,
    exportToPDF: handleExportToPDF,
    downloadExport: handleDownload,
    downloadBlob: handleDownloadBlob,
    importFromJSON: handleImportJSON,
    importFromCSV: handleImportCSV,
    importFromMSProjectXML: handleImportMSProjectXML,
    importFromFile: handleImportFile,
  };
}

export interface IUseAutoScheduleResult {
  schedule: (
    tasks: ITask[],
    links: ILink[],
    calendar?: ICalendar,
    config?: IScheduleOptions,
    onScheduleTask?: (taskId: TID, newStart: Date, newEnd: Date) => void,
  ) => {
    tasks: Map<TID, { start: Date; end: Date; changed: boolean }>;
    conflicts: Array<{ taskId: TID; type: string; message: string }>;
    affectedTaskIds: TID[];
  };
  rescheduleFrom: (
    taskId: TID,
    tasks: ITask[],
    links: ILink[],
    calendar?: ICalendar,
    config?: IScheduleOptions,
    onScheduleTask?: (taskId: TID, newStart: Date, newEnd: Date) => void,
  ) => {
    tasks: Map<TID, { start: Date; end: Date; changed: boolean }>;
    conflicts: Array<{ taskId: TID; type: string; message: string }>;
    affectedTaskIds: TID[];
  };
  getAffectedSuccessors: (taskId: TID, links: ILink[]) => TID[];
  detectCircularDependencies: (tasks: ITask[], links: ILink[]) => TID[][];
  removeInvalidLinks: (
    tasks: ITask[],
    links: ILink[],
  ) => { validLinks: ILink[]; removedLinks: ILink[] };
}

export function useAutoSchedule(): IUseAutoScheduleResult {
  const handleSchedule = useCallback(
    (
      tasks: ITask[],
      links: ILink[],
      calendar?: ICalendar,
      config?: IScheduleOptions,
      onScheduleTask?: (taskId: TID, newStart: Date, newEnd: Date) => void,
    ) => {
      const scheduleConfig: IScheduleConfig | undefined = config
        ? {
            auto: config.auto,
            projectStart: config.projectStart,
            projectEnd: config.projectEnd,
            respectCalendar: config.respectCalendar,
          }
        : undefined;

      const result = scheduleTasks(
        tasks,
        links,
        calendar,
        undefined,
        scheduleConfig,
        onScheduleTask,
      );
      return {
        tasks: result.tasks,
        conflicts: result.conflicts,
        affectedTaskIds: result.affectedTaskIds,
      };
    },
    [],
  );

  const handleRescheduleFrom = useCallback(
    (
      taskId: TID,
      tasks: ITask[],
      links: ILink[],
      calendar?: ICalendar,
      config?: IScheduleOptions,
      onScheduleTask?: (taskId: TID, newStart: Date, newEnd: Date) => void,
    ) => {
      const scheduleConfig: IScheduleConfig | undefined = config
        ? {
            auto: config.auto,
            projectStart: config.projectStart,
            projectEnd: config.projectEnd,
            respectCalendar: config.respectCalendar,
          }
        : undefined;

      const result = rescheduleFromTask(
        taskId,
        tasks,
        links,
        calendar,
        scheduleConfig,
        onScheduleTask,
      );
      return {
        tasks: result.tasks,
        conflicts: result.conflicts,
        affectedTaskIds: result.affectedTaskIds,
      };
    },
    [],
  );

  const handleGetAffectedSuccessors = useCallback(
    (taskId: TID, links: ILink[]) => {
      return getAffectedSuccessors(taskId, links);
    },
    [],
  );

  const handleDetectCircularDependencies = useCallback(
    (tasks: ITask[], links: ILink[]) => {
      return detectCircularDependencies(tasks, links);
    },
    [],
  );

  const handleRemoveInvalidLinks = useCallback(
    (tasks: ITask[], links: ILink[]) => {
      return removeInvalidLinks(tasks, links);
    },
    [],
  );

  return {
    schedule: handleSchedule,
    rescheduleFrom: handleRescheduleFrom,
    getAffectedSuccessors: handleGetAffectedSuccessors,
    detectCircularDependencies: handleDetectCircularDependencies,
    removeInvalidLinks: handleRemoveInvalidLinks,
  };
}

export interface IUseSummaryBehaviorResult {
  recalculateProgress: (taskId: TID) => void;
  recalculateDateRange: (taskId: TID) => void;
  handleAddTask: (ev: { id: TID; mode?: string }) => void;
  handleUpdateTask: (ev: { id: TID }) => void;
  handleDeleteTask: (ev: { source: TID }) => void;
  handleMoveTask: (ev: {
    id: TID;
    source: TID;
    mode?: string;
    inProgress?: boolean;
  }) => void;
  handleCopyTask: (ev: { id: TID }) => void;
}

export function useSummaryBehavior(
  api: IApi | null,
  config: ISummaryConfig = {},
): IUseSummaryBehaviorResult {
  const { autoProgress = false, autoConvert = false } = config;

  const recalculateProgress = useCallback(
    (taskId: TID) => {
      if (!api || !autoProgress) return;
      const summaryChain = getSummaryChain(api, taskId);
      for (const summaryId of summaryChain) {
        updateSummaryProgress(api, summaryId);
      }
    },
    [api, autoProgress],
  );

  const recalculateDateRange = useCallback(
    (taskId: TID) => {
      if (!api) return;
      const summaryChain = getSummaryChain(api, taskId);
      for (const summaryId of summaryChain) {
        updateSummaryDateRange(api, summaryId);
      }
    },
    [api],
  );

  const handleAddTask = useCallback(
    (ev: { id: TID; mode?: string }) => {
      if (!api) return;

      if (autoConvert && ev.mode === 'child') {
        convertToSummary(api, ev.id);
      }

      recalculateProgress(ev.id);
      recalculateDateRange(ev.id);
    },
    [api, autoConvert, recalculateProgress, recalculateDateRange],
  );

  const handleUpdateTask = useCallback(
    (ev: { id: TID }) => {
      recalculateProgress(ev.id);
      recalculateDateRange(ev.id);
    },
    [recalculateProgress, recalculateDateRange],
  );

  const handleDeleteTask = useCallback(
    (ev: { source: TID }) => {
      if (!api) return;

      if (autoConvert) {
        const task = api.getTask(ev.source);
        if (task?.type === 'summary' && !task.data?.length) {
          convertToTask(api, ev.source);
        }
      }

      recalculateProgress(ev.source);
      recalculateDateRange(ev.source);
    },
    [api, autoConvert, recalculateProgress, recalculateDateRange],
  );

  const handleMoveTask = useCallback(
    (ev: { id: TID; source: TID; mode?: string; inProgress?: boolean }) => {
      if (!api || ev.inProgress) return;

      if (autoConvert) {
        if (ev.mode === 'child') {
          convertToSummary(api, ev.id);
        } else {
          const sourceTask = api.getTask(ev.source);
          if (sourceTask?.type === 'summary' && !sourceTask.data?.length) {
            convertToTask(api, ev.source);
          }
        }
      }

      recalculateProgress(ev.id);
      recalculateProgress(ev.source);
      recalculateDateRange(ev.id);
      recalculateDateRange(ev.source);
    },
    [api, autoConvert, recalculateProgress, recalculateDateRange],
  );

  const handleCopyTask = useCallback(
    (ev: { id: TID }) => {
      recalculateProgress(ev.id);
      recalculateDateRange(ev.id);
    },
    [recalculateProgress, recalculateDateRange],
  );

  return {
    recalculateProgress,
    recalculateDateRange,
    handleAddTask,
    handleUpdateTask,
    handleDeleteTask,
    handleMoveTask,
    handleCopyTask,
  };
}

export function useGanttProFeatures(api: IApi | null) {
  const undoRedo = useUndoRedo();
  const dataExport = useDataExport();
  const autoSchedule = useAutoSchedule();

  const handleUndo = useCallback(() => {
    const result = undoRedo.undo();
    if (result && api) {
      if (result.type === 'task') {
        api.exec('update-task', {
          id: (result.data as ITask).id!,
          task: result.data as ITask,
        });
      } else if (result.type === 'link') {
        api.exec('update-link', {
          id: (result.data as ILink).id!,
          link: result.data as ILink,
        });
      }
    }
    return result;
  }, [undoRedo, api]);

  const handleRedo = useCallback(() => {
    const result = undoRedo.redo();
    if (result && api) {
      if (result.type === 'task') {
        api.exec('update-task', {
          id: (result.data as ITask).id!,
          task: result.data as ITask,
        });
      } else if (result.type === 'link') {
        api.exec('update-link', {
          id: (result.data as ILink).id!,
          link: result.data as ILink,
        });
      }
    }
    return result;
  }, [undoRedo, api]);

  return {
    undoRedo: {
      ...undoRedo,
      undo: handleUndo,
      redo: handleRedo,
    },
    dataExport,
    autoSchedule,
  };
}
