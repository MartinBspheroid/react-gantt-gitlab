/**
 * WorkloadView Component
 * Main component for workload visualization by Assignee/Label
 * Refactored to use shared hooks with GitLabGantt
 */

import '@fortawesome/fontawesome-free/css/all.min.css';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WorkloadChart } from './WorkloadChart.jsx';
import { WorkloadSidebar } from './WorkloadSidebar.jsx';
import { useProjectConfig } from '../hooks/useProjectConfig.ts';
import { useCellDimensions } from '../hooks/useCellDimensions.ts';
import { useDataInit } from '../hooks/useDataInit.ts';
import { useFilterPresets } from '../hooks/useFilterPresets.ts';
import { useHolidays } from '../hooks/useHolidays.ts';
import { useDateRangePreset } from '../hooks/useDateRangePreset.ts';
import { useHighlightTime } from '../hooks/useHighlightTime.ts';
import { DataFilters, toGitLabServerFilters } from '../utils/DataFilters.ts';
import {
  getUniqueAssignees,
  getUniqueLabels,
  findOriginalTask,
} from '../utils/WorkloadUtils.ts';
import { SyncButton } from './SyncButton.jsx';
import { ProjectSelector } from './ProjectSelector.jsx';
import { FilterPanel } from './FilterPanel.jsx';
import './WorkloadView.css';
import './shared/modal-close-button.css';

