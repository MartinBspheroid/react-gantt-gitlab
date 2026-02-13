import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getData } from '../data';
import { Gantt, Editor, defaultEditorItems, ContextMenu } from '../../src';
import './GanttSummariesProgress.css';

function GanttSummariesProgress({ skinSettings }) {
  const data = useMemo(() => getData(), []);
  const tasks = data.tasks;

  const [api, setApi] = useState();

  const [items, setItems] = useState(defaultEditorItems);

  const dayDiff = (next, prev) => {
    const d = (next - prev) / 1000 / 60 / 60 / 24;
    return Math.ceil(Math.abs(d));
  };

  /**
   * The formula of calculation is ∑d*p / ∑d , where "d" is task duration in days,
   * "p" is the task progress and "∑" stands for a sum of all loaded tasks
   */
  function getSummaryProgress(id) {
    const [totalProgress, totalDuration] = collectProgressFromKids(id);
    const res = totalProgress / totalDuration;
    return isNaN(res) ? 0 : Math.round(res);
  }

  function collectProgressFromKids(id) {
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
  }

  function recalcSummaryProgress(id, self) {
    const { tasks } = api.getState();
    const task = api.getTask(id);

    if (task.type != 'milestone') {
      const summary =
        self && task.type === 'summary' ? id : tasks.getSummaryId(id);

      if (summary) {
        const progress = getSummaryProgress(summary);
        api.exec('update-task', {
          id: summary,
          task: { progress },
        });
      }
    }
  }
  const recalcRef = useRef(null);
  recalcRef.current = recalcSummaryProgress;

  const init = useCallback((api) => {
    setApi(api);
    // auto progress calculations
    api.on('add-task', ({ id }) => {
      recalcRef.current(id);
    });
    api.on('update-task', ({ id }) => {
      recalcRef.current(id);
    });

    api.on('delete-task', ({ source }) => {
      recalcRef.current(source, true);
    });
    api.on('copy-task', ({ id }) => {
      recalcRef.current(id);
    });
    api.on('move-task', ({ id, source, inProgress }) => {
      if (inProgress) return;

      if (api.getTask(id).parent != source) recalcRef.current(source, true);
      recalcRef.current(id);
    });

    // disabling progress slider for summary tasks
    api.on('show-editor', ({ id }) => {
      if (id) {
        const type = api.getTask(id).type;
        setItems(
          defaultEditorItems.map((ed) => ({
            ...ed,
            ...(ed.key == 'progress' && {
              config: { disabled: type === 'summary' },
            }),
          })),
        );
      }
    });
  }, []);

  useEffect(() => {
    if (!api) return;
    api.getState().tasks.forEach((task) => {
      recalcSummaryProgress(task.id, true);
    });
  }, [api]);

  return (
    <div className="wx-OeNgRLo4 wrapper">
      <ContextMenu api={api}>
        <div className="wx-OeNgRLo4 gt-cell">
          <Gantt
            {...skinSettings}
            init={init}
            tasks={tasks}
            links={data.links}
            scales={data.scales}
            cellWidth={30}
          />
        </div>
      </ContextMenu>
      {api && <Editor api={api} items={items} />}
    </div>
  );
}

export default GanttSummariesProgress;
