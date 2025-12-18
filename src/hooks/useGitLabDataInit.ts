/**
 * useGitLabDataInit Hook
 * Manages GitLab data initialization with preset-aware sync flow
 * Extracted from GitLabGantt for reuse in WorkloadView
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGitLabSync } from './useGitLabSync';
import { GitLabGraphQLProvider } from '../providers/GitLabGraphQLProvider';
import { toGitLabServerFilters } from '../utils/GitLabFilters';
import type { GitLabServerFilters, GitLabSyncOptions } from '../types/gitlab';
import type { FilterPreset } from '../types/filterPreset';
import type { ITask, ILink } from '@svar-ui/gantt-store';

export interface GitLabFilterOptionsData {
  labels: Array<{ title: string; color: string }>;
  milestones: Array<{ id: number; iid: number; title: string }>;
  members: Array<{ username: string; name: string }>;
}

export interface UseGitLabDataInitOptions {
  provider: GitLabGraphQLProvider | null;
  /** Proxy config for API calls - required for presets to work */
  proxyConfig: { gitlabUrl: string; token: string; isDev: boolean } | null;
  /** Config version - used to track config changes and wait for preset reload */
  configVersion: number;
  /** Filter presets from useFilterPresets hook */
  filterPresets?: FilterPreset[];
  /** Whether presets are loading */
  presetsLoading?: boolean;
  /** Config type ('project' or 'group') */
  configType?: 'project' | 'group';
  /** Project ID (for project type) */
  projectId?: string;
  /** Group ID (for group type) */
  groupId?: string;
}

export interface UseGitLabDataInitReturn {
  // Tasks and links from sync
  tasks: ITask[];
  links: ILink[];
  // Sync state
  syncState: {
    isLoading: boolean;
    isSyncing: boolean;
    error: string | null;
    lastSyncTime: Date | null;
  };
  // Sync functions
  sync: (options?: GitLabSyncOptions) => Promise<void>;
  syncTask: (id: number | string, updates: Partial<ITask>) => Promise<void>;
  createTask: (task: Partial<ITask>) => Promise<ITask>;
  deleteTask: (id: number | string) => Promise<void>;
  createLink: (link: Partial<ILink>) => Promise<void>;
  deleteLink: (
    linkId: number | string,
    sourceId: number | string,
  ) => Promise<void>;
  // Server filter options (labels, milestones, members)
  serverFilterOptions: GitLabFilterOptionsData | null;
  serverFilterOptionsLoading: boolean;
  // Active server filters (currently applied)
  activeServerFilters: GitLabServerFilters | null;
  setActiveServerFilters: (filters: GitLabServerFilters | null) => void;
  // Preset management
  lastUsedPresetId: string | null;
  setLastUsedPresetId: (id: string | null) => void;
  getPresetStorageKey: () => string | null;
}

