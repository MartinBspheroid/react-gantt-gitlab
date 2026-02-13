// @ts-nocheck
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
  useRef,
} from 'react';
import { Editor as WxEditor, registerEditorItem } from '@svar-ui/react-editor';
import {
  Locale,
  RichSelect,
  Slider,
  Counter,
  TwoState,
} from '@svar-ui/react-core';
import { defaultEditorItems, normalizeDates } from '@svar-ui/gantt-store';
import { dateToString, locale } from '@svar-ui/lib-dom';
import { en } from '@svar-ui/gantt-locales';
import { en as coreEn } from '@svar-ui/core-locales';
import { context } from '@svar-ui/react-core';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Links from './editor/Links.tsx';
import DateTimePicker from './editor/DateTimePicker.tsx';
import NullableDatePicker from './editor/NullableDatePicker.tsx';
import WorkdaysInput from './editor/WorkdaysInput.tsx';
import SplitSegments from './editor/SplitSegments.tsx';
import { useStore, useWritableProp } from '@svar-ui/lib-react';

// helpers
import { modeObserver } from '../helpers/modeResizeObserver';
import { getSourceUrl, openSourceLink } from '../utils/LinkUtils';

import './Editor.css';

registerEditorItem('select', RichSelect);
registerEditorItem('date', DateTimePicker);
registerEditorItem('nullable-date', NullableDatePicker); // Custom date picker that supports null
registerEditorItem('twostate', TwoState);
registerEditorItem('slider', Slider);
registerEditorItem('counter', Counter);
registerEditorItem('links', Links);
registerEditorItem('workdays', WorkdaysInput);
registerEditorItem('split-segments', SplitSegments);

