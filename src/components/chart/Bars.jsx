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
import { getMatchingRules, parseLabelsString } from '../../types/colorRule';
import { isSplitTask, visualizeSplitTask } from '../../pro-features/SplitTasks';
import './Bars.css';

// Parent task baseline 括號樣式常數（9-slice 設計：斜邊固定，中間伸縮）
const BRACKET_CONFIG = {
  GAP: 10, // 與 task bar 的間距
  ARM_LENGTH: 3, // 斜邊水平寬度（固定）- 改小讓斜邊更短
  DROP_HEIGHT: 4, // 斜邊垂直落差（固定）- 改小讓直線更貼近下方
  STROKE_WIDTH: 4, // 線條粗細
};

/**
 * 標題偏移常數（避開 link 轉折區域）
 * link 轉折距離 = min(cellWidth/2, LINK_OFFSET_MAX)
 */
const LINK_OFFSET_MAX = 20; // 與 Links.jsx 的 LIBRARY_LINK_OFFSET_MAX 一致
const LABEL_GAP = 4; // 標題與 link 轉折點之間的緩衝

/**
 * 計算標題的動態偏移量
 * @param {number} cellWidth - 當前格子寬度
 * @returns {number} 標題相對於 bar 結束位置的偏移 (px)
 */
function getLabelOffset(cellWidth) {
  const linkOffset = Math.min(cellWidth / 2, LINK_OFFSET_MAX);
  return linkOffset + LABEL_GAP;
}

/**
 * Parent task baseline 括號組件
 * 形成向下包覆子任務的形狀：/────────\
 */
