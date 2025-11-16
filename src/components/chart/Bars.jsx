import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { locate, locateID } from '@svar-ui/lib-dom';
import { getID } from '../../helpers/locate';
import storeContext from '../../context';
import { useStore, useStoreWithCounter } from '@svar-ui/lib-react';
import './Bars.css';

function Bars(props) {
  const { readonly, taskTemplate: TaskTemplate } = props;

  const api = useContext(storeContext);

  const [rTasksValue, rTasksCounter] = useStoreWithCounter(api,"_tasks");
  const [rLinksValue, rLinksCounter] = useStoreWithCounter(api,"_links");
  const areaValue = useStore(api,"area");
  const scalesValue = useStore(api,"_scales");
  const taskTypesValue = useStore(api,"taskTypes");
  const baselinesValue = useStore(api,"baselines");
  const selectedValue = useStore(api,"_selected");
  const scrollTaskStore = useStore(api,"_scrollTask" );

  const tasks = useMemo(() => {
    if (!areaValue || !Array.isArray(rTasksValue)) return [];
    const start = areaValue.start ?? 0;
    const end = areaValue.end ?? 0;
    return rTasksValue.slice(start, end).map((a) => ({ ...a }));
  }, [rTasksCounter, areaValue]);

  const lengthUnitWidth = useMemo(
    () => scalesValue.lengthUnitWidth,
    [scalesValue],
  );

  const ignoreNextClickRef = useRef(false);

  const [linkFrom, setLinkFrom] = useState(undefined);
  const [taskMove, setTaskMove] = useState(null);
  const progressFromRef = useRef(null);

  const [touched, setTouched] = useState(undefined);
  const touchTimerRef = useRef(null);

  const [totalWidth, setTotalWidth] = useState(0);

  const containerRef = useRef(null);

  const hasFocus = useMemo(() => {
    const el = containerRef.current;
    return !!(
      selectedValue.length &&
      el &&
      el.contains(document.activeElement)
    );
  }, [selectedValue, containerRef.current]);

  const focused = useMemo(() => {
    return hasFocus && selectedValue[selectedValue.length - 1]?.id;
  }, [hasFocus, selectedValue]);

  useEffect(() => {
    if (!scrollTaskStore || typeof scrollTaskStore.subscribe !== 'function')
      return;
    const unsub = scrollTaskStore.subscribe((value) => {
      if (hasFocus && value) {
        const { id } = value;
        const node = containerRef.current?.querySelector(
          `.wx-bar[data-id='${id}']`,
        );
        if (node) node.focus();
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [scrollTaskStore, hasFocus]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setTotalWidth(el.offsetWidth || 0);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]) {
          setTotalWidth(entries[0].contentRect.width);
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [containerRef.current]);

  const startDrag = useCallback(() => {
    document.body.style.userSelect = 'none';
  }, []);

  const endDrag = useCallback(() => {
    document.body.style.userSelect = '';
  }, []);

  const getMoveMode = useCallback(
    (node, e, task) => {
      if (!task) task = api.getTask(getID(node));
      if (task.type === 'milestone' || task.type == 'summary') return '';

      const rect = node.getBoundingClientRect();
      const p = (e.clientX - rect.left) / rect.width;
      let delta = 0.2 / (rect.width > 200 ? rect.width / 200 : 1);

      if (p < delta) return 'start';
      if (p > 1 - delta) return 'end';
      return '';
    },
    [api],
  );

  const down = useCallback(
    (node, point) => {
      const { clientX } = point;
      const id = getID(node);
      const task = api.getTask(id);
      const css = point.target.classList;

      if (!readonly) {
        if (css.contains('wx-progress-marker')) {
          const { progress } = api.getTask(id);
          progressFromRef.current = {
            id,
            x: clientX,
            progress,
            dx: 0,
            node,
            marker: point.target,
          };
          point.target.classList.add('wx-progress-in-drag');
        } else {
          const mode = getMoveMode(node, point, task) || 'move';

          setTaskMove({
            id,
            mode,
            x: clientX,
            dx: 0,
            l: task.$x,
            w: task.$w,
          });
        }
        startDrag();
      }
    },
    [api, readonly, getMoveMode, startDrag],
  );

  const mousedown = useCallback(
    (e) => {
      if (e.button !== 0) return;

      const node = locate(e);
      if (!node) return;

      down(node, e);
    },
    [readonly, lengthUnitWidth, totalWidth, taskMove, linkFrom],
  );

  const touchstart = useCallback(
    (e) => {
      const node = locate(e);
      if (node) {
        touchTimerRef.current = setTimeout(() => {
          setTouched(true);
          down(node, e.touches[0]);
        }, 300);
      }
    },
    [readonly],
  );


  const up = useCallback(() => {
    if (progressFromRef.current) {
      const { dx, id, marker, value } = progressFromRef.current;
      progressFromRef.current = null;
      if (typeof value != 'undefined' && dx)
        api.exec('update-task', { id, task: { progress: value } });
      marker.classList.remove('wx-progress-in-drag');

      ignoreNextClickRef.current = true;
      endDrag();
    } else if (taskMove) {
      const { id, mode, dx, l, w, start } = taskMove;
      setTaskMove(null);
      if (start) {
        const diff = Math.round(dx / lengthUnitWidth);

        if (!diff) {
          api.exec('drag-task', {
            id,
            width: w,
            left: l,
            inProgress: false,
          });
        } else {
          let update = {};
          let task = api.getTask(id);
          if (mode == 'move') {
            update.start = task.start;
            update.end = task.end;
          } else update[mode] = task[mode];

          api.exec('update-task', {
            id,
            task: update,
            diff,
          });
        }
        ignoreNextClickRef.current = true;
      }

      endDrag();
    }
  }, [api, endDrag, taskMove, lengthUnitWidth]);

  const move = useCallback(
    (e, point) => {
      const { clientX } = point;

      if (!readonly) {
        if (progressFromRef.current) {
          const { node, x, id } = progressFromRef.current;
          const dx = (progressFromRef.current.dx = clientX - x);

          const diff = Math.round((dx / node.offsetWidth) * 100);
          let progress = progressFromRef.current.progress + diff;
          progressFromRef.current.value = progress = Math.min(
            Math.max(0, progress),
            100,
          );

          api.exec('update-task', {
            id,
            task: { progress },
            inProgress: true,
          });
        } else if (taskMove) {
          const { mode, l, w, x, id, start } = taskMove;
          const dx = clientX - x;
          if (
            (!start && Math.abs(dx) < 20) ||
            (mode === 'start' && w - dx < lengthUnitWidth) ||
            (mode === 'end' && w + dx < lengthUnitWidth) ||
            (mode == 'move' &&
              ((dx < 0 && l + dx < 0) || (dx > 0 && l + w + dx > totalWidth)))
          )
            return;

          const nextTaskMove = { ...taskMove, dx };

          let left, width;
          if (mode === 'start') {
            left = l + dx;
            width = w - dx;
          } else if (mode === 'end') {
            left = l;
            width = w + dx;
          } else if (mode === 'move' || mode === 'move-baseline') {
            left = l + dx;
            width = w;
          }

          let ev = {
            id,
            width: width,
            left: left,
            inProgress: true,
          };

          api.exec('drag-task', ev);

          const task = api.getTask(id);
          if (
            !nextTaskMove.start &&
            ((mode == 'move' && task.$x == l) ||
              (mode != 'move' && task.$w == w))
          ) {
            ignoreNextClickRef.current = true;
            up();
            return;
          }
          nextTaskMove.start = true;
          setTaskMove(nextTaskMove);
        } else {
          const mnode = locate(e);
          if (mnode) {
            const mode = getMoveMode(mnode, point);
            mnode.style.cursor = mode && !readonly ? 'col-resize' : 'pointer';
          }
        }
      }
    },
    [api, readonly, taskMove, lengthUnitWidth, totalWidth, getMoveMode],
  );

  const mousemove = useCallback(
    (e) => {
      move(e, e);
    },
    [move],
  );

  const touchmove = useCallback(
    (e) => {
      if (touched) {
        e.preventDefault();
        move(e, e.touches[0]);
      } else if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    },
    [touched, move],
  );

  const mouseup = useCallback(() => {
    up();
  }, [up]);

  const touchend = useCallback(() => {
    setTouched(null);
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    up();
  }, [up]);

  useEffect(() => {
    window.addEventListener('mouseup', mouseup, { passive: true });
    return () => {
      window.removeEventListener('mouseup', mouseup);
    };
  }, [mouseup]);

  const onDblClick = useCallback(
    (e) => {
      if (!readonly) {
        const id = locateID(e.target);
        if (id && !e.target.classList.contains('wx-link'))
          api.exec('show-editor', { id });
      }
    },
    [api, readonly],
  );


  const types = ['e2s', 's2s', 'e2e', 's2e'];
  const getLinkType = useCallback(
    (fromStart, toStart) => {
      return types[(fromStart ? 1 : 0) + (toStart ? 0 : 2)];
    },
    [],
  );

  const alreadyLinked = useCallback(
    (target, toStart) => {
      const source = linkFrom.id;
      const fromStart = linkFrom.start;

      if (target === source) return true;

      return !!rLinksValue.find((l) => {
        return (
          l.target == target &&
          l.source == source &&
          l.type === getLinkType(fromStart, toStart)
        );
      });
    },
    [linkFrom, rLinksCounter, getLinkType],
  );

  const removeLinkMarker = useCallback(() => {
    if (linkFrom) {
      setLinkFrom(null);
    }
  }, [linkFrom]);
  
  const onClick = useCallback(
    (e) => {
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false;
        return;
      }

      const id = locateID(e.target);
      if (id) {
        const css = e.target.classList;
        if (css.contains('wx-link')) {
          const toStart = css.contains('wx-left');
          if (!linkFrom) {
            setLinkFrom({ id, start: toStart });
            return;
          }

          if (linkFrom.id !== id && !alreadyLinked(id, toStart)) {
            api.exec('add-link', {
              link: {
                source: linkFrom.id,
                target: id,
                type: getLinkType(linkFrom.start, toStart),
              },
            });
          }
        } else {
          api.exec('select-task', {
            id,
            toggle: e.ctrlKey || e.metaKey,
            range: e.shiftKey,
          });
        }
      }
      removeLinkMarker();
    },
    [api, linkFrom, rLinksCounter],
  );

  const taskStyle = useCallback((task) => {
    return {
      left: `${task.$x}px`,
      top: `${task.$y}px`,
      width: `${task.$w}px`,
      height: `${task.$h}px`,
    };
  }, []);

  const baselineStyle = useCallback((task) => {
    // For non-parent tasks, use original baseline positioning
    return {
      left: `${task.$x_base}px`,
      top: `${task.$y_base}px`,
      width: `${task.$w_base}px`,
      height: `${task.$h_base}px`,
    };
  }, []);

  const contextmenu = useCallback(
    (ev) => {
      if (touched || touchTimerRef.current) {
        ev.preventDefault();
        return false;
      }
    },
    [touched],
  );


  const taskTypeCss = useCallback(
    (type) => {
      let css = taskTypesValue.some((t) => type === t.id) ? type : 'task';
      if (css !== 'task' && css !== 'milestone' && css !== 'summary')
        css = `task ${css}`;
      return css;
    },
    [taskTypesValue],
  );

  const forward = useCallback(
    (ev) => {
      api.exec(ev.action, ev.data);
    },
    [api],
  );

  return (
    <div
      className="wx-GKbcLEGA wx-bars"
      style={{ lineHeight: `${tasks.length ? tasks[0].$h : 0}px` }}
      ref={containerRef}
      onContextMenu={contextmenu}
      onMouseDown={mousedown}
      onMouseMove={mousemove}
      onTouchStart={touchstart}
      onTouchMove={touchmove}
      onTouchEnd={touchend}
      onClick={onClick}
      onDoubleClick={onDblClick}
      onDragStart={(e) => {
        e.preventDefault();
        return false;
      }}
    >
      {tasks.map((task) => {
        if (task.$skip) return null;
        const barClass =
          `wx-bar wx-${taskTypeCss(task.type)}` +
          (touched && taskMove && task.id === taskMove.id ? ' wx-touch' : '') +
          (linkFrom && linkFrom.id === task.id ? ' wx-selected' : '') +
          (task.$reorder ? ' wx-reorder-task' : '') +
          (task.$parent ? ' wx-parent-task' : '');
        const leftLinkClass =
          'wx-link wx-left' +
          (linkFrom ? ' wx-visible' : '') +
          (!linkFrom || !alreadyLinked(task.id, true) ? ' wx-target' : '') +
          (linkFrom && linkFrom.id === task.id && linkFrom.start
            ? ' wx-selected'
            : '');
        const rightLinkClass =
          'wx-link wx-right' +
          (linkFrom ? ' wx-visible' : '') +
          (!linkFrom || !alreadyLinked(task.id, false) ? ' wx-target' : '') +
          (linkFrom && linkFrom.id === task.id && !linkFrom.start
            ? ' wx-selected'
            : '');
        return (
          <Fragment key={task.id}>
            <div
              className={'wx-GKbcLEGA ' + barClass}
              style={taskStyle(task)}
              data-tooltip-id={task.id}
              data-id={task.id}
              tabIndex={focused === task.id ? 0 : -1}
            >
              {!readonly ? (
                <div className={'wx-GKbcLEGA ' + leftLinkClass}>
                  <div className="wx-GKbcLEGA wx-inner"></div>
                </div>
              ) : null}

              {task.type !== 'milestone' ? (
                <>
                  {task.progress ? (
                    <div className="wx-GKbcLEGA wx-progress-wrapper">
                      <div
                        className="wx-GKbcLEGA wx-progress-percent"
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                  ) : null}
                  {!readonly ? (
                    <div
                      className="wx-GKbcLEGA wx-progress-marker"
                      style={{ left: `calc(${task.progress}% - 10px)` }}
                    >
                      {task.progress}
                    </div>
                  ) : null}
                  {TaskTemplate ? (
                    <TaskTemplate data={task} api={api} onAction={forward} />
                  ) : (
                    <div className="wx-GKbcLEGA wx-content">
                      {task.text || ''}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="wx-GKbcLEGA wx-content"></div>
                  {TaskTemplate ? (
                    <TaskTemplate data={task} api={api} onAction={forward} />
                  ) : (
                    <div className="wx-GKbcLEGA wx-text-out">{task.text}</div>
                  )}
                </>
              )}

              {!readonly ? (
                <div className={'wx-GKbcLEGA ' + rightLinkClass}>
                  <div className="wx-GKbcLEGA wx-inner"></div>
                </div>
              ) : null}
            </div>
            {baselinesValue && !task.$skip_baseline ? (
              <div
                className={
                  'wx-GKbcLEGA wx-baseline' +
                  (task.type === 'milestone' ? ' wx-milestone' : '')
                }
                style={baselineStyle(task)}
              ></div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

export default Bars;
