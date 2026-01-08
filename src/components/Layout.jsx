import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useContext,
} from 'react';
import { hotkeys } from '@svar-ui/grid-store';
import TimeScales from './TimeScale.jsx';
import Grid from './grid/Grid.jsx';
import Chart from './chart/Chart.jsx';
import Resizer from './Resizer.jsx';
import { modeObserver } from '../helpers/modeResizeObserver';
import storeContext from '../context';
import { useStore } from '@svar-ui/lib-react';
import './Layout.css';

function Layout(props) {
  const {
    taskTemplate,
    readonly,
    cellBorders,
    highlightTime,
    onTableAPIChange,
    colorRules,
  } = props;

  const api = useContext(storeContext);

  const rTasks = useStore(api, "_tasks");
  const rScales = useStore(api, "_scales");
  const rCellHeight = useStore(api, "cellHeight");
  const rColumns = useStore(api, "columns");
  const scrollTop = useStore(api, "scrollTop");
  const rScrollTask = useStore(api, "_scrollTask");

  const [compactMode, setCompactMode] = useState(false);
  let [gridWidth, setGridWidth] = useState(0);
  const [ganttWidth, setGanttWidth] = useState(undefined);
  const [ganttHeight, setGanttHeight] = useState(undefined);
  const [innerWidth, setInnerWidth] = useState(undefined);
  const [display, setDisplay] = useState('all');

  const lastDisplay = useRef(null);

  const handleResize = useCallback(
    (mode) => {
      setCompactMode((prev) => {
        if (mode !== prev) {
          if (mode) {
            lastDisplay.current = display;
            if (display === 'all') setDisplay('grid');
          } else if (!lastDisplay.current || lastDisplay.current === 'all') {
            setDisplay('all');
          }
        }
        return mode;
      });
    },
    [display],
  );


  useEffect(() => {
    const ro = modeObserver(handleResize);
    ro.observe();
    return () => {
      ro.disconnect();
    };
  }, [handleResize]);

  const gridColumnWidth = useMemo(() => {
    let w;
    if (rColumns.every((c) => c.width && !c.flexgrow)) {
      w = rColumns.reduce((acc, c) => acc + parseInt(c.width), 0);
    } else {
      if (compactMode && display === 'chart') {
        w = parseInt(rColumns.find((c) => c.id === 'action')?.width) || 50;
      } else {
        w = 440;
      }
    }
    gridWidth = w;
    return w;
  }, [rColumns, compactMode, display]);


  useEffect(() => {
    setGridWidth(gridColumnWidth);
  }, [gridColumnWidth]);

  const scrollSize = useMemo(
    () => (ganttWidth ?? 0) - (innerWidth ?? 0),
    [ganttWidth, innerWidth],
  );
  const fullWidth = useMemo(() => rScales.width, [rScales]);
  const fullHeight = useMemo(
    () => rTasks.length * rCellHeight,
    [rTasks, rCellHeight],
  );
  const scrollHeight = useMemo(
    () => rScales.height + fullHeight + scrollSize,
    [rScales, fullHeight, scrollSize],
  );
  const totalWidth = useMemo(
    () => gridWidth + fullWidth,
    [gridWidth, fullWidth],
  );

  const chartRef = useRef(null);
  const expandScale = useCallback(() => {
    Promise.resolve().then(() => {
      if ((ganttWidth ?? 0) > (totalWidth ?? 0)) {
        const minWidth = (ganttWidth ?? 0) - gridWidth;
        api.exec('expand-scale', { minWidth });
      }
    });
  }, [ganttWidth, totalWidth, gridWidth, api]);

  useEffect(() => {
    let ro;
    if (chartRef.current) {
      ro = new ResizeObserver(expandScale);
      ro.observe(chartRef.current);
    }
    return () => {
      if (ro) ro.disconnect();
    };
  }, [chartRef.current, expandScale]);

  const ganttDivRef = useRef(null);
  const pseudoRowsRef = useRef(null);

  const syncScroll = useCallback(() => {
    const el = ganttDivRef.current;
    if (el && scrollTop !== el.scrollTop) el.scrollTop = scrollTop;
  }, [scrollTop]);

  useEffect(() => {
    syncScroll();
  }, [scrollTop, syncScroll]);

  const onScroll = useCallback(() => {
    const el = ganttDivRef.current;
    api.exec('scroll-chart', {
      top: el ? el.scrollTop : 0,
    });
  }, [api]);

  const latest = useRef({
    rTasks: [],
    rScales: { height: 0 },
    rCellHeight: 0,
    scrollSize: 0,
    ganttDiv: null,
    ganttHeight: 0,
  });

  useEffect(() => {
    latest.current = {
      rTasks,
      rScales,
      rCellHeight,
      scrollSize,
      ganttDiv: ganttDivRef.current,
      ganttHeight: ganttHeight ?? 0,
    };
  }, [rTasks, rScales, rCellHeight, scrollSize, ganttHeight]);

  const scrollToTask = useCallback(
    (value) => {
      if (!value) return;
      const {
        rTasks: t,
        rScales: sc,
        rCellHeight: ch,
        scrollSize: ss,
        ganttDiv: el,
        ganttHeight: gh,
      } = latest.current;
      if (!el) return;
      const { id } = value;
      const index = t.findIndex((tt) => tt.id === id);
      if (index > -1) {
        const height = gh - sc.height;
        const scrollY = index * ch;
        const now = el.scrollTop;
        let top = null;
        if (scrollY < now) {
          top = scrollY;
        } else if (scrollY + ch > now + height) {
          top = scrollY - height + ch + ss;
        }
        if (top !== null) {
          api.exec('scroll-chart', { top: Math.max(top, 0) });
        }
      }
    },
    [api],
  );

  useEffect(() => {
    scrollToTask(rScrollTask);
  }, [rScrollTask]);

  useEffect(() => {
    const el = ganttDivRef.current;
    if (!el) return;
    const update = () => {
      setGanttHeight(el.offsetHeight);
      setGanttWidth(el.offsetWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ganttDivRef.current]);

  useEffect(() => {
    const el = pseudoRowsRef.current;
    if (!el) return;
    const update = () => {
      setInnerWidth(el.offsetWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pseudoRowsRef.current]);

  const layoutRef = useRef(null);
  useEffect(() => {
    const node = layoutRef.current;
    if (!node) return;

    const cleanup = hotkeys(node, {
      keys: {
        'ctrl+c': true,
        'ctrl+v': true,
        'ctrl+x': true,
        'ctrl+d': true,
        backspace: true,
      },
      exec: (ev) => {
        if (!ev.isInput) api.exec('hotkey', ev);
      },
    });

   
    return cleanup.destroy;
  }, [api]);

  return (
    <div className="wx-jlbQoHOz wx-gantt" ref={ganttDivRef} onScroll={onScroll}>
      <div
        className="wx-jlbQoHOz wx-pseudo-rows"
        style={{ height: scrollHeight, width: '100%' }}
        ref={pseudoRowsRef}
      >
        <div
          className="wx-jlbQoHOz wx-stuck"
          style={{
            height: ganttHeight,
            width: innerWidth,
          }}
        >
          <div tabIndex={0} className="wx-jlbQoHOz wx-layout" ref={layoutRef}>
            {rColumns.length ? (
              <>
                <Grid
                  display={display}
                  compactMode={compactMode}
                  columnWidth={gridColumnWidth}
                  width={gridWidth}
                  readonly={readonly}
                  fullHeight={fullHeight}
                  onTableAPIChange={onTableAPIChange}
                />
                <Resizer
                  value={gridWidth}
                  display={display}
                  compactMode={compactMode}
                  minValue="50"
                  maxValue="800"
                  onMove={(value) => setGridWidth(value)}
                  onDisplayChange={(display) => setDisplay(display)}
                />
              </>
            ) : null}

            <div className="wx-jlbQoHOz wx-content" ref={chartRef}>
              <TimeScales highlightTime={highlightTime} />

              <Chart
                readonly={readonly}
                fullWidth={fullWidth}
                fullHeight={fullHeight}
                taskTemplate={taskTemplate}
                cellBorders={cellBorders}
                highlightTime={highlightTime}
                colorRules={colorRules}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Layout;
