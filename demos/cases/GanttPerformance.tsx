import { useState, useEffect, useMemo, useRef } from 'react';
import { getGeneratedData, complexScales } from '../data';
import { Gantt } from '../../src/';
import { Button } from '@svar-ui/react-core';
import './GanttPerformance.css';

function GanttPerformance(props) {
  const { skinSettings } = props;

  const count = 1000;
  const years = 3;
  const data = useMemo(() => getGeneratedData('', count, years), []);

  const [start, setStart] = useState(null);
  const outAreaRef = useRef(null);

  useEffect(() => {
    if (start && outAreaRef.current) {
      outAreaRef.current.innerHTML = new Date() - start;
    }
  }, [start]);

  return (
    <div className="wx-KB3Eoqwm rows">
      <div className="wx-KB3Eoqwm row">
        {start ? (
          <>
            1 000 tasks ({years} years ) rendered in{' '}
            <span ref={outAreaRef}></span> ms
          </>
        ) : (
          <Button type="primary" onClick={() => setStart(new Date())}>
            Press me to render Gantt chart with 1 000 tasks
          </Button>
        )}
      </div>

      {start ? (
        <div className="wx-KB3Eoqwm gtcell">
          <Gantt
            {...skinSettings}
            tasks={data.tasks}
            links={data.links}
            scales={complexScales}
          />
        </div>
      ) : null}
    </div>
  );
}

export default GanttPerformance;