export function WorkloadView({ initialConfigId }) {
  // Use shared project config hook
  const {
    currentConfig,
    provider,
    configs,
    reloadConfigs,
    handleConfigChange,
    handleQuickSwitch,
    projectPath,
    proxyConfig,
    configVersion,
  } = useProjectConfig(initialConfigId);

  // Use shared cell dimensions hook
  const {
    cellWidthDisplay,
    handleCellWidthChange,
    cellHeight,
    cellHeightDisplay,
    handleCellHeightChange,
    lengthUnit,
    setLengthUnit,
    effectiveCellWidth,
  } = useCellDimensions('workload');

  // Selection state for workload grouping (sidebar - client-side grouping)
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState([]);

  // Client-side filter options (from FilterPanel)
  const [filterOptions, setFilterOptions] = useState({});

  // Project members and labels from GitLab API
  const [projectMembers, setProjectMembers] = useState([]);
  const [projectLabels, setProjectLabels] = useState([]);

  // Store reference to all tasks for event handlers
  const allTasksRef = useRef([]);

  const [canEditHolidays, setCanEditHolidays] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);

  // Show "Others" category for uncategorized tasks
  const [showOthers, setShowOthers] = useState(() => {
    const saved = localStorage.getItem('workload-show-others');
    return saved === 'true';
  });

  // Use shared date range preset hook
  const {
    dateRangePreset,
    setDateRangePreset,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    dateRange,
  } = useDateRangePreset({ storagePrefix: 'workload' });

  // Persist showOthers to localStorage
  useEffect(() => {
    localStorage.setItem('workload-show-others', showOthers.toString());
  }, [showOthers]);

  // Check permissions when provider changes
  useEffect(() => {
    if (!provider) {
      setCanEditHolidays(false);
      setCanEdit(false);
      return;
    }

    provider.checkCanEdit().then((canEditResult) => {
      setCanEditHolidays(canEditResult);
      setCanEdit(canEditResult);
    });
  }, [provider]);

  // Use filter presets hook (shared with GitLabGantt)
  const {
    presets: filterPresets,
    loading: presetsLoading,
    saving: presetsSaving,
    createNewPreset,
    renamePreset,
    deletePreset,
  } = useFilterPresets(
    projectPath,
    proxyConfig,
    currentConfig?.type || 'project',
    canEdit,
  );

  // Use shared GitLab data initialization hook
  const {
    tasks: allTasks,
    syncState,
    sync,
    syncTask,
    serverFilterOptions,
    serverFilterOptionsLoading,
    activeServerFilters,
    setActiveServerFilters,
    lastUsedPresetId,
    setLastUsedPresetId,
  } = useDataInit({
    provider,
    proxyConfig,
    configVersion,
    filterPresets,
    presetsLoading,
    configType: currentConfig?.type || 'project',
    projectId: currentConfig?.projectId,
    groupId: currentConfig?.groupId,
  });

  // Apply client-side filters to tasks (same as GitLabGantt)
  const filteredTasks = useMemo(() => {
    return DataFilters.applyFilters(allTasks, filterOptions);
  }, [allTasks, filterOptions]);

  // Use GitLab holidays hook
  const { holidays, workdays } = useHolidays(
    projectPath,
    proxyConfig,
    canEditHolidays,
    currentConfig?.type || 'project',
  );

  // Update ref when allTasks changes
  useEffect(() => {
    allTasksRef.current = allTasks;
  }, [allTasks]);

  // Fetch project members and labels from GitLab API when provider changes
  useEffect(() => {
    if (!provider) {
      setProjectMembers([]);
      setProjectLabels([]);
      return;
    }

    // Fetch members and labels in parallel
    Promise.all([
      provider.getProjectMembers().catch(() => []),
      provider.getProjectLabels().catch(() => []),
    ]).then(([members, labels]) => {
      setProjectMembers(members);
      setProjectLabels(labels);
    });
  }, [provider]);

  // Extract assignees and labels from filtered tasks (for sidebar)
  const taskAssignees = useMemo(
    () => getUniqueAssignees(filteredTasks),
    [filteredTasks],
  );
  const taskLabels = useMemo(
    () => getUniqueLabels(filteredTasks),
    [filteredTasks],
  );

  // Combine project members with task assignees, and project labels with task labels
  const availableAssignees = useMemo(() => {
    const combined = new Set([...projectMembers, ...taskAssignees]);
    return Array.from(combined).sort();
  }, [projectMembers, taskAssignees]);

  const availableLabels = useMemo(() => {
    const combined = new Set([...projectLabels, ...taskLabels]);
    return Array.from(combined).sort();
  }, [projectLabels, taskLabels]);

  // Generate storage key for current project (for sidebar selection persistence)
  const filterStorageKey = useMemo(() => {
    if (!currentConfig) return null;
    const projectKey =
      currentConfig.projectId || currentConfig.groupId || 'default';
    return `workload-filter-${projectKey}`;
  }, [currentConfig]);

  // Load saved sidebar filter when project changes
  useEffect(() => {
    if (!filterStorageKey) return;

    const saved = localStorage.getItem(filterStorageKey);
    if (saved) {
      try {
        const { assignees, labels } = JSON.parse(saved);
        // Only restore if arrays exist
        if (Array.isArray(assignees)) setSelectedAssignees(assignees);
        if (Array.isArray(labels)) setSelectedLabels(labels);
      } catch {
        // Ignore parse errors
      }
    } else {
      // Reset to empty when switching to a new project without saved filters
      setSelectedAssignees([]);
      setSelectedLabels([]);
    }
  }, [filterStorageKey]);

  // Save sidebar filter when selection changes
  useEffect(() => {
    if (!filterStorageKey) return;

    localStorage.setItem(
      filterStorageKey,
      JSON.stringify({
        assignees: selectedAssignees,
        labels: selectedLabels,
      }),
    );
  }, [filterStorageKey, selectedAssignees, selectedLabels]);

  // Track pending date changes for debounce
  const pendingDateChangesRef = useRef(new Map());
  const dateChangeTimersRef = useRef(new Map());

  // Handle task drag from WorkloadChart
  const handleTaskDrag = useCallback(
    (task, changes) => {
      // Find original task
      const originalTask = findOriginalTask(task.id, allTasksRef.current);
      if (!originalTask) {
        console.warn(
          '[WorkloadView] Could not find original task for:',
          task.id,
        );
        return;
      }

      // Debounce date changes
      const taskKey = String(originalTask.id);

      // Merge with any pending changes for this task
      const existing = pendingDateChangesRef.current.get(taskKey) || {};
      const merged = { ...existing };
      if (changes.start !== undefined) merged.start = changes.start;
      if (changes.end !== undefined) merged.end = changes.end;
      pendingDateChangesRef.current.set(taskKey, merged);

      // Clear existing timer
      const existingTimer = dateChangeTimersRef.current.get(taskKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        const pendingChanges = pendingDateChangesRef.current.get(taskKey);
        pendingDateChangesRef.current.delete(taskKey);
        dateChangeTimersRef.current.delete(taskKey);

        if (pendingChanges) {
          try {
            await syncTask(originalTask.id, pendingChanges);
          } catch (error) {
            console.error('[WorkloadView] Failed to sync task:', error.message);
          }
        }
      }, 500);

      dateChangeTimersRef.current.set(taskKey, timer);
    },
    [syncTask],
  );

  // Handle group change (cross-group drag)
  const handleGroupChange = useCallback(
    async (task, { fromGroup, toGroup }) => {
      if (!provider) {
        console.warn('[WorkloadView] No provider available for group change');
        return;
      }

      // Find original task
      const originalTask = findOriginalTask(task.id, allTasksRef.current);
      if (!originalTask) {
        console.warn(
          '[WorkloadView] Could not find original task for:',
          task.id,
        );
        return;
      }

      const taskId = originalTask.id;
      console.log('[WorkloadView] Group change:', {
        taskId,
        from: fromGroup,
        to: toGroup,
      });

      try {
        if (toGroup.type === 'others') {
          // Moving to "Others" group - remove the assignee/label from the source group
          if (fromGroup.type === 'assignee') {
            const currentAssignees = originalTask.assigned
              ? originalTask.assigned.split(',').map((a) => a.trim())
              : [];
            await provider.removeIssueAssignee(
              taskId,
              fromGroup.name,
              currentAssignees,
            );
          } else if (fromGroup.type === 'label') {
            const currentLabels = originalTask.labels
              ? Array.isArray(originalTask.labels)
                ? originalTask.labels
                : originalTask.labels.split(',').map((l) => l.trim())
              : [];
            await provider.removeIssueLabel(
              taskId,
              fromGroup.name,
              currentLabels,
            );
          }
        } else if (toGroup.type === 'assignee') {
          // Moving to assignee group - add this assignee to the task
          const currentAssignees = originalTask.assigned
            ? originalTask.assigned.split(',').map((a) => a.trim())
            : [];
          await provider.addIssueAssignee(
            taskId,
            toGroup.name,
            currentAssignees,
          );

          // If moving from another assignee group, optionally remove old assignee
          if (fromGroup.type === 'assignee') {
            const updatedAssignees = [...currentAssignees, toGroup.name];
            await provider.removeIssueAssignee(
              taskId,
              fromGroup.name,
              updatedAssignees,
            );
          }
        } else if (toGroup.type === 'label') {
          // Moving to label group - add this label to the task
          const currentLabels = originalTask.labels
            ? Array.isArray(originalTask.labels)
              ? originalTask.labels
              : originalTask.labels.split(',').map((l) => l.trim())
            : [];
          await provider.addIssueLabel(taskId, toGroup.name, currentLabels);

          // If moving from another label group, optionally remove old label
          if (fromGroup.type === 'label') {
            const updatedLabels = [...currentLabels, toGroup.name];
            await provider.removeIssueLabel(
              taskId,
              fromGroup.name,
              updatedLabels,
            );
          }
        }

        // Refresh data to show updated assignments
        await sync();
      } catch (error) {
        console.error('[WorkloadView] Failed to update group:', error.message);
      }
    },
    [provider, sync],
  );

  // Handler for applying server filters and triggering sync (same as GitLabGantt)
  const handleServerFilterApply = useCallback(
    async (serverFilters) => {
      const gitlabFilters = toGitLabServerFilters(serverFilters);
      setActiveServerFilters(gitlabFilters);
      await sync({ serverFilters: gitlabFilters });
    },
    [sync, setActiveServerFilters],
  );

  // Handle preset selection from FilterPanel
  const handlePresetSelect = useCallback(
    (presetId) => {
      setLastUsedPresetId(presetId);
    },
    [setLastUsedPresetId],
  );

  // Use shared highlight time hook for weekend/holiday logic
  const { highlightTime } = useHighlightTime({ holidays, workdays });

  // Show loading state
  if (syncState.isLoading && !currentConfig) {
    return (
      <div className="workload-view-loading">
        <div className="loading-spinner"></div>
        <p>Loading GitLab configuration...</p>
      </div>
    );
  }

  // Show config prompt if no config
  if (!currentConfig) {
    return (
      <div className="workload-view-empty">
        <div className="empty-message">
          <h3>No GitLab project configured</h3>
          <p>
            Please configure a GitLab project in the Gantt View first, then
            return here.
          </p>
        </div>
      </div>
    );
  }

  const hasSelection =
    selectedAssignees.length > 0 || selectedLabels.length > 0;

  return (
    <div className="workload-view-container">
      <div className="workload-view-header">
        <div className="project-switcher">
          <select
            value={currentConfig?.id || ''}
            onChange={(e) => handleQuickSwitch(e.target.value)}
            className="project-select-compact"
          >
            <option value="">Select Project...</option>
            {configs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-settings"
            title="Settings"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>

        <button
          onClick={() => setShowViewOptions(!showViewOptions)}
          className="btn-view-options"
          title="View Options"
        >
          <i className="fas fa-sliders-h"></i>
          <i
            className={`fas fa-chevron-${showViewOptions ? 'up' : 'down'} chevron-icon`}
          ></i>
        </button>

        <SyncButton onSync={sync} syncState={syncState} filterOptions={{}} />
      </div>

      {showViewOptions && (
        <div className="view-controls">
          <label className="control-label">
            Range:
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value)}
              className="unit-select"
            >
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
              <option value="2y">2 Years</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {dateRangePreset === 'custom' && (
            <>
              <label className="control-label">
                From:
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="date-input"
                />
              </label>
              <label className="control-label">
                To:
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="date-input"
                />
              </label>
            </>
          )}
          <label className="control-label">
            Width:
            <input
              type="range"
              min="20"
              max="100"
              value={cellWidthDisplay}
              onChange={(e) => handleCellWidthChange(Number(e.target.value))}
              className="slider"
              disabled={lengthUnit !== 'day'}
            />
            <span className="control-value">
              {lengthUnit === 'day' ? cellWidthDisplay : effectiveCellWidth}
            </span>
          </label>
          <label className="control-label">
            Height:
            <input
              type="range"
              min="20"
              max="60"
              value={cellHeightDisplay}
              onChange={(e) => handleCellHeightChange(Number(e.target.value))}
              className="slider"
            />
            <span className="control-value">{cellHeightDisplay}</span>
          </label>
          <label className="control-label">
            Unit:
            <select
              value={lengthUnit}
              onChange={(e) => setLengthUnit(e.target.value)}
              className="unit-select"
            >
              <option value="hour">Hour</option>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
            </select>
          </label>
          <label className="control-label checkbox-label">
            <input
              type="checkbox"
              checked={showOthers}
              onChange={(e) => setShowOthers(e.target.checked)}
            />
            Others
          </label>
        </div>
      )}

      {/* Full FilterPanel - same as GitLabGantt */}
      <FilterPanel
        key={currentConfig?.id || 'no-config'}
        milestones={[]} // WorkloadView doesn't have separate milestone data
        epics={[]} // WorkloadView doesn't have separate epic data
        tasks={allTasks}
        onFilterChange={setFilterOptions}
        presets={filterPresets}
        presetsLoading={presetsLoading}
        presetsSaving={presetsSaving}
        canEditPresets={canEdit}
        onCreatePreset={createNewPreset}
        onRenamePreset={renamePreset}
        onDeletePreset={deletePreset}
        onPresetSelect={handlePresetSelect}
        initialPresetId={lastUsedPresetId}
        filterOptions={serverFilterOptions}
        filterOptionsLoading={serverFilterOptionsLoading}
        serverFilters={activeServerFilters}
        onServerFilterApply={handleServerFilterApply}
      />

      {syncState.error && (
        <div className="error-banner">
          <strong>Sync Error:</strong> {syncState.error}
          <button onClick={() => sync()} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      <div className="workload-view-content">
        <WorkloadSidebar
          assignees={availableAssignees}
          labels={availableLabels}
          selectedAssignees={selectedAssignees}
          selectedLabels={selectedLabels}
          onAssigneesChange={setSelectedAssignees}
          onLabelsChange={setSelectedLabels}
        />

        <div className="workload-gantt-wrapper">
          {syncState.isLoading || filteredTasks.length === 0 ? (
            <div className="loading-message">
              <p>
                {syncState.isLoading
                  ? 'Loading GitLab data...'
                  : 'No tasks match the current filters.'}
              </p>
            </div>
          ) : !hasSelection ? (
            <div className="no-selection-message">
              <i className="fas fa-hand-pointer"></i>
              <h3>Select Assignees or Labels</h3>
              <p>
                Choose assignees and/or labels from the sidebar to view their
                workload.
              </p>
            </div>
          ) : (
            <WorkloadChart
              key={`workload-${lengthUnit}-${effectiveCellWidth}`}
              tasks={filteredTasks}
              selectedAssignees={selectedAssignees}
              selectedLabels={selectedLabels}
              startDate={dateRange.start}
              endDate={dateRange.end}
              cellWidth={effectiveCellWidth}
              cellHeight={cellHeight}
              lengthUnit={lengthUnit}
              highlightTime={highlightTime}
              onTaskDrag={handleTaskDrag}
              onGroupChange={handleGroupChange}
              showOthers={showOthers}
            />
          )}
        </div>
      </div>

      {showSettings && (
        <div
          className="settings-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowSettings(false);
            }
          }}
        >
          <div
            className="settings-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h3>Workload Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="modal-close-btn"
              >
                &times;
              </button>
            </div>

            <div className="settings-modal-body">
              <div className="settings-section">
                <h4>GitLab Project</h4>
                <ProjectSelector
                  onProjectChange={(config) => {
                    handleConfigChange(config);
                    setShowSettings(false);
                  }}
                  currentConfigId={currentConfig?.id}
                  onConfigsChange={reloadConfigs}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkloadView;
