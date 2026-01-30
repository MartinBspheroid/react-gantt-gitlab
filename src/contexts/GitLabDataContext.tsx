import { createContext, useContext, type ReactNode } from 'react';
import type { GitLabDataContextValue } from './GitLabDataContext.types';

/**
 * GitLabDataContext
 *
 * Shared context for GitLab data between Gantt and Kanban views.
 * Provides access to tasks, links, sync operations, and filter state.
 */
const GitLabDataContext = createContext<GitLabDataContextValue | null>(null);

/**
 * Hook to access GitLab data context
 * @throws Error if used outside of GitLabDataProvider
 */
export function useGitLabData(): GitLabDataContextValue {
  const context = useContext(GitLabDataContext);
  if (!context) {
    throw new Error('useGitLabData must be used within a GitLabDataProvider');
  }
  return context;
}

/**
 * Hook to optionally access GitLab data context
 * Returns null if used outside of GitLabDataProvider (no error)
 */
export function useGitLabDataOptional(): GitLabDataContextValue | null {
  return useContext(GitLabDataContext);
}

export interface GitLabDataProviderProps {
  children: ReactNode;
  /** Initial config ID to load */
  initialConfigId?: string;
  /** Whether to auto-sync on mount */
  autoSync?: boolean;
}

/**
 * GitLabDataProvider
 *
 * Provider component that manages GitLab data state and exposes it via context.
 * This will be implemented in Task 4.
 */
export function GitLabDataProvider({
  children,
  initialConfigId,
  autoSync = false,
}: GitLabDataProviderProps) {
  // TODO: Implementation will be added in Task 4
  // For now, throw to indicate incomplete implementation
  throw new Error(
    'GitLabDataProvider is not yet implemented. ' +
      'This is a placeholder for the shared data layer.',
  );
}

export { GitLabDataContext };
export type { GitLabDataContextValue };
