/**
 * Filter Panel Component
 * Provides UI for filtering tasks by milestones, epics, labels, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { GitLabFilters } from '../utils/GitLabFilters';
import { FilterPresetSelector } from './FilterPresetSelector';

export function FilterPanel({
  milestones,
  epics,
  tasks,
  onFilterChange,
  initialFilters = {},
  // Preset-related props
  presets = [],
  presetsLoading = false,
  presetsSaving = false,
  canEditPresets = false,
  onCreatePreset,
  onRenamePreset,
  onDeletePreset,
}) {
  const [filters, setFilters] = useState({
    milestoneIds: initialFilters.milestoneIds || [],
    epicIds: initialFilters.epicIds || [],
    labels: initialFilters.labels || [],
    assignees: initialFilters.assignees || [],
    states: initialFilters.states || [],
    search: initialFilters.search || '',
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [availableLabels, setAvailableLabels] = useState([]);
  const [availableAssignees, setAvailableAssignees] = useState([]);

  useEffect(() => {
    // Extract unique labels and assignees from tasks
    if (tasks && tasks.length > 0) {
      setAvailableLabels(GitLabFilters.getUniqueLabels(tasks));
      setAvailableAssignees(GitLabFilters.getUniqueAssignees(tasks));
    }
  }, [tasks]);

  useEffect(() => {
    // Notify parent of filter changes
    if (onFilterChange) {
      onFilterChange(filters);
    }
  }, [filters, onFilterChange]);

  const handleMilestoneToggle = (milestoneId) => {
    setFilters((prev) => {
      const newMilestoneIds = prev.milestoneIds.includes(milestoneId)
        ? prev.milestoneIds.filter((id) => id !== milestoneId)
        : [...prev.milestoneIds, milestoneId];
      return { ...prev, milestoneIds: newMilestoneIds };
    });
  };

  const handleEpicToggle = (epicId) => {
    setFilters((prev) => {
      const newEpicIds = prev.epicIds.includes(epicId)
        ? prev.epicIds.filter((id) => id !== epicId)
        : [...prev.epicIds, epicId];
      return { ...prev, epicIds: newEpicIds };
    });
  };

  const handleLabelToggle = (label) => {
    setFilters((prev) => {
      const newLabels = prev.labels.includes(label)
        ? prev.labels.filter((l) => l !== label)
        : [...prev.labels, label];
      return { ...prev, labels: newLabels };
    });
  };

  const handleAssigneeToggle = (assignee) => {
    setFilters((prev) => {
      const newAssignees = prev.assignees.includes(assignee)
        ? prev.assignees.filter((a) => a !== assignee)
        : [...prev.assignees, assignee];
      return { ...prev, assignees: newAssignees };
    });
  };

  const handleStateToggle = (state) => {
    setFilters((prev) => {
      const newStates = prev.states.includes(state)
        ? prev.states.filter((s) => s !== state)
        : [...prev.states, state];
      return { ...prev, states: newStates };
    });
  };

  const handleSearchChange = (search) => {
    setFilters((prev) => ({ ...prev, search }));
  };

  const handleClearAll = () => {
    setFilters({
      milestoneIds: [],
      epicIds: [],
      labels: [],
      assignees: [],
      states: [],
      search: '',
    });
  };

  // Apply preset filters
  const handleApplyPreset = useCallback((presetFilters) => {
    setFilters({
      milestoneIds: presetFilters.milestoneIds || [],
      epicIds: presetFilters.epicIds || [],
      labels: presetFilters.labels || [],
      assignees: presetFilters.assignees || [],
      states: presetFilters.states || [],
      search: presetFilters.search || '',
    });
  }, []);

  // Create preset with current filters
  const handleCreatePreset = useCallback(async (name) => {
    if (onCreatePreset) {
      await onCreatePreset(name, filters);
    }
  }, [onCreatePreset, filters]);

  const activeFilterCount =
    filters.milestoneIds.length +
    filters.epicIds.length +
    filters.labels.length +
    filters.assignees.length +
    filters.states.length +
    (filters.search ? 1 : 0);

  return (
    <div className="gitlab-filter-panel">
      <div className="filter-header">
        <div className="filter-header-left">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="filter-toggle"
          >
            <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
            Filters
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
          </button>

          <FilterPresetSelector
            presets={presets}
            currentFilters={filters}
            loading={presetsLoading}
            saving={presetsSaving}
            canEdit={canEditPresets}
            onSelectPreset={handleApplyPreset}
            onCreatePreset={handleCreatePreset}
            onRenamePreset={onRenamePreset}
            onDeletePreset={onDeletePreset}
          />
        </div>

        {activeFilterCount > 0 && (
          <button onClick={handleClearAll} className="btn-clear">
            Clear All
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Top Row: Search and State */}
          <div className="filter-row">
            {/* Search */}
            <div className="filter-section filter-search-section">
              <label className="filter-label">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search tasks..."
                className="filter-search"
              />
            </div>

            {/* States */}
            <div className="filter-section filter-state-section">
              <label className="filter-label">State</label>
              <div className="filter-options horizontal">
                {['opened', 'closed'].map((state) => (
                  <label key={state} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.states.includes(state)}
                      onChange={() => handleStateToggle(state)}
                    />
                    <span>{state}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Main Filter Grid */}
          <div className="filter-grid">
            {/* Milestones */}
            {milestones && milestones.length > 0 && (
              <div className="filter-section">
                <label className="filter-label">
                  <i className="fas fa-flag-checkered"></i>
                  Milestones ({milestones.length})
                </label>
                <div className="filter-options scrollable">
                  {milestones.map((milestone) => (
                    <label key={milestone.id} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={filters.milestoneIds.includes(milestone.id)}
                        onChange={() => handleMilestoneToggle(milestone.id)}
                      />
                      <span title={milestone.title}>{milestone.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Epics */}
            {epics && epics.length > 0 && (
              <div className="filter-section">
                <label className="filter-label">
                  <i className="fas fa-layer-group"></i>
                  Epics ({epics.length})
                </label>
                <div className="filter-options scrollable">
                  {epics.map((epic) => (
                    <label key={epic.id} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={filters.epicIds.includes(epic.id)}
                        onChange={() => handleEpicToggle(epic.id)}
                      />
                      <span title={epic.title}>{epic.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Labels */}
            {availableLabels.length > 0 && (
              <div className="filter-section">
                <label className="filter-label">
                  <i className="fas fa-tags"></i>
                  Labels ({availableLabels.length})
                </label>
                <div className="filter-options scrollable">
                  {availableLabels.map((label) => (
                    <label key={label} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={filters.labels.includes(label)}
                        onChange={() => handleLabelToggle(label)}
                      />
                      <span className="label-tag">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Assignees */}
            {availableAssignees.length > 0 && (
              <div className="filter-section">
                <label className="filter-label">
                  <i className="fas fa-users"></i>
                  Assignees ({availableAssignees.length})
                </label>
                <div className="filter-options scrollable">
                  {availableAssignees.map((assignee) => (
                    <label key={assignee} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={filters.assignees.includes(assignee)}
                        onChange={() => handleAssigneeToggle(assignee)}
                      />
                      <span>{assignee}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .gitlab-filter-panel {
          background: var(--wx-gitlab-filter-background);
          border-bottom: 1px solid var(--wx-gitlab-filter-border);
        }

        .filter-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
        }

        .filter-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .filter-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          font-size: 14px;
          font-weight: 500;
          color: var(--wx-gitlab-filter-text);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .filter-toggle:hover {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .toggle-icon {
          font-size: 10px;
          color: var(--wx-gitlab-control-text);
        }

        .filter-badge {
          background: #1f75cb;
          color: white;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }

        .btn-clear {
          padding: 4px 12px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-clear:hover {
          background: #c82333;
        }

        .filter-content {
          padding: 0 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .filter-row {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          align-items: start;
        }

        .filter-search-section {
          flex: 1;
        }

        .filter-state-section {
          min-width: 150px;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          align-items: start;
        }

        @media (min-width: 1200px) {
          .filter-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (min-width: 900px) and (max-width: 1199px) {
          .filter-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (min-width: 600px) and (max-width: 899px) {
          .filter-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .filter-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0; /* Prevent grid blowout */
        }

        .filter-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--wx-gitlab-filter-text);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .filter-label i {
          font-size: 11px;
          opacity: 0.7;
        }

        .filter-search {
          padding: 8px 12px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-input-background);
          color: var(--wx-gitlab-filter-text);
          font-size: 14px;
        }

        .filter-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-options.horizontal {
          flex-direction: row;
          gap: 12px;
        }

        .filter-options.scrollable {
          max-height: 150px;
          overflow-y: auto;
          padding-right: 4px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          padding: 8px;
          background: var(--wx-gitlab-filter-input-background);
        }

        .filter-options.scrollable::-webkit-scrollbar {
          width: 6px;
        }

        .filter-options.scrollable::-webkit-scrollbar-track {
          background: var(--wx-gitlab-filter-hover-background);
          border-radius: 3px;
        }

        .filter-options.scrollable::-webkit-scrollbar-thumb {
          background: var(--wx-gitlab-control-text);
          border-radius: 3px;
        }

        .filter-options.scrollable::-webkit-scrollbar-thumb:hover {
          background: var(--wx-gitlab-control-value);
        }

        .filter-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          padding: 4px 0;
          color: var(--wx-gitlab-filter-text);
        }

        .filter-checkbox input[type="checkbox"] {
          cursor: pointer;
        }

        .filter-checkbox span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .label-tag {
          background: var(--wx-gitlab-control-background);
          color: var(--wx-gitlab-filter-text);
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
