import { useMemo, useState } from 'react';
import { getData } from '../data';
import { Gantt, Editor } from '../../src';

function GanttEditorReadonly({ ...skinSettings }) {
  const data = useMemo(() => getData(), []);
  const [api, setApi] = useState();

  return (
    <>
      <Gantt
        init={setApi}
        {...skinSettings}
        tasks={data.tasks}
        links={data.links}
        scales={data.scales}
      />
      {api && <Editor api={api} readonly={true} topBar={true} />}
    </>
  );
}

export default GanttEditorReadonly;
