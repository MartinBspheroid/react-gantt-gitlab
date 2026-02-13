import { useMemo, useState } from 'react';
import { getData } from '../data';
import { Gantt, ContextMenu, Editor, defaultEditorItems } from '../../src';
import { RadioButtonGroup } from '@svar-ui/react-core';
import './GanttDurationUnitChanges.css';

export default function GanttDurationUnitChanges({ skinSettings }) {
  const initialData = getData();
  const [tasks, setTasks] = useState(initialData.tasks);
  const [links] = useState(initialData.links);

  const scalesMap = useMemo(
    () => ({
      hour: getData('hour').scales,
      day: getData().scales,
    }),
    [],
  );

  const options = [
    { id: 'hour', label: 'Hour' },
    { id: 'day', label: 'Day' },
  ];

  const [durationUnit, setDurationUnit] = useState('hour');
  const [scales, setScales] = useState(scalesMap['hour']);

  const [api, setApi] = useState(null);

  const items = useMemo(
    () =>
      defaultEditorItems.map((ed) => ({
        ...ed,
        ...(ed.comp === 'date' && {
          config: { time: durationUnit === 'hour' },
        }),
      })),
    [durationUnit],
  );

  function handleUnitChange({ value }) {
    const sTasks = api.serialize().map((task) => {
      if (task.start && task.end) {
        const ms = 1000 * 60 * 60 * (value === 'day' ? 24 : 1);
        const duration = Math.floor((task.end - task.start) / ms);
        return { ...task, duration };
      }
      return task;
    });
    setTasks(sTasks);
    setDurationUnit(value);
    setScales(scalesMap[value]);
  }

  return (
    <div className="wx-d4Cw5r6y rows">
      <div className="wx-d4Cw5r6y bar">
        <div className="wx-d4Cw5r6y label">Gantt duration unit</div>
        <RadioButtonGroup
          options={options}
          value={durationUnit}
          type="inline"
          onChange={handleUnitChange}
        />
      </div>

      <div className="wx-d4Cw5r6y gtcell">
        <ContextMenu api={api}>
          <Gantt
            init={setApi}
            {...skinSettings}
            tasks={tasks}
            links={links}
            scales={scales}
            cellWidth={40}
            durationUnit={durationUnit}
            lengthUnit={'hour'}
          />
        </ContextMenu>
        {api && <Editor api={api} items={items} />}
      </div>
    </div>
  );
}