function Editor({
  api,
  items = defaultEditorItems,
  css = '',
  layout = 'default',
  readonly = false,
  placement = 'sidebar',
  bottomBar = true,
  topBar = true,
  autoSave = true,
  focus = false,
  workdaysHelpers = null, // { countWorkdays, calculateEndDateByWorkdays }
}) {
  const lFromCtx = useContext(context.i18n);
  const l = useMemo(() => lFromCtx || locale({ ...en, ...coreEn }), [lFromCtx]);
  const _ = useMemo(() => l.getGroup('gantt'), [l]);
  const i18nData = l.getRaw();
  const dateFormat = useMemo(() => {
    const f = i18nData.gantt?.dateFormat || i18nData.formats?.dateFormat;
    return dateToString(f, i18nData.calendar);
  }, [i18nData]);

  const activeTask = useStore(api, '_activeTask');

  const normalizedTopBar = useMemo(() => {
    if (topBar === true && !readonly) {
      const buttons = [
        { comp: 'icon', icon: 'wxi-close', id: 'close' },
        { comp: 'spacer' },
      ];

      // Add source link button with Font Awesome icon
      if (getSourceUrl(activeTask)) {
        buttons.push({
          comp: 'button',
          id: 'source-link',
          title: 'Open in source',
          circle: true,
          css: 'source-link-btn',
        });
      }

      buttons.push({
        comp: 'button',
        type: 'danger',
        text: _('Delete'),
        id: 'delete',
      });

      if (autoSave) return { items: buttons };
      return {
        items: [
          ...buttons,
          {
            comp: 'button',
            type: 'primary',
            text: _('Save'),
            id: 'save',
          },
        ],
      };
    }
    return topBar;
  }, [topBar, readonly, autoSave, _, activeTask]);

  // resize
  const [compactMode, setCompactMode] = useState(false);
  const styleCss = useMemo(
    () => (compactMode ? 'wx-full-screen' : ''),
    [compactMode],
  );

  const handleResize = useCallback((mode) => {
    setCompactMode(mode);
  }, []);

  useEffect(() => {
    const ro = modeObserver(handleResize);
    ro.observe();
    return () => {
      ro.disconnect();
    };
  }, [handleResize]);

  // const taskId = useStore(api, "activeTaskId");
  const taskId = useMemo(() => activeTask?.id, [activeTask]);
  const unit = useStore(api, 'durationUnit');
  const unscheduledTasks = useStore(api, 'unscheduledTasks');
  const taskTypes = useStore(api, 'taskTypes');

  const [taskType, setTaskType] = useWritableProp(activeTask?.type);
  const taskUnscheduled = useMemo(() => activeTask?.unscheduled, [activeTask]);
  const [linksActionsMap, setLinksActionsMap] = useState({});

  useEffect(() => {
    setLinksActionsMap({});
  }, [taskId]);

  // Check if this is a data-source milestone (has start AND end dates)
  // vs traditional Gantt milestone (single point in time, type === 'milestone')
  const isSourceMilestone = useMemo(
    () => activeTask?.$isMilestone || activeTask?.type === 'milestone',
    [activeTask],
  );

  // Traditional Gantt milestone type OR data-source milestone
  const milestone = useMemo(
    () => taskType === 'milestone' || isSourceMilestone,
    [taskType, isSourceMilestone],
  );
  const summary = useMemo(() => taskType === 'summary', [taskType]);

  function prepareEditorItems(localItems, isUnscheduled) {
    const dates = { start: 1, end: 1, duration: 1 };

    return localItems.map((a) => {
      const item = { ...a };
      if (a.config) item.config = { ...item.config };
      if (item.comp === 'links' && api) {
        item.api = api;
        item.autoSave = autoSave;
        item.onLinksChange = handleLinksChange;
      }
      if (item.comp === 'select' && item.key === 'type') {
        let options = item.options ?? (taskTypes ? taskTypes : []);
        item.options = options.map((t) => ({
          ...t,
          label: _(t.label),
        }));
      }

      if (item.label) item.label = _(item.label);
      if (item.config?.placeholder)
        item.config.placeholder = _(item.config.placeholder);

      if (unscheduledTasks && dates[item.key]) {
        if (isUnscheduled) {
          item.disabled = true;
        } else {
          delete item.disabled;
        }
      }

      return item;
    });
  }

  function filterEditorItems(localItems) {
    return localItems.filter(({ comp, key, options }) => {
      switch (comp) {
        case 'date': {
          // Data-source milestones have both start and end dates - show all date fields
          // Traditional Gantt milestones (single point) - hide end date
          if (isSourceMilestone) {
            return true; // Show all date fields for data-source milestones
          }
          // For traditional milestone type, hide end date
          return !milestone || (key !== 'end' && key !== 'base_end');
        }
        case 'select': {
          return options.length > 1;
        }
        case 'twostate': {
          return unscheduledTasks && !summary;
        }
        case 'counter': {
          // Hide duration counter (workdays display in grid is used instead)
          return false;
        }
        case 'slider': {
          // Hide progress slider (not supported)
          return false;
        }
        case 'workdays': {
          // Show workdays for data-source milestones (they have start and end dates)
          // Hide for traditional Gantt milestones (single point in time)
          return !milestone || isSourceMilestone;
        }
        default:
          return true;
      }
    });
  }

  const editorItems = useMemo(() => {
    let eItems = prepareEditorItems(items, taskUnscheduled);
    eItems = filterEditorItems(eItems);

    // Add split segments editor for tasks with splitParts
    if (
      activeTask?.splitParts &&
      Array.isArray(activeTask.splitParts) &&
      activeTask.splitParts.length > 0
    ) {
      // Find position to insert split segments (after dates section, before links)
      const linksIndex = eItems.findIndex((item) => item.comp === 'links');
      const insertIndex = linksIndex > 0 ? linksIndex : eItems.length;

      const splitSegmentsItem = {
        comp: 'split-segments',
        key: 'splitParts',
        label: 'Split Segments',
      };

      eItems = [
        ...eItems.slice(0, insertIndex),
        splitSegmentsItem,
        ...eItems.slice(insertIndex),
      ];
    }

    return eItems;
  }, [
    items,
    taskUnscheduled,
    milestone,
    isSourceMilestone,
    summary,
    unscheduledTasks,
    taskTypes,
    _,
    api,
    autoSave,
    activeTask?.splitParts,
  ]);

  const task = useMemo(() => {
    if (readonly && activeTask) {
      let values = {};
      editorItems.forEach(({ key, comp }) => {
        if (comp !== 'links') {
          const value = activeTask[key];
          if (comp === 'date' && value instanceof Date) {
            values[key] = dateFormat(value);
          } else {
            values[key] = value;
          }
        }
      });
      return values;
    }
    if (!activeTask) return null;

    // Create task object with workdays calculation
    const taskWithWorkdays = { ...activeTask };

    // Data-source milestones always have dates (stored directly on task.start/end)
    // For regular tasks: check date fields to determine if the source actually has the dates
    // (task.start may be auto-filled with createdAt when source has no startDate)
    const hasSourceStartDate = isSourceMilestone || activeTask.startDate;
    const hasSourceDueDate = isSourceMilestone || activeTask.dueDate;

    // If source doesn't have the date, set it to null so Editor shows empty
    if (!hasSourceStartDate) {
      taskWithWorkdays.start = null;
    }
    if (!hasSourceDueDate) {
      taskWithWorkdays.end = null;
    }

    // Calculate workdays if helpers are available and both dates exist
    if (
      workdaysHelpers?.countWorkdays &&
      hasSourceStartDate &&
      hasSourceDueDate
    ) {
      taskWithWorkdays.workdays = workdaysHelpers.countWorkdays(
        activeTask.start,
        activeTask.end,
      );
    }
    return taskWithWorkdays;
  }, [readonly, activeTask, editorItems, dateFormat, workdaysHelpers]);

  function handleLinksChange({ id, action, data }) {
    setLinksActionsMap((prev) => ({
      ...prev,
      [id]: { action, data },
    }));
  }

  const saveLinks = useCallback(() => {
    for (let link in linksActionsMap) {
      const { action, data } = linksActionsMap[link];
      api.exec(action, data);
    }
  }, [api, linksActionsMap]);

  const deleteTask = useCallback(() => {
    api.exec('delete-task', { id: taskId });
  }, [api, taskId]);

  const hide = useCallback(() => {
    api.exec('show-editor', { id: null });
  }, [api]);

  const handleAction = useCallback(
    (ev) => {
      const { item, changes } = ev;
      if (item.id === 'delete') {
        deleteTask();
      }
      if (item.id === 'save') {
        if (!changes.length) saveLinks();
        else hide();
      }
      if (item.id === 'source-link') {
        openSourceLink(activeTask);
        return; // Don't hide editor
      }
      if (item.comp) hide();
    },
    [api, taskId, autoSave, saveLinks, deleteTask, hide, activeTask],
  );

  // Track which date fields the user has actually changed
  // This is needed because svar's normalizeDates auto-fills the other date field
  const changedDateFieldsRef = useRef(new Set());

  const normalizeTask = useCallback(
    (t, key) => {
      if (unscheduledTasks && t.type === 'summary') t.unscheduled = false;

      // Track date field changes
      if (key === 'start' || key === 'end') {
        changedDateFieldsRef.current.add(key);
      }

      // Skip normalizeDates for date fields entirely
      // normalizeDates auto-fills start/end which we don't want - dates should be independent
      if (key === 'start' || key === 'end') {
        return t;
      }

      normalizeDates(t, unit, true, key);
      return t;
    },
    [unscheduledTasks, unit],
  );

  /**
   * Set end date time to 23:59:59 to make the date inclusive.
   * Gantt bars are drawn based on time difference, so end dates at 00:00:00
   * would visually end on the previous day. Setting to 23:59:59 ensures
   * the bar includes the full end date.
   */
  const setEndOfDay = useCallback((date) => {
    if (date instanceof Date) {
      date.setHours(23, 59, 59, 0);
    }
    return date;
  }, []);

  const handleChange = useCallback(
    (ev) => {
      let { update, key, value } = ev;

      // Handle workdays change - calculate new end date
      if (
        key === 'workdays' &&
        workdaysHelpers?.calculateEndDateByWorkdays &&
        update.start
      ) {
        const newEndDate = workdaysHelpers.calculateEndDateByWorkdays(
          update.start,
          value,
        );
        update.end = setEndOfDay(newEndDate);
        ev.update = normalizeTask({ ...update }, 'end');
        return;
      }

      // Handle end date change - ensure bar draws through the entire day
      if (key === 'end') {
        setEndOfDay(update.end);
      }

      ev.update = normalizeTask({ ...update }, key);

      if (!autoSave) {
        if (key === 'type') setTaskType(value);
      }
    },
    [autoSave, workdaysHelpers, normalizeTask, setEndOfDay],
  );

  const handleSave = useCallback(
    (ev) => {
      let { values } = ev;

      // Build originalDateValues based on what the user actually changed
      // This tells GanttView which fields to sync to the data source
      const originalDateValues = {};
      if (changedDateFieldsRef.current.has('start')) {
        originalDateValues.start = values.start; // can be null or Date
      }
      if (changedDateFieldsRef.current.has('end')) {
        originalDateValues.end = values.end; // can be null or Date
      }

      // Clear the tracking for next edit session
      changedDateFieldsRef.current.clear();

      values = {
        ...values,
        unscheduled:
          unscheduledTasks && values.unscheduled && values.type !== 'summary',
      };
      delete values.links;
      delete values.data;

      api.exec('update-task', {
        id: taskId,
        task: values,
        _originalDateValues: originalDateValues, // Preserve null values that svar would overwrite
      });

      if (!autoSave) saveLinks();
    },
    [api, taskId, unscheduledTasks, autoSave, saveLinks],
  );

  return task ? (
    <Locale>
      <WxEditor
        css={`wx-XkvqDXuw wx-gantt-editor ${styleCss} ${css}`}
        items={editorItems}
        values={task}
        topBar={normalizedTopBar}
        bottomBar={bottomBar}
        placement={placement}
        layout={layout}
        readonly={readonly}
        autoSave={autoSave}
        focus={focus}
        onAction={handleAction}
        onSave={handleSave}
        onChange={handleChange}
      />
    </Locale>
  ) : null;
}

export default Editor;
