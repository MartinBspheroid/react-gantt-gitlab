import { useMemo } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';

function GanttNoGrid(props) {
  const { skinSettings } = props;

  const data = useMemo(() => getData(), []);

  return (
    <Gantt
      {...skinSettings}
      tasks={data.tasks}
      links={data.links}
      scales={data.scales}
      columns={false}
      cellWidth={60}
    />
  );
}

export default GanttNoGrid;
