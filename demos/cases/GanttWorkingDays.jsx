import { useMemo, useState, useCallback } from 'react';
import { Gantt, Editor } from '../../src/';
import { Locale } from '@svar-ui/react-core';
import { Alert } from '../components/Alert';
import { useHighlightTime } from '../../src/hooks/useHighlightTime';
import './GanttWorkingDays.css';

export default function GanttWorkingDays({ skinSettings }) {
  // Define holidays for the demo
  const holidays = useMemo(
    () => [
      { date: '2024-04-01', name: 'April Fools Day' },
      { date: '2024-04-25', name: 'Company Holiday' },
      { date: '2024-05-01', name: 'Labor Day' },
      { date: '2024-05-27', name: 'Memorial Day' },
    ],
    [],
  );

  // Define special working days (weekends that are workdays)
  const workdays = useMemo(
    () => [
      { date: '2024-04-06', name: 'Working Saturday' }, // Saturday
      { date: '2024-05-11', name: 'Working Saturday' }, // Saturday
    ],
    [],
  );

  // Use the highlight time hook to get working days functionality
  const { highlightTime, countWorkdays } = useHighlightTime({
    holidays,
    workdays,
  });

  // Demo tasks that span weekends to demonstrate working day calculations
  const tasks = useMemo(
    () => [
      {
        id: 1,
        start: new Date(2024, 3, 1), // Monday
        end: new Date(2024, 3, 5), // Friday - 5 workdays
        text: 'Week Task (Mon-Fri, 5 workdays)',
        progress: 30,
        parent: 0,
        type: 'task',
      },
      {
        id: 2,
        start: new Date(2024, 3, 8), // Monday
        end: new Date(2024, 3, 12), // Friday - spans weekend
        text: 'Task Spanning Weekend (3 workdays)',
        progress: 50,
        parent: 0,
        type: 'task',
      },
      {
        id: 3,
        start: new Date(2024, 3, 15), // Monday
        end: new Date(2024, 3, 19), // Friday with holiday on 25th
        text: 'Task with Holiday (5 workdays)',
        progress: 40,
        parent: 0,
        type: 'task',
      },
      {
        id: 4,
        start: new Date(2024, 3, 22), // Monday
        end: new Date(2024, 3, 26), // Friday
        text: 'Task Through Holiday (4 workdays)',
        progress: 60,
        parent: 0,
        type: 'task',
      },
      {
        id: 5,
        start: new Date(2024, 3, 29), // Monday
        end: new Date(2024, 4, 3), // Friday - spans month boundary
        text: 'Cross-Month Task (4 workdays)',
        progress: 25,
        parent: 0,
        type: 'task',
      },
      {
        id: 6,
        start: new Date(2024, 3, 6), // Saturday (special working day)
        end: new Date(2024, 3, 10), // Wednesday
        text: 'Task on Working Saturday (4 workdays)',
        progress: 45,
        parent: 0,
        type: 'task',
      },
      {
        id: 7,
        start: new Date(2024, 4, 6), // Monday
        end: new Date(2024, 4, 10), // Friday
        text: 'May Week Task (5 workdays)',
        progress: 35,
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
      { unit: 'week', step: 1, format: "'Week' w" },
      { unit: 'day', step: 1, format: 'd' },
    ],
    [],
  );

  const [api, setApi] = useState();
  const [selectedTask, setSelectedTask] = useState(null);
  const [workdayInfo, setWorkdayInfo] = useState(null);

  // Calculate workday info when a task is selected
  const calculateWorkdayInfo = useCallback(
    (task) => {
      if (!task || !task.start || !task.end) return null;

      const start = new Date(task.start);
      const end = new Date(task.end);
      const workdaysCount = countWorkdays(start, end);
      const calendarDays =
        Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

      return {
        workdays: workdaysCount,
        calendarDays: calendarDays,
        weekendsSkipped: calendarDays - workdaysCount,
      };
    },
    [countWorkdays],
  );

  // Initialize Gantt API
  const init = useCallback(
    (gApi) => {
      setApi(gApi);

      // Listen for task selection
      gApi.on('select-task', (ev) => {
        const state = gApi.getState();
        if (ev.id && state.tasks?._pool) {
          const task = state.tasks._pool.get(ev.id);
          if (task) {
            setSelectedTask(task);
            setWorkdayInfo(calculateWorkdayInfo(task));
          }
        } else {
          setSelectedTask(null);
          setWorkdayInfo(null);
        }
      });
    },
    [calculateWorkdayInfo],
  );

  // Create markers for holidays
  const markers = useMemo(
    () =>
      holidays.map((holiday) => ({
        start: new Date(holiday.date),
        text: holiday.name,
        css: 'holiday-marker',
      })),
    [holidays],
  );

  return (
    <div className="wx-working-days-demo demo">
      <Locale>
        <div className="wx-working-days-demo explanation-banner">
          <Alert type="info">
            <strong>Working Days Calendar Demo:</strong> This demo showcases the
            Working Days Calendar feature. Weekends are{' '}
            <span className="highlight-weekend">grayed out</span> to indicate
            non-working days, while{' '}
            <span className="highlight-holiday">holidays</span> are marked with
            special markers. The system automatically skips weekends when
            calculating task durations. Special working days (like the Working
            Saturday on April 6) override weekend rules. Click on any task to
            see its workday calculation details.
          </Alert>
        </div>

        {workdayInfo && selectedTask && (
          <div className="wx-working-days-demo info-panel">
            <Alert type="success">
              <strong>{selectedTask.text}:</strong> {workdayInfo.workdays}{' '}
              workdays
              {workdayInfo.weekendsSkipped > 0 && (
                <span className="skip-info">
                  {' '}
                  (skips {workdayInfo.weekendsSkipped} weekend
                  {workdayInfo.weekendsSkipped > 1 ? 's' : ''})
                </span>
              )}
            </Alert>
          </div>
        )}

        <div className="wx-working-days-demo legend">
          <div className="legend-item">
            <div className="legend-box weekend-box"></div>
            <span>Weekend (Non-Working)</span>
          </div>
          <div className="legend-item">
            <div className="legend-box working-day-box"></div>
            <span>Working Day</span>
          </div>
          <div className="legend-item">
            <div className="legend-box holiday-box"></div>
            <span>Holiday</span>
          </div>
          <div className="legend-item">
            <div className="legend-box special-workday-box"></div>
            <span>Special Working Day</span>
          </div>
        </div>
      </Locale>

      <div className="wx-working-days-demo gantt-container">
        <Gantt
          {...skinSettings}
          init={init}
          tasks={tasks}
          links={links}
          scales={scales}
          markers={markers}
          highlightTime={highlightTime}
          countWorkdays={countWorkdays}
          start={new Date(2024, 3, 1)}
          end={new Date(2024, 4, 15)}
          zoom
          cellWidth={50}
        />
        {api && <Editor api={api} />}
      </div>
    </div>
  );
}
