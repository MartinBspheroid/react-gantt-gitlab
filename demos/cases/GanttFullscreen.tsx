import { useMemo } from 'react';
import { getData } from '../data';
import { Gantt, Fullscreen } from '../../src/';
import './GanttFullscreen.css';

function GanttFullscreen({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  return (
    <div className="wx-0qqHrQ85 demo">
      <h4>Click the "expand" icon, or click on Gantt and press Ctrl+Shift+F</h4>
      <div className="wx-0qqHrQ85 gtcell">
        <Fullscreen hotkey="ctrl+shift+f">
          <Gantt {...skinSettings} tasks={data.tasks} links={data.links} />
        </Fullscreen>
      </div>
    </div>
  );
}

export default GanttFullscreen;
