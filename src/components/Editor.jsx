import { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { Editor as WxEditor, registerEditorItem } from '@svar-ui/react-editor';
import { Locale, RichSelect, Slider, Counter, TwoState } from '@svar-ui/react-core';
import { defaultEditorItems, normalizeDates } from '@svar-ui/gantt-store';
import { dateToString, locale } from '@svar-ui/lib-dom';
import { en } from '@svar-ui/gantt-locales';
import { en as coreEn } from '@svar-ui/core-locales';
import { context } from '@svar-ui/react-core';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Links from './editor/Links.jsx';
import DateTimePicker from './editor/DateTimePicker.jsx';
import WorkdaysInput from './editor/WorkdaysInput.jsx';
import { useStore, useWritableProp } from '@svar-ui/lib-react';

// helpers
import { modeObserver } from '../helpers/modeResizeObserver';
import { getGitLabUrl, openGitLabLink } from '../utils/GitLabLinkUtils';

import './Editor.css';

registerEditorItem('select', RichSelect);
registerEditorItem('date', DateTimePicker);
registerEditorItem('twostate', TwoState);
registerEditorItem('slider', Slider);
registerEditorItem('counter', Counter);
registerEditorItem('links', Links);
registerEditorItem('workdays', WorkdaysInput);

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

  const activeTask = useStore(api, "_activeTask");

  const normalizedTopBar = useMemo(() => {
    if (topBar === true && !readonly) {
      const buttons = [
        { comp: 'icon', icon: 'wxi-close', id: 'close' },
        { comp: 'spacer' },
      ];

      // Add GitLab link button with Font Awesome icon
      if (getGitLabUrl(activeTask)) {
        buttons.push({
          comp: 'button',
          id: 'gitlab-link',
          title: 'Open in GitLab',
          circle: true,
          css: 'gitlab-link-btn',
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
  const unit = useStore(api, "durationUnit");
  const unscheduledTasks = useStore(api, "unscheduledTasks");
  const taskTypes = useStore(api, "taskTypes");

  const [taskType, setTaskType] = useWritableProp(activeTask?.type);
  const taskUnscheduled = useMemo(() => activeTask?.unscheduled, [activeTask]);
  const [linksActionsMap, setLinksActionsMap] = useState({});


  useEffect(() => {
    setLinksActionsMap({});
  }, [taskId]);

  // Check if this is a GitLab milestone (has start AND end dates)
  // vs traditional Gantt milestone (single point in time, type === 'milestone')
  const isGitLabMilestone = useMemo(
    () => activeTask?.$isMilestone || activeTask?._gitlab?.type === 'milestone',
    [activeTask]
  );

  // Traditional Gantt milestone type OR GitLab milestone
  const milestone = useMemo(
    () => taskType === 'milestone' || isGitLabMilestone,
    [taskType, isGitLabMilestone]
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
          // GitLab milestones have both start and end dates - show all date fields
          // Traditional Gantt milestones (single point) - hide end date
          if (isGitLabMilestone) {
            return true; // Show all date fields for GitLab milestones
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
          // Hide duration counter (GitLab uses workdays display in grid instead)
          return false;
        }
        case 'slider': {
          // Hide progress slider (not supported for GitLab)
          return false;
        }
        case 'workdays': {
          // Show workdays for GitLab milestones (they have start and end dates)
          // Hide for traditional Gantt milestones (single point in time)
          return !milestone || isGitLabMilestone;
        }
        default:
          return true;
      }
    });
  }

  const editorItems = useMemo(() => {
    const eItems = prepareEditorItems(items, taskUnscheduled);
    return filterEditorItems(eItems);
  }, [
    items,
    taskUnscheduled,
    milestone,
    isGitLabMilestone,
    summary,
    unscheduledTasks,
    taskTypes,
    _,
    api,
    autoSave,
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

    // Calculate workdays if helpers are available
    const taskWithWorkdays = { ...activeTask };
    if (workdaysHelpers?.countWorkdays && activeTask.start && activeTask.end) {
      taskWithWorkdays.workdays = workdaysHelpers.countWorkdays(
        activeTask.start,
        activeTask.end
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

  const handleAction = useCallback((ev) => {
    const { item, changes } = ev;
    if (item.id === 'delete') {
      deleteTask();
    }
    if (item.id === 'save') {
      if (!changes.length) saveLinks();
      else hide();
    }
    if (item.id === 'gitlab-link') {
      openGitLabLink(activeTask);
      return; // Don't hide editor
    }
    if (item.comp) hide();
  }, [api, taskId, autoSave, saveLinks, deleteTask, hide, activeTask]);

  const normalizeTask = useCallback((t, key) => {
    if (unscheduledTasks && t.type === 'summary') t.unscheduled = false;

    normalizeDates(t, unit, true, key);
    return t;
  }, [unscheduledTasks, unit]);

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

  const handleChange = useCallback((ev) => {
    let { update, key, value } = ev;

    // Handle workdays change - calculate new end date
    if (key === 'workdays' && workdaysHelpers?.calculateEndDateByWorkdays && update.start) {
      const newEndDate = workdaysHelpers.calculateEndDateByWorkdays(update.start, value);
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
  }, [autoSave, workdaysHelpers, normalizeTask, setEndOfDay]);

  const handleSave = useCallback((ev) => {
    let { values } = ev;
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
    });

    if (!autoSave) saveLinks();
  }, [api, taskId, unscheduledTasks, autoSave, saveLinks]);

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
