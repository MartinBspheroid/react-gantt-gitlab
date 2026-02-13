import { useMemo, useState } from 'react';
import { getData } from '../data';
import { Gantt, Editor, defaultEditorItems } from '../../src';

function GanttEditorValidation({ skinSettings }) {
  const data = useMemo(() => getData(), []);
  const [api, setApi] = useState();

  const items = useMemo(
    () =>
      defaultEditorItems.map((ed) => ({
        ...ed,
        ...(ed.comp === 'text' && { required: true }),
        ...(ed.comp === 'counter' && {
          validation: (v) => v <= 50,
          validationMessage: 'Task duration should not exceed 50 days',
        }),
      })),
    [],
  );

  return (
    <>
      <Gantt
        init={setApi}
        {...skinSettings}
        tasks={data.tasks}
        links={data.links}
        scales={data.scales}
      />
      {api && <Editor api={api} items={items} autoSave={false} />}
    </>
  );
}

export default GanttEditorValidation;
