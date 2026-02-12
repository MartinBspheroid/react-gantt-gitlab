/**
 * Row Grouping - Group by Epic Example
 *
 * Demonstrates grouping tasks by epic with collapsible sections,
 * custom grouping logic, and visual indicators for group types.
 */

import { useMemo, useState } from 'react';
import { Gantt } from '@svar-ui/react-gantt';
import './GroupByEpic.css';

function GroupByEpic() {
  const [collapsedGroups, _setCollapsedGroups] = useState(new Set());

  // Sample epics
  const epics = useMemo(
    () => [
      { id: 'epic-1', name: 'User Authentication', color: '#3b82f6' },
      { id: 'epic-2', name: 'Dashboard Redesign', color: '#8b5cf6' },
      { id: 'epic-3', name: 'Performance Optimization', color: '#10b981' },
      { id: 'epic-4', name: 'Mobile Support', color: '#f59e0b' },
    ],
    [],
  );

  // Sample tasks organized by epic
  const tasks = useMemo(
    () => [
      // User Authentication Epic
      {
        id: 11,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 5),
        text: 'Login Page',
        progress: 100,
        type: 'task',
        epic: 'epic-1',
      },
      {
        id: 12,
        start: new Date(2024, 3, 4),
        end: new Date(2024, 3, 10),
        text: 'OAuth Integration',
        progress: 80,
        type: 'task',
        epic: 'epic-1',
      },
      {
        id: 13,
        start: new Date(2024, 3, 8),
        end: new Date(2024, 3, 12),
        text: 'Password Reset',
        progress: 60,
        type: 'task',
        epic: 'epic-1',
      },
      // Dashboard Redesign Epic
      {
        id: 21,
        start: new Date(2024, 3, 3),
        end: new Date(2024, 3, 8),
        text: 'Wireframes',
        progress: 100,
        type: 'task',
        epic: 'epic-2',
      },
      {
        id: 22,
        start: new Date(2024, 3, 7),
        end: new Date(2024, 3, 15),
        text: 'UI Components',
        progress: 50,
        type: 'task',
        epic: 'epic-2',
      },
      {
        id: 23,
        start: new Date(2024, 3, 14),
        end: new Date(2024, 3, 18),
        text: 'User Testing',
        progress: 20,
        type: 'task',
        epic: 'epic-2',
      },
      // Performance Optimization Epic
      {
        id: 31,
        start: new Date(2024, 3, 10),
        end: new Date(2024, 3, 14),
        text: 'Code Splitting',
        progress: 70,
        type: 'task',
        epic: 'epic-3',
      },
      {
        id: 32,
        start: new Date(2024, 3, 13),
        end: new Date(2024, 3, 17),
        text: 'Cache Layer',
        progress: 40,
        type: 'task',
        epic: 'epic-3',
      },
      // Mobile Support Epic
      {
        id: 41,
        start: new Date(2024, 3, 15),
        end: new Date(2024, 3, 20),
        text: 'Responsive Layout',
        progress: 30,
        type: 'task',
        epic: 'epic-4',
      },
      {
        id: 42,
        start: new Date(2024, 3, 18),
        end: new Date(2024, 3, 22),
        text: 'Touch Gestures',
        progress: 10,
        type: 'task',
        epic: 'epic-4',
      },
      // Unassigned tasks
      {
        id: 51,
        start: new Date(2024, 3, 5),
        end: new Date(2024, 3, 12),
        text: 'Bug Fixes',
        progress: 50,
        type: 'task',
        epic: '',
      },
    ],
    [],
  );

  // Group tasks by epic with custom logic
  const groupedTasks = useMemo(() => {
    const result = [];
    let groupId = 1000;

    // Group tasks by epic
    epics.forEach((epic) => {
      const epicTasks = tasks.filter((t) => t.epic === epic.id);
      const isCollapsed = collapsedGroups.has(epic.id);

      // Add epic header
      result.push({
        id: groupId,
        text: epic.name,
        type: 'summary',
        open: !isCollapsed,
        parent: 0,
        $groupType: 'epic',
        $epicColor: epic.color,
        $rowCount: epicTasks.length,
      });

      // Add tasks under epic if not collapsed
      if (!isCollapsed) {
        epicTasks.forEach((task) => {
          result.push({
            ...task,
            parent: groupId,
          });
        });
      }

      groupId++;
    });

    // Add "No Epic" group for unassigned tasks
    const unassignedTasks = tasks.filter((t) => !t.epic);
    if (unassignedTasks.length > 0) {
      const isCollapsed = collapsedGroups.has('no-epic');

      result.push({
        id: groupId,
        text: 'Other Tasks',
        type: 'summary',
        open: !isCollapsed,
        parent: 0,
        $groupType: 'epic',
        $epicColor: '#6b7280',
        $rowCount: unassignedTasks.length,
      });

      if (!isCollapsed) {
        unassignedTasks.forEach((task) => {
          result.push({
            ...task,
            parent: groupId,
          });
        });
      }
    }

    return result;
  }, [tasks, epics, collapsedGroups]);

  const scales = useMemo(
    () => [
      { unit: 'month', step: 1, format: 'MMMM yyyy' },
      { unit: 'week', step: 1, format: 'w' },
      { unit: 'day', step: 1, format: 'd' },
    ],
    [],
  );

  return (
    <div className="group-by-epic-demo">
      <div className="grouping-header">
        <div className="grouping-info">
          <h3>Group by Epic</h3>
          <p>
            Tasks are organized by epic/feature group. Each epic shows a summary
            bar spanning all its tasks. Click headers to expand/collapse.
          </p>
        </div>

        <div className="epic-legend">
          {epics.map((epic) => (
            <div key={epic.id} className="epic-badge">
              <span
                className="epic-color-dot"
                style={{ backgroundColor: epic.color }}
              />
              <span className="epic-name">{epic.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="gantt-container">
        <Gantt tasks={groupedTasks} scales={scales} zoom />
      </div>
    </div>
  );
}

export default GroupByEpic;
