// @ts-nocheck
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { context } from '@svar-ui/react-core';
import { locateID, locateAttr } from '@svar-ui/lib-dom';
import { reorder } from '../../helpers/reorder';
import { normalizeDates } from '@svar-ui/gantt-store';
import { Grid as WxGrid } from '@svar-ui/react-grid';
import TextCell from './TextCell.tsx';
import ActionCell from './ActionCell.tsx';
import { useWritableProp, useStore } from '@svar-ui/lib-react';
import storeContext from '../../context';
import './Grid.css';

export default function Grid(props) {
  const {
    readonly,
    compactMode,
    width = 0,
    display = 'all',
    columnWidth: columnWidthProp = 0,
    onTableAPIChange,
    colorRules,
  } = props;
  const [columnWidth, setColumnWidthProp] = useWritableProp(columnWidthProp);
  const [tableAPI, setTableAPI] = useState();

  const i18n = useContext(context.i18n);
  const _ = useMemo(() => i18n.getGroup('gantt'), [i18n]);
  const api = useContext(storeContext);

  const scrollTopVal = useStore(api, 'scrollTop');
  const cellHeightVal = useStore(api, 'cellHeight');
  const scrollTask = useStore(api, '_scrollTask');
  const selectedVal = useStore(api, '_selected');
  const areaVal = useStore(api, 'area');
  const rTasksVal = useStore(api, '_tasks');
  const scalesVal = useStore(api, '_scales');
  const columnsVal = useStore(api, 'columns');
  const sortVal = useStore(api, '_sort');
  const durationUnitVal = useStore(api, 'durationUnit');

  const touchYRef = useRef(null);
  const scrollRef = useRef(true);
  const [dragTask, setDragTask] = useState(null);

  const tasks = useMemo(() => {
    if (!rTasksVal || !areaVal) return [];
    return rTasksVal.slice(areaVal.start, areaVal.end);
  }, [rTasksVal, areaVal]);

  const execAction = useCallback(
    (id, action) => {
      if (action === 'add-task') {
        api.exec(action, {
          target: id,
          task: { text: _('New Task') },
          mode: 'child',
          show: true,
        });
      } else if (action === 'open-task') {
        const task = tasks.find((a) => a.id === id);
        if (task?.data || task?.lazy)
          api.exec(action, { id, mode: !task.open });
      }
    },
    [tasks],
  );

  const onClick = useCallback(
    (e) => {
      const id = locateID(e);
      const action = e.target.dataset.action;
      if (action) e.preventDefault();
      if (id) {
        if (action === 'add-task' || action === 'open-task') {
          execAction(id, action);
        } else {
          api.exec('select-task', {
            id,
            toggle: e.ctrlKey || e.metaKey,
            range: e.shiftKey,
            show: true,
          });
        }
      } else if (action === 'add-task') {
        execAction(null, action);
      }
    },
    [api, execAction],
  );

  const tableRef = useRef(null);
  const tableContainerRef = useRef(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [updateFlex, setUpdateFlex] = useState(false);

  useEffect(() => {
    const node = tableContainerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const update = () => setGridWidth(node.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const lastDetailRef = useRef(null);

  const reorderTasks = useCallback(
    (detail) => {
      const id = detail.id;
      const { before, after } = detail;
      const inProgress = detail.onMove;

      let target = before || after;
      let mode = before ? 'before' : 'after';

      if (inProgress) {
        if (mode === 'after') {
          const task = api.getTask(target);
          if (task.data?.length && task.open) {
            mode = 'before';
            target = task.data[0].id;
          }
        }
        lastDetailRef.current = { id, [mode]: target };
      } else lastDetailRef.current = null;

      api.exec('move-task', {
        id,
        mode,
        target,
        inProgress,
      });
    },
    [api],
  );

  const scrollDelta = useMemo(() => areaVal?.from ?? 0, [areaVal]);
  const headerHeight = useMemo(() => scalesVal?.height ?? 0, [scalesVal]);

  const scrollX = useMemo(() => {
    if (!compactMode && display !== 'grid') {
      return (columnWidth ?? 0) > (width ?? 0);
    } else {
      return (columnWidth ?? 0) > (gridWidth ?? 0);
    }
  }, [compactMode, display, columnWidth, width, gridWidth]);

  const tableStyle = useMemo(() => {
    const style = {};
    if ((scrollX && display === 'all') || (display === 'grid' && scrollX)) {
      style.width = columnWidth;
    } else if (display === 'grid') {
      style.width = '100%';
    }
    return style;
  }, [scrollX, display, columnWidth]);

  const allTasks = useMemo(() => {
    if (dragTask && !tasks.find((t) => t.id === dragTask.id)) {
      return [...tasks, dragTask];
    }
    return tasks;
  }, [tasks, dragTask]);

  const cols = useMemo(() => {
    let cols = (columnsVal || []).map((col) => {
      col = { ...col };
      const header = col.header;
      if (typeof header === 'object') {
        const text = header.text && _(header.text);
        col.header = { ...header, text };
      } else col.header = _(header);
      return col;
    });
    const ti = cols.findIndex((c) => c.id === 'text');
    const ai = cols.findIndex((c) => c.id === 'add-task');

    if (ti !== -1) {
      if (cols[ti].cell) cols[ti]._cell = cols[ti].cell;
      cols[ti].cell = TextCell;
      cols[ti].colorRules = colorRules; // Pass colorRules to TextCell
    }
    if (ai !== -1) {
      cols[ai].cell = cols[ai].cell || ActionCell;

      const header = cols[ai].header;
      if (typeof header !== 'object') cols[ai].header = { text: header };
      cols[ai].header.cell = header.cell || ActionCell;

      if (readonly) {
        cols.splice(ai, 1);
      } else {
        if (compactMode) {
          const [actionCol] = cols.splice(ai, 1);
          cols.unshift(actionCol);
        }
      }
    }

    if (cols.length > 0) cols[cols.length - 1].resize = false;
    return cols;
  }, [columnsVal, _, readonly, compactMode, colorRules]);

  const basis = useMemo(() => {
    if (display === 'all') return `${width}px`;
    if (display === 'grid') return 'calc(100% - 4px)';
    return cols.find((c) => c.id === 'add-task') ? '50px' : '0';
  }, [display, width, cols]);

  const sortMarks = useMemo(() => {
    if (allTasks && sortVal?.length) {
      const marks = {};
      sortVal.forEach(({ key, order }, index) => {
        marks[key] = {
          order,
          ...(sortVal.length > 1 && { index }),
        };
      });
      return marks;
    }
    return {};
  }, [allTasks, sortVal]);

  const checkFlex = useCallback(() => {
    return cols.some((c) => c.flexgrow && !c.hidden);
  }, []); // cols defined later; will use latest value when invoked

  const hasFlexCol = useMemo(() => {
    // updateFlex is used to trigger re-evaluation
    void updateFlex;
    return checkFlex();
  }, [checkFlex, updateFlex]);

  const fitColumns = useMemo(() => {
    let filteredColumns =
      display === 'chart' ? cols.filter((c) => c.id === 'add-task') : cols;

    const containerWidth = display === 'all' ? width : gridWidth;
    if (!hasFlexCol) {
      let baseColumnWidth = columnWidth;
      let forceReset = false;
      if (cols.some((c) => c.$width)) {
        let actualWidth = 0;
        baseColumnWidth = cols.reduce((acc, col) => {
          if (!col.hidden) {
            actualWidth += col.width;
            acc += col.$width || col.width;
          }
          return acc;
        }, 0);

        if (actualWidth > baseColumnWidth && baseColumnWidth > containerWidth)
          forceReset = true;
      }

      if (forceReset || baseColumnWidth < containerWidth) {
        let k = 1;
        if (!forceReset)
          k = (containerWidth - 50) / (baseColumnWidth - 50 || 1);
        return filteredColumns.map((c) => {
          if (c.id !== 'add-task' && !c.hidden) {
            if (!c.$width) c.$width = c.width;
            c.width = c.$width * k;
          }
          return c;
        });
      }
    }
    return filteredColumns;
  }, [display, cols, hasFlexCol, columnWidth, width, gridWidth]);

  const setColumnWidth = useCallback(
    (resized) => {
      if (!checkFlex()) {
        const newColumnWidth = fitColumns.reduce((acc, col) => {
          if (resized && col.$width) col.$width = col.width;
          return acc + (col.hidden ? 0 : col.width);
        }, 0);
        if (newColumnWidth !== columnWidth) setColumnWidthProp(newColumnWidth);
      }
      setUpdateFlex(true);
      setUpdateFlex(false);
    },
    [checkFlex, fitColumns, columnWidth, setColumnWidthProp],
  );

  const adjustColumns = useCallback(() => {
    const flexCols = cols.filter((c) => c.flexgrow && !c.hidden);
    if (flexCols.length === 1)
      cols.forEach((c) => {
        if (c.$width && !c.flexgrow && !c.hidden) c.width = c.$width;
      });
  }, []); // cols defined later; will use latest

  const onDblClick = useCallback(
    (e) => {
      if (!readonly) {
        const id = locateID(e);
        const column = locateAttr(e, 'data-col-id');
        const columnObj = column && cols.find((c) => c.id == column);
        if (!columnObj?.editor && id) api.exec('show-editor', { id });
      }
    },
    [api, readonly], // cols is defined later; relies on latest value at call time
  );

  const endScroll = useCallback(() => {
    scrollRef.current = false;
  }, []);

  const onTouchstart = useCallback(
    (e) => {
      scrollRef.current = true;
      touchYRef.current = e.touches[0].clientY + (scrollTopVal ?? 0);
    },
    [scrollTopVal],
  );

  const onTouchmove = useCallback(
    (e) => {
      if (scrollRef.current) {
        const delta = (touchYRef.current ?? 0) - e.touches[0].clientY;
        api.exec('scroll-chart', { top: delta });
        e.preventDefault();
        return false;
      }
    },
    [api],
  );

  const sel = useMemo(
    () => (Array.isArray(selectedVal) ? selectedVal.map((o) => o.id) : []),
    [selectedVal],
  );

  useEffect(() => {
    const handler = () => endScroll();
    window.addEventListener('touchend', handler, { passive: true });
    return () => window.removeEventListener('touchend', handler);
  }, [endScroll]);

  const setScrollOffset = useCallback(() => {
    if (tableRef.current && allTasks !== null) {
      const body = tableRef.current.querySelector('.wx-body');
      if (body)
        body.style.top = -((scrollTopVal ?? 0) - (scrollDelta ?? 0)) + 'px';
    }
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
  }, [allTasks, scrollTopVal, scrollDelta]);

  useEffect(() => {
    if (tableRef.current) {
      setScrollOffset();
    }
  }, [scrollTopVal, scrollDelta, setScrollOffset]);

  useEffect(() => {
    const tableEl = tableRef.current;
    if (!tableEl) return;
    const bodyEl = tableEl.querySelector('.wx-table-box .wx-body');
    if (!bodyEl || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      setScrollOffset();
    });
    ro.observe(bodyEl);
    return () => {
      ro.disconnect();
    };
  }, [fitColumns, tableStyle, display, basis, allTasks, setScrollOffset]);

  useEffect(() => {
    if (!scrollTask || !tableAPI) return;

    const { id } = scrollTask;
    const focusCell = tableAPI.getState().focusCell;
    if (
      focusCell &&
      focusCell.row !== id &&
      tableRef.current &&
      tableRef.current.contains(document.activeElement)
    ) {
      tableAPI.exec('focus-cell', {
        row: id,
        column: focusCell.column,
      });
    }
  }, [scrollTask, tableAPI]);

  const startReorder = useCallback(
    ({ id }) => {
      if (readonly) return false;

      if (api.getTask(id).open) api.exec('open-task', { id, mode: false });

      const t = api.getState()._tasks.find((t) => t.id === id);
      setDragTask(t || null);
      if (!t) return false;
    },
    [api, readonly],
  );

  const endReorder = useCallback(
    ({ id, top }) => {
      if (lastDetailRef.current) {
        reorderTasks({ ...lastDetailRef.current, onMove: false });
      } else {
        api.exec('drag-task', {
          id,
          top: top + (scrollDelta ?? 0),
          inProgress: false,
        });
      }
      setDragTask(null);
    },
    [api, reorderTasks, scrollDelta],
  );

  const moveReorder = useCallback(
    ({ id, top, detail }) => {
      if (detail) {
        reorderTasks({ ...detail, onMove: true });
      }
      api.exec('drag-task', {
        id,
        top: top + (scrollDelta ?? 0),
        inProgress: true,
      });
    },
    [api, reorderTasks, scrollDelta],
  );

  useEffect(() => {
    const node = tableRef.current;
    if (!node) return;
    const action = reorder(node, {
      start: startReorder,
      touchStart: endScroll,
      end: endReorder,
      move: moveReorder,
      getTask: api.getTask,
    });
    return action.destroy;
  }, [api, startReorder, endScroll, endReorder, moveReorder]);

  const handleHotkey = useCallback(
    (ev) => {
      const { key, isInput } = ev;
      if (!isInput && (key === 'arrowup' || key === 'arrowdown')) {
        ev.eventSource = 'grid';
        api.exec('hotkey', ev);
        return false;
      } else if (key === 'enter') {
        const focusCell = tableAPI?.getState().focusCell;
        if (focusCell) {
          const { row, column } = focusCell;
          if (column === 'add-task') {
            execAction(row, 'add-task');
          } else if (column === 'text') {
            execAction(row, 'open-task');
          }
        }
      }
    },
    [api, execAction, tableAPI],
  );

  // FIXME - temporary hack to provide fresh values to grid's handlers
  const handlersStateRef = useRef(null);
  const setHandlersState = () => {
    handlersStateRef.current = {
      setTableAPI,
      handleHotkey,
      sortVal,
      api,
      adjustColumns,
      setColumnWidth,
      tasks,
      durationUnitVal,
      onTableAPIChange,
    };
  };
  setHandlersState();
  useEffect(() => {
    setHandlersState();
  }, [
    setTableAPI,
    handleHotkey,
    sortVal,
    api,
    adjustColumns,
    setColumnWidth,
    tasks,
    durationUnitVal,
    onTableAPIChange,
  ]);

  const init = useCallback((tapi) => {
    setTableAPI(tapi);
    tapi.intercept('hotkey', (ev) => handlersStateRef.current.handleHotkey(ev));
    tapi.intercept('scroll', () => false);
    tapi.intercept('select-row', () => false);
    tapi.intercept('sort-rows', (e) => {
      const sortVal = handlersStateRef.current.sortVal;
      const { key, add } = e;
      const keySort = sortVal ? sortVal.find((s) => s.key === key) : null;
      let order = 'asc';
      if (keySort) order = !keySort || keySort.order === 'asc' ? 'desc' : 'asc';

      api.exec('sort-tasks', {
        key,
        order,
        add,
      });
      return false;
    });

    tapi.on('resize-column', () => {
      handlersStateRef.current.setColumnWidth(true);
    });

    tapi.on('hide-column', (ev) => {
      if (!ev.mode) handlersStateRef.current.adjustColumns();
      handlersStateRef.current.setColumnWidth();
    });

    tapi.intercept('update-cell', (e) => {
      const { id, column, value } = e;
      const task = handlersStateRef.current.tasks.find((t) => t.id === id);

      if (task) {
        const update = { ...task };
        let v = value;

        // Allow null values through (for clearing dates)
        // Only apply number conversion for non-null, non-Date values
        if (v !== null && v && !isNaN(v) && !(v instanceof Date)) v *= 1;
        update[column] = v;

        // Skip normalizeDates if value is null (date being cleared)
        // to prevent auto-filling default dates
        if (v !== null) {
          normalizeDates(
            update,
            handlersStateRef.current.durationUnitVal,
            true,
            column,
          );
        }

        api.exec('update-task', {
          id: id,
          task: update,
        });
      }
      return false;
    });

    onTableAPIChange && onTableAPIChange(tapi);
  }, []);

  return (
    <div
      className="wx-rHj6070p wx-table-container"
      style={{ flex: `0 0 ${basis}` }}
      ref={tableContainerRef}
    >
      <div
        ref={tableRef}
        style={tableStyle}
        className="wx-rHj6070p wx-table"
        onTouchStart={onTouchstart}
        onTouchMove={onTouchmove}
        onClick={onClick}
        onDoubleClick={onDblClick}
      >
        <WxGrid
          init={init}
          sizes={{
            rowHeight: cellHeightVal,
            headerHeight: (headerHeight ?? 0) - 1,
          }}
          rowStyle={(row) => {
            let className = 'wx-rHj6070p';
            if (row.$reorder) className += ' wx-reorder-task';
            if (row.$isMilestone || row.type === 'milestone')
              className += ' wx-milestone-row';
            return className;
          }}
          columnStyle={(col) =>
            `wx-rHj6070p wx-text-${col.align}${col.id === 'add-task' ? ' wx-action' : ''}`
          }
          data={allTasks}
          columns={fitColumns}
          selectedRows={[...sel]}
          sortMarks={sortMarks}
        />
      </div>
    </div>
  );
}
