import { useState, useMemo, useCallback } from 'react';
import { getData } from '../data';
import { Gantt, ContextMenu, Editor } from '../../src/';

function ContextMenuHandler(props) {
  const { skinSettings } = props;
  const [api, setApi] = useState();

  const data = useMemo(() => getData(), []);

  const resolver = useCallback((id) => {
    return id > 2;
  }, []);

  const filter = useCallback((option, task) => {
    const type = task.type;
    if (option.id) {
      const ids = option.id.toString().split(':');
      if (type == 'milestone' && ids[0] == 'add-task') return ids[1] != 'child';
    }

    return true;
  }, []);

  return (
    <>
      <ContextMenu api={api} resolver={resolver} filter={filter}>
        <Gantt
          init={setApi}
          {...skinSettings}
          tasks={data.tasks}
          links={data.links}
          scales={data.scales}
        />
      </ContextMenu>
      {api && <Editor api={api} />}
    </>
  );
}

export default ContextMenuHandler;
