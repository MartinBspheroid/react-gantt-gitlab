// @ts-nocheck
/**
 * GanttView Component
 *
 * Gantt chart view that uses shared DataContext for data.
 * Orchestrates extracted hooks for init, data, columns, dialogs, context menu, and fold state.
 */

import '@fortawesome/fontawesome-free/css/all.min.css';
import '../LabelCell.css';
import './GanttView.css';
import '../shared/modal-close-button.css';
import '../shared/SettingsModal.css';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useGanttState } from './useGanttState.ts';
import { createPortal } from 'react-dom';
import Gantt from '../Gantt.tsx';
import Editor from '../Editor.tsx';
import Toolbar from '../Toolbar.tsx';
import ContextMenu from '../ContextMenu.tsx';
import SmartTaskContent from '../SmartTaskContent.tsx';
import { useData } from '../../contexts/DataContext';
import { useDateRangePreset } from '../../hooks/useDateRangePreset.ts';
import { cn } from '../../utils/cn';
import { SyncButton } from '../SyncButton.tsx';
import { FilterPanel } from '../FilterPanel.tsx';
import {
  ColumnSettingsDropdown,
  useColumnSettings,
} from '../ColumnSettingsDropdown.tsx';
import { ColorRulesEditor } from '../ColorRulesEditor.tsx';
import { MoveInModal } from '../MoveInModal.tsx';
import { SaveBlueprintModal } from '../SaveBlueprintModal.tsx';
import { ApplyBlueprintModal } from '../ApplyBlueprintModal.tsx';
import { BlueprintManager } from '../BlueprintManager.tsx';
import { GroupingDropdown } from '../GroupingDropdown.tsx';

// Blueprint hook stub - provides empty data when no backend is available
function useBlueprint() {
  return {
    blueprints: [],
    loading: false,
    addBlueprint: async () => {},
    deleteBlueprint: async () => {},
    renameBlueprint: async () => {},
    reload: () => {},
  };
}

// Blueprint service stub
async function applyBlueprintService() {
  return { tasks: [], links: [] };
}

import { ConfirmDialog } from '../shared/dialogs/ConfirmDialog';
import { CreateItemDialog } from '../shared/dialogs/CreateItemDialog';
import { DeleteDialog } from '../shared/dialogs/DeleteDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTaskValidation } from './useTaskValidation';
import { KeyboardShortcutsHelp } from '../KeyboardShortcutsHelp';
import { BulkOperationsBar } from '../BulkOperationsBar';
import { useStoreLater } from '@svar-ui/lib-react';
import Tooltip from '../../widgets/Tooltip.tsx';
import TaskTooltipContent from '../TaskTooltipContent.tsx';

// Extracted hooks
import { useFoldState } from './useFoldState.ts';
import { useGanttInit } from './useGanttInit.ts';
import { useContextMenuActions } from './useContextMenuActions.ts';
import { useDialogHandlers } from './useDialogHandlers.ts';
import { useGanttData } from './useGanttData.ts';
import { useGanttColumns } from './useGanttColumns.tsx';

/**
 * GanttView Props
 * @param {boolean} hideSharedToolbar - Hide shared toolbar elements when embedded in Workspace.
 * @param {boolean} showSettings - Control settings modal visibility from parent
 * @param {function} onSettingsClose - Callback when settings modal is closed
 * @param {boolean} readonly - When true, blocks all modifications
 */
