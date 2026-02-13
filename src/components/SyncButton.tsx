// @ts-nocheck
/**
 * Sync Button Component
 * Manual sync button with loading state and last sync time display
 */

import React from 'react';
import { useState } from 'react';
import { Icon } from './common/Icon';
import { SyncIcon } from './common/icons';
import './SyncButton.css';

export function SyncButton({ onSync, syncState, filterOptions }) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSync = async () => {
    setIsAnimating(true);
    try {
      await onSync(filterOptions);
    } finally {
      setTimeout(() => setIsAnimating(false), 500);
    }
  };

  const formatLastSyncTime = (lastSyncTime) => {
    if (!lastSyncTime) {
      return 'Never';
    }

    const now = new Date();
    const diff = now - lastSyncTime;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) {
      return `${seconds}s ago`;
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return lastSyncTime.toLocaleDateString();
    }
  };

  return (
    <div className="sync-button">
      <button
        onClick={handleSync}
        disabled={syncState.isSyncing || syncState.isLoading}
        className={`sync-btn ${isAnimating ? 'animating' : ''}`}
        title="Sync data"
      >
        <Icon
          type="svg"
          svg={<SyncIcon size={14} />}
          size={14}
          className="sync-icon"
        />
        {syncState.isSyncing
          ? syncState.progress?.message || 'Syncing...'
          : 'Sync'}
      </button>

      <div className="sync-info">
        {syncState.error && (
          <div className="sync-error" title={syncState.error}>
            Sync failed
          </div>
        )}
        {!syncState.error && syncState.lastSyncTime && (
          <div
            className="sync-time"
            title={syncState.lastSyncTime?.toLocaleString()}
          >
            Last sync: {formatLastSyncTime(syncState.lastSyncTime)}
          </div>
        )}
      </div>
    </div>
  );
}
