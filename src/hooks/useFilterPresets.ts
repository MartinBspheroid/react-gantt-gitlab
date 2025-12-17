/**
 * React Hook for managing GitLab-stored filter presets
 * Handles loading, saving, and CRUD operations for filter presets
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadFilterPresets,
  saveFilterPresets,
  createPreset,
} from '../providers/GitLabFilterPresetsApi';
import type { GitLabProxyConfig } from '../providers/GitLabApiUtils';
import type { FilterPreset, FilterPresetsConfig } from '../types/filterPreset';
import type { FilterOptions } from '../utils/GitLabFilters';

export interface UseFilterPresetsResult {
  /** Array of saved presets */
  presets: FilterPreset[];
  /** Whether data is loading */
  loading: boolean;
  /** Whether data is saving */
  saving: boolean;
  /** Error message if any */
  error: string | null;
  /** Create a new preset with current filters */
  createNewPreset: (name: string, filters: FilterOptions) => Promise<void>;
  /** Update an existing preset */
  updatePreset: (
    id: string,
    updates: Partial<Pick<FilterPreset, 'name' | 'filters'>>,
  ) => Promise<void>;
  /** Delete a preset */
  deletePreset: (id: string) => Promise<void>;
  /** Rename a preset */
  renamePreset: (id: string, newName: string) => Promise<void>;
  /** Reload presets from GitLab */
  reload: () => Promise<void>;
}

/**
 * Hook for managing GitLab-stored filter presets
 */
export function useFilterPresets(
  fullPath: string | null,
  proxyConfig: GitLabProxyConfig | null,
  configType: 'project' | 'group',
  canEdit: boolean,
): UseFilterPresetsResult {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store values in refs to avoid dependency issues
  const proxyConfigRef = useRef(proxyConfig);
  proxyConfigRef.current = proxyConfig;

  const configTypeRef = useRef(configType);
  configTypeRef.current = configType;

  const presetsRef = useRef(presets);
  presetsRef.current = presets;

  // Load presets from GitLab
  const loadPresetsFromGitLab = useCallback(async () => {
    const currentProxyConfig = proxyConfigRef.current;
    if (!fullPath || !currentProxyConfig) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const config = await loadFilterPresets(
        fullPath,
        currentProxyConfig,
        configTypeRef.current,
      );
      setPresets(config.presets);
    } catch (err) {
      console.error('[useFilterPresets] Failed to load presets:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load filter presets',
      );
    } finally {
      setLoading(false);
    }
  }, [fullPath]);

  // Save presets to GitLab
  const savePresetsToGitLab = useCallback(
    async (newPresets: FilterPreset[]) => {
      const currentProxyConfig = proxyConfigRef.current;
      if (!fullPath || !currentProxyConfig || !canEdit) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const config: FilterPresetsConfig = {
          version: 1,
          presets: newPresets,
        };
        await saveFilterPresets(
          fullPath,
          config,
          currentProxyConfig,
          configTypeRef.current,
        );
        console.log('[useFilterPresets] Presets saved to GitLab');
      } catch (err) {
        console.error('[useFilterPresets] Failed to save presets:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to save filter presets',
        );
        throw err; // Re-throw to let caller handle
      } finally {
        setSaving(false);
      }
    },
    [fullPath, canEdit],
  );

  // Create a new preset
  const createNewPreset = useCallback(
    async (name: string, filters: FilterOptions) => {
      if (!canEdit) {
        setError('You do not have permission to create presets');
        return;
      }

      const newPreset = createPreset(name, filters);
      const newPresets = [...presetsRef.current, newPreset];

      // Optimistic update
      setPresets(newPresets);

      try {
        await savePresetsToGitLab(newPresets);
      } catch {
        // Rollback on error
        setPresets(presetsRef.current);
      }
    },
    [canEdit, savePresetsToGitLab],
  );

  // Update an existing preset
  const updatePreset = useCallback(
    async (
      id: string,
      updates: Partial<Pick<FilterPreset, 'name' | 'filters'>>,
    ) => {
      if (!canEdit) {
        setError('You do not have permission to update presets');
        return;
      }

      const newPresets = presetsRef.current.map((preset) =>
        preset.id === id
          ? {
              ...preset,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : preset,
      );

      // Optimistic update
      setPresets(newPresets);

      try {
        await savePresetsToGitLab(newPresets);
      } catch {
        // Rollback on error
        setPresets(presetsRef.current);
      }
    },
    [canEdit, savePresetsToGitLab],
  );

  // Delete a preset
  const deletePreset = useCallback(
    async (id: string) => {
      if (!canEdit) {
        setError('You do not have permission to delete presets');
        return;
      }

      const newPresets = presetsRef.current.filter(
        (preset) => preset.id !== id,
      );

      // Optimistic update
      setPresets(newPresets);

      try {
        await savePresetsToGitLab(newPresets);
      } catch {
        // Rollback on error
        setPresets(presetsRef.current);
      }
    },
    [canEdit, savePresetsToGitLab],
  );

  // Rename a preset (convenience wrapper)
  const renamePreset = useCallback(
    async (id: string, newName: string) => {
      await updatePreset(id, { name: newName });
    },
    [updatePreset],
  );

  // Load presets when path changes
  useEffect(() => {
    loadPresetsFromGitLab();
  }, [loadPresetsFromGitLab]);

  return {
    presets,
    loading,
    saving,
    error,
    createNewPreset,
    updatePreset,
    deletePreset,
    renamePreset,
    reload: loadPresetsFromGitLab,
  };
}
