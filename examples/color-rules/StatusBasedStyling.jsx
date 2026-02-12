/**
 * Color Rules - Status-Based Task Styling
 *
 * Demonstrates styling tasks based on their workflow status
 * (e.g., in-progress, completed, blocked, pending).
 */

import { useMemo } from 'react';
import { Gantt } from '@svar-ui/react-gantt';
import './StatusBasedStyling.css';

function StatusBasedStyling() {
  // Define color rules for different statuses
  const colorRules = useMemo(
    () => [
      {
        id: 'status-completed',
        name: 'Completed Tasks',
        pattern: 'completed',
        matchType: 'contains',
        conditionType: 'label',
        color: '#16a34a', // Green
        opacity: 0.85,
        priority: 0,
        enabled: true,
      },
      {
        id: 'status-progress',
        name: 'In Progress',
        pattern: 'in-progress',
        matchType: 'contains',
        conditionType: 'label',
        color: '#2563eb', // Blue
        opacity: 0.85,
        priority: 1,
        enabled: true,
      },
      {
        id: 'status-blocked',
        name: 'Blocked Tasks',
        pattern: 'blocked',
        matchType: 'contains',
        conditionType: 'label',
        color: '#dc2626', // Red
        opacity: 0.9,
        priority: 0,
        enabled: true,
      },
      {
        id: 'status-review',
        name: 'In Review',
        pattern: 'review',
        matchType: 'contains',
        conditionType: 'label',
        color: '#9333ea', // Purple
        opacity: 0.85,
        priority: 2,
        enabled: true,
      },
      {
        id: 'status-pending',
        name: 'Pending',
        pattern: 'pending',
        matchType: 'contains',
        conditionType: 'label',
        color: '#6b7280', // Gray
        opacity: 0.75,
        priority: 3,
        enabled: true,
      },
    ],
    [],
  );

  // Sample tasks with status labels
  const tasks = useMemo(
    () => [
      {
        id: 1,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 5),
        text: 'Project Setup',
        progress: 100,
        type: 'task',
        labels: 'completed, setup',
      },
      {
        id: 2,
        start: new Date(2024, 3, 4),
        end: new Date(2024, 3, 10),
        text: 'Requirements Gathering',
        progress: 100,
        type: 'task',
        labels: 'completed, requirements',
      },
      {
        id: 3,
        start: new Date(2024, 3, 8),
        end: new Date(2024, 3, 15),
        text: 'UI Design Implementation',
        progress: 70,
        type: 'task',
        labels: 'in-progress, design',
      },
      {
        id: 4,
        start: new Date(2024, 3, 12),
        end: new Date(2024, 3, 18),
        text: 'API Integration',
        progress: 50,
        type: 'task',
        labels: 'in-progress, backend',
      },
      {
        id: 5,
        start: new Date(2024, 3, 15),
        end: new Date(2024, 3, 20),
        text: 'Database Migration',
        progress: 20,
        type: 'task',
        labels: 'blocked, database',
      },
      {
        id: 6,
        start: new Date(2024, 3, 10),
        end: new Date(2024, 3, 16),
        text: 'Code Review',
        progress: 80,
        type: 'task',
        labels: 'review, code-quality',
      },
      {
        id: 7,
        start: new Date(2024, 3, 18),
        end: new Date(2024, 3, 22),
        text: 'Testing Phase',
        progress: 0,
        type: 'task',
        labels: 'pending, testing',
      },
      {
        id: 8,
        start: new Date(2024, 3, 20),
        end: new Date(2024, 3, 25),
        text: 'Documentation',
        progress: 0,
        type: 'task',
        labels: 'pending, docs',
      },
      {
        id: 9,
        start: new Date(2024, 3, 25),
        text: 'Production Release',
        progress: 0,
        type: 'milestone',
        labels: 'pending, release',
      },
    ],
    [],
  );

  const links = useMemo(
    () => [
      { id: 1, source: 1, target: 2, type: 'e2s' },
      { id: 2, source: 2, target: 3, type: 'e2s' },
      { id: 3, source: 3, target: 4, type: 'e2s' },
      { id: 4, source: 4, target: 5, type: 'e2s' },
      { id: 5, source: 4, target: 6, type: 'e2s' },
      { id: 6, source: 5, target: 7, type: 'e2s' },
      { id: 7, source: 6, target: 7, type: 'e2s' },
      { id: 8, source: 7, target: 8, type: 'e2s' },
      { id: 9, source: 8, target: 9, type: 'e2s' },
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
    <div className="status-styling-demo">
      <div className="styling-info">
        <h3>Status-Based Task Styling</h3>
        <p>
          Tasks are styled based on their workflow status. This makes it easy
          to identify blocked work, completed items, and tasks pending review
          at a glance.
        </p>

        <div className="status-legend">
          <div className="status-item completed">
            <span className="status-indicator"></span>
            <div className="status-details">
              <span className="status-name">Completed</span>
              <span className="status-desc">Done and verified</span>
            </div>
          </div>
          <div className="status-item in-progress">
            <span className="status-indicator"></span>
            <div className="status-details">
              <span className="status-name">In Progress</span>
              <span className="status-desc">Actively being worked on</span>
            </div>
          </div>
          <div className="status-item blocked">
            <span className="status-indicator"></span>
            <div className="status-details">
              <span className="status-name">Blocked</span>
              <span className="status-desc">Waiting on dependencies</span>
            </div>
          </div>
          <div className="status-item review">
            <span className="status-indicator"></span>
            <div className="status-details">
              <span className="status-name">In Review</span>
              <span className="status-desc">Under review/QA</span>
            </div>
          </div>
          <div className="status-item pending">
            <span className="status-indicator"></span>
            <div className="status-details">
              <span className="status-name">Pending</span>
              <span className="status-desc">Scheduled but not started</span>
            </div>
          </div>
        </div>
      </div>

      <div className="gantt-container">
        <Gantt
          tasks={tasks}
          links={links}
          scales={scales}
          colorRules={colorRules}
          zoom
        />
      </div>
    </div>
  );
}

export default StatusBasedStyling;
