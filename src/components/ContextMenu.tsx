// @ts-nocheck
import {
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useContext,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { ContextMenu as WxContextMenu } from '@svar-ui/react-menu';
import {
  handleAction,
  defaultMenuOptions,
  isHandledAction,
} from '@svar-ui/gantt-store';
import { locale } from '@svar-ui/lib-dom';
import { en } from '@svar-ui/gantt-locales';
import { en as coreEn } from '@svar-ui/core-locales';
import { context } from '@svar-ui/react-core';
import { useWritableProp, useStoreLater } from '@svar-ui/lib-react';
import './ContextMenu.css';

const ContextMenu = forwardRef(function ContextMenu(
  {
    options: optionsInit,
    api = null,
    resolver = null,
    filter = null,
    at = 'point',
    children,
    onClick,
    css,
  },
  ref,
) {
  const ownMenu = useMemo(
    () => optionsInit ?? [...defaultMenuOptions],
    [optionsInit],
  );
  const [optionsProp] = useWritableProp(ownMenu);

  const menuRef = useRef(null);
  const activeIdRef = useRef(null);

  // i18n context
  const i18nCtx = useContext(context.i18n);
  const l = useMemo(() => i18nCtx || locale({ ...en, ...coreEn }), [i18nCtx]);
  const _ = useMemo(() => l.getGroup('gantt'), [l]);

  const rTaskTypesVal = useStoreLater(api, 'taskTypes');
  const rTasksVal = useStoreLater(api, '_tasks');
  const rSelectedVal = useStoreLater(api, 'selected');
  const rSelectedTasksVal = useStoreLater(api, '_selected');

  useEffect(() => {
    if (!api) return;

    api.on('scroll-chart', () => {
      if (menuRef.current && menuRef.current.show) menuRef.current.show();
    });
    api.on('drag-task', () => {
      if (menuRef.current && menuRef.current.show) menuRef.current.show();
    });
  }, [api]);

  function applyLocaleFn(opts) {
    return opts.map((op) => {
      op = { ...op };
      if (op.text) op.text = _(op.text);
      if (op.subtext) op.subtext = _(op.subtext);
      if (op.data) op.data = applyLocaleFn(op.data);
      return op;
    });
  }

  function getOptions() {
    const convertOption = optionsProp.find((o) => o.id === 'convert-task');
    if (convertOption) {
      convertOption.data = [];
      (rTaskTypesVal || []).forEach((t) => {
        convertOption.data.push(convertOption.dataFactory(t));
      });
    }
    return applyLocaleFn(optionsProp);
  }

  const cOptions = useMemo(() => {
    if (api) {
      return getOptions();
    }
    return null;
  }, [api, optionsProp, rTaskTypesVal, _]);

  const selectedTasks = useMemo(
    () =>
      rSelectedTasksVal && rSelectedTasksVal.length ? rSelectedTasksVal : [],
    [rSelectedTasksVal],
  );

  const itemResolver = useCallback(
    (id, ev) => {
      let task = id ? api?.getTask(id) : null;
      if (resolver) {
        const result = resolver(id, ev);
        task = result === true ? task : result;
      }
      if (task) {
        activeIdRef.current = task.id;
        if (!Array.isArray(rSelectedVal) || !rSelectedVal.includes(task.id)) {
          api && api.exec && api.exec('select-task', { id: task.id });
        }
      }
      return task;
    },
    [api, resolver, rSelectedVal],
  );

  const menuAction = useCallback(
    (ev) => {
      const action = ev.action;
      if (action) {
        const isAction = isHandledAction(defaultMenuOptions, action.id);
        if (isAction) handleAction(api, action.id, activeIdRef.current, _);
        onClick && onClick(ev);
      }
    },
    [api, _, onClick],
  );

  const filterMenu = useCallback(
    (item, task) => {
      const tasks = selectedTasks.length ? selectedTasks : task ? [task] : [];

      let result = filter ? filter(item, task) : true;
      if (item.check && result) {
        const isDisabled = tasks.some((t) => !item.check(t, rTasksVal));
        item.css = isDisabled ? 'wx-disabled' : '';
      }
      return result;
    },
    [filter, selectedTasks, rTasksVal],
  );

  useImperativeHandle(ref, () => ({
    show: (ev, obj) => {
      if (menuRef.current && menuRef.current.show) {
        menuRef.current.show(ev, obj);
      }
    },
  }));

  const onContextMenu = useCallback((e) => {
    if (menuRef.current && menuRef.current.show) {
      menuRef.current.show(e);
    }
  }, []);

  const content = (
    <>
      <WxContextMenu
        filter={filterMenu}
        options={cOptions}
        dataKey={'id'}
        resolver={itemResolver}
        onClick={menuAction}
        at={at}
        ref={menuRef}
        css={css}
      />
      <span onContextMenu={onContextMenu} data-menu-ignore="true">
        {typeof children === 'function' ? children() : children}
      </span>
    </>
  );

  if (!i18nCtx && context.i18n?.Provider) {
    const Provider = context.i18n.Provider;
    return <Provider value={l}>{content}</Provider>;
  }

  return content;
});

export default ContextMenu;
