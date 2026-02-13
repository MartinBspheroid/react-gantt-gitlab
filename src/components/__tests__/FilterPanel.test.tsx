// @ts-nocheck
/**
 * FilterPanel Component Tests
 * Tests for tab switching, client filter selection, clear/reset, and callbacks.
 *
 * FilterPanel is a complex component with client/server tab switching,
 * multiple FilterMultiSelect sub-components, preset management, and search.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPanel } from '../FilterPanel';

// Mock the FilterPresetSelector to simplify tests - it has its own complex UI
vi.mock('../FilterPresetSelector', () => ({
  FilterPresetSelector: () => <div data-testid="preset-selector" />,
}));

// Mock the projectSettings helpers
vi.mock('../../types/projectSettings', () => ({
  presetHasServerFilters: vi.fn(() => false),
  presetHasClientFilters: vi.fn(() => false),
}));

// Sample data for tests
const sampleMilestones = [
  { iid: 1, title: 'Sprint 1' },
  { iid: 2, title: 'Sprint 2' },
  { iid: 3, title: 'Sprint 3' },
];

const sampleEpics = [
  { id: 101, title: 'Epic Alpha' },
  { id: 102, title: 'Epic Beta' },
];

const sampleTasks = [
  {
    id: 't1',
    text: 'Task 1',
    labels: ['bug', 'urgent'],
    milestoneIid: 1,
    assignees: ['Alice'],
    state: 'opened',
  },
  {
    id: 't2',
    text: 'Task 2',
    labels: ['feature'],
    milestoneIid: 2,
    assignees: ['Bob'],
    state: 'opened',
  },
  {
    id: 't3',
    text: 'Task 3',
    labels: ['bug'],
    milestoneIid: 1,
    assignees: ['Alice', 'Charlie'],
    state: 'closed',
  },
];

const defaultProps = {
  milestones: sampleMilestones,
  epics: sampleEpics,
  tasks: sampleTasks,
  onFilterChange: vi.fn(),
  initialFilters: {},
  presets: [],
  presetsLoading: false,
  presetsSaving: false,
  canEditPresets: false,
  onPresetSelect: vi.fn(),
  isGroupMode: false,
  filterOptions: null,
  filterOptionsLoading: false,
  serverFilters: null,
  onServerFilterApply: vi.fn(),
  isDirty: false,
};

describe('FilterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering and expand/collapse ---

  it('should render the filter toggle button', () => {
    render(<FilterPanel {...defaultProps} />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('should be collapsed by default', () => {
    render(<FilterPanel {...defaultProps} />);

    // When collapsed, client/server tabs should not be visible
    expect(screen.queryByText('Client')).not.toBeInTheDocument();
    expect(screen.queryByText('Server')).not.toBeInTheDocument();
  });

  it('should expand when filter toggle is clicked', () => {
    render(<FilterPanel {...defaultProps} />);

    const toggle = screen.getByText('Filters');
    fireEvent.click(toggle);

    // After expanding, tabs should be visible
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Server')).toBeInTheDocument();
  });

  // --- Tab switching ---

  it('should default to client tab when expanded', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    // Client tab should be active (has 'active' class)
    const clientTab = screen.getByText('Client').closest('button');
    expect(clientTab.className).toContain('active');

    // Search input for client filters should be visible
    expect(
      screen.getByPlaceholderText(
        'Search tasks by title, description, labels...',
      ),
    ).toBeInTheDocument();
  });

  it('should switch to server tab when clicked', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    const serverTab = screen.getByText('Server').closest('button');
    fireEvent.click(serverTab);

    // Server tab should now be active
    expect(serverTab.className).toContain('active');

    // Server-specific content should appear (Apply button)
    expect(screen.getByText('No Changes')).toBeInTheDocument();
  });

  it('should show tab description text for client tab', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    expect(
      screen.getByText(/Filters applied locally to fetched data/),
    ).toBeInTheDocument();
  });

  it('should show tab description text for server tab', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByText('Server').closest('button'));

    expect(
      screen.getByText(/Filters applied when fetching from data source/),
    ).toBeInTheDocument();
  });

  // --- Client filter sections rendering ---

  it('should render milestone filter section in client tab', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    expect(screen.getByText(/Milestones \(OR\)/)).toBeInTheDocument();
  });

  it('should render epic filter section in client tab', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    expect(screen.getByText(/Epics \(OR\)/)).toBeInTheDocument();
  });

  it('should render label filter section in client tab', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    expect(screen.getByText(/Labels \(OR\)/)).toBeInTheDocument();
  });

  it('should render assignee filter section in client tab', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    expect(screen.getByText(/Assignees \(OR\)/)).toBeInTheDocument();
  });

  // --- Client filter selection ---

  it('should render milestone options including None option', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    expect(screen.getByText('None (No Milestone)')).toBeInTheDocument();
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
    expect(screen.getByText('Sprint 3')).toBeInTheDocument();
  });

  it('should call onFilterChange when a milestone checkbox is toggled', () => {
    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    // Find the Sprint 1 checkbox
    const sprint1Label = screen.getByText('Sprint 1');
    const checkbox = sprint1Label
      .closest('label')
      .querySelector('input[type="checkbox"]');

    fireEvent.click(checkbox);

    expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        milestoneIds: [1],
      }),
      true,
    );
  });

  it('should update search input and trigger filter change', async () => {
    const user = userEvent.setup();

    render(<FilterPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Filters'));

    const searchInput = screen.getByPlaceholderText(
      'Search tasks by title, description, labels...',
    );
    await user.type(searchInput, 'hello');

    // onFilterChange should have been called with the search value
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('h'),
      }),
      true,
    );
  });

  // --- Clear/Reset functionality ---

  it('should show Clear Client button when client filters are active', () => {
    render(
      <FilterPanel
        {...defaultProps}
        initialFilters={{
          milestoneIds: [1],
          epicIds: [],
          labels: [],
          assignees: [],
          states: [],
          search: '',
        }}
      />,
    );

    expect(screen.getByText(/Clear Client/)).toBeInTheDocument();
  });

  it('should clear client filters when Clear Client button is clicked', () => {
    render(
      <FilterPanel
        {...defaultProps}
        initialFilters={{
          milestoneIds: [1],
          epicIds: [],
          labels: [],
          assignees: [],
          states: [],
          search: '',
        }}
      />,
    );

    const clearBtn = screen.getByText(/Clear Client/);
    fireEvent.click(clearBtn);

    expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
      {
        milestoneIds: [],
        epicIds: [],
        labels: [],
        assignees: [],
        states: [],
        search: '',
      },
      true,
    );
  });

  it('should not show Clear Client button when no client filters are active', () => {
    render(<FilterPanel {...defaultProps} />);

    expect(screen.queryByText(/Clear Client/)).not.toBeInTheDocument();
  });

  // --- Server tab content ---

  it('should show loading state on server tab when filterOptionsLoading is true', () => {
    render(<FilterPanel {...defaultProps} filterOptionsLoading={true} />);

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByText('Server').closest('button'));

    expect(screen.getByText('Loading filter options...')).toBeInTheDocument();
  });

  it('should show server filter sections with filterOptions data', () => {
    render(
      <FilterPanel
        {...defaultProps}
        filterOptions={{
          labels: [
            { title: 'bug', color: '#d73a4a' },
            { title: 'enhancement', color: '#a2eeef' },
          ],
          milestones: [{ iid: 1, title: 'v1.0' }],
          members: [{ username: 'jdoe', name: 'John Doe' }],
        }}
      />,
    );

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByText('Server').closest('button'));

    // Server tab should show Labels (AND), Milestones (OR), Assignees (AND)
    expect(screen.getByText(/Labels \(AND\)/)).toBeInTheDocument();
    // There are multiple "Milestones (OR)" entries, the server one should be visible
    expect(screen.getByText(/Assignees \(AND\)/)).toBeInTheDocument();
    expect(screen.getByText('Created Date Range')).toBeInTheDocument();
  });

  it('should disable Apply button when no server filter changes have been made', () => {
    render(
      <FilterPanel
        {...defaultProps}
        filterOptions={{
          labels: [],
          milestones: [],
          members: [],
        }}
      />,
    );

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByText('Server').closest('button'));

    const applyBtn = screen.getByText('No Changes');
    expect(applyBtn).toBeDisabled();
  });
});
