import { useState, useCallback, useMemo } from 'react';
import { getData } from '../data';
import { Gantt, defaultTaskTypes } from '../../src/';
import Form from '../custom/Form.tsx';
import './GanttForm.css';

export default function GanttForm({ skinSettings }) {
  const data = useMemo(() => getData(), []);
  const taskTypes = defaultTaskTypes;

  const [task, setTask] = useState();
  const [gApi, setGApi] = useState();

  const formAction = useCallback(
    ({ action, data }) => {
      switch (action) {
        case 'close-form':
          setTask(null);
          break;
        default:
          gApi.exec(action, data);
          break;
      }
    },
    [gApi],
  );

  const init = useCallback((api) => {
    api.intercept('show-editor', ({ id }) => {
      if (id) setTask(api.getState().tasks.byId(id));
      return false;
    });
    setGApi(api);
  }, []);

  return (
    <div className="wx-0moLF6Ul wrapper">
      <Gantt
        init={init}
        {...skinSettings}
        tasks={data.tasks}
        links={data.links}
        scales={data.scales}
      />
      {task ? (
        <Form task={task} taskTypes={taskTypes} onAction={formAction} />
      ) : null}
    </div>
  );
}
