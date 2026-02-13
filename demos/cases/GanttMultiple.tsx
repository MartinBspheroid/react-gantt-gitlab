import { useRef, useState } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';
import { Button } from '@svar-ui/react-core';
import './GanttMultiple.css';

function GanttMultiple(props) {
  const { skinSettings } = props;

  const counterRef = useRef(0);
  const [gantts, setGantts] = useState(() => {
    const initial = [];
    initial.push({
      id: counterRef.current,
      data: getData(),
    });
    counterRef.current += 1;
    initial.push({
      id: counterRef.current,
      data: getData(),
    });
    counterRef.current += 1;
    return initial;
  });

  function addGantt() {
    setGantts((prev) => {
      const next = [
        ...prev,
        {
          id: counterRef.current,
          data: getData(),
        },
      ];
      counterRef.current += 1;
      return next;
    });
  }

  function removeGantt(id) {
    setGantts((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="wx-NlISAKUQ rows">
      <div className="wx-NlISAKUQ row">
        <Button type="primary" onClick={addGantt}>
          Add Gantt
        </Button>
      </div>

      {gantts.map((gantt, id) => (
        <div className="wx-NlISAKUQ ganttCell" key={id}>
          <div className="wx-NlISAKUQ ganttHeader">
            <Button type="secondary" onClick={() => removeGantt(gantt.id)}>
              Delete Gantt
            </Button>
          </div>
          <div className="wx-NlISAKUQ ganttBox">
            <Gantt
              {...skinSettings}
              tasks={gantt.data.tasks}
              links={gantt.data.links}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default GanttMultiple;
