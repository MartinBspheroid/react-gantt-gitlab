import { useMemo, useState, useCallback } from 'react';
import { getData } from '../data';
import { Gantt, Editor } from '../../src/';

function GanttEditor(props) {
  const { skinSettings } = props;

  const data = useMemo(() => getData(), []);

  const [api, setApi] = useState();

  const init = useCallback((ganttApi) => {
    setApi(ganttApi);
    // show Editor on "add-task" action
    ganttApi.on('add-task', ({ id }) => {
      ganttApi.exec('show-editor', { id });
    });
  }, []);

  return (
    <>
      <Gantt
        init={init}
        {...skinSettings}
        tasks={data.tasks}
        links={data.links}
        scales={data.scales}
      />
      {api && <Editor api={api} />}
    </>
  );
}

export default GanttEditor;
