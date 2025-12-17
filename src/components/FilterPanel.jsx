/**
 * Filter Panel Component
 * Provides UI for filtering tasks by milestones, epics, labels, etc.
 * Supports both client-side and server-side filtering with Tab switch.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GitLabFilters } from '../utils/GitLabFilters';
import { FilterPresetSelector } from './FilterPresetSelector';

// Default empty server filters
const DEFAULT_SERVER_FILTERS = {
  labelNames: [],
  milestoneTitles: [],
  assigneeUsernames: [],
  dateRange: {
    createdAfter: '',
    createdBefore: '',
  },
};

// Default empty client filters
const DEFAULT_CLIENT_FILTERS = {
  milestoneIds: [],
  epicIds: [],
  labels: [],
  assignees: [],
  states: [],
  search: '',
};

/**
 * Parse server filters from preset, ensuring all fields have default values
 */
const parseServerFiltersFromPreset = (presetServerFilters) => ({
  labelNames: presetServerFilters?.labelNames || [],
  milestoneTitles: presetServerFilters?.milestoneTitles || [],
  assigneeUsernames: presetServerFilters?.assigneeUsernames || [],
  dateRange: presetServerFilters?.dateRange || { createdAfter: '', createdBefore: '' },
});

/**
 * Parse client filters from preset, ensuring all fields have default values
 */
