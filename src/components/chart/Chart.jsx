import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useContext,
  useCallback,
} from 'react';
import CellGrid from './CellGrid.jsx';
import Bars from './Bars.jsx';
import Links from './Links.jsx';
import { hotkeys } from '@svar-ui/grid-store';
import storeContext from '../../context';
import { useStore, useStoreWithCounter } from '@svar-ui/lib-react';
import { useMiddleMouseDrag } from '../../hooks/useMiddleMouseDrag';
import './Chart.css';

function Chart(props) {
  const {
    readonly,
    fullWidth,
    fullHeight,
    taskTemplate,
    cellBorders,
    highlightTime,
    colorRules,
  } = props;

  const api = useContext(storeContext);

  const [selected, selectedCounter] = useStoreWithCounter(api, "_selected");
  const rScrollLeft = useStore(api, "scrollLeft");
  const rScrollTop = useStore(api, "scrollTop");
  const cellHeight = useStore(api, "cellHeight");
  const cellWidth = useStore(api, "cellWidth");
  const scales = useStore(api, "_scales");
  const markers = useStore(api, "_markers");
  const rScrollTask = useStore(api, "_scrollTask");
  const zoom = useStore(api, "zoom");

  const [chartHeight, setChartHeight] = useState();
  const [scrollLeft, setScrollLeft] = useState();
  const [scrollTop, setScrollTop] = useState();
  const chartRef = useRef(null);

  // Middle mouse drag to scroll
  const { isDragging, onMouseDown } = useMiddleMouseDrag(chartRef);

  const extraRows = 1;
  useEffect(() => {
    setScrollLeft(rScrollLeft);
    setScrollTop(rScrollTop);
  }, [rScrollLeft, rScrollTop]);


  const selectStyle = useMemo(() => {
    const t = [];
    if (selected && selected.length && cellHeight) {
      selected.forEach((obj) => {
        t.push({ height: `${cellHeight}px`, top: `${obj.$y - 3}px` });
      });
    }
    return t;
  }, [selectedCounter, cellHeight]);

  useEffect(() => {
    dataRequest();
  }, [chartHeight]);

  const chartGridHeight = useMemo(
    () => Math.max(chartHeight || 0, fullHeight),
    [chartHeight, fullHeight],
  );

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    if (typeof scrollTop === 'number') el.scrollTop = scrollTop;
    if (typeof scrollLeft === 'number') el.scrollLeft = scrollLeft;
    if (typeof scrollTop === 'number' && scrollTop !== el.scrollTop)
      setScroll({ top: true });
    if (typeof scrollLeft === 'number' && scrollLeft !== el.scrollLeft)
      setScroll({ left: true });
  }, [scrollTop, scrollLeft]);

  const onScroll = () => {
    const scroll = { left: true, top: true };
    setScroll(scroll);
    dataRequest();
  };

  function setScroll(scroll) {
    const el = chartRef.current;
    if (!el) return;
    const pos = {};
    if (scroll.top) pos.top = el.scrollTop;
    if (scroll.left) pos.left = el.scrollLeft;
    api.exec('scroll-chart', pos);
  }

  function dataRequest() {
    const el = chartRef.current;
    const clientHeightLocal = chartHeight || 0;
    const num = Math.ceil(clientHeightLocal / (cellHeight || 1)) + 1;
    const pos = Math.floor(((el && el.scrollTop) || 0) / (cellHeight || 1));
    const start = Math.max(0, pos - extraRows);
    const end = pos + num + extraRows;
    const from = start * (cellHeight || 0);
    api.exec('render-data', {
      start,
      end,
      from,
    });
  }

  const showTask = useCallback(
    (value) => {
      if (!value) return;

      const { id, mode } = value;

      if (mode.toString().indexOf('x') < 0) return;
      const el = chartRef.current;
      if (!el) return;
      const { clientWidth } = el;
      const task = api.getTask(id);
      if (task.$x + task.$w < (scrollLeft || 0)) {
        setScrollLeft(task.$x - (cellWidth || 0));
      } else if (task.$x >= clientWidth + (scrollLeft || 0)) {
        const width = clientWidth < task.$w ? cellWidth || 0 : task.$w;
        setScrollLeft(task.$x - clientWidth + width);
      }
    },
    [api, scrollLeft, cellWidth],
  );

  useEffect(() => {
    showTask(rScrollTask);
  }, [rScrollTask]);


  function onWheel(e) {
    if (zoom && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const el = chartRef.current;
      const dir = -Math.sign(e.deltaY);
      const offset = e.clientX - (el ? el.getBoundingClientRect().left : 0);
      api.exec('zoom-scale', {
        dir,
        offset,
      });
    }
  }

  function getHoliday(cell) {
    const style = highlightTime(cell.date, cell.unit);
    if (style)
      return {
        css: style,
        width: cell.width,
      };
    return null;
  }

  const holidays = useMemo(() => {
    return scales &&
      (scales.minUnit === 'hour' || scales.minUnit === 'day') &&
      highlightTime
      ? scales.rows[scales.rows.length - 1].cells.map(getHoliday)
      : null;
  }, [scales, highlightTime]);

  function handleHotkey(ev) {
    ev.eventSource = 'chart';
    api.exec('hotkey', ev);
  }

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const update = () => setChartHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [chartRef.current]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const cleanup = hotkeys(el, {
      keys: {
        arrowup: true,
        arrowdown: true,
      },
      exec: (v) => handleHotkey(v),
    });
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [chartRef.current]);
  
  useEffect(() => {
    const node = chartRef.current;
    if (!node) return;

    const handler = onWheel;
    // Use passive: false only when zoom is enabled to allow preventDefault
    node.addEventListener('wheel', handler, { passive: !zoom });
    return () => {
      node.removeEventListener('wheel', handler);
    };
  }, [onWheel, zoom])

  return (
    <div
      className={`wx-mR7v2Xag wx-chart${isDragging ? ' wx-dragging' : ''}`}
      tabIndex={-1}
      ref={chartRef}
      onScroll={onScroll}
      onMouseDown={onMouseDown}
    >
      {markers && markers.length ? (
        <div
          className="wx-mR7v2Xag wx-markers"
          style={{ height: `${chartGridHeight}px` }}
        >
          {markers.map((marker, i) => (
            <div
              key={i}
              className={`wx-mR7v2Xag wx-marker ${marker.css || 'wx-default'}`}
              style={{ left: `${marker.left}px` }}
            >
              <div className="wx-mR7v2Xag wx-content">{marker.text}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        className="wx-mR7v2Xag wx-area"
        style={{ width: `${fullWidth}px`, height: `${chartGridHeight}px` }}
      >
        {holidays ? (
          <div
            className="wx-mR7v2Xag wx-gantt-holidays"
            style={{ height: '100%' }}
          >
            {holidays.map((holiday, i) =>
              holiday ? (
                <div
                  key={i}
                  className={'wx-mR7v2Xag ' + holiday.css}
                  style={{
                    width: `${holiday.width}px`,
                    left: `${i * holiday.width}px`,
                  }}
                />
              ) : null,
            )}
          </div>
        ) : null}

        <CellGrid borders={cellBorders} />

        {selected && selected.length
          ? selected.map((obj, index) =>
              obj.$y ? (
                <div
                  key={obj.id}
                  className="wx-mR7v2Xag wx-selected"
                  data-id={obj.id}
                  style={selectStyle[index]}
                ></div>
              ) : null,
            )
          : null}

        <Links />
        <Bars readonly={readonly} taskTemplate={taskTemplate} colorRules={colorRules} />
      </div>
    </div>
  );
}

export default Chart;
