// src/components/GitLabWorkspace/SharedToolbar.jsx

/**
 * SharedToolbar
 *
 * Shared toolbar component for Gantt and Kanban views.
 * Contains view switcher, project selector, settings button, sync button, and filter toggle.
 *
 * NOTE: This component gets most data from GitLabDataContext to reduce prop drilling.
 * Only view-specific callbacks and state are passed as props.
 */

import { useGitLabData } from '../../contexts/GitLabDataContext';
import { SyncButton } from '../SyncButton';
import './SharedToolbar.css';

/**
 * SharedToolbar Props:
 * @param {string} activeView - Current active view ('gantt' | 'kanban')
 * @param {function} onViewChange - Callback when view changes (view: string) => void
 * @param {function} onSettingsClick - Callback when settings button is clicked
 * @param {function} onFilterToggle - Callback when filter toggle button is clicked
 * @param {boolean} showFilter - Whether filter panel is currently visible
 */
export function SharedToolbar({
  activeView,
  onViewChange,
  onSettingsClick,
  onFilterToggle,
  showFilter,
}) {
  // Get data from context
  const {
    configs,
    currentConfig,
    handleQuickSwitch,
    sync,
    syncState,
    filterOptions,
  } = useGitLabData();

  return (
    <div className="shared-toolbar">
      {/* View Switcher - Toggle between Gantt and Kanban */}
      <div className="shared-toolbar-view-switcher">
        <button
          className={`view-switcher-btn ${activeView === 'gantt' ? 'active' : ''}`}
          onClick={() => onViewChange('gantt')}
          title="Gantt View"
        >
          <i className="fas fa-bars-staggered" />
          <span>Gantt</span>
        </button>
        <button
          className={`view-switcher-btn ${activeView === 'kanban' ? 'active' : ''}`}
          onClick={() => onViewChange('kanban')}
          title="Kanban View"
        >
          <i className="fas fa-columns" />
          <span>Kanban</span>
        </button>
      </div>

      {/* Divider */}
      <div className="shared-toolbar-divider" />

      {/* Project Selector Dropdown */}
      <div className="shared-toolbar-project">
        <select
          value={currentConfig?.id || ''}
          onChange={(e) => handleQuickSwitch(e.target.value)}
          className="shared-toolbar-select"
          disabled={!configs || configs.length === 0}
        >
          <option value="">Select Project...</option>
          {configs?.map((config) => (
            <option key={config.id} value={config.id}>
              {config.name}
            </option>
          ))}
        </select>
      </div>

      {/* Settings Button */}
      <button
        onClick={onSettingsClick}
        className="shared-toolbar-btn shared-toolbar-btn-icon"
        title="Settings"
      >
        <i className="fas fa-cog" />
      </button>

      {/* Divider */}
      <div className="shared-toolbar-divider" />

      {/* Sync Button */}
      <SyncButton
        onSync={sync}
        syncState={syncState}
        filterOptions={filterOptions}
      />

      {/* Spacer to push filter toggle to the right */}
      <div className="shared-toolbar-spacer" />

      {/* Filter Toggle Button */}
      <button
        onClick={onFilterToggle}
        className={`shared-toolbar-btn shared-toolbar-btn-filter ${showFilter ? 'active' : ''}`}
        title={showFilter ? 'Hide Filters' : 'Show Filters'}
      >
        <i className="fas fa-filter" />
        <span>Filter</span>
        <i className={`fas fa-chevron-${showFilter ? 'up' : 'down'} chevron-icon`} />
      </button>
    </div>
  );
}
