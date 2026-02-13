import { useEffect, useRef, useState } from 'react';
import {
  Field,
  Text,
  TextArea,
  Select,
  Slider,
  DatePicker,
} from '@svar-ui/react-core';
import { useWritableProp } from '@svar-ui/lib-react';
import './Form.css';

export default function Form(props) {
  const [task, setTask] = useWritableProp(props.task);
  const { taskTypes, onAction } = props;

  const nodeRef = useRef(null);
  const [left, setLeft] = useState();
  const [top, setTop] = useState();

  useEffect(() => {
    if (nodeRef.current) {
      setLeft((window.innerWidth - nodeRef.current.offsetWidth) / 2);
      setTop((window.innerHeight - nodeRef.current.offsetHeight) / 2);
    }
  }, []);

  function deleteTask() {
    onAction && onAction({ action: 'delete-task', data: { id: task.id } });
    onAction && onAction({ action: 'close-form' });
  }

  function onClose() {
    onAction && onAction({ action: 'close-form' });
  }

  function handleChange({ value }, key) {
    let t = task;
    if (key === 'type' && value === 'milestone') {
      delete t.end;
      t.duration = 0;
    } else if (t.start > t.end) {
      t.start = t.end;
      t.duration = 1;
      t.end = 0;
    }
    t = {
      ...t,
      [key]: value,
    };
    setTask(t);
    onAction &&
      onAction({
        action: 'update-task',
        data: { id: t.id, task: t },
      });
  }

  return (
    <div className="wx-QkE5vh0y backdrop">
      <div className="wx-QkE5vh0y modal" style={{ left, top }} ref={nodeRef}>
        <div className="wx-QkE5vh0y header">
          <h3 className="wx-QkE5vh0y title">Edit task</h3>
          <i className="wx-QkE5vh0y close wxi-close" onClick={onClose}></i>
        </div>
        <div className="wx-QkE5vh0y body">
          <Field label="Name">
            {({ id }) => (
              <Text
                id={id}
                focus={true}
                value={task.text}
                onChange={(ev) => handleChange(ev, 'text')}
              />
            )}
          </Field>

          <Field label="Description">
            {({ id }) => (
              <TextArea
                id={id}
                value={task.details}
                onChange={(ev) => handleChange(ev, 'details')}
              />
            )}
          </Field>

          {taskTypes.length > 1 ? (
            <Field label="Type">
              {({ id }) => (
                <Select
                  id={id}
                  value={task.type}
                  options={taskTypes}
                  onChange={(ev) => handleChange(ev, 'type')}
                />
              )}
            </Field>
          ) : null}

          <Field label="Start date">
            {({ id }) => (
              <DatePicker
                id={id}
                value={task.start}
                onChange={(ev) => handleChange(ev, 'start')}
              />
            )}
          </Field>

          {task.type !== 'milestone' ? (
            <>
              <Field label="End date">
                {({ id }) => (
                  <DatePicker
                    id={id}
                    value={task.end}
                    onChange={(ev) => handleChange(ev, 'end')}
                  />
                )}
              </Field>
              <Field label={`Progress: ${task.progress}%`}>
                {({ id }) => (
                  <Slider
                    id={id}
                    value={task.progress}
                    onChange={(ev) => handleChange(ev, 'progress')}
                  />
                )}
              </Field>
            </>
          ) : null}

          <button className="wx-QkE5vh0y button danger" onClick={deleteTask}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
