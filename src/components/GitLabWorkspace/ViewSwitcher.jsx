// src/components/GitLabWorkspace/ViewSwitcher.jsx

/**
 * ViewSwitcher
 *
 * Toggle between Gantt and Kanban views.
 */

import './ViewSwitcher.css';

export function ViewSwitcher({ activeView, onViewChange }) {
  return (
    <div className="view-switcher">
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
  );
}
