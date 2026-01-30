/**
 * GitLabWorkspace
 *
 * Main container component that wraps Gantt and Kanban views.
 * Provides shared data context and view switching.
 */

import { useState } from 'react';
import { GitLabDataProvider } from '../../contexts/GitLabDataContext';
import { GanttView } from '../GanttView/GanttView';
// import { KanbanView } from '../KanbanView/KanbanView'; // TODO: Phase 2
import './GitLabWorkspace.css';

export function GitLabWorkspace({ initialConfigId, autoSync = false }) {
  const [activeView, setActiveView] = useState('gantt'); // 'gantt' | 'kanban'

  return (
    <GitLabDataProvider initialConfigId={initialConfigId} autoSync={autoSync}>
      <div className="gitlab-workspace">
        {/* View Switcher - TODO: Enable when Kanban is ready */}
        {/* <ViewSwitcher activeView={activeView} onViewChange={setActiveView} /> */}

        {/* View Content */}
        <div className="gitlab-workspace-content">
          {activeView === 'gantt' && <GanttView />}
          {/* {activeView === 'kanban' && <KanbanView />} */}
        </div>
      </div>
    </GitLabDataProvider>
  );
}
