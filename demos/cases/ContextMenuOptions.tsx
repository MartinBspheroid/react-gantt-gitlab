import { useState, useContext, useMemo } from 'react';
import { getData } from '../data';
import { Gantt, ContextMenu, Editor, defaultMenuOptions } from '../../src/';
import { context } from '@svar-ui/react-core';

export default function ContextMenuOptions({ skinSettings }) {
  const helpers = useContext(context.helpers);

  const data = useMemo(() => getData(), []);

  const [api, setApi] = useState();

  function actionHandler() {
    helpers.showNotice({ text: "'My action' clicked" });
  }

  const [options] = useState(() => {
    const ids = ['cut-task', 'copy-task', 'paste-task', 'delete-task'];
    let arr = [{ id: 'add-task:after', text: ' Add below', icon: 'wxi-plus' }];
    arr = arr.concat(
      defaultMenuOptions.filter((op) => ids.indexOf(op.id) >= 0),
    );
    arr.push({
      id: 'my-action',
      text: 'My action',
      icon: 'wxi-empty',
      handler: actionHandler,
    });
    return arr;
  });

  function onClick({ context: ctx, action }) {
    if (!action.handler)
      helpers.showNotice({
        text: `'${action.id}' clicked for the '${ctx.id}' task`,
      });
  }

  return (
    <>
      <ContextMenu api={api} options={options} onClick={onClick}>
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
