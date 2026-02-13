import { useState, useMemo } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';
import { RadioButtonGroup } from '@svar-ui/react-core';
import './ChartBorders.css';

export default function ChartBorders({ skinSettings }) {
  const data = useMemo(() => getData(), []);
  const [cellBorders, setCellBorders] = useState('full');

  const options = useMemo(
    () => [
      { id: 'full', label: 'Full' },
      { id: 'column', label: 'Column' },
    ],
    [],
  );

  return (
    <div className="wx-gnwCbZe9 rows">
      <div className="wx-gnwCbZe9 bar">
        <div className="wx-gnwCbZe9 label">Chart cell borders</div>
        <RadioButtonGroup
          options={options}
          value={cellBorders}
          onChange={({ value }) => setCellBorders(value)}
          type="inline"
        />
      </div>

      <div className="wx-gnwCbZe9 gtcell">
        <Gantt
          {...skinSettings}
          tasks={data.tasks}
          links={data.links}
          scales={data.scales}
          cellBorders={cellBorders}
        />
      </div>
    </div>
  );
}
