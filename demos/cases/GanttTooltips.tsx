import { useMemo, useState } from 'react';
import { getData } from '../data';
import { Gantt, Tooltip } from '../../src/';
import MyTooltipContent from '../custom/MyTooltipContent.tsx';

function GanttTooltips({ skinSettings }) {
  const data = useMemo(() => getData(), []);
  const [api, setApi] = useState(null);

  return (
    <Tooltip api={api} content={MyTooltipContent}>
      <Gantt
        {...skinSettings}
        tasks={data.tasks}
        links={data.links}
        scales={data.scales}
        init={setApi}
      />
    </Tooltip>
  );
}

export default GanttTooltips;