const parseClientFiltersFromPreset = (presetFilters) => ({
  milestoneIds: presetFilters?.milestoneIds || [],
  epicIds: presetFilters?.epicIds || [],
  labels: presetFilters?.labels || [],
  assignees: presetFilters?.assignees || [],
  states: presetFilters?.states || [],
  search: presetFilters?.search || '',
});

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
  onPresetSelect,
  initialPresetId,
  // Server filter props
  filterOptions = null, // { members, labels, milestones } from getFilterOptions()
  filterOptionsLoading = false,
  serverFilters: initialServerFilters = null, // Initial server filters (from parent state)
  onServerFilterApply, // Callback to apply server filters and trigger sync
}) {
  // Tab state: 'client' or 'server'
  const [activeTab, setActiveTab] = useState('client');

  // Client-side filters
  const [filters, setFilters] = useState(() =>
    parseClientFiltersFromPreset(initialFilters)
  );

  // Server-side filters (local state for editing)
  const [serverFilters, setServerFilters] = useState(
    initialServerFilters || DEFAULT_SERVER_FILTERS
  );

  // Track if server filters have unsync'd changes
  const [hasUnsyncedServerChanges, setHasUnsyncedServerChanges] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [availableLabels, setAvailableLabels] = useState([]);
  const [availableAssignees, setAvailableAssignees] = useState([]);

  // Track if initial preset has been applied
  const initialPresetAppliedRef = useRef(false);

  useEffect(() => {
    // Extract unique labels and assignees from tasks
    if (tasks && tasks.length > 0) {
      setAvailableLabels(GitLabFilters.getUniqueLabels(tasks));
      setAvailableAssignees(GitLabFilters.getUniqueAssignees(tasks));
    }
  }, [tasks]);

  // Apply initial preset when presets are loaded
  useEffect(() => {
    if (
      initialPresetId &&
      presets &&
      presets.length > 0 &&
      !presetsLoading &&
      !initialPresetAppliedRef.current
    ) {
      const preset = presets.find(p => p.id === initialPresetId);
      if (preset) {
        const presetFilters = preset.filters;
        const isServerPreset = presetFilters.filterType === 'server' && presetFilters.serverFilters;

        if (isServerPreset) {
          setActiveTab('server');
          const parsedServerFilters = parseServerFiltersFromPreset(presetFilters.serverFilters);
          setServerFilters(parsedServerFilters);
          onServerFilterApply?.(parsedServerFilters);
        } else {
          setActiveTab('client');
          setFilters(parseClientFiltersFromPreset(presetFilters));
        }
        initialPresetAppliedRef.current = true;
      }
    }
  }, [initialPresetId, presets, presetsLoading, onServerFilterApply]);

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

  const handleSearchChange = (search) => {
    setFilters((prev) => ({ ...prev, search }));
  };

  // Apply preset filters
  const handleApplyPreset = useCallback((preset) => {
    const presetFilters = preset.filters;
    const isServerPreset = presetFilters.filterType === 'server' && presetFilters.serverFilters;

    if (isServerPreset) {
      setActiveTab('server');
      const parsedServerFilters = parseServerFiltersFromPreset(presetFilters.serverFilters);
      setServerFilters(parsedServerFilters);
      setHasUnsyncedServerChanges(false);
      onServerFilterApply?.(parsedServerFilters);
    } else {
      setActiveTab('client');
      setFilters(parseClientFiltersFromPreset(presetFilters));
    }
    onPresetSelect?.(preset.id);
  }, [onPresetSelect, onServerFilterApply]);

  // Create preset with current filters
  const handleCreatePreset = useCallback(async (name) => {
    if (onCreatePreset) {
      if (activeTab === 'server') {
        // Save as server filter preset
        await onCreatePreset(name, {
          filterType: 'server',
          serverFilters: serverFilters,
        });
      } else {
        // Save as client filter preset
        await onCreatePreset(name, {
          filterType: 'client',
          ...filters,
        });
      }
    }
  }, [onCreatePreset, filters, serverFilters, activeTab]);

  // Client filter count
  const clientFilterCount =
    filters.milestoneIds.length +
    filters.epicIds.length +
    filters.labels.length +
    filters.assignees.length +
    (filters.search ? 1 : 0);

  // Server filter count
  const serverFilterCount =
    (serverFilters.labelNames?.length || 0) +
    (serverFilters.milestoneTitles?.length || 0) +
    (serverFilters.assigneeUsernames?.length || 0) +
    (serverFilters.dateRange?.createdAfter ? 1 : 0) +
    (serverFilters.dateRange?.createdBefore ? 1 : 0);

  // Total active filter count based on current tab
  const activeFilterCount = activeTab === 'server' ? serverFilterCount : clientFilterCount;

  // Server filter handlers
  const handleServerFilterChange = (field, value) => {
    setServerFilters(prev => ({ ...prev, [field]: value }));
    setHasUnsyncedServerChanges(true);
  };

  const handleServerDateRangeChange = (field, value) => {
    setServerFilters(prev => ({
      ...prev,
      dateRange: { ...prev.dateRange, [field]: value },
    }));
    setHasUnsyncedServerChanges(true);
  };

  const handleApplyServerFilter = () => {
    if (onServerFilterApply) {
      onServerFilterApply(serverFilters);
      setHasUnsyncedServerChanges(false);
    }
  };

  const handleClearServerFilters = () => {
    setServerFilters(DEFAULT_SERVER_FILTERS);
    setHasUnsyncedServerChanges(true);
  };

  // Toggle item in array (for multi-select)
  const toggleArrayItem = (array, item) => {
    return array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
  };

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

        <div className="filter-header-right">
          {clientFilterCount > 0 && (
            <button
              onClick={() => setFilters(DEFAULT_CLIENT_FILTERS)}
              className="btn-clear"
            >
              Clear Client{clientFilterCount > 0 ? ` (${clientFilterCount})` : ''}
            </button>
          )}
          {serverFilterCount > 0 && (
            <button
              onClick={handleClearServerFilters}
              className="btn-clear btn-clear-server"
            >
              Clear Server{serverFilterCount > 0 ? ` (${serverFilterCount})` : ''}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Tab Switch */}
          <div className="filter-tabs">
            <button
              className={`filter-tab ${activeTab === 'client' ? 'active' : ''}`}
              onClick={() => setActiveTab('client')}
            >
              Client
              {clientFilterCount > 0 && (
                <span className="tab-badge">{clientFilterCount}</span>
              )}
            </button>
            <button
              className={`filter-tab ${activeTab === 'server' ? 'active' : ''}`}
              onClick={() => setActiveTab('server')}
            >
              Server
              {serverFilterCount > 0 && (
                <span className="tab-badge">{serverFilterCount}</span>
              )}
              {hasUnsyncedServerChanges && <span className="unsync-indicator">*</span>}
            </button>
          </div>

          {/* Client Tab Content */}
          {activeTab === 'client' && (
            <>
              {/* Search */}
              <div className="filter-section">
                <label className="filter-label">Search</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search tasks..."
                  className="filter-search"
                />
              </div>

              {/* Main Filter Grid */}
              <div className="filter-grid">
                {/* Milestones */}
                {milestones && milestones.length > 0 && (
                  <div className="filter-section">
                    <label className="filter-label">
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
            </>
          )}

          {/* Server Tab Content */}
          {activeTab === 'server' && (
            <>
              <div className="server-filter-info">
                Server filters are applied when fetching data from GitLab.
                Changes require re-sync to take effect.
              </div>

              {filterOptionsLoading ? (
                <div className="filter-loading">Loading filter options...</div>
              ) : (
                <div className="filter-grid">
                  {/* Labels */}
                  <div className="filter-section">
                    <label className="filter-label">
                      Labels ({filterOptions?.labels?.length || 0})
                    </label>
                    <div className="filter-options scrollable">
                      {filterOptions?.labels?.map((label) => (
                        <label key={label.title} className="filter-checkbox">
                          <input
                            type="checkbox"
                            checked={serverFilters.labelNames?.includes(label.title)}
                            onChange={() =>
                              handleServerFilterChange(
                                'labelNames',
                                toggleArrayItem(serverFilters.labelNames || [], label.title)
                              )
                            }
                          />
                          <span
                            className="label-tag"
                            style={label.color ? { backgroundColor: label.color, color: '#fff' } : {}}
                          >
                            {label.title}
                          </span>
                        </label>
                      ))}
                      {(!filterOptions?.labels || filterOptions.labels.length === 0) && (
                        <div className="no-options">No labels available</div>
                      )}
                    </div>
                  </div>

                  {/* Milestones */}
                  <div className="filter-section">
                    <label className="filter-label">
                      Milestones ({filterOptions?.milestones?.length || 0})
                    </label>
                    <div className="filter-options scrollable">
                      {filterOptions?.milestones?.map((milestone) => (
                        <label key={milestone.iid} className="filter-checkbox">
                          <input
                            type="checkbox"
                            checked={serverFilters.milestoneTitles?.includes(milestone.title)}
                            onChange={() =>
                              handleServerFilterChange(
                                'milestoneTitles',
                                toggleArrayItem(serverFilters.milestoneTitles || [], milestone.title)
                              )
                            }
                          />
                          <span title={milestone.title}>{milestone.title}</span>
                        </label>
                      ))}
                      {(!filterOptions?.milestones || filterOptions.milestones.length === 0) && (
                        <div className="no-options">No milestones available</div>
                      )}
                    </div>
                  </div>

                  {/* Assignees */}
                  <div className="filter-section">
                    <label className="filter-label">
                      Assignees ({filterOptions?.members?.length || 0})
                    </label>
                    <div className="filter-options scrollable">
                      {filterOptions?.members?.map((member) => (
                        <label key={member.username} className="filter-checkbox">
                          <input
                            type="checkbox"
                            checked={serverFilters.assigneeUsernames?.includes(member.username)}
                            onChange={() =>
                              handleServerFilterChange(
                                'assigneeUsernames',
                                toggleArrayItem(serverFilters.assigneeUsernames || [], member.username)
                              )
                            }
                          />
                          <span title={`@${member.username}`}>{member.name}</span>
                        </label>
                      ))}
                      {(!filterOptions?.members || filterOptions.members.length === 0) && (
                        <div className="no-options">No members available</div>
                      )}
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="filter-section">
                    <label className="filter-label">Created Date Range</label>
                    <div className="date-range-inputs">
                      <div className="date-input-group">
                        <label>From:</label>
                        <input
                          type="date"
                          value={serverFilters.dateRange?.createdAfter || ''}
                          onChange={(e) => handleServerDateRangeChange('createdAfter', e.target.value)}
                          className="filter-date-input"
                        />
                      </div>
                      <div className="date-input-group">
                        <label>To:</label>
                        <input
                          type="date"
                          value={serverFilters.dateRange?.createdBefore || ''}
                          onChange={(e) => handleServerDateRangeChange('createdBefore', e.target.value)}
                          className="filter-date-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Apply Button */}
              <div className="server-filter-actions">
                <button
                  className="btn-apply-server"
                  onClick={handleApplyServerFilter}
                  disabled={!hasUnsyncedServerChanges}
                >
                  {hasUnsyncedServerChanges ? 'Apply Changes' : 'No Changes'}
                </button>
              </div>
            </>
          )}
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

        .filter-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
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

        /* Tab styles */
        .filter-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 8px;
        }

        .filter-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--wx-gitlab-filter-input-background);
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          color: var(--wx-gitlab-filter-text);
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-tab:hover {
          background: var(--wx-gitlab-filter-hover-background);
        }

        .filter-tab.active {
          background: #1f75cb;
          border-color: #1f75cb;
          color: white;
        }

        .tab-badge {
          background: rgba(255, 255, 255, 0.3);
          padding: 1px 5px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        }

        .filter-tab.active .tab-badge {
          background: rgba(255, 255, 255, 0.3);
        }

        .unsync-indicator {
          color: #ffc107;
          font-weight: bold;
          margin-left: 2px;
        }

        .filter-tab.active .unsync-indicator {
          color: #ffc107;
        }

        /* Server filter styles */
        .server-filter-info {
          font-size: 12px;
          color: var(--wx-gitlab-control-text);
          padding: 8px 12px;
          background: var(--wx-gitlab-filter-hover-background);
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .filter-loading {
          padding: 20px;
          text-align: center;
          color: var(--wx-gitlab-control-text);
        }

        .no-options {
          padding: 8px;
          text-align: center;
          color: var(--wx-gitlab-control-text);
          font-size: 12px;
          font-style: italic;
        }

        .date-range-inputs {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .date-input-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .date-input-group label {
          font-size: 12px;
          color: var(--wx-gitlab-filter-text);
          min-width: 40px;
        }

        .filter-date-input {
          flex: 1;
          padding: 6px 8px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-input-background);
          color: var(--wx-gitlab-filter-text);
          font-size: 13px;
        }

        .server-filter-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid var(--wx-gitlab-filter-border);
        }

        .btn-apply-server {
          padding: 8px 16px;
          background: #1f75cb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-apply-server:hover:not(:disabled) {
          background: #1a65b3;
        }

        .btn-apply-server:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
