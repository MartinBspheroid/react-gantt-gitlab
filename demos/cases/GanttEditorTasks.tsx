import { useState, useMemo } from 'react';
import { getData } from '../data';
import {
  Gantt,
  Editor,
  defaultEditorItems,
  registerEditorItem,
} from '../../src';
import { Tasklist } from '@svar-ui/react-tasklist';

registerEditorItem('tasks', Tasklist);

export default function GanttEditorTasks({ skinSettings }) {
  const data = useMemo(() => {
    const data = getData();
    data.tasks.forEach((d, i) => {
      d.tasks = !i
        ? [
            {
              id: 1,
              content:
                'Research best practices for integrating third-party libraries with React',
              status: 1,
            },
            {
              id: 2,
              content:
                'Explore modern approaches to building applications using React',
              status: 0,
            },
            {
              id: 3,
              content:
                'Explore different methods for integrating React with existing JavaScript frameworks',
              status: 0,
            },
            {
              id: 4,
              date: new Date(),
              content: 'Learn about routing in React using React Router',
              status: 1,
            },
            {
              id: 5,
              content:
                'Understand principles and best practices for component development in React',
              status: 0,
            },
            {
              id: 6,
              content:
                'Explore different methods for integrating React with existing JavaScript frameworks',
              status: 0,
            },
            {
              id: 7,
              content: 'Optimize performance in React applications',
              status: 0,
            },
            {
              id: 8,
              content:
                'Work with API requests and data handling in React applications',
              status: 0,
            },
          ]
        : [];
    });
    return data;
  }, []);

  const items = useMemo(() => {
    const keys = ['text', 'details'];
    const items = defaultEditorItems.filter((op) => keys.indexOf(op.key) >= 0);
    items.push({
      key: 'tasks',
      comp: 'tasks',
      label: 'Tasks',
    });
    return items;
  }, []);

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
      {api && <Editor api={api} items={items} />}
    </>
  );
}
