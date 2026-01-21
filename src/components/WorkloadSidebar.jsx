/**
 * WorkloadSidebar Component
 * Displays checkboxes for assignees and labels to filter workload view
 * Uses FilterMultiSelect for consistent UI with filter panels
 */

import { useMemo } from 'react';
import { FilterMultiSelect } from './FilterMultiSelect.jsx';

export function WorkloadSidebar({
  assignees = [],
  labels = [],
  selectedAssignees = [],
  selectedLabels = [],
  onAssigneesChange,
  onLabelsChange,
}) {
  // Convert assignees to FilterMultiSelect options format
  const assigneeOptions = useMemo(
    () =>
      assignees.map((assignee) => ({
        value: assignee,
        label: assignee,
      })),
    [assignees],
  );

  // Convert labels to FilterMultiSelect options format
  const labelOptions = useMemo(
    () =>
      labels.map((label) => ({
        value: label,
        label: label,
      })),
    [labels],
  );

  return (
    <div className="workload-sidebar">
      {/* Assignees Section */}
      <div className="sidebar-section">
        <FilterMultiSelect
          title={
            <>
              <i className="fas fa-user"></i> Assignees
            </>
          }
          options={assigneeOptions}
          selected={selectedAssignees}
          onChange={onAssigneesChange}
          placeholder="Search assignees..."
          emptyMessage="No tasks have assignees"
        />
      </div>

      {/* Labels Section */}
      <div className="sidebar-section">
        <FilterMultiSelect
          title={
            <>
              <i className="fas fa-tag"></i> Labels
            </>
          }
          options={labelOptions}
          selected={selectedLabels}
          onChange={onLabelsChange}
          placeholder="Search labels..."
          emptyMessage="No tasks have labels assigned"
        />
      </div>

      {/* Selection Summary */}
      <div className="sidebar-section selection-summary">
        <div className="summary-item">
          <span className="summary-label">Selected Assignees:</span>
          <span className="summary-value">{selectedAssignees.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Selected Labels:</span>
          <span className="summary-value">{selectedLabels.length}</span>
        </div>
      </div>
    </div>
  );
}

export default WorkloadSidebar;
