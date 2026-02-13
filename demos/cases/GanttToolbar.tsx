import { useState, useMemo } from 'react';
import { getData } from '../data';
import { Gantt, Toolbar, Editor } from '../../src/';
import './GanttToolbar.css';

export default function GanttToolbar(props) {
  const { skinSettings } = props;

  const data = useMemo(() => getData(), []);

  const [api, setApi] = useState();

  return (
    <>
      <Toolbar api={api} />
      <div className="wx-2rSWAdWv gtcell">
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
