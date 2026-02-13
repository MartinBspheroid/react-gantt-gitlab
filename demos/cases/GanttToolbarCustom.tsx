import { useState, useMemo } from 'react';
import { getData } from '../data';
import { Gantt, Editor } from '../../src/';
import { Toolbar } from '@svar-ui/react-toolbar';
import { useStoreLater } from '@svar-ui/lib-react';
import './GanttToolbarCustom.css';

export default function GanttToolbarCustom({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  const [api, setApi] = useState(null);
  const selectedValue = useStoreLater(api, 'selected');

  function handleAdd() {
    if (!api) return;
    api.exec('add-task', {
      task: {
        text: 'New task',
      },
      target: selectedValue[0],
      mode: 'after',
    });
  }

  function handleDelete() {
    if (!api) return;
    const order = getActionOrder(true);
    order.forEach((id) => api.exec('delete-task', { id }));
  }

  function handleMove(mode) {
    if (!api) return;
    const changeDir = mode === 'down';
    const order = getActionOrder(changeDir);
    order.forEach((id) => api.exec('move-task', { id, mode }));
  }

  function getActionOrder(changeDir) {
    if (!api) return [];
    const tasks = selectedValue
      .map((id) => api.getTask(id))
      .sort((a, b) => {
        return a.$level - b.$level || a.$y - b.$y;
      });
    const idOrder = tasks.map((o) => o.id);
    if (changeDir) return idOrder.reverse();
    return idOrder;
  }

  const allItems = [
    {
      comp: 'button',
      type: 'primary',
      text: 'Add task',
      handler: handleAdd,
    },
    {
      comp: 'button',
      text: 'Delete task',
      handler: handleDelete,
    },
    {
      comp: 'button',
      type: 'primary',
      text: 'Move task down',
      handler: () => handleMove('down'),
    },
    {
      comp: 'button',
      type: 'primary',
      text: 'Move task up',
      handler: () => handleMove('up'),
    },
  ];

  const items = useMemo(() => {
    if (api && selectedValue) {
      return selectedValue.length ? allItems : [allItems[0]];
    }
    return [allItems[0]];
  }, [api, selectedValue, allItems]);

  const GanttInitialised = useMemo(() => {
    return (
      <Gantt
        {...(skinSettings || {})}
        init={setApi}
        tasks={data.tasks}
        links={data.links}
        scales={data.scales}
      />
    );
  }, [skinSettings, data.tasks, data.links, data.scales]);

  return (
    <>
      <Toolbar items={items} />
      <div className="wx-7sTOb4gt gtcell">
        {GanttInitialised}
        {api && <Editor api={api} />}
      </div>
    </>
  );
}
