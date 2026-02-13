import { useState, useMemo } from 'react';
import { getData } from '../data';
import { Gantt, Editor, defaultEditorItems } from '../../src';

function GanttEditorConfig({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  const [api, setApi] = useState();

  const bottomBar = useMemo(
    () => ({
      items: [
        { comp: 'button', type: 'secondary', text: 'Close', id: 'close' },
        { comp: 'spacer' },
        { comp: 'button', type: 'danger', text: 'Delete', id: 'delete' },
        { comp: 'button', type: 'primary', text: 'Save', id: 'save' },
      ],
    }),
    [],
  );

  const keys = useMemo(
    () => ['text', 'type', 'start', 'end', 'duration', 'progress', 'details'],
    [],
  );

  const items = useMemo(
    () =>
      keys.map((key) => ({
        ...defaultEditorItems.find((op) => op.key === key),
      })),
    [keys],
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
      {api && (
        <Editor
          api={api}
          items={items}
          bottomBar={bottomBar}
          topBar={false}
          placement="modal"
          autoSave={false}
        />
      )}
    </>
  );
}

export default GanttEditorConfig;
