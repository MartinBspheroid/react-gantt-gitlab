import { useMemo } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';
import AvatarCell from '../custom/AvatarCell.tsx';
import NameAndDateCell from '../custom/NameAndDateCell.tsx';
import AddTaskCell from '../custom/AddTaskCell.tsx';

function GanttGrid({ skinSettings }) {
  const columns = useMemo(
    () => [
      { id: 'text', header: 'Task', width: 220, cell: NameAndDateCell },
      { id: 'assigned', header: 'Assigned', width: 160, cell: AvatarCell },
      {
        id: 'add-task',
        header: { cell: AddTaskCell },
        align: 'center',
        width: 80,
      },
    ],
    [],
  );

  const data = useMemo(() => getData(), []);

  return (
    <Gantt
      {...skinSettings}
      tasks={data.tasks}
      links={data.links}
      scales={data.scales}
      columns={columns}
      cellHeight={40}
    />
  );
}

export default GanttGrid;
