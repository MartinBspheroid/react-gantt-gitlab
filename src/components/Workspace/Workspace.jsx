// src/components/GitLabWorkspace/GitLabWorkspace.jsx

/**
 * GitLabWorkspace
 *
 * Main container component that wraps Gantt and Kanban views.
 * Provides shared data context, toolbar, and view switching.
 *
 * NOTE: SharedToolbar contains view switcher, project selector, sync button,
 * settings button, and filter toggle. These are shared between Gantt and Kanban.
 */

import { useState, useCallback } from 'react';
import { GitLabDataProvider } from '../../contexts/GitLabDataContext';
import { GanttView } from '../GanttView/GanttView';
import { KanbanView } from '../KanbanView/KanbanView';
import { SharedToolbar } from './SharedToolbar';
import { SharedFilterPanel } from './SharedFilterPanel';
import './Workspace.css';

const VIEW_MODE_KEY = 'gitlab-gantt-view-mode';

function getStoredViewMode() {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'gantt' || stored === 'kanban') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return 'gantt'; // default
}

function storeViewMode(mode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // localStorage not available
  }
}

export function Workspace({ initialConfigId, autoSync = false }) {
  const [activeView, setActiveView] = useState(getStoredViewMode); // 'gantt' | 'kanban'
  const [showSettings, setShowSettings] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);

  // Handle view change and persist to localStorage
  const handleViewChange = useCallback((newView) => {
    setActiveView(newView);
    storeViewMode(newView);
  }, []);

  return (
    <GitLabDataProvider initialConfigId={initialConfigId} autoSync={autoSync}>
      <div className="gitlab-workspace">
        {/* Shared Toolbar */}
        <SharedToolbar
          activeView={activeView}
          onViewChange={handleViewChange}
          onSettingsClick={() => setShowSettings(true)}
          showViewOptions={showViewOptions}
          onViewOptionsToggle={() => setShowViewOptions((prev) => !prev)}
        />

        {/* View Options Container - GanttView will render its controls here via portal */}
        <div id="view-options-container" />

        {/* Shared Filter Panel */}
        <SharedFilterPanel />

        {/* View Content */}
        <div className="gitlab-workspace-content">
          {activeView === 'gantt' && (
            <GanttView
              hideSharedToolbar={true}
              showSettings={showSettings}
              onSettingsClose={() => setShowSettings(false)}
              externalShowViewOptions={showViewOptions}
            />
          )}
          {activeView === 'kanban' && (
            <KanbanView
              showSettings={showSettings}
              onSettingsClose={() => setShowSettings(false)}
            />
          )}
        </div>
      </div>
    </GitLabDataProvider>
  );
}
