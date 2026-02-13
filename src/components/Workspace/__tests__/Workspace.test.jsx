/**
 * Workspace Component Tests
 * Tests for view switching, toolbar rendering, filter panel, and settings toggle.
 *
 * The Workspace component wraps everything in DataProvider which uses
 * useData context heavily. We mock the entire context module to isolate
 * the Workspace behavior.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the DataContext module to avoid real provider initialization
const mockUseData = vi.fn();
vi.mock('../../../contexts/DataContext', () => ({
  DataProvider: ({ children }) =>
    React.createElement('div', { 'data-testid': 'data-provider' }, children),
  useData: () => mockUseData(),
}));

// Mock GanttView and KanbanView since they are heavy components
vi.mock('../../GanttView/GanttView', () => ({
  GanttView: (props) =>
    React.createElement('div', {
      'data-testid': 'gantt-view',
      'data-hide-toolbar': props.hideSharedToolbar,
    }),
}));

vi.mock('../../KanbanView/KanbanView', () => ({
  KanbanView: (_props) =>
    React.createElement('div', { 'data-testid': 'kanban-view' }),
}));

// Mock CSS import
vi.mock('../Workspace.css', () => ({}));
vi.mock('../SharedToolbar.css', () => ({}));

import { Workspace } from '../Workspace';

// Default mock context value
const defaultContextValue = {
  configs: [
    { id: 'proj-1', name: 'Project Alpha' },
    { id: 'proj-2', name: 'Project Beta' },
  ],
  currentConfig: { id: 'proj-1', name: 'Project Alpha' },
  handleQuickSwitch: vi.fn(),
  sync: vi.fn(),
  syncState: {
    isLoading: false,
    isSyncing: false,
    error: null,
    lastSyncTime: null,
    progress: null,
  },
  filterOptions: {},
  tasks: [],
  milestones: [],
  epics: [],
  serverFilterOptions: null,
  serverFilterOptionsLoading: false,
  activeServerFilters: null,
  filterPresets: [],
  presetsLoading: false,
  presetsSaving: false,
  createNewPreset: vi.fn(),
  updatePreset: vi.fn(),
  renamePreset: vi.fn(),
  deletePreset: vi.fn(),
  lastUsedPresetId: null,
  filterDirty: false,
  handlePresetSelect: vi.fn(),
  handleFilterChange: vi.fn(),
  handleServerFilterApply: vi.fn(),
  canEditHolidays: false,
};

describe('Workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseData.mockReturnValue(defaultContextValue);
    // Reset localStorage mock to return 'gantt' by default
    localStorage.getItem.mockReturnValue('gantt');
  });

  // --- Rendering tests ---

  it('should render inside a data provider wrapper', () => {
    render(<Workspace initialConfigId="proj-1" />);

    expect(screen.getByTestId('data-provider')).toBeInTheDocument();
  });

  it('should render the shared toolbar with view switcher buttons', () => {
    render(<Workspace initialConfigId="proj-1" />);

    expect(screen.getByText('Gantt')).toBeInTheDocument();
    expect(screen.getByText('Kanban')).toBeInTheDocument();
  });

  it('should render project selector in toolbar', () => {
    render(<Workspace initialConfigId="proj-1" />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('should render the filter panel', () => {
    render(<Workspace initialConfigId="proj-1" />);

    // FilterPanel renders a "Filters" toggle button
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  // --- View switching tests ---

  it('should default to gantt view', () => {
    render(<Workspace initialConfigId="proj-1" />);

    expect(screen.getByTestId('gantt-view')).toBeInTheDocument();
    expect(screen.queryByTestId('kanban-view')).not.toBeInTheDocument();
  });

  it('should switch to kanban view when Kanban button is clicked', () => {
    render(<Workspace initialConfigId="proj-1" />);

    const kanbanBtn = screen.getByText('Kanban').closest('button');
    fireEvent.click(kanbanBtn);

    expect(screen.queryByTestId('gantt-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('kanban-view')).toBeInTheDocument();
  });

  it('should switch back to gantt view from kanban', () => {
    render(<Workspace initialConfigId="proj-1" />);

    // Switch to kanban
    const kanbanBtn = screen.getByText('Kanban').closest('button');
    fireEvent.click(kanbanBtn);
    expect(screen.getByTestId('kanban-view')).toBeInTheDocument();

    // Switch back to gantt
    const ganttBtn = screen.getByText('Gantt').closest('button');
    fireEvent.click(ganttBtn);
    expect(screen.getByTestId('gantt-view')).toBeInTheDocument();
  });

  it('should persist view mode to localStorage on switch', () => {
    render(<Workspace initialConfigId="proj-1" />);

    const kanbanBtn = screen.getByText('Kanban').closest('button');
    fireEvent.click(kanbanBtn);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'gantt-view-mode',
      'kanban',
    );
  });

  it('should restore view mode from localStorage', () => {
    localStorage.getItem.mockReturnValue('kanban');

    render(<Workspace initialConfigId="proj-1" />);

    expect(screen.queryByTestId('gantt-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('kanban-view')).toBeInTheDocument();
  });

  // --- Settings/view options toggle ---

  it('should show view options toggle button only in gantt view', () => {
    render(<Workspace initialConfigId="proj-1" />);

    // In gantt view, the View Options button should exist
    const viewOptionsBtn = screen.getByTitle('View Options');
    expect(viewOptionsBtn).toBeInTheDocument();

    // Switch to kanban - view options should disappear
    const kanbanBtn = screen.getByText('Kanban').closest('button');
    fireEvent.click(kanbanBtn);

    expect(screen.queryByTitle('View Options')).not.toBeInTheDocument();
  });
});
