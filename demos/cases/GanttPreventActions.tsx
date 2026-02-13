import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getData } from '../data';
import { Gantt, defaultColumns, Editor } from '../../src/';
import { Field, Switch } from '@svar-ui/react-core';
import './GanttPreventActions.css';

function GanttPreventActions({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  const [edit, setEdit] = useState(true); // if false - cannot add and edit task
  const [drag, setDrag] = useState(true); // if false - cannot drag tasks on scale
  const [order, setOrder] = useState(true); // if false - cannot reorder tasks in grid
  const [newLink, setNewLink] = useState(true); // if false - cannot create new links

  const ignoreRef = useRef(false);
  const [api, setApi] = useState();

  const editRef = useRef(edit);
  const dragRef = useRef(drag);
  const orderRef = useRef(order);

  useEffect(() => {
    editRef.current = edit;
  }, [edit]);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const init = useCallback((gApi) => {
    setApi(gApi);

    gApi.intercept('show-editor', () => editRef.current || ignoreRef.current);
    gApi.intercept('drag-task', (ev) => {
      if (typeof ev.top !== 'undefined') return orderRef.current;
      return dragRef.current; // ev.width && ev.left
    });
  }, []);

  const columns = useMemo(
    () =>
      edit ? defaultColumns : defaultColumns.filter((a) => a.id != 'add-task'),
    [edit],
  );

  // for demo purposes: close editor when checkbox is unchecked
  useEffect(() => {
    if (!edit) {
      ignoreRef.current = true;
      api.exec('show-editor', { id: null });
      ignoreRef.current = false;
    }
  }, [edit, api]);

  return (
    <div className="wx-RPSbwjNq rows">
      <div className="wx-RPSbwjNq bar">
        <Field label="Adding and editing" position={'left'}>
          {({ id }) => (
            <Switch
              value={edit}
              onChange={({ value }) => setEdit(value)}
              id={id}
            />
          )}
        </Field>
        <Field label="Creating links" position={'left'}>
          {({ id }) => (
            <Switch
              value={newLink}
              onChange={({ value }) => setNewLink(value)}
              id={id}
            />
          )}
        </Field>
        <Field label="Dragging tasks" position={'left'}>
          {({ id }) => (
            <Switch
              value={drag}
              onChange={({ value }) => setDrag(value)}
              id={id}
            />
          )}
        </Field>
        <Field label="Reordering tasks" position={'left'}>
          {({ id }) => (
            <Switch
              value={order}
              onChange={({ value }) => setOrder(value)}
              id={id}
            />
          )}
        </Field>
      </div>
      <div
        className={
          'wx-RPSbwjNq ' +
          ('gantt' +
            (!edit ? ' hide-progress' : '') +
            (!newLink ? ' hide-links' : '') +
            (!drag ? ' hide-drag' : ''))
        }
      >
        <Gantt
          init={init}
          {...(skinSettings || {})}
          tasks={data.tasks}
          links={data.links}
          scales={data.scales}
          columns={columns}
        />
        {api && <Editor api={api} />}
      </div>
    </div>
  );
}

export default GanttPreventActions;
