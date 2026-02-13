import { useRef, useState, useCallback, useMemo } from 'react';
import { getData } from '../data';
import { Gantt, ContextMenu, Editor } from '../../src/';
import { Button } from '@svar-ui/react-core';
import './DropDownMenu.css';

export default function DropDownMenu({ skinSettings }) {
  const apiRef = useRef(null);
  const [api, setApi] = useState(null);
  const menu = useRef(null);

  const data = useMemo(() => getData(), []);

  const resolver = useCallback(() => {
    const inst = apiRef.current;
    const selected = inst ? inst.getReactiveState().selected : null;
    const id =
      selected && selected.length ? selected[selected.length - 1] : null;
    return id ? inst.getTask(id) : null;
  }, []);

  return (
    <>
      <ContextMenu api={api} resolver={resolver} at="right" ref={menu} />

      <div className="wx-T6JFUSGo rows">
        <div className="wx-T6JFUSGo bar">
          <Button
            type="primary"
            onClick={(ev) => menu.current && menu.current.show(ev)}
          >
            Task action
          </Button>
        </div>

        <div className="wx-T6JFUSGo gtcell">
          <Gantt
            ref={(inst) => {
              apiRef.current = inst;
              setApi(inst);
            }}
            {...skinSettings}
            tasks={data.tasks}
            links={data.links}
            scales={data.scales}
          />
          <Editor api={api} />
        </div>
      </div>
    </>
  );
}
