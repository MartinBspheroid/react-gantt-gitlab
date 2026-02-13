import { useMemo, useState, useCallback } from 'react';
import {
  Gantt,
  ContextMenu,
  Editor,
  defaultEditorItems,
  defaultColumns,
} from '../../src';
import { format } from 'date-fns';
import { getData } from '../data';

export default function GanttDurationUnitHour({ skinSettings }) {
  const { tasks, links, scales } = useMemo(() => getData('hour'), []);

  const [api, setApi] = useState(null);

  const items = useMemo(
    () =>
      defaultEditorItems.map((ed) => ({
        ...ed,
        ...(ed.comp === 'date' && { config: { time: true } }),
      })),
    [],
  );

  const columns = useMemo(
    () =>
      defaultColumns.map((col) => ({
        ...col,
        ...(col.id === 'start' && {
          template: (d) => format(d, 'MMM d, HH:mm'),
          width: 120,
        }),
      })),
    [],
  );

  const highlightTime = useCallback((date, unit) => {
    const h = date.getHours();
    if ((unit === 'hour' && h < 8) || h > 21) return 'wx-weekend';
    return '';
  }, []);

  return (
    <>
      <ContextMenu api={api}>
        <Gantt
          init={setApi}
          {...(skinSettings || {})}
          tasks={tasks}
          links={links}
          columns={columns}
          scales={scales}
          cellWidth={40}
          durationUnit="hour"
          lengthUnit="minute"
          highlightTime={highlightTime}
        />
      </ContextMenu>
      {api && <Editor api={api} items={items} />}
    </>
  );
}
