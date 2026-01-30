// src/config/GitLabCredentialManager.ts

/**
 * GitLab Credential Manager
 * Manages GitLab credentials (URL + token pairs) with localStorage persistence
 */

import type { GitLabCredential } from '../types/credential';
import { getRestProxyConfig } from '../utils/proxyUtils';

const CREDENTIALS_STORAGE_KEY = 'gitlab_gantt_credentials';

export class GitLabCredentialManager {
  private credentials: Map<string, GitLabCredential> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load credentials from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
      if (stored) {
        const credentials: GitLabCredential[] = JSON.parse(stored);
        credentials.forEach((cred) => {
          this.credentials.set(cred.id, cred);
        });
      }
    } catch (error) {
      console.error('Failed to load GitLab credentials from storage:', error);
    }
  }

  /**
   * Save credentials to localStorage
   */
  private saveToStorage(): void {
    try {
      const credentials = Array.from(this.credentials.values());
      localStorage.setItem(
        CREDENTIALS_STORAGE_KEY,
        JSON.stringify(credentials),
      );
    } catch (error) {
      console.error('Failed to save GitLab credentials to storage:', error);
    }
  }

  /**
   * Generate unique ID for credential
   */
  private generateId(): string {
    return `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Normalize GitLab URL to remove trailing slashes and paths
   */
  static normalizeGitLabUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch (error) {
      console.warn('Failed to normalize GitLab URL:', url, error);
      return url;
    }
  }

  /**
   * Extract domain name from URL for default naming
   */
  static extractDomainName(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Add a new credential
   */
  addCredential(
    credential: Omit<GitLabCredential, 'id' | 'createdAt'>,
  ): GitLabCredential {
    const id = this.generateId();
    const newCredential: GitLabCredential = {
      ...credential,
      gitlabUrl: GitLabCredentialManager.normalizeGitLabUrl(
        credential.gitlabUrl,
      ),
      id,
      createdAt: Date.now(),
    };

    this.credentials.set(id, newCredential);
    this.saveToStorage();
    return newCredential;
  }

  /**
   * Update existing credential
   */
  updateCredential(
    id: string,
    updates: Partial<Omit<GitLabCredential, 'id' | 'createdAt'>>,
  ): boolean {
    const existing = this.credentials.get(id);
    if (!existing) {
      return false;
    }

    const updated: GitLabCredential = {
      ...existing,
      ...updates,
      gitlabUrl: updates.gitlabUrl
        ? GitLabCredentialManager.normalizeGitLabUrl(updates.gitlabUrl)
        : existing.gitlabUrl,
    };

    this.credentials.set(id, updated);
    this.saveToStorage();
    return true;
  }

  /**
   * Delete a credential
   */
  deleteCredential(id: string): boolean {
    if (!this.credentials.has(id)) {
      return false;
    }

    this.credentials.delete(id);
    this.saveToStorage();
    return true;
  }

  /**
   * Get a specific credential
   */
  getCredential(id: string): GitLabCredential | undefined {
    return this.credentials.get(id);
  }

  /**
   * Get all credentials
   */
  getAllCredentials(): GitLabCredential[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Find credential by gitlabUrl and token (for migration)
   * NOTE: This method is essential for migrating legacy configs to the new
   * credentialId-based system. It finds existing credentials that match
   * the URL and token pair to avoid creating duplicates during migration.
   */
  findCredential(
    gitlabUrl: string,
    token: string,
  ): GitLabCredential | undefined {
    const normalizedUrl = GitLabCredentialManager.normalizeGitLabUrl(gitlabUrl);
    return Array.from(this.credentials.values()).find(
      (cred) => cred.gitlabUrl === normalizedUrl && cred.token === token,
    );
  }

  /**
   * Check if any credentials exist
   */
  hasCredentials(): boolean {
    return this.credentials.size > 0;
  }

  /**
   * Test connection to GitLab instance
   * Uses centralized proxy utilities for consistent behavior across environments
   */
  static async testConnection(config: {
    gitlabUrl: string;
    token: string;
  }): Promise<{ success: boolean; error?: string; username?: string }> {
    try {
      const proxyConfig = getRestProxyConfig('/user', config);

      const response = await fetch(proxyConfig.url, {
        headers: proxyConfig.headers,
      });

      if (response.ok) {
        const user = await response.json();
        return { success: true, username: user.username };
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
export const gitlabCredentialManager = new GitLabCredentialManager();
