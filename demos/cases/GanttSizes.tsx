import { useMemo, useState } from 'react';
import { getData, complexScales } from '../data';
import { Gantt } from '../../src/';
import { Slider } from '@svar-ui/react-core';
import './GanttSizes.css';

function GanttSizes({ skinSettings }) {
  const data = useMemo(() => getData(), []);
  const [cellWidth, setCellWidth] = useState(100);
  const [scaleHeight, setScaleHeight] = useState(38);
  const [cellHeight, setCellHeight] = useState(36);

  return (
    <div className="wx-MZ5YXrqJ rows">
      <div className="wx-MZ5YXrqJ bar">
        <Slider
          label="Cell width"
          value={cellWidth}
          onChange={({ value }) => setCellWidth(value)}
          min={20}
          max={200}
        />
        <Slider
          label="Cell height"
          value={cellHeight}
          onChange={({ value }) => setCellHeight(value)}
          min={20}
          max={60}
        />
        <Slider
          label="Scale height"
          value={scaleHeight}
          onChange={({ value }) => setScaleHeight(value)}
          min={20}
          max={60}
        />
      </div>

      <div className="wx-MZ5YXrqJ gtcell">
        <Gantt
          {...skinSettings}
          tasks={data.tasks}
          links={data.links}
          scales={complexScales}
          cellWidth={cellWidth}
          cellHeight={cellHeight}
          scaleHeight={scaleHeight}
        />
      </div>
    </div>
  );
}

export default GanttSizes;
