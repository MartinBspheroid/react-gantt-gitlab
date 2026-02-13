// src/components/Workspace/SharedFilterPanel.jsx

/**
 * SharedFilterPanel
 *
 * Wrapper component that renders FilterPanel using data from DataContext.
 * This allows FilterPanel to be used at the Workspace level,
 * shared between Gantt and Kanban views.
 */

import React, { forwardRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { FilterPanel } from '../FilterPanel';

export const SharedFilterPanel = forwardRef(function SharedFilterPanel(_props, ref) {
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
  } = useData();

  return (
    <FilterPanel
      ref={ref}
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
});
