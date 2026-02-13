import { useMemo, useState } from 'react';
import { getData, bigScales } from '../data';
import { Gantt } from '../../src/';
import { Select } from '@svar-ui/react-core';
import './GanttLengthUnit.css';

function GanttLengthUnit({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  const options = [
    { id: 'minute', label: 'Minute' },
    { id: 'hour', label: 'Hour' },
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
  ];

  const [lengthUnit, setLengthUnit] = useState('day');

  const scales = useMemo(() => {
    let scales;
    switch (lengthUnit) {
      case 'minute':
        scales = [
          { unit: 'day', step: 1, format: 'MMM d' },
          { unit: 'hour', step: 1, format: 'HH:mm' },
        ];
        break;
      case 'hour':
        scales = [
          { unit: 'month', step: 1, format: 'MMM' },
          { unit: 'day', step: 1, format: 'MMM d' },
        ];
        break;
      case 'day':
        scales = [
          { unit: 'month', step: 1, format: 'MMM' },
          { unit: 'week', step: 1, format: 'w' },
        ];
        break;
      case 'week':
        scales = [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'month', step: 1, format: 'MMM' },
        ];
        break;
      case 'month':
        scales = [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'quarter', step: 1, format: 'QQQ' },
        ];
        break;
      case 'quarter':
        scales = [{ unit: 'year', step: 1, format: 'yyyy' }];
        break;
      default:
        scales = bigScales;
    }
    return scales;
  }, [lengthUnit]);

  return (
    <div className="wx-VOqDTkHq demo">
      <div className="wx-VOqDTkHq bar">
        <Select
          value={lengthUnit}
          options={options}
          onChange={({ value }) => setLengthUnit(value)}
        />
      </div>
      <div className="wx-VOqDTkHq gantt">
        <Gantt
          {...skinSettings}
          tasks={data.tasks}
          links={data.links}
          scales={scales}
          lengthUnit={lengthUnit}
          cellWidth={300}
        />
      </div>
    </div>
  );
}

export default GanttLengthUnit;
