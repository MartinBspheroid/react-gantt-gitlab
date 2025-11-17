/**
 * GitLab Configuration Manager
 * Manages multiple GitLab project/group configurations with localStorage persistence
 */

import type { GitLabConfig } from '../types/gitlab';

const STORAGE_KEY = 'gitlab_gantt_configs';
const ACTIVE_CONFIG_KEY = 'gitlab_gantt_active_config';

export class GitLabConfigManager {
  private configs: Map<string, GitLabConfig> = new Map();
  private activeConfigId: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load configurations from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const configs: GitLabConfig[] = JSON.parse(stored);
        configs.forEach((config) => {
          this.configs.set(config.id, config);
        });
      }

      const activeId = localStorage.getItem(ACTIVE_CONFIG_KEY);
      if (activeId && this.configs.has(activeId)) {
        this.activeConfigId = activeId;
      } else if (this.configs.size > 0) {
        // Set first config as active if no active config
        this.activeConfigId = Array.from(this.configs.keys())[0];
      }
    } catch (error) {
      console.error('Failed to load GitLab configs from storage:', error);
    }
  }

  /**
   * Save configurations to localStorage
   */
  private saveToStorage(): void {
    try {
      const configs = Array.from(this.configs.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));

      if (this.activeConfigId) {
        localStorage.setItem(ACTIVE_CONFIG_KEY, this.activeConfigId);
      }
    } catch (error) {
      console.error('Failed to save GitLab configs to storage:', error);
    }
  }

  /**
   * Generate unique ID for config
   */
  private generateId(): string {
    return `gitlab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add or update a configuration
   */
  addConfig(config: Omit<GitLabConfig, 'id'>): GitLabConfig {
    const id = this.generateId();
    const newConfig: GitLabConfig = {
      ...config,
      id,
    };

    this.configs.set(id, newConfig);

    // Set as active if it's the first config or marked as default
    if (this.configs.size === 1 || config.isDefault) {
      this.activeConfigId = id;
    }

    this.saveToStorage();
    return newConfig;
  }

  /**
   * Update existing configuration
   */
  updateConfig(id: string, updates: Partial<GitLabConfig>): boolean {
    const existing = this.configs.get(id);
    if (!existing) {
      return false;
    }

    const updated: GitLabConfig = {
      ...existing,
      ...updates,
      id, // Preserve ID
    };

    this.configs.set(id, updated);
    this.saveToStorage();
    return true;
  }

  /**
   * Delete a configuration
   */
  deleteConfig(id: string): boolean {
    if (!this.configs.has(id)) {
      return false;
    }

    this.configs.delete(id);

    // Update active config if deleted
    if (this.activeConfigId === id) {
      if (this.configs.size > 0) {
        this.activeConfigId = Array.from(this.configs.keys())[0];
      } else {
        this.activeConfigId = null;
      }
    }

    this.saveToStorage();
    return true;
  }

  /**
   * Get a specific configuration
   */
  getConfig(id: string): GitLabConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get all configurations
   */
  getAllConfigs(): GitLabConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get active configuration
   */
  getActiveConfig(): GitLabConfig | null {
    if (!this.activeConfigId) {
      return null;
    }
    return this.configs.get(this.activeConfigId) || null;
  }

  /**
   * Set active configuration
   */
  setActiveConfig(id: string): boolean {
    if (!this.configs.has(id)) {
      return false;
    }

    this.activeConfigId = id;
    localStorage.setItem(ACTIVE_CONFIG_KEY, id);
    return true;
  }

  /**
   * Check if any configs exist
   */
  hasConfigs(): boolean {
    return this.configs.size > 0;
  }

  /**
   * Clear all configurations
   */
  clearAll(): void {
    this.configs.clear();
    this.activeConfigId = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_CONFIG_KEY);
  }

  /**
   * Validate GitLab URL format
   */
  static validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: Partial<GitLabConfig>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.name || config.name.trim() === '') {
      errors.push('Configuration name is required');
    }

    if (
      !config.gitlabUrl ||
      !GitLabConfigManager.validateUrl(config.gitlabUrl)
    ) {
      errors.push('Valid GitLab URL is required (http:// or https://)');
    }

    if (!config.token || config.token.trim() === '') {
      errors.push('GitLab access token is required');
    }

    if (
      !config.type ||
      (config.type !== 'project' && config.type !== 'group')
    ) {
      errors.push('Type must be either "project" or "group"');
    }

    if (config.type === 'project' && !config.projectId) {
      errors.push('Project ID is required for project type');
    }

    if (config.type === 'group' && !config.groupId) {
      errors.push('Group ID is required for group type');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test connection to GitLab instance
   */
  static async testConnection(config: {
    gitlabUrl: string;
    token: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Use proxy in development or production to avoid CORS issues
      const isDev = import.meta.env.DEV;
      const corsProxy = import.meta.env.VITE_CORS_PROXY;

      let apiUrl: string;
      let headers: HeadersInit;

      if (isDev) {
        // Development: use Vite proxy
        apiUrl = `/api/gitlab-proxy/api/v4/user`;
        headers = { 'X-GitLab-Token': config.token };
      } else if (corsProxy) {
        // Production with CORS proxy
        apiUrl = `${corsProxy}/${config.gitlabUrl}/api/v4/user`;
        headers = { 'PRIVATE-TOKEN': config.token };
      } else {
        // Production without CORS proxy (direct access)
        apiUrl = `${config.gitlabUrl}/api/v4/user`;
        headers = { 'PRIVATE-TOKEN': config.token };
      }

      const response = await fetch(apiUrl, { headers });

      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${error}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}

// Singleton instance
export const gitlabConfigManager = new GitLabConfigManager();
