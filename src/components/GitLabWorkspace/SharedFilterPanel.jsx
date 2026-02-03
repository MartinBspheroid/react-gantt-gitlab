// src/components/GitLabWorkspace/SharedFilterPanel.jsx

/**
 * SharedFilterPanel
 *
 * Wrapper component that renders FilterPanel using data from GitLabDataContext.
 * This allows FilterPanel to be used at the GitLabWorkspace level,
 * shared between Gantt and Kanban views.
 */

import { useGitLabData } from '../../contexts/GitLabDataContext';
import { FilterPanel } from '../FilterPanel';

export function SharedFilterPanel() {
  const {
    // Core Data
    tasks: allTasks,
    milestones,
    epics,
    // Configuration
    currentConfig,
    // Filter State
    filterOptions,
    serverFilterOptions,
    serverFilterOptionsLoading,
    activeServerFilters,
    // Filter Presets
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
    // Permissions
    canEditHolidays,
  } = useGitLabData();

  return (
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
  );
}
