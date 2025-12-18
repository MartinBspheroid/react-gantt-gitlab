/**
 * useProjectConfig Hook
 * Manages GitLab project/group configuration selection and provider initialization
 * Extracted from GitLabGantt for reuse in WorkloadView
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { GitLabGraphQLProvider } from '../providers/GitLabGraphQLProvider';
import { gitlabConfigManager } from '../config/GitLabConfigManager';

export interface GitLabConfig {
  id: string;
  name: string;
  gitlabUrl: string;
  token: string;
  type: 'project' | 'group';
  projectId?: string;
  groupId?: string;
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

  // Reload configs list (used on mount and after add/update/delete)
  const reloadConfigs = useCallback(() => {
    setConfigs(gitlabConfigManager.getAllConfigs());
  }, []);

  // Load configs on mount
  useEffect(() => {
    reloadConfigs();
  }, [reloadConfigs]);

  // Initialize provider when config changes
  const handleConfigChange = useCallback((config: GitLabConfig) => {
    setCurrentConfig(config);

    // Increment config version to signal that dependent data needs to reload
    // This prevents using stale data from a previous project
    setConfigVersion((v) => v + 1);

    const newProvider = new GitLabGraphQLProvider({
      gitlabUrl: config.gitlabUrl,
      token: config.token,
      projectId: config.projectId,
      groupId: config.groupId,
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
  const proxyConfig = useMemo<ProxyConfig | null>(() => {
    if (!currentConfig) return null;
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
