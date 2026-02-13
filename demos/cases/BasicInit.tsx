import { useMemo } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';

export default function BasicInit({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  return (
    <Gantt
      {...skinSettings}
      tasks={data.tasks}
      links={data.links}
      scales={data.scales}
    />
  );
}
