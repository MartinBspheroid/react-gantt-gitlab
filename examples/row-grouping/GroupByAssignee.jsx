/**
 * Row Grouping - Group by Assignee Example
 *
 * Demonstrates how to group Gantt tasks by assignee with collapsible sections
 * and summary information for each group.
 */

import { useMemo, useState } from 'react';
import { Gantt } from '@svar-ui/react-gantt';
import './GroupByAssignee.css';

function GroupByAssignee() {
  const [collapsedGroups, _setCollapsedGroups] = useState(new Set());

  // Sample tasks with assignees
  const tasks = useMemo(
    () => [
      // Alice's tasks
      {
        id: 11,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 5),
        text: 'UI Design',
        progress: 100,
        type: 'task',
        assigned: 'Alice',
      },
      {
        id: 12,
        start: new Date(2024, 3, 6),
        end: new Date(2024, 3, 10),
        text: 'Design Review',
        progress: 80,
        type: 'task',
        assigned: 'Alice',
      },
      // Bob's tasks
      {
        id: 21,
        start: new Date(2024, 3, 2),
        end: new Date(2024, 3, 8),
        text: 'Backend API',
        progress: 60,
        type: 'task',
        assigned: 'Bob',
      },
      {
        id: 22,
        start: new Date(2024, 3, 9),
        end: new Date(2024, 3, 15),
        text: 'Database Setup',
        progress: 40,
        type: 'task',
        assigned: 'Bob',
      },
      // Carol's tasks
      {
        id: 31,
        start: new Date(2024, 3, 5),
        end: new Date(2024, 3, 12),
        text: 'Frontend Dev',
        progress: 50,
        type: 'task',
        assigned: 'Carol',
      },
      {
        id: 32,
        start: new Date(2024, 3, 13),
        end: new Date(2024, 3, 18),
        text: 'Component Lib',
        progress: 20,
        type: 'task',
        assigned: 'Carol',
      },
      // Unassigned task
      {
        id: 41,
        start: new Date(2024, 3, 10),
        end: new Date(2024, 3, 20),
        text: 'Documentation',
        progress: 30,
        type: 'task',
        assigned: '',
      },
    ],
    [],
  );

  // Create groups with headers
  const groupedTasks = useMemo(() => {
    const assignees = [
      ...new Set(tasks.map((t) => t.assigned || 'Unassigned')),
    ];
    const result = [];
    let groupId = 1000;

    assignees.forEach((assignee) => {
      const groupTasks = tasks.filter(
        (t) => (t.assigned || 'Unassigned') === assignee,
      );
      const isCollapsed = collapsedGroups.has(assignee);

      // Add group header
      result.push({
        id: groupId,
        text: assignee,
        type: 'summary',
        open: !isCollapsed,
        parent: 0,
        $groupType: 'assignee',
        $rowCount: groupTasks.length,
      });

      // Add tasks under group if not collapsed
      if (!isCollapsed) {
        groupTasks.forEach((task) => {
          result.push({
            ...task,
            parent: groupId,
          });
        });
      }

      groupId++;
    });

    return result;
  }, [tasks, collapsedGroups]);

  const scales = useMemo(
    () => [
      { unit: 'month', step: 1, format: 'MMMM yyyy' },
      { unit: 'week', step: 1, format: 'w' },
      { unit: 'day', step: 1, format: 'd' },
    ],
    [],
  );

  return (
    <div className="group-by-assignee-demo">
      <div className="grouping-info">
        <h3>Group by Assignee</h3>
        <p>
          Tasks are grouped by their assigned team member. Click on a group
          header to collapse or expand the section.
        </p>

        <div className="group-stats">
          <div className="stat-card">
            <span className="stat-value">{tasks.length}</span>
            <span className="stat-label">Total Tasks</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {
                [...new Set(tasks.map((t) => t.assigned || 'Unassigned'))]
                  .length
              }
            </span>
            <span className="stat-label">Team Members</span>
          </div>
        </div>
      </div>

      <div className="gantt-container">
        <Gantt tasks={groupedTasks} scales={scales} zoom />
      </div>
    </div>
  );
}

export default GroupByAssignee;
