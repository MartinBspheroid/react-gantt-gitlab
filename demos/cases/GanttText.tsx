import { useMemo, useRef, useCallback } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';
import MyTaskContent from '../custom/MyTaskContent.tsx';

export default function GanttText({ skinSettings }) {
  const data = useMemo(() => getData(), []);
  const api = useRef(null);

  const doClick = useCallback((ev) => {
    api.current.exec('update-task', {
      id: ev.id,
      task: {
        clicked: ev.clicked,
      },
    });
  }, []);

  return (
    <Gantt
      {...skinSettings}
      ref={api}
      onCustomClick={doClick}
      taskTemplate={MyTaskContent}
      tasks={data.tasks}
      links={data.links}
      scales={data.scales}
    />
  );
}