export function useGitLabDataInit(
  options: UseGitLabDataInitOptions,
): UseGitLabDataInitReturn {
  const {
    provider,
    proxyConfig,
    configVersion,
    filterPresets = [],
    presetsLoading = false,
    configType = 'project',
    projectId,
    groupId,
  } = options;

  // Server filter options (labels, milestones, members from GitLab)
  const [serverFilterOptions, setServerFilterOptions] =
    useState<GitLabFilterOptionsData | null>(null);
  const [serverFilterOptionsLoading, setServerFilterOptionsLoading] =
    useState(false);

  // Active server filters (applied to API calls)
  const [activeServerFilters, setActiveServerFilters] =
    useState<GitLabServerFilters | null>(null);

  // Last used preset ID
  const [lastUsedPresetId, setLastUsedPresetId] = useState<string | null>(null);

  // Use sync hook (no auto-sync - we control initial sync timing)
  const {
    tasks,
    links,
    syncState,
    sync: baseSync,
    syncTask,
    createTask,
    deleteTask,
    createLink,
    deleteLink,
  } = useGitLabSync(provider, false, 60000);

  // Generate localStorage key for last used preset
  const getPresetStorageKey = useCallback(() => {
    if (configType === 'project' && projectId) {
      return `gitlab-gantt-preset-project-${projectId}`;
    } else if (configType === 'group' && groupId) {
      return `gitlab-gantt-preset-group-${groupId}`;
    }
    return null;
  }, [configType, projectId, groupId]);

  // Load last used preset ID from localStorage when config changes
  useEffect(() => {
    const key = getPresetStorageKey();
    if (key) {
      const savedId = localStorage.getItem(key);
      setLastUsedPresetId(savedId);
    } else {
      setLastUsedPresetId(null);
    }
  }, [getPresetStorageKey]);

  // Save preset ID when it changes
  const handleSetLastUsedPresetId = useCallback(
    (presetId: string | null) => {
      const key = getPresetStorageKey();
      if (key) {
        if (presetId) {
          localStorage.setItem(key, presetId);
        } else {
          localStorage.removeItem(key);
        }
      }
      setLastUsedPresetId(presetId);
    },
    [getPresetStorageKey],
  );

  // Wrapped sync function that automatically applies activeServerFilters
  const sync = useCallback(
    async (syncOptions?: GitLabSyncOptions) => {
      // Merge activeServerFilters with provided options
      const mergedOptions: GitLabSyncOptions = {
        ...syncOptions,
        serverFilters:
          syncOptions?.serverFilters || activeServerFilters || undefined,
      };
      await baseSync(mergedOptions);
    },
    [baseSync, activeServerFilters],
  );

  // Load server filter options when provider changes
  useEffect(() => {
    if (!provider) {
      setServerFilterOptions(null);
      return;
    }

    const loadFilterOptions = async () => {
      setServerFilterOptionsLoading(true);
      try {
        const options = await provider.getFilterOptions();
        setServerFilterOptions(options);
      } catch (error) {
        console.error(
          '[useGitLabDataInit] Failed to load filter options:',
          error,
        );
        setServerFilterOptions(null);
      } finally {
        setServerFilterOptionsLoading(false);
      }
    };

    loadFilterOptions();
  }, [provider]);

  // Track if initial sync has been done for current provider
  const initialSyncDoneRef = useRef(false);
  const presetsLoadedForVersionRef = useRef(-1);

  // Reset initial sync flag when provider changes
  useEffect(() => {
    initialSyncDoneRef.current = false;
    // Clear server filters when provider changes
    setActiveServerFilters(null);
  }, [provider]);

  // Track presetsLoading transitions to detect when presets finish loading
  const prevPresetsLoadingRef = useRef(presetsLoading);
  useEffect(() => {
    const wasLoading = prevPresetsLoadingRef.current;
    const isNowNotLoading = !presetsLoading;

    if (wasLoading && isNowNotLoading && proxyConfig) {
      presetsLoadedForVersionRef.current = configVersion;
    }

    prevPresetsLoadingRef.current = presetsLoading;
  }, [presetsLoading, proxyConfig, configVersion]);

  // Trigger initial sync after presets are loaded
  useEffect(() => {
    // Skip if not ready or already synced
    if (
      !provider ||
      presetsLoading ||
      !proxyConfig ||
      initialSyncDoneRef.current
    ) {
      return;
    }

    // Wait until presets have been loaded for the current config version
    if (presetsLoadedForVersionRef.current !== configVersion) {
      return;
    }

    initialSyncDoneRef.current = true;

    // Read preset ID directly from localStorage
    const presetStorageKey = getPresetStorageKey();
    const savedPresetId = presetStorageKey
      ? localStorage.getItem(presetStorageKey)
      : null;

    // Check if we have a saved preset with server filters
    if (savedPresetId && filterPresets.length > 0) {
      const savedPreset = filterPresets.find((p) => p.id === savedPresetId);
      if (
        savedPreset?.filters?.filterType === 'server' &&
        savedPreset?.filters?.serverFilters
      ) {
        const gitlabFilters = toGitLabServerFilters(
          savedPreset.filters.serverFilters,
        );
        if (gitlabFilters) {
          setActiveServerFilters(gitlabFilters);
          setLastUsedPresetId(savedPresetId);
          baseSync({ serverFilters: gitlabFilters });
          return;
        }
      }
    }

    // No saved server preset - sync without filters
    baseSync();
  }, [
    provider,
    presetsLoading,
    proxyConfig,
    filterPresets,
    baseSync,
    getPresetStorageKey,
    configVersion,
  ]);

  return {
    tasks,
    links,
    syncState,
    sync,
    syncTask,
    createTask,
    deleteTask,
    createLink,
    deleteLink,
    serverFilterOptions,
    serverFilterOptionsLoading,
    activeServerFilters,
    setActiveServerFilters,
    lastUsedPresetId,
    setLastUsedPresetId: handleSetLastUsedPresetId,
    getPresetStorageKey,
  };
}
