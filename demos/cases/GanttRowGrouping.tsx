/**
 * Row Grouping Demo
 *
 * Demonstrates the powerful Row Grouping feature (US-015) that restructures
 * grid rows into collapsible groups by Assignee, Epic, or Sprint.
 *
 * Key Features:
 * - Group headers with summary bars showing date range and task count
 * - Collapsible sections to focus on specific groups
 * - Alternating group background colors for visual separation
 * - Group count display in toolbar
 */

import { useState, useMemo } from 'react';
import { getData } from '../data';
import { Gantt, Editor } from '../../src/';
import { GroupingDropdown } from '../../src/components/GroupingDropdown';
import { DataFilters } from '../../src/utils/DataFilters';
import './GanttRowGrouping.css';

export default function GanttRowGrouping(props) {
  const { skinSettings } = props;

  // Get base data
  const baseData = useMemo(() => getData(), []);

  // Enhance data with assignee, epic, and sprint information
  const data = useMemo(() => {
    const tasks = baseData.tasks.map((task, index) => {
      // Add realistic grouping data
      const assignees = [
        'Laura Turner',
        'Robert Williams',
        'Mary Johnson',
        'John Doe',
      ];
      const epics = ['Project Planning', 'Development', 'Testing', 'Release'];
      const sprints = ['Sprint 1', 'Sprint 2', 'Sprint 3'];

      return {
        ...task,
        // Assign based on task ID for consistent grouping
        assigned: assignees[index % assignees.length],
        epic: epics[Math.floor(index / 5) % epics.length],
        iteration: sprints[Math.floor(index / 8) % sprints.length],
      };
    });

    return { ...baseData, tasks };
  }, [baseData]);

  // State for grouping
  const [groupBy, setGroupBy] = useState('assignee');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [api, setApi] = useState();

  // Apply grouping to tasks
  const groupedData = useMemo(() => {
    const {
      tasks: groupedTasks,
      groupCount,
      groupMeta,
    } = DataFilters.groupTasks(data.tasks, groupBy, collapsedGroups);

    return {
      tasks: groupedTasks,
      links: data.links,
      scales: data.scales,
      groupCount,
      groupMeta,
    };
  }, [data, groupBy, collapsedGroups]);

  // Handle group change
  const handleGroupChange = (newGroupBy) => {
    setGroupBy(newGroupBy);
    setCollapsedGroups(new Set()); // Reset collapsed state when changing group type
  };

  // Toggle group collapse
  const _handleToggleGroup = (groupId) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Calculate task count (excluding group headers)
  const taskCount = useMemo(() => {
    return data.tasks.length;
  }, [data.tasks]);

  return (
    <>
      {/* Explanation Banner */}
      <div className="grouping-demo-banner">
        <div className="grouping-demo-icon">
          <i className="fas fa-layer-group"></i>
        </div>
        <div className="grouping-demo-content">
          <h3>Row Grouping Feature</h3>
          <p>
            Group tasks by <strong>Assignee</strong>, <strong>Epic</strong>, or{' '}
            <strong>Sprint</strong>. Group headers display summary bars with
            date ranges and task counts. Click the arrow to collapse/expand
            groups. Notice the alternating background colors for visual
            separation.
          </p>
        </div>
      </div>

      {/* Custom Toolbar with Grouping Dropdown */}
      <div className="grouping-toolbar">
        <div className="grouping-toolbar-left">
          <GroupingDropdown
            value={groupBy}
            onChange={handleGroupChange}
            groupCount={groupedData.groupCount}
            taskCount={taskCount}
          />
          <span className="grouping-hint">
            <i className="fas fa-info-circle"></i>
            Select a grouping option to restructure the grid
          </span>
        </div>
        <div className="grouping-toolbar-right">
          {groupedData.groupCount > 0 && (
            <span className="grouping-stats">
              <span className="stat-item">
                <strong>{groupedData.groupCount}</strong> groups
              </span>
              <span className="stat-item">
                <strong>{taskCount}</strong> tasks
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="wx-2rSWAdWv gtcell grouping-gantt-container">
        <Gantt
          {...skinSettings}
          init={setApi}
          tasks={groupedData.tasks}
          links={groupedData.links}
          scales={groupedData.scales}
          cellHeight={44}
        />
        {api && <Editor api={api} />}
      </div>
    </>
  );
}
