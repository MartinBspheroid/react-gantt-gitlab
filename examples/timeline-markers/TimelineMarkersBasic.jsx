/**
 * Timeline Markers - Basic Example
 *
 * Demonstrates how to add visual markers to the Gantt timeline.
 * Markers are vertical lines with labels that highlight important dates.
 */

import { useMemo } from 'react';
import { Gantt } from '@svar-ui/react-gantt';

function TimelineMarkersBasic() {
  // Sample tasks
  const tasks = useMemo(
    () => [
      {
        id: 1,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 10),
        text: 'Project Kickoff',
        progress: 100,
        type: 'task',
      },
      {
        id: 2,
        start: new Date(2024, 3, 8),
        end: new Date(2024, 3, 20),
        text: 'Development Phase',
        progress: 60,
        type: 'task',
      },
      {
        id: 3,
        start: new Date(2024, 3, 18),
        end: new Date(2024, 3, 25),
        text: 'Testing Phase',
        progress: 30,
        type: 'task',
      },
      {
        id: 4,
        start: new Date(2024, 3, 25),
        text: 'Release Date',
        progress: 0,
        type: 'milestone',
      },
    ],
    [],
  );

  const links = useMemo(
    () => [
      { id: 1, source: 1, target: 2, type: 'e2s' },
      { id: 2, source: 2, target: 3, type: 'e2s' },
      { id: 3, source: 3, target: 4, type: 'e2s' },
    ],
    [],
  );

  // Define timeline markers
  const markers = useMemo(
    () => [
      // Today's marker - commonly used to show current date
      {
        start: new Date(),
        text: 'Today',
        css: 'marker-today',
      },
      // Custom date marker
      {
        start: new Date(2024, 3, 15),
        text: 'Sprint Review',
        css: 'marker-review',
      },
      // Another custom marker
      {
        start: new Date(2024, 3, 22),
        text: 'Code Freeze',
        css: 'marker-freeze',
      },
    ],
    [],
  );

  const scales = useMemo(
    () => [
      { unit: 'month', step: 1, format: 'MMMM yyyy' },
      { unit: 'week', step: 1, format: 'w' },
      { unit: 'day', step: 1, format: 'd' },
    ],
    [],
  );

  return (
    <div style={{ height: '500px' }}>
      <Gantt
        tasks={tasks}
        links={links}
        scales={scales}
        markers={markers}
        zoom
      />
    </div>
  );
}

export default TimelineMarkersBasic;
