// src/config/configMigration.ts

/**
 * Config Migration
 * Migrates legacy GitLab configs to new credential-based format
 *
 * NOTE: This migration runs ONCE on first app load after the shared credentials
 * feature is deployed. It detects legacy configs (with inline gitlabUrl/token),
 * extracts unique credentials, merges identical ones, and converts configs to
 * use credentialId references instead.
 */

import type { GitLabConfigV2, GitLabConfigLegacy } from '../types/credential';
import {
  GitLabCredentialManager,
  gitlabCredentialManager,
} from './GitLabCredentialManager';

const CONFIGS_STORAGE_KEY = 'gitlab_gantt_configs';
const MIGRATION_FLAG_KEY = 'gitlab_gantt_migration_v2_done';

interface MigrationResult {
  migrated: boolean;
  credentialsCreated: number;
  configsUpdated: number;
}

/**
 * Check if migration is needed
 *
 * Migration is needed when:
 * 1. Migration has not been marked as done
 * 2. There are configs with inline gitlabUrl/token (legacy format)
 */
export function isMigrationNeeded(): boolean {
  // If migration already done, skip
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
    return false;
  }

  // Check if there are any legacy configs
  const stored = localStorage.getItem(CONFIGS_STORAGE_KEY);
  if (!stored) {
    return false;
  }

  try {
    const configs = JSON.parse(stored);
    return configs.some(
      (config: any) =>
        'gitlabUrl' in config &&
        'token' in config &&
        !('credentialId' in config),
    );
  } catch {
    return false;
  }
}

/**
 * Migrate legacy configs to new format
 *
 * This function:
 * 1. Reads all configs from localStorage
 * 2. For each legacy config, extracts or reuses credentials
 * 3. Creates new format configs with credentialId
 * 4. Saves migrated configs and marks migration as done
 *
 * NOTE: Identical credentials (same gitlabUrl + token) are merged into one
 * credential entry and shared across multiple configs.
 */
export function migrateConfigs(): MigrationResult {
  const result: MigrationResult = {
    migrated: false,
    credentialsCreated: 0,
    configsUpdated: 0,
  };

  if (!isMigrationNeeded()) {
    return result;
  }

  try {
    const stored = localStorage.getItem(CONFIGS_STORAGE_KEY);
    if (!stored) {
      return result;
    }

    const configs: GitLabConfigLegacy[] = JSON.parse(stored);
    const credentialMap = new Map<string, string>(); // key: "url|token" -> credentialId
    const newConfigs: GitLabConfigV2[] = [];

    for (const config of configs) {
      // Skip if already migrated (mixed state scenario)
      if ('credentialId' in config) {
        newConfigs.push(config as unknown as GitLabConfigV2);
        continue;
      }

      const normalizedUrl = GitLabCredentialManager.normalizeGitLabUrl(
        config.gitlabUrl,
      );
      const credentialKey = `${normalizedUrl}|${config.token}`;

      let credentialId = credentialMap.get(credentialKey);

      if (!credentialId) {
        // Check if credential already exists (from a previous partial migration)
        const existing = gitlabCredentialManager.findCredential(
          config.gitlabUrl,
          config.token,
        );

        if (existing) {
          credentialId = existing.id;
        } else {
          // Create new credential
          const domainName = GitLabCredentialManager.extractDomainName(
            config.gitlabUrl,
          );
          const newCredential = gitlabCredentialManager.addCredential({
            name: domainName,
            gitlabUrl: config.gitlabUrl,
            token: config.token,
          });
          credentialId = newCredential.id;
          result.credentialsCreated++;
        }

        credentialMap.set(credentialKey, credentialId);
      }

      // Create new config without gitlabUrl/token
      const newConfig: GitLabConfigV2 = {
        id: config.id,
        name: config.name,
        credentialId,
        type: config.type,
        projectId: config.projectId,
        groupId: config.groupId,
        isDefault: config.isDefault,
      };

      newConfigs.push(newConfig);
      result.configsUpdated++;
    }

    // Save migrated configs
    localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(newConfigs));

    // Mark migration as done
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

    result.migrated = true;
    console.log(
      `Migration complete: ${result.credentialsCreated} credentials created, ${result.configsUpdated} configs updated`,
    );

    return result;
  } catch (error) {
    console.error('Migration failed:', error);
    return result;
  }
}

/**
 * Run migration on app startup
 *
 * This is the main entry point for migration. Call this early in the app
 * initialization process before attempting to load configs.
 */
export function runMigrationIfNeeded(): MigrationResult {
  return migrateConfigs();
}
