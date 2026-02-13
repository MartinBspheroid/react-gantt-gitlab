// @ts-nocheck
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useImperativeHandle,
  useState,
} from 'react';

// core widgets lib
import { Locale } from '@svar-ui/react-core';
import { en } from '@svar-ui/gantt-locales';

// stores
import { EventBusRouter } from '@svar-ui/lib-state';
import {
  DataStore,
  defaultColumns,
  defaultTaskTypes,
} from '@svar-ui/gantt-store';

// context
import StoreContext from '../context';

// store factory
import { writable } from '@svar-ui/lib-react';

// ui
import Layout from './Layout.tsx';

const camelize = (s) =>
  s
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join('');

const defaultScales = [
  { unit: 'month', step: 1, format: 'MMMM yyy' },
  { unit: 'day', step: 1, format: 'd' },
];

const Gantt = forwardRef(function Gantt(
  {
    taskTemplate = null,
    markers = [],
    taskTypes = defaultTaskTypes,
    tasks = [],
    selected = [],
    activeTask = null,
    links = [],
    scales = defaultScales,
    columns = defaultColumns,
    start = null,
    end = null,
    lengthUnit = 'day',
    durationUnit = 'day',
    cellWidth = 100,
    cellHeight = 38,
    scaleHeight = 36,
    readonly = false,
    cellBorders = 'full',
    zoom = false,
    baselines = false,
    highlightTime = null,
    countWorkdays = null,
    calculateEndDateByWorkdays = null,
    init = null,
    autoScale = true,
    unscheduledTasks = false,
    colorRules = [],
    summary = null,
    sprints = [],
    ...restProps
  },
  ref,
) {
  // keep latest rest props for event routing
  const restPropsRef = useRef();
  restPropsRef.current = restProps;

  // init stores
  const dataStore = useMemo(() => new DataStore(writable), []);
  const firstInRoute = useMemo(() => dataStore.in, [dataStore]);

  const lastInRouteRef = useRef(null);
  if (lastInRouteRef.current === null) {
    lastInRouteRef.current = new EventBusRouter((a, b) => {
      const name = 'on' + camelize(a);
      if (restPropsRef.current && restPropsRef.current[name]) {
        restPropsRef.current[name](b);
      }
    });
    firstInRoute.setNext(lastInRouteRef.current);
  }

  // writable prop for two-way binding tableAPI
  const [tableAPI, setTableAPI] = useState(null);
  const tableAPIRef = useRef(null);
  tableAPIRef.current = tableAPI;

  // public API
  const api = useMemo(
    () => ({
      getState: dataStore.getState.bind(dataStore),
      getReactiveState: dataStore.getReactive.bind(dataStore),
      getStores: () => ({ data: dataStore }),
      exec: firstInRoute.exec,
      setNext: (ev) => {
        lastInRouteRef.current = lastInRouteRef.current.setNext(ev);
        return lastInRouteRef.current;
      },
      intercept: firstInRoute.intercept.bind(firstInRoute),
      on: firstInRoute.on.bind(firstInRoute),
      detach: firstInRoute.detach.bind(firstInRoute),
      getTask: dataStore.getTask.bind(dataStore),
      serialize: dataStore.serialize.bind(dataStore),
      getTable: (waitRender) =>
        waitRender
          ? new Promise((res) => setTimeout(() => res(tableAPIRef.current), 1))
          : tableAPIRef.current,
    }),
    [dataStore, firstInRoute],
  );

  // expose API via ref
  useImperativeHandle(
    ref,
    () => ({
      ...api,
    }),
    [api],
  );

  const initOnceRef = useRef(0);
  useEffect(() => {
    if (!initOnceRef.current) {
      if (init) init(api);

      if (summary && (summary.autoProgress || summary.autoConvert)) {
        const { autoProgress, autoConvert } = summary;

        const dayDiff = (next, prev) => {
          const d = (new Date(next) - new Date(prev)) / 1000 / 60 / 60 / 24;
          return Math.ceil(Math.abs(d));
        };

        const collectProgressFromKids = (id) => {
          let totalProgress = 0,
            totalDuration = 0;
          const kids = api.getTask(id).data;

          kids?.forEach((kid) => {
            let duration = 0;
            if (kid.type !== 'milestone' && kid.type !== 'summary') {
              duration = kid.duration || dayDiff(kid.end, kid.start);
              totalDuration += duration;
              totalProgress += duration * kid.progress;
            }

            const [p, d] = collectProgressFromKids(kid.id);
            totalProgress += p;
            totalDuration += d;
          });
          return [totalProgress, totalDuration];
        };

        const getSummaryProgress = (id) => {
          const [totalProgress, totalDuration] = collectProgressFromKids(id);
          const res = totalProgress / totalDuration;
          return isNaN(res) ? 0 : Math.round(res);
        };

        const recalcSummaryProgress = (id, self) => {
          const { tasks } = api.getState();
          const task = api.getTask(id);

          if (task.type != 'milestone') {
            const summaryId =
              self && task.type === 'summary' ? id : tasks.getSummaryId(id);

            if (summaryId) {
              const progress = getSummaryProgress(summaryId);
              api.exec('update-task', {
                id: summaryId,
                task: { progress },
              });
            }
          }
        };

        const toSummary = (id, self) => {
          const task = api.getTask(id);
          if (!self) id = task.parent;

          if (id && task.type !== 'summary') {
            api.exec('update-task', {
              id,
              task: { type: 'summary' },
            });
          }
        };

        const toTask = (id) => {
          const obj = api.getTask(id);
          if (obj && !obj.data?.length) {
            api.exec('update-task', {
              id,
              task: { type: 'task' },
            });
          }
        };

        if (autoProgress) {
          api.getState().tasks.forEach((task) => {
            recalcSummaryProgress(task.id, true);
          });
        }

        if (autoConvert) {
          api.getState().tasks.forEach((task) => {
            if (task.data?.length && task.type !== 'summary') {
              toSummary(task.id, true);
            }
          });
        }

        api.on('add-task', ({ id, mode }) => {
          if (autoConvert && mode === 'child') toSummary(id);
          if (autoProgress) recalcSummaryProgress(id);
        });

        api.on('update-task', ({ id }) => {
          if (autoProgress) recalcSummaryProgress(id);
        });

        api.on('delete-task', ({ source }) => {
          if (autoConvert) toTask(source);
          if (autoProgress) recalcSummaryProgress(source, true);
        });

        api.on('copy-task', ({ id }) => {
          if (autoProgress) recalcSummaryProgress(id);
        });

        api.on('move-task', ({ id, source, mode, inProgress }) => {
          if (inProgress) return;

          if (autoConvert) {
            if (mode == 'child') toSummary(id);
            else toTask(source);
          }
          if (autoProgress) {
            const task = api.getTask(id);
            if (task.parent != source) recalcSummaryProgress(source, true);
            recalcSummaryProgress(id);
          }
        });
      }
    } else {
      // Preserve sort state before re-init (dataStore.init resets it)
      const currentSort = dataStore.getState()._sort;

      dataStore.init({
        tasks,
        links,
        start,
        columns,
        end,
        lengthUnit,
        cellWidth,
        cellHeight,
        scaleHeight,
        scales,
        taskTypes,
        zoom,
        selected,
        activeTask,
        baselines,
        autoScale,
        unscheduledTasks,
        markers,
        durationUnit,
      });

      // Restore sort state (use setTimeout to avoid re-triggering this effect)
      if (currentSort?.length > 0) {
        setTimeout(() => {
          currentSort.forEach((sortItem, index) => {
            api.exec('sort-tasks', {
              key: sortItem.key,
              order: sortItem.order,
              add: index > 0,
            });
          });
        }, 0);
      }
    }
    initOnceRef.current++;
  }, [
    tasks,
    links,
    start,
    columns,
    end,
    lengthUnit,
    cellWidth,
    cellHeight,
    scaleHeight,
    scales,
    taskTypes,
    zoom,
    selected,
    activeTask,
    baselines,
    autoScale,
    unscheduledTasks,
    markers,
    durationUnit,
  ]);

  if (initOnceRef.current === 0) {
    dataStore.init({
      tasks,
      links,
      start,
      columns,
      end,
      lengthUnit,
      cellWidth,
      cellHeight,
      scaleHeight,
      scales,
      taskTypes,
      zoom,
      selected,
      activeTask,
      baselines,
      autoScale,
      unscheduledTasks,
      markers,
      durationUnit,
    });
  }

  // Custom locale with YY/MM/DD date format
  const customLocale = useMemo(
    () => ({
      ...en,
      gantt: {
        ...en.gantt,
        dateFormat: 'yy/MM/dd',
      },
      formats: {
        ...en.formats,
        dateFormat: 'yy/MM/dd',
      },
    }),
    [],
  );

  return (
    <Locale words={customLocale} optional={true}>
      <StoreContext.Provider value={api}>
        <Layout
          taskTemplate={taskTemplate}
          readonly={readonly}
          cellBorders={cellBorders}
          highlightTime={highlightTime}
          countWorkdays={countWorkdays}
          calculateEndDateByWorkdays={calculateEndDateByWorkdays}
          onTableAPIChange={setTableAPI}
          colorRules={colorRules}
          sprints={sprints}
        />
      </StoreContext.Provider>
    </Locale>
  );
});

export default Gantt;
