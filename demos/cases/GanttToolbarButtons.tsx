import { useState, useMemo, useCallback, useContext } from 'react';
import { context } from '@svar-ui/react-core';
import { getData } from '../data';
import { Gantt, Toolbar, Editor, defaultToolbarButtons } from '../../src/';
import './GanttToolbarButtons.css';

export default function GanttToolbarButtons({ skinSettings }) {
  const helpers = useContext(context.helpers);
  const [api, setApi] = useState();

  const data = useMemo(() => getData(), []);

  const actionHandler = useCallback(() => {
    helpers.showNotice({ text: "'My action' clicked" });
  }, [helpers]);

  const items = useMemo(() => {
    const items = defaultToolbarButtons.filter((b) => {
      return b.id?.indexOf('indent') === -1;
    });

    items.push({
      id: 'my-action',
      comp: 'icon',
      icon: 'wxi-cat',
      handler: actionHandler,
    });

    return items;
  }, [actionHandler]);

  return (
    <>
      <Toolbar api={api} items={items} />
      <div className="wx-vkht5Uhi gtcell">
        <Gantt
          {...skinSettings}
          init={setApi}
          tasks={data.tasks}
          links={data.links}
          scales={data.scales}
        />
        {api && <Editor api={api} />}
      </div>
    </>
  );
}
