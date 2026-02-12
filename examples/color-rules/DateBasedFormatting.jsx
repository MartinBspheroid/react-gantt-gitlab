/**
 * Color Rules - Date-Based Conditional Formatting
 *
 * Demonstrates how to apply color rules based on dates,
 * such as highlighting overdue tasks or upcoming deadlines.
 */

import { useMemo } from 'react';
import { Gantt } from '@svar-ui/react-gantt';
import './DateBasedFormatting.css';

function DateBasedFormatting() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Define color rules for date-based conditions
  const colorRules = useMemo(
    () => [
      {
        id: 'overdue',
        name: 'Overdue Tasks',
        pattern: 'overdue',
        matchType: 'contains',
        conditionType: 'title',
        color: '#dc2626', // Red
        opacity: 0.95,
        priority: 0,
        enabled: true,
      },
      {
        id: 'due-soon',
        name: 'Due Soon',
        pattern: 'due-soon',
        matchType: 'contains',
        conditionType: 'title',
        color: '#f59e0b', // Amber/Orange
        opacity: 0.9,
        priority: 1,
        enabled: true,
      },
      {
        id: 'upcoming',
        name: 'Upcoming',
        pattern: 'upcoming',
        matchType: 'contains',
        conditionType: 'title',
        color: '#3b82f6', // Blue
        opacity: 0.85,
        priority: 2,
        enabled: true,
      },
    ],
    [],
  );

  // Sample tasks with date-based indicators in titles
  const tasks = useMemo(
    () => [
      // Overdue tasks
      {
        id: 1,
        start: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 5,
        ),
        end: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 1,
        ),
        text: '[OVERDUE] Fix Critical Bug',
        progress: 80,
        type: 'task',
        labels: 'bug, critical',
      },
      {
        id: 2,
        start: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 3,
        ),
        end: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 1,
        ),
        text: '[OVERDUE] Update Documentation',
        progress: 60,
        type: 'task',
        labels: 'docs',
      },
      // Due soon (today or tomorrow)
      {
        id: 3,
        start: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 2,
        ),
        end: today,
        text: '[DUE-SOON] Code Review',
        progress: 90,
        type: 'task',
        labels: 'review',
      },
      {
        id: 4,
        start: today,
        end: tomorrow,
        text: '[DUE-SOON] Deploy to Staging',
        progress: 70,
        type: 'task',
        labels: 'deployment',
      },
      // Upcoming (within a week)
      {
        id: 5,
        start: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 2,
        ),
        end: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 4,
        ),
        text: '[UPCOMING] Sprint Planning',
        progress: 0,
        type: 'task',
        labels: 'planning',
      },
      {
        id: 6,
        start: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 3,
        ),
        end: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 6,
        ),
        text: '[UPCOMING] Feature Implementation',
        progress: 10,
        type: 'task',
        labels: 'feature',
      },
      // Normal tasks
      {
        id: 7,
        start: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 5,
        ),
        end: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 10,
        ),
        text: 'Future Task',
        progress: 0,
        type: 'task',
        labels: 'feature',
      },
      {
        id: 8,
        start: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 8,
        ),
        text: 'Release Milestone',
        progress: 0,
        type: 'milestone',
        labels: 'milestone',
      },
    ],
    [today, tomorrow],
  );

  const links = useMemo(
    () => [
      { id: 1, source: 1, target: 2, type: 'e2s' },
      { id: 2, source: 2, target: 3, type: 'e2s' },
      { id: 3, source: 3, target: 4, type: 'e2s' },
      { id: 4, source: 4, target: 5, type: 'e2s' },
      { id: 5, source: 5, target: 6, type: 'e2s' },
      { id: 6, source: 6, target: 7, type: 'e2s' },
      { id: 7, source: 7, target: 8, type: 'e2s' },
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

  const markers = useMemo(
    () => [
      {
        start: today,
        text: 'Today',
        css: 'marker-today',
      },
    ],
    [today],
  );

  return (
    <div className="date-formatting-demo">
      <div className="formatting-info">
        <h3>Date-Based Conditional Formatting</h3>
        <p>
          Tasks are styled based on their due dates relative to today. Color
          rules can be dynamically applied based on date calculations to
          highlight time-sensitive work.
        </p>

        <div className="date-legend">
          <div className="date-item overdue">
            <span className="date-indicator"></span>
            <div className="date-details">
              <span className="date-name">Overdue</span>
              <span className="date-desc">Past due date</span>
            </div>
          </div>
          <div className="date-item due-soon">
            <span className="date-indicator"></span>
            <div className="date-details">
              <span className="date-name">Due Soon</span>
              <span className="date-desc">Due today or tomorrow</span>
            </div>
          </div>
          <div className="date-item upcoming">
            <span className="date-indicator"></span>
            <div className="date-details">
              <span className="date-name">Upcoming</span>
              <span className="date-desc">Within next 7 days</span>
            </div>
          </div>
        </div>

        <div className="implementation-note">
          <strong>Implementation Note:</strong> In a real application,
          date-based rules would be computed dynamically based on actual end
          dates rather than title patterns. This example uses title matching for
          demonstration purposes.
        </div>
      </div>

      <div className="gantt-container">
        <Gantt
          tasks={tasks}
          links={links}
          scales={scales}
          markers={markers}
          colorRules={colorRules}
          zoom
        />
      </div>
    </div>
  );
}

export default DateBasedFormatting;
