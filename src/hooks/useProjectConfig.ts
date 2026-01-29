/**
 * useProjectConfig Hook
 * Manages GitLab project/group configuration selection and provider initialization
 * Extracted from GitLabGantt for reuse in WorkloadView
 *
 * NOTE: This hook resolves credentialId to actual gitlabUrl/token for backwards
 * compatibility. The config stored in localStorage only has credentialId, but
 * the returned GitLabConfig has both credentialId and resolved gitlabUrl/token.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GitLabGraphQLProvider } from '../providers/GitLabGraphQLProvider';
import { gitlabConfigManager } from '../config/GitLabConfigManager';
import { gitlabCredentialManager } from '../config/GitLabCredentialManager';
import type { GitLabConfigV2, GitLabCredential } from '../types/credential';

/**
 * Extended config type with resolved credential info for backwards compatibility
 * The stored config only has credentialId, but we resolve and add gitlabUrl/token
 */
export interface GitLabConfig extends GitLabConfigV2 {
  // Resolved from credential for backwards compatibility
  gitlabUrl?: string;
  token?: string;
}

/**
 * Config type with guaranteed credential info
 */
export interface GitLabConfigResolved extends GitLabConfigV2 {
  credential: GitLabCredential;
}

export interface ProxyConfig {
  gitlabUrl: string;
  token: string;
  isDev: boolean;
}

export interface UseProjectConfigReturn {
  currentConfig: GitLabConfig | null;
  provider: GitLabGraphQLProvider | null;
  configs: GitLabConfig[];
  reloadConfigs: () => void;
  handleConfigChange: (config: GitLabConfig) => void;
  handleQuickSwitch: (configId: string) => void;
  projectPath: string | null;
  proxyConfig: ProxyConfig | null;
  /** Version number that increments when config changes - use to track preset reload */
  configVersion: number;
}

export function useProjectConfig(
  initialConfigId?: string,
): UseProjectConfigReturn {
  const [currentConfig, setCurrentConfig] = useState<GitLabConfig | null>(null);
  const [provider, setProvider] = useState<GitLabGraphQLProvider | null>(null);
  const [configs, setConfigs] = useState<GitLabConfig[]>([]);
  const [configVersion, setConfigVersion] = useState(0);

  // Track the latest config change request to prevent race conditions
  // when user rapidly switches between projects
  const latestConfigIdRef = useRef<string | null>(null);

  // Reload configs list (used on mount and after add/update/delete)
  const reloadConfigs = useCallback(() => {
    setConfigs(gitlabConfigManager.getAllConfigs());
  }, []);

  // Load configs on mount
  useEffect(() => {
    reloadConfigs();
  }, [reloadConfigs]);

  // Initialize provider when config changes
  // This resolves the credentialId to actual gitlabUrl/token
  // Also handles fullPath resolution for legacy configs with numeric IDs
  const handleConfigChange = useCallback(async (config: GitLabConfig) => {
    // Track this config change request to prevent race conditions
    // when user rapidly switches between projects
    latestConfigIdRef.current = config.id;

    // Resolve credential from credentialId
    const credential = gitlabCredentialManager.getCredential(
      config.credentialId,
    );

    if (!credential) {
      console.error(`Credential not found for config: ${config.id}`);
      // Set config without resolved credential - provider will be null
      setCurrentConfig(config);
      setProvider(null);
      return;
    }

    // Resolve fullPath if not available in config
    // This handles legacy configs that only have numeric IDs
    let resolvedFullPath = config.fullPath;
    if (!resolvedFullPath) {
      const numericId =
        config.type === 'project' ? config.projectId : config.groupId;
      if (numericId) {
        // Check if numericId looks like a path (contains '/') or is a number
        const idStr = String(numericId);
        if (idStr.includes('/')) {
          // Already a path, use as-is
          resolvedFullPath = idStr;
        } else if (/^\d+$/.test(idStr)) {
          // Numeric ID - try to resolve fullPath from API
          try {
            const resolved = await GitLabGraphQLProvider.resolveFullPathFromId(
              { gitlabUrl: credential.gitlabUrl, token: credential.token },
              config.type,
              numericId,
            );
            if (resolved) {
              resolvedFullPath = resolved;
              // Persist the resolved fullPath to avoid future API calls
              gitlabConfigManager.updateConfig(config.id, {
                fullPath: resolvedFullPath,
              });
            }
          } catch (error) {
            console.error(
              '[useProjectConfig] Failed to resolve fullPath:',
              error,
            );
          }
        } else {
          // Non-numeric, non-path string - assume it's a path
          resolvedFullPath = idStr;
        }
      }
    }

    // Check if this config is still the latest requested
    // Prevents race condition when user rapidly switches between projects
    if (latestConfigIdRef.current !== config.id) {
      return; // A newer config was requested, abandon this one
    }

    // Create config with resolved credential info for backwards compatibility
    const resolvedConfig: GitLabConfig = {
      ...config,
      gitlabUrl: credential.gitlabUrl,
      token: credential.token,
      fullPath: resolvedFullPath,
    };

    setCurrentConfig(resolvedConfig);

    // Increment config version to signal that dependent data needs to reload
    // This prevents using stale data from a previous project
    setConfigVersion((v) => v + 1);

    const newProvider = new GitLabGraphQLProvider({
      gitlabUrl: credential.gitlabUrl,
      token: credential.token,
      projectId: config.projectId,
      groupId: config.groupId,
      fullPath: resolvedFullPath,
      type: config.type,
    });

    setProvider(newProvider);
  }, []);

  // Quick switch between projects
  const handleQuickSwitch = useCallback(
    (configId: string) => {
      gitlabConfigManager.setActiveConfig(configId);
      const config = gitlabConfigManager.getConfig(configId);
      if (config) {
        handleConfigChange(config);
      }
    },
    [handleConfigChange],
  );

  // Initialize with active config on mount
  useEffect(() => {
    const activeConfig =
      gitlabConfigManager.getConfig(initialConfigId) ||
      gitlabConfigManager.getActiveConfig();

    if (activeConfig) {
      handleConfigChange(activeConfig);
    }
  }, [initialConfigId, handleConfigChange]);

  // Get project path for API calls
  const projectPath = useMemo(() => {
    if (!currentConfig) return null;
    if (currentConfig.type === 'project' && currentConfig.projectId) {
      return String(currentConfig.projectId);
    } else if (currentConfig.type === 'group' && currentConfig.groupId) {
      return String(currentConfig.groupId);
    }
    return null;
  }, [currentConfig]);

  // Get proxy config for REST API calls
  // currentConfig has resolved gitlabUrl/token from handleConfigChange
  const proxyConfig = useMemo<ProxyConfig | null>(() => {
    if (!currentConfig) return null;

    // Check if credential was resolved (gitlabUrl and token exist)
    if (!currentConfig.gitlabUrl || !currentConfig.token) {
      return null;
    }

    return {
      gitlabUrl: currentConfig.gitlabUrl,
      token: currentConfig.token,
      isDev: import.meta.env.DEV,
    };
  }, [currentConfig]);

  return {
    currentConfig,
    provider,
    configs,
    reloadConfigs,
    handleConfigChange,
    handleQuickSwitch,
    projectPath,
    proxyConfig,
    configVersion,
  };
}
