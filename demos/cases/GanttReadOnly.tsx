import { useMemo } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';

export default function GanttReadOnly({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  return (
    <Gantt
      readonly={true}
      {...skinSettings}
      tasks={data.tasks}
      links={data.links}
      scales={data.scales}
    />
  );
}
