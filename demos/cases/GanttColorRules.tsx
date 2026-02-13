import { useMemo } from 'react';
import { Gantt } from '../../src/';

/**
 * Color Rules Demo
 *
 * Demonstrates conditional formatting based on color rules.
 * Color rules allow automatic styling of tasks based on:
 * - Task labels (e.g., priority levels, status)
 * - Task titles (e.g., keywords, patterns)
 * - Date ranges (via title matching)
 *
 * Rules are evaluated in priority order (lower number = higher priority).
 * Up to 3 matching rules are displayed per task.
 */
function GanttColorRules({ skinSettings }) {
  // Define color rules for different conditions
  const colorRules = useMemo(
    () => [
      // High Priority - Red/Orange
      {
        id: 'rule-1',
        name: 'High Priority',
        pattern: 'high-priority',
        matchType: 'contains',
        conditionType: 'label',
        color: '#FF5722', // Deep Orange
        opacity: 0.9,
        priority: 1,
        enabled: true,
      },
      {
        id: 'rule-2',
        name: 'Critical Priority',
        pattern: 'critical',
        matchType: 'contains',
        conditionType: 'label',
        color: '#F44336', // Red
        opacity: 1,
        priority: 0,
        enabled: true,
      },
      // Status-based colors
      {
        id: 'rule-3',
        name: 'Completed Tasks',
        pattern: 'completed',
        matchType: 'contains',
        conditionType: 'label',
        color: '#4CAF50', // Green
        opacity: 0.85,
        priority: 2,
        enabled: true,
      },
      {
        id: 'rule-4',
        name: 'In Progress',
        pattern: 'in-progress',
        matchType: 'contains',
        conditionType: 'label',
        color: '#2196F3', // Blue
        opacity: 0.8,
        priority: 3,
        enabled: true,
      },
      // Assignee-based colors
      {
        id: 'rule-5',
        name: 'Design Team',
        pattern: 'design',
        matchType: 'contains',
        conditionType: 'label',
        color: '#9C27B0', // Purple
        opacity: 0.75,
        priority: 4,
        enabled: true,
      },
      // Overdue tasks (matched by title)
      {
        id: 'rule-6',
        name: 'Overdue Tasks',
        pattern: 'overdue',
        matchType: 'contains',
        conditionType: 'title',
        color: '#FF9800', // Orange
        opacity: 0.9,
        priority: 1,
        enabled: true,
      },
      // Bug/Fix tasks
      {
        id: 'rule-7',
        name: 'Bug Fix',
        pattern: 'bug',
        matchType: 'contains',
        conditionType: 'label',
        color: '#E91E63', // Pink
        opacity: 0.85,
        priority: 5,
        enabled: true,
      },
    ],
    [],
  );

  // Create demo tasks with labels and varied statuses
  const tasks = useMemo(
    () => [
      // Summary task - Project Planning
      {
        id: 1,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 15),
        text: 'Project Planning Phase',
        progress: 75,
        parent: 0,
        type: 'summary',
        open: true,
        labels: 'planning, phase-1',
      },
      // High priority tasks
      {
        id: 10,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 5),
        text: 'Requirements Analysis',
        progress: 100,
        parent: 1,
        type: 'task',
        labels: 'high-priority, analysis',
      },
      {
        id: 11,
        start: new Date(2024, 3, 3),
        end: new Date(2024, 3, 8),
        text: 'Architecture Design',
        progress: 80,
        parent: 1,
        type: 'task',
        labels: 'critical, design',
      },
      // Completed tasks
      {
        id: 12,
        start: new Date(2024, 3, 6),
        end: new Date(2024, 3, 10),
        text: 'Initial Setup',
        progress: 100,
        parent: 1,
        type: 'task',
        labels: 'completed, setup',
      },
      // Overdue task
      {
        id: 13,
        start: new Date(2024, 3, 5),
        end: new Date(2024, 3, 8),
        text: 'Review Overdue Documentation',
        progress: 30,
        parent: 1,
        type: 'task',
        labels: 'high-priority, docs',
      },
      // Development Phase Summary
      {
        id: 2,
        start: new Date(2024, 3, 10),
        end: new Date(2024, 3, 30),
        text: 'Development Phase',
        progress: 40,
        parent: 0,
        type: 'summary',
        open: true,
        labels: 'development',
      },
      // In Progress tasks
      {
        id: 20,
        start: new Date(2024, 3, 10),
        end: new Date(2024, 3, 15),
        text: 'Frontend Implementation',
        progress: 60,
        parent: 2,
        type: 'task',
        labels: 'in-progress, frontend',
      },
      {
        id: 21,
        start: new Date(2024, 3, 12),
        end: new Date(2024, 3, 18),
        text: 'Backend API Development',
        progress: 45,
        parent: 2,
        type: 'task',
        labels: 'in-progress, backend, high-priority',
      },
      // Critical bug fix
      {
        id: 22,
        start: new Date(2024, 3, 15),
        end: new Date(2024, 3, 17),
        text: 'Critical Security Patch',
        progress: 20,
        parent: 2,
        type: 'task',
        labels: 'critical, bug, security',
      },
      // Design team tasks
      {
        id: 23,
        start: new Date(2024, 3, 18),
        end: new Date(2024, 3, 22),
        text: 'UI/UX Refinement',
        progress: 0,
        parent: 2,
        type: 'task',
        labels: 'design, in-progress',
      },
      // Multiple labels task
      {
        id: 24,
        start: new Date(2024, 3, 20),
        end: new Date(2024, 3, 25),
        text: 'Integration Testing',
        progress: 0,
        parent: 2,
        type: 'task',
        labels: 'testing, high-priority, in-progress',
      },
      // Milestone
      {
        id: 25,
        start: new Date(2024, 3, 30),
        text: 'Phase 1 Completion',
        progress: 0,
        parent: 2,
        type: 'milestone',
        labels: 'completed, milestone',
      },
      // Testing Phase Summary
      {
        id: 3,
        start: new Date(2024, 4, 1),
        end: new Date(2024, 4, 15),
        text: 'Testing Phase',
        progress: 0,
        parent: 0,
        type: 'summary',
        open: true,
        labels: 'testing',
      },
      // Bug fixes
      {
        id: 30,
        start: new Date(2024, 4, 1),
        end: new Date(2024, 4, 5),
        text: 'Fix Login Bug',
        progress: 0,
        parent: 3,
        type: 'task',
        labels: 'bug, high-priority',
      },
      {
        id: 31,
        start: new Date(2024, 4, 3),
        end: new Date(2024, 4, 8),
        text: 'Performance Optimization',
        progress: 0,
        parent: 3,
        type: 'task',
        labels: 'bug, performance',
      },
      // Completed testing task
      {
        id: 32,
        start: new Date(2024, 4, 6),
        end: new Date(2024, 4, 10),
        text: 'Unit Tests',
        progress: 100,
        parent: 3,
        type: 'task',
        labels: 'completed, testing',
      },
    ],
    [],
  );

  const links = useMemo(
    () => [
      { id: 1, source: 10, target: 11, type: 'e2s' },
      { id: 2, source: 11, target: 12, type: 'e2s' },
      { id: 3, source: 12, target: 20, type: 'e2s' },
      { id: 4, source: 20, target: 21, type: 'e2s' },
      { id: 5, source: 21, target: 22, type: 'e2s' },
      { id: 6, source: 22, target: 23, type: 'e2s' },
      { id: 7, source: 23, target: 24, type: 'e2s' },
      { id: 8, source: 24, target: 25, type: 'e2s' },
      { id: 9, source: 30, target: 31, type: 'e2s' },
      { id: 10, source: 31, target: 32, type: 'e2s' },
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Explanation Banner */}
      <div
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>
          Color Rules Demo
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', opacity: 0.95 }}>
          Color rules enable automatic visual formatting based on task
          properties. Rules are matched by task labels or titles and displayed
          as colored stripes on task bars and indicators in the grid.
        </p>

        {/* Color Legend */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: '#F44336',
                borderRadius: '3px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
            <span>Critical Priority</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: '#FF5722',
                borderRadius: '3px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
            <span>High Priority</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: '#4CAF50',
                borderRadius: '3px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
            <span>Completed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: '#2196F3',
                borderRadius: '3px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
            <span>In Progress</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: '#9C27B0',
                borderRadius: '3px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
            <span>Design Team</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: '#E91E63',
                borderRadius: '3px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
            <span>Bug Fix</span>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Gantt
          {...skinSettings}
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

export default GanttColorRules;
