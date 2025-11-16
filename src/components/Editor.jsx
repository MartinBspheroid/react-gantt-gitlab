import { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { Editor as WxEditor, registerEditorItem } from '@svar-ui/react-editor';
import { Locale, RichSelect, Slider, Counter, TwoState } from '@svar-ui/react-core';
import { defaultEditorItems, normalizeDates } from '@svar-ui/gantt-store';
import { dateToString, locale } from '@svar-ui/lib-dom';
import { en } from '@svar-ui/gantt-locales';
import { en as coreEn } from '@svar-ui/core-locales';
import { context } from '@svar-ui/react-core';

import Links from './editor/Links.jsx';
import DateTimePicker from './editor/DateTimePicker.jsx';
import { useStore, useWritableProp } from '@svar-ui/lib-react';

// helpers
import { modeObserver } from '../helpers/modeResizeObserver';

import './Editor.css';

registerEditorItem('select', RichSelect);
registerEditorItem('date', DateTimePicker);
registerEditorItem('twostate', TwoState);
registerEditorItem('slider', Slider);
registerEditorItem('counter', Counter);
registerEditorItem('links', Links);

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
}) {
  const lFromCtx = useContext(context.i18n);
  const l = useMemo(() => lFromCtx || locale({ ...en, ...coreEn }), [lFromCtx]);
  const _ = useMemo(() => l.getGroup('gantt'), [l]);
  const i18nData = l.getRaw();
  const dateFormat = useMemo(() => {
    const f = i18nData.gantt?.dateFormat || i18nData.formats?.dateFormat;
    return dateToString(f, i18nData.calendar);
  }, [i18nData]);

  const normalizedTopBar = useMemo(() => {
    if (topBar === true && !readonly) {
      const buttons = [
        { comp: 'icon', icon: 'wxi-close', id: 'close' },
        { comp: 'spacer' },
        {
          comp: 'button',
          type: 'danger',
          text: _('Delete'),
          id: 'delete',
        },
      ];
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
  }, [topBar, readonly, autoSave, _]);

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

  const activeTask = useStore(api, "_activeTask");
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

  const milestone = useMemo(() => taskType === 'milestone', [taskType]);
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

      if (item.comp === 'slider' && item.key === 'progress') {
        item.labelTemplate = (value) => `${_(item.label)} ${value}%`;
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
          // Allow date fields for summary tasks (for independent parent dates)
          // Only hide end date for milestone
          return !milestone || (key !== 'end' && key !== 'base_end');
        }
        case 'select': {
          return options.length > 1;
        }
        case 'twostate': {
          return unscheduledTasks && !summary;
        }
        case 'counter': {
          // Allow duration for summary tasks
          return !milestone;
        }
        case 'slider': {
          return !milestone;
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
          } else if (comp === 'slider' && key === 'progress') {
            values[key] = `${value}%`;
          } else {
            values[key] = value;
          }
        }
      });
      return values;
    }
    return activeTask ? { ...activeTask } : null;
  }, [readonly, activeTask, editorItems, dateFormat]);

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
    if (item.comp) hide();
  }, [api, taskId, autoSave, saveLinks, deleteTask, hide]);

  const normalizeTask = useCallback((t, key) => {
    if (unscheduledTasks && t.type === 'summary') t.unscheduled = false;

    normalizeDates(t, unit, true, key);
    return t;
  }, [unscheduledTasks, unit]);

  const handleChange = useCallback((ev) => {
    let { update, key, value } = ev;
    ev.update = normalizeTask({ ...update }, key);
    
    if (!autoSave) {
      if (key === 'type') setTaskType(value);
    }
  }, [api, autoSave]);

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
