// src/types/credential.ts

/**
 * GitLab Credential
 * Stores authentication information for a GitLab instance
 */
export interface GitLabCredential {
  id: string;
  name: string;
  gitlabUrl: string;
  token: string;
  createdAt: number;
}

/**
 * GitLab Config with credential reference
 * New format using credentialId instead of inline gitlabUrl/token
 *
 * NOTE: fullPath is required for GitLab GraphQL API queries.
 * projectId/groupId are kept for backwards compatibility but fullPath
 * should be used preferentially by GitLabGraphQLProvider.
 */
export interface GitLabConfigV2 {
  id: string;
  name: string;
  credentialId: string;
  type: 'project' | 'group';
  projectId?: string;
  groupId?: string;
  /**
   * Full path of the project or group (e.g., "namespace/project-name" or "group-name")
   * Required for GitLab GraphQL API queries.
   * Falls back to projectId/groupId if not set (for legacy configs).
   */
  fullPath?: string;
  isDefault?: boolean;
}

/**
 * Legacy GitLab Config (for migration)
 * Old format with inline gitlabUrl/token
 */
export interface GitLabConfigLegacy {
  id: string;
  name: string;
  gitlabUrl: string;
  token: string;
  type: 'project' | 'group';
  projectId?: string;
  groupId?: string;
  isDefault?: boolean;
}

/**
 * Union type for config (either legacy or new format)
 */
export type GitLabConfigAny = GitLabConfigV2 | GitLabConfigLegacy;

/**
 * Check if config is legacy format
 */
export function isLegacyConfig(
  config: GitLabConfigAny,
): config is GitLabConfigLegacy {
  return (
    'gitlabUrl' in config && 'token' in config && !('credentialId' in config)
  );
}

/**
 * Check if config is new format
 */
export function isV2Config(config: GitLabConfigAny): config is GitLabConfigV2 {
  return 'credentialId' in config;
}
