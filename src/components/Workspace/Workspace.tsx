// @ts-nocheck
// src/components/Workspace/Workspace.jsx

/**
 * Workspace
 *
 * Main container component that wraps Gantt and Kanban views.
 * Provides shared data context, toolbar, and view switching.
 */

import React, { useState, useCallback, useRef } from 'react';
import { DataProvider } from '../../contexts/DataContext';
import { GanttView } from '../GanttView/GanttView';
import { KanbanView } from '../KanbanView/KanbanView';
import { SharedToolbar } from './SharedToolbar';
import { SharedFilterPanel } from './SharedFilterPanel';
import { cn } from '../../utils/cn';
import './Workspace.css';

const VIEW_MODE_KEY = 'gantt-view-mode';

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

export function Workspace({ provider, autoSync = true, className }) {
  const [activeView, setActiveView] = useState(getStoredViewMode); // 'gantt' | 'kanban'
  const [showSettings, setShowSettings] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);

  // Refs for child components
  const filterSearchInputRef = useRef(null);
  const viewOptionsContainerRef = useRef(null);

  // Handle view change and persist to localStorage
  const handleViewChange = useCallback((newView) => {
    setActiveView(newView);
    storeViewMode(newView);
  }, []);

  return (
    <DataProvider provider={provider} autoSync={autoSync}>
      <div className={cn('gantt-workspace', className)}>
        {/* Shared Toolbar */}
        <SharedToolbar
          activeView={activeView}
          onViewChange={handleViewChange}
          onSettingsClick={() => setShowSettings(true)}
          showViewOptions={showViewOptions}
          onViewOptionsToggle={() => setShowViewOptions((prev) => !prev)}
        />

        {/* View Options Container - GanttView will render its controls here via portal */}
        <div ref={viewOptionsContainerRef} />

        {/* Shared Filter Panel */}
        <SharedFilterPanel ref={filterSearchInputRef} />

        {/* View Content */}
        <main className="gantt-workspace-content">
          {activeView === 'gantt' && (
            <GanttView
              hideSharedToolbar={true}
              showSettings={showSettings}
              onSettingsClose={() => setShowSettings(false)}
              externalShowViewOptions={showViewOptions}
              filterSearchInputRef={filterSearchInputRef}
              viewOptionsContainerRef={viewOptionsContainerRef}
            />
          )}
          {activeView === 'kanban' && (
            <KanbanView
              showSettings={showSettings}
              onSettingsClose={() => setShowSettings(false)}
            />
          )}
        </main>
      </div>
    </DataProvider>
  );
}
