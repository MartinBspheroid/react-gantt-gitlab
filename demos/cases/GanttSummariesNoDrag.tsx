import { useState, useMemo, useCallback } from 'react';
import { getData } from '../data';
import { Gantt, ContextMenu, Editor } from '../../src/';

export default function GanttSummariesNoDrag({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  const [api, setApi] = useState();

  const init = useCallback((api) => {
    setApi(api);
    api.intercept('drag-task', ({ id, top }) => {
      return !(typeof top === 'undefined' && api.getTask(id).type == 'summary');
    });
  }, []);

  return (
    <div className="wx-h4Sohvpn gt-cell">
      <ContextMenu api={api}>
        <Gantt
          init={init}
          {...skinSettings}
          tasks={data.tasks}
          links={data.links}
          scales={data.scales}
        />
      </ContextMenu>
      {api && <Editor api={api} />}
    </div>
  );
}