export function GanttView({
  hideSharedToolbar = false,
  showSettings: externalShowSettings,
  onSettingsClose,
  externalShowViewOptions,
  className,
  readonly = false,
  filterSearchInputRef,
  viewOptionsContainerRef,
}) {
  // === Get data from DataContext ===
  const {
    tasks: allTasks,
    links,
    milestones,
    epics,
    syncState,
    sync,
    syncTask,
    createTask,
    createMilestone,
    deleteTask,
    createLink,
    deleteLink,
    currentConfig,
    provider,
    configs,
    reloadConfigs: _reloadConfigs,
    handleConfigChange: _handleConfigChange,
    handleQuickSwitch,
    projectPath: _projectPath,
    proxyConfig: _proxyConfig,
    filterOptions,
    serverFilterOptions,
    serverFilterOptionsLoading,
    activeServerFilters,
    filterPresets,
    presetsLoading,
    presetsSaving,
    createNewPreset,
    updatePreset,
    renamePreset,
    deletePreset,
    lastUsedPresetId,
    filterDirty,
    handlePresetSelect,
    handleFilterChange,
    handleServerFilterApply,
    canEditHolidays,
    holidays,
    workdays,
    colorRules,
    holidaysText,
    workdaysText,
    holidaysLoading,
    holidaysSaving,
    holidaysError,
    setHolidaysText,
    setWorkdaysText,
    setColorRules,
    showToast,
    countWorkdays,
    calculateEndDateByWorkdays,
    highlightTime,
  } = useData();

  // === GanttView-specific State ===
  const {
    api,
    setApi,
    internalShowSettings,
    setInternalShowSettings,
    internalShowViewOptions,
    setInternalShowViewOptions,
    showMoveInModal,
    setShowMoveInModal,
    moveInProcessing,
    setMoveInProcessing,
    showSaveBlueprintModal,
    setShowSaveBlueprintModal,
    showApplyBlueprintModal,
    setShowApplyBlueprintModal,
    showBlueprintManager,
    setShowBlueprintManager,
    selectedMilestoneForBlueprint,
    setSelectedMilestoneForBlueprint,
    createItemDialogOpen,
    setCreateItemDialogOpen,
    createItemDialogType,
    setCreateItemDialogType,
    createItemDialogContext,
    setCreateItemDialogContext,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteDialogItems,
    setDeleteDialogItems,
    discardChangesDialogOpen,
    setDiscardChangesDialogOpen,
    dateEditable,
    cellWidthDisplay,
    cellHeight,
    cellHeightDisplay,
    handleCellWidthChange,
    handleCellHeightChange,
    lengthUnit,
    setLengthUnit,
    showColumnSettings,
    setShowColumnSettings,
    effectiveCellWidth,
    groupBy,
    setGroupBy,
    collapsedGroups,
    setCollapsedGroups,
  } = useGanttState();

  // Settings modal can be controlled externally (from Workspace) or internally
  const showSettings =
    externalShowSettings !== undefined
      ? externalShowSettings
      : internalShowSettings;
  const setShowSettings = onSettingsClose
    ? (value) => {
        if (!value) onSettingsClose();
        else setInternalShowSettings(true);
      }
    : setInternalShowSettings;
  const showViewOptions =
    externalShowViewOptions !== undefined
      ? externalShowViewOptions
      : internalShowViewOptions;
  const setShowViewOptions = setInternalShowViewOptions;

  // === Bulk selection ===
  const selectedIds = useStoreLater(api, 'selected');
  const selectedTasksForBulk = useMemo(() => {
    if (!api || !selectedIds || selectedIds.length === 0) return [];
    return selectedIds
      .map((id) => api.getTask(id))
      .filter((task) => task != null);
  }, [api, selectedIds]);

  const handleDeselectAll = useCallback(() => {
    if (api) {
      api.exec('clear-selection');
    }
  }, [api]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedTasksForBulk.length > 0) {
        handleDeselectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTasksForBulk.length, handleDeselectAll]);

  // === Keyboard shortcuts ===
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  useKeyboardShortcuts({
    api,
    onOpenEditor: (taskId) => {
      if (api) {
        api.exec('open-editor', { id: taskId });
      }
    },
    onCloseEditor: () => {
      if (api) {
        api.exec('close-editor');
      }
    },
    onClearSelection: handleDeselectAll,
    onFocusSearch: () => {
      const searchInput = filterSearchInputRef?.current;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    },
    onGoToToday: () => {
      if (api) {
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const state = api.getState();
        const cellWidth = state?.cellWidth || 40;
        const start = state?.start;

        if (start) {
          const daysDiff = Math.floor(
            (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
          );
          const scrollLeft = Math.max(0, daysDiff * cellWidth);
          api.exec('scroll-chart', { left: scrollLeft });
        }
      }
    },
    onShowManagedMessage: () => {
      showToast(
        'Delete action is managed in Azure DevOps. Please use ADO to delete items.',
        'info',
      );
    },
    onShowHelp: () => {
      setShowKeyboardHelp(true);
    },
    enabled: true,
  });

  // === Refs ===
  const allTasksRef = useRef([]);
  const linksRef = useRef([]);
  const pendingDeleteTaskIdsRef = useRef([]);
  const pendingAddTaskContextRef = useRef(null);
  const ganttContainerRef = useRef(null);
  const pendingEditorChangesRef = useRef(new Map());
  const isEditorOpenRef = useRef(false);
  const currentEditingTaskRef = useRef(null);
  const countWorkdaysRef = useRef(countWorkdays);
  const calculateEndDateByWorkdaysRef = useRef(calculateEndDateByWorkdays);

  // Keep refs updated
  useEffect(() => {
    allTasksRef.current = allTasks;
  }, [allTasks]);

  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  useEffect(() => {
    countWorkdaysRef.current = countWorkdays;
    calculateEndDateByWorkdaysRef.current = calculateEndDateByWorkdays;
  }, [countWorkdays, calculateEndDateByWorkdays]);

  // === Column settings ===
  const { columnSettings, toggleColumn, reorderColumns } = useColumnSettings();

  // === Date range preset ===
  const {
    dateRangePreset,
    setDateRangePreset,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    dateRange,
  } = useDateRangePreset({ storagePrefix: 'gantt' });

  // === Fold State ===
  const { registerFoldHandlers } = useFoldState({
    api,
    currentConfig,
    allTasks,
    setCollapsedGroups,
  });

  // === Data computations ===
  const {
    labelPriorityMap,
    labelColorMap,
    assigneeOptions,
    tasksWithWorkdays,
    groupCount,
    stats,
    scales,
    markers,
  } = useGanttData({
    allTasks,
    filterOptions,
    serverFilterOptions,
    countWorkdays,
    lengthUnit,
    groupBy,
    collapsedGroups,
    api,
  });

  // === Blueprint ===
  const {
    blueprints,
    loading: blueprintsLoading,
    addBlueprint,
    deleteBlueprint,
    renameBlueprint,
  } = useBlueprint();

  // === Dialog handlers ===
  const {
    handleCreateItemConfirm,
    handleDiscardChangesConfirm,
    handleDeleteConfirm,
  } = useDialogHandlers({
    api,
    allTasksRef,
    pendingEditorChangesRef,
    pendingAddTaskContextRef,
    pendingDeleteTaskIdsRef,
    createMilestone,
    createTask,
    syncTask,
    sync,
    showToast,
    createItemDialogType,
    setCreateItemDialogOpen,
    setDeleteDialogOpen,
    setDeleteDialogItems,
    setDiscardChangesDialogOpen,
  });

  const handleAddMilestone = useCallback(() => {
    setCreateItemDialogType('milestone');
    setCreateItemDialogContext(null);
    setCreateItemDialogOpen(true);
  }, []);

  // === Context menu ===
  const {
    contextMenuOptions,
    handleContextMenuClick,
    handleMoveIn,
    selectedTasksForModal,
  } = useContextMenuActions({
    api,
    provider,
    syncTask,
    sync,
    showToast,
    setShowMoveInModal,
    setShowSaveBlueprintModal,
    setShowApplyBlueprintModal,
    setSelectedMilestoneForBlueprint,
    setMoveInProcessing,
  });

  // === Gantt Init ===
  const init = useGanttInit({
    setApi,
    setDiscardChangesDialogOpen,
    setCreateItemDialogType,
    setCreateItemDialogContext,
    setCreateItemDialogOpen,
    setDeleteDialogItems,
    setDeleteDialogOpen,
    allTasksRef,
    linksRef,
    pendingEditorChangesRef,
    isEditorOpenRef,
    currentEditingTaskRef,
    pendingAddTaskContextRef,
    pendingDeleteTaskIdsRef,
    ganttContainerRef,
    countWorkdaysRef,
    calculateEndDateByWorkdaysRef,
    syncTask,
    createTask,
    createMilestone,
    deleteTask,
    createLink,
    deleteLink,
    links,
    sync,
    provider,
    showToast,
    registerFoldHandlers,
  });

  // === Columns ===
  const { columns, editorItems } = useGanttColumns({
    api,
    columnSettings,
    labelColorMap,
    labelPriorityMap,
    dateEditable,
    countWorkdays,
  });

  // === Validation ===
  useTaskValidation(tasksWithWorkdays);

  // === Loading / empty states ===
  if (syncState.isLoading && !currentConfig) {
    return (
      <div className="gantt-view-loading">
        <div className="loading-spinner"></div>
        <p>Loading configuration...</p>
      </div>
    );
  }

  if (!currentConfig) {
    return (
      <div className="gantt-view-empty">
        <div className="empty-message">
          <h3>No data source configured</h3>
          <p>
            Please provide a DataProvider with a data source to get started.
          </p>
        </div>
      </div>
    );
  }

  // === Render ===
  return (
    <div className={cn('gantt-view-container', className)}>
      {/* Header section */}
      {!hideSharedToolbar && (
        <div className="gantt-view-header">
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
          >
            <i className="fas fa-sliders-h"></i>
            <i
              className={`fas fa-chevron-${showViewOptions ? 'up' : 'down'} chevron-icon`}
            ></i>
          </button>

          <SyncButton
            onSync={sync}
            syncState={syncState}
            filterOptions={filterOptions}
          />
          <div className="stats-panel">
            <div className="stat-item">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Completed:</span>
              <span className="stat-value stat-completed">
                {stats.completed}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">In Progress:</span>
              <span className="stat-value stat-progress">
                {stats.inProgress}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Not Started:</span>
              <span className="stat-value">{stats.notStarted}</span>
            </div>
            {stats.overdue > 0 && (
              <div className="stat-item">
                <span className="stat-label">Overdue:</span>
                <span className="stat-value stat-overdue">{stats.overdue}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Controls */}
      {showViewOptions &&
        (() => {
          const viewControlsContent = (
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
                  onChange={(e) =>
                    handleCellWidthChange(Number(e.target.value))
                  }
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
                  onChange={(e) =>
                    handleCellHeightChange(Number(e.target.value))
                  }
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
            </div>
          );

          const portalContainer = viewOptionsContainerRef?.current;
          if (hideSharedToolbar && portalContainer) {
            return createPortal(viewControlsContent, portalContainer);
          }
          return viewControlsContent;
        })()}

      {/* Settings Modal */}
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
            <header className="settings-modal-header">
              <h3>Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="modal-close-btn"
              >
                &times;
              </button>
            </header>

            <div className="settings-modal-body">
              <div className="settings-section">
                <h4>Data Source</h4>
                <p style={{ fontSize: '13px', color: '#666' }}>
                  Data source is configured via the DataProvider wrapper.
                </p>
              </div>

              <div className="settings-section">
                <h4 className="settings-section-header">
                  Holidays
                  {!canEditHolidays && (
                    <span className="permission-warning">
                      <i className="fas fa-lock"></i>
                      {currentConfig?.type === 'group'
                        ? ' Not available for Groups'
                        : ' Create Snippet permission required'}
                    </span>
                  )}
                  {holidaysSaving && (
                    <span className="saving-indicator">
                      <i className="fas fa-spinner fa-spin"></i> Saving...
                    </span>
                  )}
                </h4>
                <p className="settings-hint">
                  Add holiday dates (one per line, formats: YYYY-MM-DD or
                  YYYY/M/D, optional name after space)
                </p>
                {holidaysError && (
                  <div className="holidays-error">
                    <i className="fas fa-exclamation-triangle"></i>{' '}
                    {holidaysError}
                  </div>
                )}
                <textarea
                  value={holidaysText}
                  onChange={(e) => setHolidaysText(e.target.value)}
                  placeholder="2025-01-01 New Year&#10;2025/2/28&#10;2025-12-25 Christmas"
                  className={`holidays-textarea ${!canEditHolidays ? 'disabled' : ''}`}
                  rows={6}
                  disabled={!canEditHolidays || holidaysLoading}
                />
                {canEditHolidays && (
                  <div className="holiday-presets">
                    <button
                      onClick={() => setHolidaysText('')}
                      className="preset-btn preset-btn-clear"
                      disabled={holidaysLoading}
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              <div className="settings-section">
                <h4 className="settings-section-header">
                  Extra Working Days
                  {!canEditHolidays && (
                    <span className="permission-warning">
                      <i className="fas fa-lock"></i>
                      {currentConfig?.type === 'group'
                        ? ' Not available for Groups'
                        : ' Create Snippet permission required'}
                    </span>
                  )}
                </h4>
                <p className="settings-hint">
                  Add extra working days on weekends (one per line, formats:
                  YYYY-MM-DD or YYYY/M/D)
                </p>
                <textarea
                  value={workdaysText}
                  onChange={(e) => setWorkdaysText(e.target.value)}
                  placeholder="2025/1/25&#10;2025-02-08"
                  className={`holidays-textarea ${!canEditHolidays ? 'disabled' : ''}`}
                  rows={6}
                  disabled={!canEditHolidays || holidaysLoading}
                />
                {canEditHolidays && (
                  <div className="holiday-presets">
                    <button
                      onClick={() => setWorkdaysText('')}
                      className="preset-btn preset-btn-clear"
                      disabled={holidaysLoading}
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              <div className="settings-section">
                <h4 className="settings-section-header">
                  Color Rules
                  {!canEditHolidays && (
                    <span className="permission-warning">
                      <i className="fas fa-lock"></i>
                      {currentConfig?.type === 'group'
                        ? ' Not available for Groups'
                        : ' Create Snippet permission required'}
                    </span>
                  )}
                  {holidaysSaving && (
                    <span className="saving-indicator">
                      <i className="fas fa-spinner fa-spin"></i> Saving...
                    </span>
                  )}
                </h4>
                <p className="settings-hint">
                  Highlight time bars with diagonal stripes based on issue title
                  matching conditions
                </p>
                <ColorRulesEditor
                  rules={colorRules}
                  onRulesChange={setColorRules}
                  canEdit={canEditHolidays}
                  saving={holidaysSaving}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FilterPanel */}
      {!hideSharedToolbar && (
        <FilterPanel
          key={currentConfig?.id || 'no-config'}
          milestones={milestones}
          epics={epics}
          tasks={allTasks}
          onFilterChange={handleFilterChange}
          initialFilters={filterOptions}
          presets={filterPresets}
          presetsLoading={presetsLoading}
          presetsSaving={presetsSaving}
          canEditPresets={canEditHolidays}
          onCreatePreset={createNewPreset}
          onUpdatePreset={updatePreset}
          onRenamePreset={renamePreset}
          onDeletePreset={deletePreset}
          onPresetSelect={handlePresetSelect}
          initialPresetId={lastUsedPresetId}
          isGroupMode={currentConfig?.type === 'group'}
          filterOptions={serverFilterOptions}
          filterOptionsLoading={serverFilterOptionsLoading}
          serverFilters={activeServerFilters}
          onServerFilterApply={handleServerFilterApply}
          isDirty={filterDirty}
        />
      )}

      {syncState.error && (
        <div className="error-banner">
          <strong>Sync Error:</strong> {syncState.error}
          <button onClick={() => sync()} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      <div className="gantt-wrapper">
        <div className="gantt-toolbar-row">
          <ColumnSettingsDropdown
            isOpen={showColumnSettings}
            onToggle={() => setShowColumnSettings(!showColumnSettings)}
            columnSettings={columnSettings}
            onToggleColumn={toggleColumn}
            onReorderColumns={reorderColumns}
          />
          <GroupingDropdown
            value={groupBy}
            onChange={setGroupBy}
            groupCount={groupCount}
            taskCount={stats.total}
          />
          <Toolbar
            api={api}
            onAddMilestone={handleAddMilestone}
            onOpenBlueprints={() => setShowBlueprintManager(true)}
          />
        </div>
        <div ref={ganttContainerRef} className="gantt-chart-container">
          {syncState.isLoading ? (
            <div className="loading-message">
              <p>Loading data...</p>
            </div>
          ) : (
            <ContextMenu
              api={api}
              options={contextMenuOptions}
              onClick={handleContextMenuClick}
              filter={(item, _task) => {
                if (item.id === 'assign-to' && serverFilterOptions?.members) {
                  const memberOptions = serverFilterOptions.members
                    .map((member) => ({
                      id: `assign-to:${member.name}`,
                      text: member.name,
                      icon: 'fas fa-user',
                    }))
                    .sort((a, b) => a.text.localeCompare(b.text));

                  item.data = [
                    {
                      id: 'assign-to:unassigned',
                      text: 'Unassigned',
                      icon: 'fas fa-user-slash',
                    },
                    { type: 'separator' },
                    ...memberOptions,
                  ];
                }
                return true;
              }}
            >
              <Tooltip api={api} content={TaskTooltipContent}>
                <Gantt
                  init={(api) => {
                    try {
                      const result = init(api);
                      return result;
                    } catch (error) {
                      console.error(
                        '[Gantt init] ERROR in init callback:',
                        error,
                      );
                      console.error('[Gantt init] ERROR name:', error.name);
                      console.error(
                        '[Gantt init] ERROR message:',
                        error.message,
                      );
                      console.error('[Gantt init] ERROR stack:', error.stack);
                      throw error;
                    }
                  }}
                  tasks={tasksWithWorkdays}
                  links={links}
                  markers={markers}
                  scales={scales}
                  lengthUnit={lengthUnit}
                  start={dateRange.start}
                  end={dateRange.end}
                  columns={columns}
                  cellWidth={effectiveCellWidth}
                  cellHeight={cellHeight}
                  highlightTime={highlightTime}
                  countWorkdays={countWorkdays}
                  readonly={readonly}
                  baselines={true}
                  taskTemplate={SmartTaskContent}
                  autoScale={false}
                  colorRules={colorRules}
                  sprints={sprints}
                />
              </Tooltip>
            </ContextMenu>
          )}
        </div>
        {api && (
          <Editor
            api={api}
            bottomBar={false}
            autoSave={false}
            items={editorItems}
            workdaysHelpers={{ countWorkdays, calculateEndDateByWorkdays }}
          />
        )}
      </div>

      {/* Move In Modal */}
      <MoveInModal
        isOpen={showMoveInModal}
        onClose={() => setShowMoveInModal(false)}
        selectedTasks={selectedTasksForModal}
        allTasks={allTasksRef.current}
        epics={epics || []}
        onMove={handleMoveIn}
        isProcessing={moveInProcessing}
      />

      {/* Blueprint Modals */}
      <SaveBlueprintModal
        isOpen={showSaveBlueprintModal}
        onClose={() => {
          setShowSaveBlueprintModal(false);
          setSelectedMilestoneForBlueprint(null);
        }}
        milestoneTask={selectedMilestoneForBlueprint}
        allTasks={allTasksRef.current}
        allLinks={links}
        holidays={holidays}
        workdays={workdays}
        onSave={async (blueprint) => {
          await addBlueprint(blueprint);
          showToast('Blueprint saved successfully', 'success');
        }}
        canUseSnippet={canUseBlueprintSnippet}
      />

      <ApplyBlueprintModal
        isOpen={showApplyBlueprintModal}
        onClose={() => setShowApplyBlueprintModal(false)}
        blueprints={blueprints}
        onApply={async (blueprint, options) => {
          try {
            const result = await applyBlueprintService(
              blueprint,
              options,
              provider,
              holidays || [],
              workdays || [],
            );

            if (result.success) {
              showToast('Blueprint applied successfully', 'success');
            } else {
              showToast('Blueprint applied with some issues', 'warning');
            }

            await sync();
            return result;
          } catch (error) {
            console.error('[GanttView] Apply blueprint error:', error);
            showToast(`Failed to apply blueprint: ${error.message}`, 'error');
            throw error;
          }
        }}
      />

      <BlueprintManager
        isOpen={showBlueprintManager}
        onClose={() => setShowBlueprintManager(false)}
        blueprints={blueprints}
        loading={blueprintsLoading}
        onDelete={deleteBlueprint}
        onRename={renameBlueprint}
        onApply={() => {
          setShowBlueprintManager(false);
          setShowApplyBlueprintModal(true);
        }}
      />

      {/* Create Item Dialog */}
      <CreateItemDialog
        isOpen={createItemDialogOpen}
        onClose={() => {
          setCreateItemDialogOpen(false);
          pendingAddTaskContextRef.current = null;
        }}
        onConfirm={handleCreateItemConfirm}
        itemType={createItemDialogType}
        parentTask={createItemDialogContext?.parentTask}
        assigneeOptions={assigneeOptions}
      />

      {/* Delete Dialog */}
      <DeleteDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteDialogItems([]);
          pendingDeleteTaskIdsRef.current = [];
        }}
        onConfirm={handleDeleteConfirm}
        items={deleteDialogItems}
      />

      {/* Discard Changes Dialog */}
      <ConfirmDialog
        isOpen={discardChangesDialogOpen}
        onClose={() => setDiscardChangesDialogOpen(false)}
        onConfirm={handleDiscardChangesConfirm}
        title="Discard Changes"
        message="You have unsaved changes. Do you want to discard them?"
        severity="warning"
        confirmLabel="Discard"
      />

      {/* Bulk Operations Bar */}
      <BulkOperationsBar
        selectedTasks={selectedTasksForBulk}
        api={api}
        provider={provider}
        assigneeOptions={assigneeOptions}
        onSync={sync}
        showToast={showToast}
        onDeselectAll={handleDeselectAll}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  );
}
