// @ts-nocheck
/**
 * WorkloadView Component
 * Main component for workload visualization by Assignee/Label
 * Consumes data from DataContext (shared with GanttView/KanbanView)
 */

import '@fortawesome/fontawesome-free/css/all.min.css';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WorkloadChart } from './WorkloadChart.tsx';
import { WorkloadSidebar } from './WorkloadSidebar.tsx';
import { useCellDimensions } from '../hooks/useCellDimensions.ts';
import { useDateRangePreset } from '../hooks/useDateRangePreset.ts';
import { useData } from '../contexts/DataContext';
import { DataFilters } from '../utils/DataFilters.ts';
import {
  getUniqueAssignees,
  getUniqueLabels,
  findOriginalTask,
} from '../utils/WorkloadUtils.ts';
import { SyncButton } from './SyncButton.tsx';
import { FilterPanel } from './FilterPanel.tsx';
import './WorkloadView.css';
import './shared/modal-close-button.css';

export function WorkloadView() {
  // Get data from shared DataContext
  const {
    tasks: allTasks,
    syncState,
    sync,
    syncTask,
    highlightTime,
    canEdit,
    filterPresets,
    presetsLoading,
    presetsSaving,
    createNewPreset,
    renamePreset,
    deletePreset,
    serverFilterOptions,
    serverFilterOptionsLoading,
    activeServerFilters,
    setActiveServerFilters,
    lastUsedPresetId,
    handlePresetSelect: setLastUsedPresetId,
  } = useData();

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

  // Store reference to all tasks for event handlers
  const allTasksRef = useRef([]);

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

  // Apply client-side filters to tasks
  const filteredTasks = useMemo(() => {
    return DataFilters.applyFilters(allTasks, filterOptions);
  }, [allTasks, filterOptions]);

  // Update ref when allTasks changes
  useEffect(() => {
    allTasksRef.current = allTasks;
  }, [allTasks]);

  // Extract assignees and labels from filtered tasks (for sidebar)
  const taskAssignees = useMemo(
    () => getUniqueAssignees(filteredTasks),
    [filteredTasks],
  );
  const taskLabels = useMemo(
    () => getUniqueLabels(filteredTasks),
    [filteredTasks],
  );

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

  // Handle group change (cross-group drag) - simplified without provider-specific APIs
  const handleGroupChange = useCallback(
    async (task, { fromGroup, toGroup }) => {
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
        // Update task assignment based on group change
        const updates = {};

        if (toGroup.type === 'assignee') {
          // Add new assignee
          const currentAssignees = originalTask.assigned
            ? originalTask.assigned.split(',').map((a) => a.trim())
            : [];
          if (!currentAssignees.includes(toGroup.name)) {
            currentAssignees.push(toGroup.name);
          }
          // Remove old assignee if moving between assignee groups
          if (fromGroup.type === 'assignee') {
            const idx = currentAssignees.indexOf(fromGroup.name);
            if (idx > -1) currentAssignees.splice(idx, 1);
          }
          updates.assigned = currentAssignees.join(', ');
        } else if (toGroup.type === 'label') {
          // Add new label
          const currentLabels = originalTask.labels
            ? Array.isArray(originalTask.labels)
              ? [...originalTask.labels]
              : originalTask.labels.split(',').map((l) => l.trim())
            : [];
          if (!currentLabels.includes(toGroup.name)) {
            currentLabels.push(toGroup.name);
          }
          // Remove old label if moving between label groups
          if (fromGroup.type === 'label') {
            const idx = currentLabels.indexOf(fromGroup.name);
            if (idx > -1) currentLabels.splice(idx, 1);
          }
          updates.labels = currentLabels;
        }

        if (Object.keys(updates).length > 0) {
          await syncTask(taskId, updates);
        }

        // Refresh data to show updated assignments
        await sync();
      } catch (error) {
        console.error('[WorkloadView] Failed to update group:', error.message);
      }
    },
    [sync, syncTask],
  );

  // Handler for applying server filters and triggering sync
  const handleServerFilterApply = useCallback(
    async (serverFilters) => {
      setActiveServerFilters(serverFilters);
      await sync({ serverFilters });
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

  const hasSelection =
    selectedAssignees.length > 0 || selectedLabels.length > 0;

  return (
    <div className="workload-view-container">
      <div className="workload-view-header">
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

      {/* FilterPanel */}
      <FilterPanel
        milestones={[]}
        epics={[]}
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
          assignees={taskAssignees}
          labels={taskLabels}
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
                  ? 'Loading data...'
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
    </div>
  );
}

export default WorkloadView;