const ParentBaselineBracket = ({ task, isMilestone, cellWidth }) => {
  const { GAP, ARM_LENGTH, DROP_HEIGHT, STROKE_WIDTH } = BRACKET_CONFIG;

  const x = task.$x_base;
  const width = task.$w_base;
  const bracketTop = task.$y + task.$h + GAP;

  // 窄寬度時等比縮小斜邊長度
  const minWidth = cellWidth || 40;
  const armLength = width < minWidth ? width / 2 : ARM_LENGTH;

  // 點位：左下 -> 左上 -> 右上 -> 右下
  const points = `0,${DROP_HEIGHT} ${armLength},0 ${width - armLength},0 ${width},${DROP_HEIGHT}`;

  return (
    <svg
      className={`wx-GKbcLEGA wx-baseline-bracket${isMilestone ? ' wx-milestone' : ''}`}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${bracketTop}px`,
        width: `${width}px`,
        height: `${DROP_HEIGHT + STROKE_WIDTH}px`,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Calculate position for a split task segment
 * Uses task's internal positioning ($x, $w) relative to timeline start
 */
const getSegmentPosition = (task, segmentStart, segmentEnd, scalesValue) => {
  if (!task.start || !scalesValue?.start) return null;

  const timelineStart = scalesValue.start.getTime();
  const cellWidth = scalesValue.lengthUnitWidth || 40;
  const lengthUnit = scalesValue.lengthUnit || 'day';

  let unitMs = 24 * 60 * 60 * 1000; // day
  if (lengthUnit === 'hour') unitMs = 60 * 60 * 1000;
  else if (lengthUnit === 'week') unitMs = 7 * 24 * 60 * 60 * 1000;
  else if (lengthUnit === 'month') unitMs = 30 * 24 * 60 * 60 * 1000;
  else if (lengthUnit === 'quarter') unitMs = 90 * 24 * 60 * 60 * 1000;

  const startX =
    ((segmentStart.getTime() - timelineStart) / unitMs) * cellWidth;
  const endX = ((segmentEnd.getTime() - timelineStart) / unitMs) * cellWidth;
  const width = Math.max(cellWidth, endX - startX);

  return { left: startX, width };
};

/**
 * SplitTaskSegments - renders a split task as multiple segments with gap connectors
 */
const SplitTaskSegments = ({
  task,
  api,
  readonly,
  taskTemplate: TaskTemplate,
  colorRules,
  labelOffset,
  getMoveMode,
  linkFrom,
  alreadyLinked,
  scalesValue,
  onSegmentDown,
}) => {
  if (!isSplitTask(task)) return null;

  const visualSegments = visualizeSplitTask({
    id: task.id,
    parts: task.splitParts,
  });

  if (visualSegments.length === 0) return null;

  // Filter out gaps, keep only actual segments
  const segments = visualSegments.filter((s) => !s.isGap);
  const gaps = visualSegments.filter((s) => s.isGap);

  // Calculate positions for all segments
  const segmentPositions = segments.map((segment) => ({
    ...segment,
    position: getSegmentPosition(task, segment.start, segment.end, scalesValue),
  }));

  // Get color rules matching
  const matchedRules = getMatchingRules(
    task.text,
    parseLabelsString(task.labels),
    colorRules,
  );
  const hasColorRules = matchedRules.length > 0;

  const toRgba = (hex, opacity = 1) => {
    if (!hex) return 'transparent';
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const baseColor = '#00ba94';
  const stripeStyle = hasColorRules
    ? {
        '--wx-base-color': baseColor,
        '--wx-color-rule-1': toRgba(
          matchedRules[0]?.color,
          matchedRules[0]?.opacity ?? 1,
        ),
        '--wx-color-rule-2': toRgba(
          matchedRules[1]?.color || matchedRules[0]?.color,
          matchedRules[1]?.opacity ?? matchedRules[0]?.opacity ?? 1,
        ),
        '--wx-color-rule-3': toRgba(
          matchedRules[2]?.color || matchedRules[0]?.color,
          matchedRules[2]?.opacity ?? matchedRules[0]?.opacity ?? 1,
        ),
      }
    : {};

  const stripeClass = hasColorRules
    ? matchedRules.length === 1
      ? ' wx-color-rule-single'
      : matchedRules.length === 2
        ? ' wx-color-rule-double'
        : ' wx-color-rule-triple'
    : '';

  return (
    <div
      className="wx-GKbcLEGA wx-split-task-container"
      style={{
        left: `${task.$x}px`,
        top: `${task.$y}px`,
        height: `${task.$h}px`,
      }}
    >
      {segmentPositions.map((segment, index) => {
        if (!segment.position) return null;

        const segmentStyle = {
          left: `${segment.position.left - task.$x}px`,
          width: `${segment.position.width}px`,
          height: `${task.$h}px`,
          ...stripeStyle,
          '--wx-label-offset': `${labelOffset}px`,
        };

        const segmentClass =
          `wx-GKbcLEGA wx-split-segment wx-task` +
          (linkFrom && linkFrom.id === task.id ? ' wx-selected' : '') +
          stripeClass;

        // Calculate gap connector to next segment
        const gapConnector =
          index < segmentPositions.length - 1
            ? (() => {
                const currentEnd =
                  segment.position.left + segment.position.width;
                const nextStart = segmentPositions[index + 1].position.left;
                return {
                  left: currentEnd,
                  width: nextStart - currentEnd,
                };
              })()
            : null;

        return (
          <Fragment key={segment.id}>
            <div
              className={segmentClass}
              style={segmentStyle}
              data-tooltip-id={task.id}
              data-id={task.id}
              data-segment-id={segment.id}
              onMouseDown={(e) =>
                onSegmentDown && onSegmentDown(e, task, segment.id)
              }
            >
              {TaskTemplate ? (
                <TaskTemplate data={task} api={api} onAction={() => {}} />
              ) : hasColorRules ? (
                <>
                  <div className="wx-GKbcLEGA wx-content"></div>
                  {index === 0 && (
                    <div className="wx-GKbcLEGA wx-text-out">
                      {task.text || ''}
                    </div>
                  )}
                </>
              ) : (
                <div className="wx-GKbcLEGA wx-content">
                  {index === 0 ? task.text || '' : ''}
                </div>
              )}
            </div>
            {gapConnector && gapConnector.width > 0 && (
              <div
                className="wx-GKbcLEGA wx-split-gap-connector"
                style={{
                  left: `${gapConnector.left - task.$x}px`,
                  width: `${gapConnector.width}px`,
                  top: `${task.$h / 2}px`,
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
};

function Bars(props) {
  const { readonly, taskTemplate: TaskTemplate, colorRules = [] } = props;

  const api = useContext(storeContext);

  const [rTasksValue, rTasksCounter] = useStoreWithCounter(api, '_tasks');
  const [rLinksValue, rLinksCounter] = useStoreWithCounter(api, '_links');
  const areaValue = useStore(api, 'area');
  const scalesValue = useStore(api, '_scales');
  const taskTypesValue = useStore(api, 'taskTypes');
  const baselinesValue = useStore(api, 'baselines');
  const selectedValue = useStore(api, '_selected');
  const scrollTaskStore = useStore(api, '_scrollTask');
  const cellWidthValue = useStore(api, 'cellWidth');

  // 動態計算標題偏移（隨 cellWidth 變化）
  // 設定為 CSS 變數，讓子元素的 .wx-text-out 可以使用
  const labelOffset = useMemo(
    () => getLabelOffset(cellWidthValue),
    [cellWidthValue],
  );

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
    (node, point, isCascadeMode = false) => {
      const { clientX } = point;
      const id = getID(node);
      const task = api.getTask(id);

      if (!readonly) {
        const mode = isCascadeMode
          ? 'cascade'
          : getMoveMode(node, point, task) || 'move';

        setTaskMove({
          id,
          mode,
          x: clientX,
          dx: 0,
          l: task.$x,
          w: task.$w,
          isCascadeMode,
        });
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

      // Check if clicking on cascade trigger
      const cascadeTrigger = e.target.closest('[data-cascade="true"]');
      const isCascadeMode = !!cascadeTrigger;

      down(node, e, isCascadeMode);
    },
    [readonly, lengthUnitWidth, totalWidth, taskMove, linkFrom, down],
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
    if (taskMove) {
      const { id, mode, dx, l, w, start, isCascadeMode } = taskMove;
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
        } else if (isCascadeMode) {
          // Trigger cascade-move-task event for moving parent with all children
          api.exec('cascade-move-task', { id, diff });
        } else {
          let update = {};
          let task = api.getTask(id);
          if (mode == 'move' || mode === 'cascade') {
            update.start = task.start;
            update.end = task.end;
          } else update[mode] = task[mode];

          api.exec('update-task', {
            id,
            task: update,
            diff,
            mode: mode === 'cascade' ? 'move' : mode, // 'move', 'start', or 'end'
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
        if (taskMove) {
          const { mode, l, w, x, id, start } = taskMove;
          const dx = clientX - x;
          if (
            (!start && Math.abs(dx) < 20) ||
            (mode === 'start' && w - dx < lengthUnitWidth) ||
            (mode === 'end' && w + dx < lengthUnitWidth) ||
            ((mode == 'move' || mode === 'cascade') &&
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
          } else if (
            mode === 'move' ||
            mode === 'move-baseline' ||
            mode === 'cascade'
          ) {
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
            (((mode == 'move' || mode === 'cascade') && task.$x == l) ||
              (mode != 'move' && mode !== 'cascade' && task.$w == w))
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
        if (id && !e.target.classList.contains('wx-link')) {
          const task = api.getTask(id);
          if (task && (task.data?.length > 0 || task.lazy)) {
            api.exec('open-task', { id, mode: !task.open });
          } else {
            api.exec('show-editor', { id });
          }
        }
      }
    },
    [api, readonly],
  );

  const types = ['e2s', 's2s', 'e2e', 's2e'];
  const getLinkType = useCallback((fromStart, toStart) => {
    return types[(fromStart ? 1 : 0) + (toStart ? 0 : 2)];
  }, []);

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

        // Check if this is a split task - render using SplitTaskSegments
        if (
          isSplitTask(task) &&
          task.type !== 'milestone' &&
          task.type !== 'summary'
        ) {
          const matchedRules = getMatchingRules(
            task.text,
            parseLabelsString(task.labels),
            colorRules,
          );

          return (
            <Fragment key={task.id}>
              <SplitTaskSegments
                task={task}
                api={api}
                readonly={readonly}
                taskTemplate={TaskTemplate}
                colorRules={colorRules}
                labelOffset={labelOffset}
                getMoveMode={getMoveMode}
                linkFrom={linkFrom}
                alreadyLinked={alreadyLinked}
                scalesValue={scalesValue}
                onSegmentDown={(e, task, segmentId) => {
                  // Handle segment-specific drag operations
                  const node = locate(e);
                  if (node) down(node, e);
                }}
              />
              {baselinesValue && !task.$skip_baseline ? (
                <div
                  className="wx-GKbcLEGA wx-baseline"
                  style={baselineStyle(task)}
                ></div>
              ) : null}
            </Fragment>
          );
        }

        // Color rules matching
        const matchedRules = getMatchingRules(
          task.text,
          parseLabelsString(task.labels),
          colorRules,
        );
        const hasColorRules = matchedRules.length > 0;

        // Build stripe class based on number of matches
        let stripeClass = '';
        if (hasColorRules) {
          if (matchedRules.length === 1) stripeClass = ' wx-color-rule-single';
          else if (matchedRules.length === 2)
            stripeClass = ' wx-color-rule-double';
          else stripeClass = ' wx-color-rule-triple';
        }

        // Helper to convert hex + opacity to rgba
        const toRgba = (hex, opacity = 1) => {
          if (!hex) return 'transparent';
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          if (!result) return hex;
          const r = parseInt(result[1], 16);
          const g = parseInt(result[2], 16);
          const b = parseInt(result[3], 16);
          return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        };

        // Determine base color based on task type
        const isMilestone =
          task.$isMilestone ||
          task._gitlab?.type === 'milestone' ||
          task.type === 'milestone';
        let baseColor = '#00ba94'; // Default: green for tasks
        if (isMilestone) {
          baseColor = '#ad44ab'; // Purple for milestones
        } else if (task.$isIssue) {
          baseColor = '#3983eb'; // Blue for issues
        }

        // Build inline style for CSS variables
        const stripeStyle = hasColorRules
          ? {
              '--wx-base-color': baseColor,
              '--wx-color-rule-1': toRgba(
                matchedRules[0]?.color,
                matchedRules[0]?.opacity ?? 1,
              ),
              '--wx-color-rule-2': toRgba(
                matchedRules[1]?.color || matchedRules[0]?.color,
                matchedRules[1]?.opacity ?? matchedRules[0]?.opacity ?? 1,
              ),
              '--wx-color-rule-3': toRgba(
                matchedRules[2]?.color || matchedRules[0]?.color,
                matchedRules[2]?.opacity ?? matchedRules[0]?.opacity ?? 1,
              ),
            }
          : {};

        const barClass =
          `wx-bar wx-${taskTypeCss(task.type)}` +
          (touched && taskMove && task.id === taskMove.id ? ' wx-touch' : '') +
          (linkFrom && linkFrom.id === task.id ? ' wx-selected' : '') +
          (task.$reorder ? ' wx-reorder-task' : '') +
          (task.$parent ? ' wx-parent-task' : '') +
          (task.$isIssue !== undefined
            ? task.$isIssue
              ? ' wx-gitlab-issue'
              : ' wx-gitlab-task'
            : '') +
          (task.$isMilestone || task._gitlab?.type === 'milestone'
            ? ' wx-gitlab-milestone'
            : '') +
          (task.priority !== undefined && task.priority !== null
            ? ` wx-priority-${task.priority}`
            : '') +
          stripeClass;
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
              style={{
                ...taskStyle(task),
                ...stripeStyle,
                '--wx-label-offset': `${labelOffset}px`,
              }}
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
                TaskTemplate ? (
                  <TaskTemplate data={task} api={api} onAction={forward} />
                ) : hasColorRules ? (
                  // For bars with color rules, show text outside to avoid stripe interference
                  <>
                    <div className="wx-GKbcLEGA wx-content"></div>
                    <div className="wx-GKbcLEGA wx-text-out">
                      {task.text || ''}
                    </div>
                  </>
                ) : (
                  <div className="wx-GKbcLEGA wx-content">
                    {task.text || ''}
                  </div>
                )
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

              {/* Cascade move trigger - only show for bars with children */}
              {!readonly && task.data && task.data.length > 0 && (
                <div
                  className="wx-GKbcLEGA wx-cascade-trigger"
                  data-cascade="true"
                  title="Drag to move with all children"
                >
                  <svg viewBox="0 0 10 8" width="10" height="8">
                    <polygon
                      points="0,0 10,0 5,8"
                      fill="currentColor"
                      stroke="#333"
                      strokeWidth="0.5"
                    />
                  </svg>
                </div>
              )}

              {!readonly ? (
                <div className={'wx-GKbcLEGA ' + rightLinkClass}>
                  <div className="wx-GKbcLEGA wx-inner"></div>
                </div>
              ) : null}
            </div>
            {baselinesValue && !task.$skip_baseline ? (
              task.$parent ? (
                // Parent tasks: 使用括號形式 baseline（向下包覆子任務）
                <ParentBaselineBracket
                  task={task}
                  isMilestone={
                    task.type === 'milestone' ||
                    task.$isMilestone ||
                    task._gitlab?.type === 'milestone'
                  }
                  cellWidth={cellWidthValue}
                />
              ) : (
                // Non-parent tasks: 保持原有 bar 形式 baseline
                <div
                  className={
                    'wx-GKbcLEGA wx-baseline' +
                    (task.type === 'milestone' ||
                    task.$isMilestone ||
                    task._gitlab?.type === 'milestone'
                      ? ' wx-milestone'
                      : '')
                  }
                  style={baselineStyle(task)}
                ></div>
              )
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

export default Bars;
