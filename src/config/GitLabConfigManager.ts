/**
 * GitLab Configuration Manager
 * Manages multiple GitLab project/group configurations with localStorage persistence
 *
 * NOTE: This manager now uses credentialId to reference credentials stored in
 * GitLabCredentialManager, instead of storing gitlabUrl/token inline.
 * Migration from legacy format happens automatically on first load.
 */

import type { GitLabConfigV2, GitLabCredential } from '../types/credential';
import { gitlabCredentialManager } from './GitLabCredentialManager';
import { runMigrationIfNeeded } from './configMigration';

const STORAGE_KEY = 'gitlab_gantt_configs';
const ACTIVE_CONFIG_KEY = 'gitlab_gantt_active_config';

// Re-export for backwards compatibility
export type GitLabConfig = GitLabConfigV2;

export class GitLabConfigManager {
  private configs: Map<string, GitLabConfigV2> = new Map();
  private activeConfigId: string | null = null;

  constructor() {
    // Run migration before loading configs
    // NOTE: This ensures legacy configs with inline gitlabUrl/token are
    // converted to use credentialId before we try to load them.
    runMigrationIfNeeded();
    this.loadFromStorage();
  }

  /**
   * Normalize GitLab URL to remove project/group paths
   * Extracts only the base GitLab instance URL
   * @deprecated Use GitLabCredentialManager.normalizeGitLabUrl instead
   */
  static normalizeGitLabUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Return only protocol + hostname + port (if any)
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch (error) {
      // If URL parsing fails, return as-is
      console.warn('Failed to normalize GitLab URL:', url, error);
      return url;
    }
  }

  /**
   * Load configurations from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const configs: GitLabConfigV2[] = JSON.parse(stored);
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
   * Add a new configuration (requires valid credentialId)
   */
  addConfig(config: Omit<GitLabConfigV2, 'id'>): GitLabConfigV2 {
    // Validate credentialId exists
    const credential = gitlabCredentialManager.getCredential(
      config.credentialId,
    );
    if (!credential) {
      throw new Error(`Credential not found: ${config.credentialId}`);
    }

    const id = this.generateId();
    const newConfig: GitLabConfigV2 = {
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
  updateConfig(id: string, updates: Partial<GitLabConfigV2>): boolean {
    const existing = this.configs.get(id);
    if (!existing) {
      return false;
    }

    // If updating credentialId, validate it exists
    if (updates.credentialId) {
      const credential = gitlabCredentialManager.getCredential(
        updates.credentialId,
      );
      if (!credential) {
        throw new Error(`Credential not found: ${updates.credentialId}`);
      }
    }

    const updated: GitLabConfigV2 = {
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
  getConfig(id: string): GitLabConfigV2 | undefined {
    return this.configs.get(id);
  }

  /**
   * Get all configurations
   */
  getAllConfigs(): GitLabConfigV2[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get active configuration
   */
  getActiveConfig(): GitLabConfigV2 | null {
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
  static validateConfig(config: Partial<GitLabConfigV2>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.name || config.name.trim() === '') {
      errors.push('Configuration name is required');
    }

    if (!config.credentialId) {
      errors.push('Credential is required');
    } else {
      // Validate credential exists
      const credential = gitlabCredentialManager.getCredential(
        config.credentialId,
      );
      if (!credential) {
        errors.push('Selected credential not found');
      }
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
   * @deprecated Use GitLabCredentialManager.testConnection instead
   */
  static async testConnection(config: {
    gitlabUrl: string;
    token: string;
  }): Promise<{ success: boolean; error?: string }> {
    // Delegate to CredentialManager which has the canonical implementation
    const { GitLabCredentialManager } = await import(
      './GitLabCredentialManager'
    );
    return GitLabCredentialManager.testConnection(config);
  }

  /**
   * Get config with resolved credential info
   * Returns null if config or credential is missing
   *
   * NOTE: Use this when you need both the config and its associated
   * credential information (e.g., for making API calls).
   */
  getConfigWithCredential(
    id: string,
  ): (GitLabConfigV2 & { credential: GitLabCredential }) | null {
    const config = this.configs.get(id);
    if (!config) return null;

    const credential = gitlabCredentialManager.getCredential(
      config.credentialId,
    );
    if (!credential) return null;

    return { ...config, credential };
  }

  /**
   * Check if config has valid credential
   *
   * NOTE: Credentials can be deleted independently, so a config may become
   * invalid if its referenced credential is removed. Use this method to
   * check validity before attempting API operations.
   */
  hasValidCredential(id: string): boolean {
    const config = this.configs.get(id);
    if (!config) return false;
    return !!gitlabCredentialManager.getCredential(config.credentialId);
  }

  /**
   * Get configs using a specific credential
   *
   * NOTE: Useful for checking dependencies before deleting a credential.
   * If any configs use the credential, user should be warned.
   */
  getConfigsByCredential(credentialId: string): GitLabConfigV2[] {
    return Array.from(this.configs.values()).filter(
      (config) => config.credentialId === credentialId,
    );
  }
}

// Singleton instance
export const gitlabConfigManager = new GitLabConfigManager();
