import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useImperativeHandle,
  useState,
  useCallback,
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
import Layout from './Layout.jsx';

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
    calendar = null,
    init = null,
    autoScale = true,
    unscheduledTasks = false,
    colorRules = [],
    ...restProps
  },
  ref,
) {
  // Derive workday functions from calendar if provided
  const calendarCountWorkdays = useCallback(
    (startDate, endDate) => {
      if (calendar) {
        return calendar.countWorkdays(startDate, endDate);
      }
      return countWorkdays ? countWorkdays(startDate, endDate) : 0;
    },
    [calendar, countWorkdays],
  );

  const calendarCalculateEndDate = useCallback(
    (startDate, workdays) => {
      if (calendar) {
        return calendar.calculateEndDateByWorkdays(startDate, workdays);
      }
      return calculateEndDateByWorkdays
        ? calculateEndDateByWorkdays(startDate, workdays)
        : startDate;
    },
    [calendar, calculateEndDateByWorkdays],
  );

  const calendarHighlightTime = useCallback(
    (date, unit) => {
      if (calendar && unit === 'day' && calendar.isNonWorkday(date)) {
        return 'wx-weekend';
      }
      return highlightTime ? highlightTime(date, unit) : '';
    },
    [calendar, highlightTime],
  );

  // Use calendar-derived functions or provided functions
  const effectiveCountWorkdays = calendar
    ? calendarCountWorkdays
    : countWorkdays;
  const effectiveCalculateEndDate = calendar
    ? calendarCalculateEndDate
    : calculateEndDateByWorkdays;
  const effectiveHighlightTime = calendar
    ? calendarHighlightTime
    : highlightTime;
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
          highlightTime={effectiveHighlightTime}
          countWorkdays={effectiveCountWorkdays}
          calculateEndDateByWorkdays={effectiveCalculateEndDate}
          onTableAPIChange={setTableAPI}
          colorRules={colorRules}
        />
      </StoreContext.Provider>
    </Locale>
  );
});

export default Gantt;
