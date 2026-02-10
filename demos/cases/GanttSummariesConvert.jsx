import { useMemo, useCallback, useRef } from 'react';
import { useStoreLater } from '@svar-ui/lib-react';
import { getData } from '../data';
import {
  Gantt,
  ContextMenu,
  Editor,
  defaultEditorItems,
  defaultTaskTypes,
} from '../../src/';

export default function GanttSummariesConvert({ skinSettings }) {
  const data = useMemo(() => getData(), []);
  const gApi = useRef(null);

  const toSummary = useCallback(
    (id, self) => {
      const api = gApi.current;
      if (!api) return;
      const task = api.getTask(id);
      if (!self) id = task.parent;

      if (id && task.type !== 'summary') {
        api.exec('update-task', {
          id,
          task: { type: 'summary' },
        });
      }
    },
    [gApi],
  );

  const toTask = useCallback(
    (id) => {
      const api = gApi.current;
      if (!api) return;
      const obj = api.getTask(id);
      if (obj && !obj.data?.length) {
        api.exec('update-task', {
          id,
          task: { type: 'task' },
        });
      }
    },
    [gApi],
  );

  const init = useCallback(
    (api) => {
      gApi.current = api;

      api.getState().tasks.forEach((task) => {
        if (task.data?.length) {
          toSummary(task.id, true);
        }
      });

      api.on('add-task', ({ id, mode }) => {
        if (mode === 'child') toSummary(id);
      });

      api.on('move-task', ({ id, source, mode, inProgress }) => {
        if (inProgress) return;
        if (mode == 'child') toSummary(id);
        else toTask(source);
      });

      api.on('delete-task', ({ source }) => {
        toTask(source);
      });
    },
    [toSummary, toTask],
  );

  const activeTaskId = useStoreLater(gApi.current, 'activeTask');

  const items = useMemo(() => {
    const api = gApi.current;
    const task = activeTaskId ? api?.getTask(activeTaskId) : null;
    if (task) {
      return defaultEditorItems.map((item) => {
        item = { ...item };
        if (item.comp === 'select' && item.key === 'type') {
          item.options =
            task.type !== 'summary'
              ? defaultTaskTypes.filter((t) => t.id !== 'summary')
              : [];
        }
        return item;
      });
    }
    return undefined;
  }, [activeTaskId, gApi.current]);

  return (
    <div className="wx-TEIogFEZ gt-cell">
      <ContextMenu api={gApi.current}>
        <Gantt
          init={init}
          {...skinSettings}
          tasks={data.tasks}
          links={data.links}
          scales={data.scales}
        />
      </ContextMenu>
      {gApi.current && <Editor api={gApi.current} items={items} />}
    </div>
  );
}
