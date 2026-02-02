// src/components/GitLabWorkspace/GitLabWorkspace.jsx

/**
 * GitLabWorkspace
 *
 * Main container component that wraps Gantt and Kanban views.
 * Provides shared data context and view switching.
 */

import { useState } from 'react';
import { GitLabDataProvider } from '../../contexts/GitLabDataContext';
import { GanttView } from '../GanttView/GanttView';
import { KanbanView } from '../KanbanView/KanbanView';
import { ViewSwitcher } from './ViewSwitcher';
import './GitLabWorkspace.css';

export function GitLabWorkspace({ initialConfigId, autoSync = false }) {
  const [activeView, setActiveView] = useState('gantt'); // 'gantt' | 'kanban'

  return (
    <GitLabDataProvider initialConfigId={initialConfigId} autoSync={autoSync}>
      <div className="gitlab-workspace">
        {/* View Switcher in header area */}
        <div className="gitlab-workspace-header">
          <ViewSwitcher activeView={activeView} onViewChange={setActiveView} />
        </div>

        {/* View Content */}
        <div className="gitlab-workspace-content">
          {activeView === 'gantt' && <GanttView />}
          {activeView === 'kanban' && <KanbanView />}
        </div>
      </div>
    </GitLabDataProvider>
  );
}
