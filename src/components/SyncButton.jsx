/**
 * Sync Button Component
 * Manual sync button with loading state and last sync time display
 */

import { useState } from 'react';

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
    <div className="gitlab-sync-button">
      <button
        onClick={handleSync}
        disabled={syncState.isSyncing || syncState.isLoading}
        className={`sync-btn ${isAnimating ? 'animating' : ''}`}
        title="Sync with GitLab"
      >
        <svg
          className="sync-icon"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" />
        </svg>
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

      <style>{`
        .gitlab-sync-button {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .sync-btn {
          height: 24px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0 8px;
          background: #1f75cb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
          font-weight: 500;
          box-sizing: border-box;
        }

        .sync-btn:hover:not(:disabled) {
          background: #1662b0;
        }

        .sync-btn:disabled {
          background: #9db8d4;
          cursor: not-allowed;
        }

        .sync-icon {
          display: block;
        }

        .sync-btn.animating .sync-icon {
          animation: spin 0.5s linear;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .sync-info {
          font-size: 11px;
          color: var(--wx-gitlab-control-text);
        }

        .sync-time {
          color: var(--wx-gitlab-control-text);
        }

        .sync-error {
          color: #dc3545;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
