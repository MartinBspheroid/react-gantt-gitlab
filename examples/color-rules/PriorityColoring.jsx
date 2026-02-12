/**
 * Color Rules - Priority-Based Coloring Example
 *
 * Demonstrates how to use color rules to automatically style tasks
 * based on their priority levels.
 */

import { useMemo } from 'react';
import { Gantt } from '@svar-ui/react-gantt';
import './PriorityColoring.css';

function PriorityColoring() {
  // Define color rules for different priorities
  const colorRules = useMemo(
    () => [
      {
        id: 'priority-critical',
        name: 'Critical Priority',
        pattern: 'critical',
        matchType: 'contains',
        conditionType: 'label',
        color: '#dc2626', // Red
        opacity: 1,
        priority: 0,
        enabled: true,
      },
      {
        id: 'priority-high',
        name: 'High Priority',
        pattern: 'high',
        matchType: 'contains',
        conditionType: 'label',
        color: '#ea580c', // Orange
        opacity: 0.9,
        priority: 1,
        enabled: true,
      },
      {
        id: 'priority-medium',
        name: 'Medium Priority',
        pattern: 'medium',
        matchType: 'contains',
        conditionType: 'label',
        color: '#ca8a04', // Yellow/Orange
        opacity: 0.85,
        priority: 2,
        enabled: true,
      },
      {
        id: 'priority-low',
        name: 'Low Priority',
        pattern: 'low',
        matchType: 'contains',
        conditionType: 'label',
        color: '#16a34a', // Green
        opacity: 0.8,
        priority: 3,
        enabled: true,
      },
    ],
    [],
  );

  // Sample tasks with priority labels
  const tasks = useMemo(
    () => [
      {
        id: 1,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 5),
        text: 'Critical Security Fix',
        progress: 100,
        type: 'task',
        labels: 'critical, security',
      },
      {
        id: 2,
        start: new Date(2024, 3, 3),
        end: new Date(2024, 3, 8),
        text: 'High Priority Feature',
        progress: 80,
        type: 'task',
        labels: 'high, feature',
      },
      {
        id: 3,
        start: new Date(2024, 3, 6),
        end: new Date(2024, 3, 12),
        text: 'Medium Priority Enhancement',
        progress: 50,
        type: 'task',
        labels: 'medium, enhancement',
      },
      {
        id: 4,
        start: new Date(2024, 3, 8),
        end: new Date(2024, 3, 15),
        text: 'Low Priority Documentation',
        progress: 30,
        type: 'task',
        labels: 'low, docs',
      },
      {
        id: 5,
        start: new Date(2024, 3, 10),
        end: new Date(2024, 3, 14),
        text: 'Critical Bug Fix',
        progress: 60,
        type: 'task',
        labels: 'critical, bug',
      },
      {
        id: 6,
        start: new Date(2024, 3, 12),
        end: new Date(2024, 3, 18),
        text: 'High Priority Integration',
        progress: 40,
        type: 'task',
        labels: 'high, integration',
      },
      {
        id: 7,
        start: new Date(2024, 3, 15),
        text: 'Release Milestone',
        progress: 0,
        type: 'milestone',
        labels: 'critical, milestone',
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
      { id: 5, source: 5, target: 6, type: 'e2s' },
      { id: 6, source: 6, target: 7, type: 'e2s' },
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
    <div className="priority-coloring-demo">
      <div className="coloring-info">
        <h3>Priority-Based Coloring</h3>
        <p>
          Tasks are automatically styled based on their priority labels. Color
          rules match task labels and apply colored stripes to indicate priority
          levels at a glance.
        </p>

        <div className="priority-legend">
          <div className="priority-item critical">
            <span className="priority-color"></span>
            <span className="priority-label">Critical</span>
          </div>
          <div className="priority-item high">
            <span className="priority-color"></span>
            <span className="priority-label">High</span>
          </div>
          <div className="priority-item medium">
            <span className="priority-color"></span>
            <span className="priority-label">Medium</span>
          </div>
          <div className="priority-item low">
            <span className="priority-color"></span>
            <span className="priority-label">Low</span>
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

export default PriorityColoring;
