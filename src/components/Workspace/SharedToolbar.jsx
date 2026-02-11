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
 * @param {boolean} showViewOptions - Whether view options panel is visible
 * @param {function} onViewOptionsToggle - Callback when view options button is clicked
 * @param {boolean} readonly - Whether the chart is in readonly mode
 * @param {function} onReadonlyToggle - Callback when readonly toggle is clicked
 */
export function SharedToolbar({
  activeView,
  onViewChange,
  onSettingsClick,
  showViewOptions,
  onViewOptionsToggle,
  readonly = false,
  onReadonlyToggle,
}) {
  // Get data from context
  const {
    configs,
    currentConfig,
    handleQuickSwitch,
    sync,
    syncState,
    filterOptions,
    tasks,
  } = useGitLabData();

  // Calculate stats from tasks
  const stats = {
    total: tasks?.length || 0,
    completed:
      tasks?.filter((t) => t.progress === 100 || t._gitlab?.state === 'closed')
        .length || 0,
    inProgress:
      tasks?.filter((t) => t.progress > 0 && t.progress < 100).length || 0,
    notStarted:
      tasks?.filter((t) => t.progress === 0 && t._gitlab?.state !== 'closed')
        .length || 0,
    overdue:
      tasks?.filter((t) => {
        if (!t.end || t._gitlab?.state === 'closed') return false;
        return new Date(t.end) < new Date();
      }).length || 0,
  };

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

      {/* Readonly Toggle Button */}
      <button
        onClick={onReadonlyToggle}
        className={`shared-toolbar-btn shared-toolbar-btn-icon ${readonly ? 'active' : ''}`}
        title={readonly ? 'Switch to Edit Mode' : 'Switch to Read-Only Mode'}
      >
        <i className={`fas ${readonly ? 'fa-eye' : 'fa-edit'}`} />
      </button>

      {/* Readonly Mode Indicator */}
      {readonly && (
        <span className="readonly-badge">
          <i className="fas fa-lock" />
          <span>Read Only</span>
        </span>
      )}

      {/* View Options Toggle - Only for Gantt view, before Sync */}
      {activeView === 'gantt' && (
        <>
          <div className="shared-toolbar-divider" />
          <button
            onClick={onViewOptionsToggle}
            className={`shared-toolbar-btn shared-toolbar-btn-icon ${showViewOptions ? 'active' : ''}`}
            title="View Options"
          >
            <i className="fas fa-sliders-h" />
            <i
              className={`fas fa-chevron-${showViewOptions ? 'up' : 'down'} chevron-icon`}
            />
          </button>
        </>
      )}

      {/* Divider */}
      <div className="shared-toolbar-divider" />

      {/* Sync Button */}
      <SyncButton
        onSync={sync}
        syncState={syncState}
        filterOptions={filterOptions}
      />

      {/* Spacer to push stats to the right */}
      <div className="shared-toolbar-spacer" />

      {/* Stats Panel */}
      <div className="shared-toolbar-stats">
        <span className="stat-item">
          <span className="stat-label">Total:</span>
          <span className="stat-value">{stats.total}</span>
        </span>
        <span className="stat-item">
          <span className="stat-label">Done:</span>
          <span className="stat-value stat-completed">{stats.completed}</span>
        </span>
        <span className="stat-item">
          <span className="stat-label">In Progress:</span>
          <span className="stat-value stat-progress">{stats.inProgress}</span>
        </span>
        {stats.overdue > 0 && (
          <span className="stat-item">
            <span className="stat-label">Overdue:</span>
            <span className="stat-value stat-overdue">{stats.overdue}</span>
          </span>
        )}
      </div>
    </div>
  );
}
