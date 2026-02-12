import { useMemo, useState, useCallback } from 'react';
import { Gantt, Editor } from '../../src/';
import { Field, DatePicker, Locale, Alert } from '@svar-ui/react-core';
import './GanttProjectBoundaries.css';

export default function GanttProjectBoundaries({ skinSettings }) {
  // Project boundaries - tasks cannot be dragged outside these dates
  const [projectStart, setProjectStart] = useState(new Date(2024, 3, 5));
  const [projectEnd, setProjectEnd] = useState(new Date(2024, 4, 20));

  // Demo tasks - some inside boundaries, some near edges
  const tasks = useMemo(
    () => [
      {
        id: 1,
        start: new Date(2024, 3, 8),
        end: new Date(2024, 3, 15),
        text: 'Task Inside Boundaries',
        progress: 40,
        parent: 0,
        type: 'task',
      },
      {
        id: 2,
        start: new Date(2024, 3, 5),
        end: new Date(2024, 3, 12),
        text: 'Task Starting at Boundary',
        progress: 25,
        parent: 0,
        type: 'task',
      },
      {
        id: 3,
        start: new Date(2024, 4, 10),
        end: new Date(2024, 4, 20),
        text: 'Task Ending at Boundary',
        progress: 60,
        parent: 0,
        type: 'task',
      },
      {
        id: 4,
        start: new Date(2024, 3, 15),
        end: new Date(2024, 3, 25),
        text: 'Task Spanning Center',
        progress: 50,
        parent: 0,
        type: 'task',
      },
    ],
    [],
  );

  const links = useMemo(() => [], []);

  const scales = useMemo(
    () => [
      { unit: 'month', step: 1, format: 'MMMM yyyy' },
      { unit: 'day', step: 1, format: 'd' },
    ],
    [],
  );

  const [api, setApi] = useState();

  // Create markers for project boundaries
  const markers = useMemo(
    () => [
      {
        start: projectStart,
        text: 'Project Start',
        css: 'project-start-boundary',
      },
      {
        start: projectEnd,
        text: 'Project End',
        css: 'project-end-boundary',
      },
    ],
    [projectStart, projectEnd],
  );

  // Initialize Gantt API and set up drag constraints
  const init = useCallback(
    (gApi) => {
      setApi(gApi);

      // Intercept drag-task to enforce boundary constraints
      gApi.intercept('drag-task', (ev) => {
        // Only check date constraints (not vertical reordering)
        if (typeof ev.top !== 'undefined') {
          return true; // Allow vertical reordering
        }

        // ev contains: id, start, end (new proposed dates)
        // Check if the new position violates boundaries
        if (ev.start && ev.start < projectStart) {
          return false; // Block - would start before project start
        }
        if (ev.end && ev.end > projectEnd) {
          return false; // Block - would end after project end
        }

        return true; // Allow the drag
      });
    },
    [projectStart, projectEnd],
  );

  return (
    <div className="wx-boundaries-demo demo">
      <Locale>
        <div className="wx-boundaries-demo explanation-banner">
          <Alert type="info">
            <strong>Project Boundaries Demo:</strong> Tasks cannot be dragged
            outside the project start and end dates. Try dragging any task - it
            will be constrained within the boundaries marked by the green
            (start) and red (end) vertical lines.
          </Alert>
        </div>

        <div className="wx-boundaries-demo controls-bar">
          <Field label="Project Start Boundary" position="left">
            {({ id }) => (
              <DatePicker
                value={projectStart}
                id={id}
                onChange={({ value }) => setProjectStart(value)}
              />
            )}
          </Field>
          <Field label="Project End Boundary" position="left">
            {({ id }) => (
              <DatePicker
                value={projectEnd}
                id={id}
                onChange={({ value }) => setProjectEnd(value)}
              />
            )}
          </Field>
        </div>
      </Locale>

      <div className="wx-boundaries-demo gantt-container">
        <Gantt
          {...skinSettings}
          init={init}
          tasks={tasks}
          links={links}
          scales={scales}
          markers={markers}
          start={new Date(2024, 3, 1)}
          end={new Date(2024, 4, 25)}
          zoom
        />
        {api && <Editor api={api} />}
      </div>
    </div>
  );
}
