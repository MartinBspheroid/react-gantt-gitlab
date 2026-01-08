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
import { DataStore, defaultColumns, defaultTaskTypes } from '@svar-ui/gantt-store';

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
    init = null,
    autoScale = true,
    unscheduledTasks = false,
    colorRules = [],
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
    } else {
      // const prev = dataStore.getState();
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
  const customLocale = useMemo(() => ({
    ...en,
    gantt: {
      ...en.gantt,
      dateFormat: 'yy/MM/dd',
    },
    formats: {
      ...en.formats,
      dateFormat: 'yy/MM/dd',
    },
  }), []);

  return (
    <Locale words={customLocale} optional={true}>
      <StoreContext.Provider value={api}>
        <Layout
          taskTemplate={taskTemplate}
          readonly={readonly}
          cellBorders={cellBorders}
          highlightTime={highlightTime}
          onTableAPIChange={setTableAPI}
          colorRules={colorRules}
        />
      </StoreContext.Provider>
    </Locale>
  );
});

export default Gantt;
