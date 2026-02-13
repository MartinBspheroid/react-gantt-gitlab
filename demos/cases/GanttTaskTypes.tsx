import { useMemo, useState } from 'react';
import { getTypedData, taskTypes } from '../data';
import { Gantt, Editor } from '../../src/';
import './GanttTaskTypes.css';

function GanttTaskTypes(props) {
  const { skinSettings } = props;

  const data = useMemo(() => getTypedData(), []);
  const [api, setApi] = useState(null);

  return (
    <div className="wx-I1glfWSB demo">
      <Gantt
        init={setApi}
        {...skinSettings}
        tasks={data.tasks}
        links={data.links}
        scales={data.scales}
        taskTypes={taskTypes}
      />
      {api && <Editor api={api} />}
    </div>
  );
}

export default GanttTaskTypes;
