import { useState, useMemo } from 'react';
import { getData } from '../data';
import {
  Gantt,
  Editor,
  defaultEditorItems,
  registerEditorItem,
} from '../../src';
import { Comments } from '@svar-ui/react-comments';
registerEditorItem('comments', Comments);

function GanttEditorComments(props) {
  const { skinSettings } = props;

  const data = useMemo(() => {
    const data = getData();
    data.tasks.forEach((d, i) => {
      d.comments = !i
        ? [
            {
              id: 1,
              user: 1,
              content:
                'Greetings, fellow colleagues. I would like to share my insights on this task. I reckon we should deal with at least half of the points in the plan without further delays.',
              date: new Date(),
            },
            {
              id: 2,
              user: 2,
              content:
                "Hi, Diego. I am sure that that's exactly what is thought best out there in Dunwall. Let's just do what we are supposed to do to get the result.",
              date: new Date(),
            },
            {
              id: 5,
              user: 3,
              content:
                "Absolutely, Diego. Action speaks louder than words, and in this case, it's about executing the plan efficiently. Let's prioritize tasks and tackle them head-on.",
              date: new Date(),
            },
          ]
        : [];
    });
    return data;
  }, []);

  const [api, setApi] = useState();
  const keys = useMemo(() => ['text', 'details'], []);
  const items = useMemo(() => {
    const items = defaultEditorItems.filter((op) => keys.indexOf(op.key) >= 0);
    items.push({
      key: 'comments',
      comp: 'comments',
      label: 'Comments',
      users: [
        { id: 1, name: 'Alex' },
        { id: 2, name: 'John' },
        { id: 3, name: 'Bob' },
        { id: 4, name: 'Mary' },
        { id: 5, name: 'Kate' },
      ],
      activeUser: 1,
    });
    return items;
  }, [keys]);

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

export default GanttEditorComments;
