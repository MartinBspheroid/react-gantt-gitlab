/**
 * SyncButton Component Tests
 * Tests for the sync button component including progress display,
 * animation state, disabled state, and accessibility.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncButton } from '../SyncButton';

const defaultSyncState = {
  isLoading: false,
  isSyncing: false,
  error: null,
  lastSyncTime: null,
  progress: null,
};

describe('SyncButton', () => {
  let mockSync;

  beforeEach(() => {
    mockSync = vi.fn().mockResolvedValue(undefined);
  });

  // --- Existing tests (kept) ---

  it('should render sync button', () => {
    render(<SyncButton onSync={mockSync} syncState={defaultSyncState} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should call onSync when clicked', async () => {
    render(<SyncButton onSync={mockSync} syncState={defaultSyncState} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSync).toHaveBeenCalledTimes(1);
    });
  });

  it('should show loading state during sync', () => {
    const { rerender } = render(
      <SyncButton onSync={mockSync} syncState={defaultSyncState} />,
    );

    expect(screen.getByRole('button')).not.toBeDisabled();

    // Update to syncing state
    rerender(
      <SyncButton
        onSync={mockSync}
        syncState={{
          ...defaultSyncState,
          isSyncing: true,
        }}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should display error message when sync fails', () => {
    const errorMessage = 'Connection failed';

    render(
      <SyncButton
        onSync={mockSync}
        syncState={{
          ...defaultSyncState,
          error: errorMessage,
        }}
      />,
    );

    const errorEl = screen.getByText('Sync failed');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveAttribute('title', errorMessage);
  });

  // --- New tests: Progress display ---

  it('should show progress message text during sync', () => {
    render(
      <SyncButton
        onSync={mockSync}
        syncState={{
          ...defaultSyncState,
          isSyncing: true,
          progress: { message: 'Fetching issues...' },
        }}
      />,
    );

    expect(screen.getByText('Fetching issues...')).toBeInTheDocument();
  });

  it('should show default "Syncing..." when no progress message provided', () => {
    render(
      <SyncButton
        onSync={mockSync}
        syncState={{
          ...defaultSyncState,
          isSyncing: true,
          progress: null,
        }}
      />,
    );

    expect(screen.getByText('Syncing...')).toBeInTheDocument();
  });

  it('should show "Sync" text when not syncing', () => {
    render(<SyncButton onSync={mockSync} syncState={defaultSyncState} />);

    expect(screen.getByText('Sync')).toBeInTheDocument();
  });

  // --- New tests: Animation and accessibility ---

  it('should add animating class when sync is triggered', async () => {
    render(<SyncButton onSync={mockSync} syncState={defaultSyncState} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button.className).toContain('animating');
    });
  });

  it('should be disabled when isLoading is true', () => {
    render(
      <SyncButton
        onSync={mockSync}
        syncState={{
          ...defaultSyncState,
          isLoading: true,
        }}
      />,
    );

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should have title attribute for accessibility', () => {
    render(<SyncButton onSync={mockSync} syncState={defaultSyncState} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Sync data');
  });

  // --- New tests: Last sync time display ---

  it('should show last sync time when available', () => {
    const recentTime = new Date(Date.now() - 30000); // 30 seconds ago

    render(
      <SyncButton
        onSync={mockSync}
        syncState={{
          ...defaultSyncState,
          lastSyncTime: recentTime,
        }}
      />,
    );

    expect(screen.getByText(/Last sync:/)).toBeInTheDocument();
    expect(screen.getByText(/30s ago/)).toBeInTheDocument();
  });

  it('should pass filterOptions to onSync', async () => {
    const filterOpts = { labels: ['bug'], milestones: ['v1.0'] };

    render(
      <SyncButton
        onSync={mockSync}
        syncState={defaultSyncState}
        filterOptions={filterOpts}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockSync).toHaveBeenCalledWith(filterOpts);
    });
  });
});
