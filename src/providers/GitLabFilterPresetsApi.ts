/**
 * GitLab Filter Presets API
 * Uses Project/Group Snippets to store filter presets for team sharing
 */

import { gitlabRestRequest, type GitLabProxyConfig } from './GitLabApiUtils';
import {
  type FilterPresetsConfig,
  type FilterPreset,
  DEFAULT_FILTER_PRESETS_CONFIG,
  FILTER_PRESETS_SNIPPET,
} from '../types/filterPreset';

interface GitLabSnippet {
  id: number;
  title: string;
  file_name: string;
  visibility: string;
  web_url: string;
}

/**
 * Get the API endpoint prefix based on config type
 */
function getEndpointPrefix(
  fullPath: string,
  configType: 'project' | 'group',
): string {
  const encodedPath = encodeURIComponent(fullPath);
  return configType === 'group'
    ? `/groups/${encodedPath}`
    : `/projects/${encodedPath}`;
}

/**
 * Find existing filter-presets snippet
 */
export async function findFilterPresetsSnippet(
  fullPath: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<GitLabSnippet | null> {
  const prefix = getEndpointPrefix(fullPath, configType);

  try {
    const snippets = await gitlabRestRequest<GitLabSnippet[]>(
      `${prefix}/snippets`,
      proxyConfig,
    );

    return (
      snippets.find((s) => s.title === FILTER_PRESETS_SNIPPET.TITLE) || null
    );
  } catch (error) {
    console.error('[GitLabFilterPresetsApi] Failed to list snippets:', error);
    return null;
  }
}

/**
 * Fetch raw snippet content (handles non-JSON response from /raw endpoint)
 */
async function fetchSnippetRaw(
  fullPath: string,
  snippetId: number,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<string> {
  const prefix = getEndpointPrefix(fullPath, configType);
  const endpoint = `${prefix}/snippets/${snippetId}/raw`;

  const isDev =
    proxyConfig.isDev ??
    (typeof import.meta !== 'undefined' && import.meta.env?.DEV);
  let url = `${proxyConfig.gitlabUrl}/api/v4${endpoint}`;

  // Apply proxy if needed
  if (isDev) {
    url = url.replace(proxyConfig.gitlabUrl, '/api/gitlab-proxy');
  } else {
    const corsProxy =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_CORS_PROXY;
    if (corsProxy) {
      url = `${corsProxy}/${url}`;
    }
  }

  const headers: HeadersInit = isDev
    ? { 'X-GitLab-Token': proxyConfig.token }
    : { 'PRIVATE-TOKEN': proxyConfig.token };

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch snippet content: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Get snippet content by ID
 */
async function getSnippetContent(
  fullPath: string,
  snippetId: number,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<string> {
  const prefix = getEndpointPrefix(fullPath, configType);

  // Use raw endpoint to get content
  const content = await gitlabRestRequest<string>(
    `${prefix}/snippets/${snippetId}/raw`,
    proxyConfig,
  );

  // gitlabRestRequest returns {} for non-JSON responses
  // We need to handle the raw text response
  if (typeof content === 'object') {
    // Fetch raw content directly
    return fetchSnippetRaw(fullPath, snippetId, proxyConfig, configType);
  }

  return content;
}

/**
 * Create new filter-presets snippet
 */
async function createFilterPresetsSnippet(
  fullPath: string,
  content: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<GitLabSnippet> {
  const prefix = getEndpointPrefix(fullPath, configType);

  const snippet = await gitlabRestRequest<GitLabSnippet>(
    `${prefix}/snippets`,
    proxyConfig,
    {
      method: 'POST',
      body: JSON.stringify({
        title: FILTER_PRESETS_SNIPPET.TITLE,
        file_name: FILTER_PRESETS_SNIPPET.FILENAME,
        content: content,
        visibility: FILTER_PRESETS_SNIPPET.VISIBILITY,
      }),
    },
  );

  return snippet;
}

/**
 * Update existing snippet content
 */
async function updateSnippetContent(
  fullPath: string,
  snippetId: number,
  content: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<void> {
  const prefix = getEndpointPrefix(fullPath, configType);

  await gitlabRestRequest(`${prefix}/snippets/${snippetId}`, proxyConfig, {
    method: 'PUT',
    body: JSON.stringify({
      content: content,
    }),
  });
}

/**
 * Parse and validate filter presets config
 */
function parseFilterPresetsConfig(text: string): FilterPresetsConfig {
  try {
    const parsed = JSON.parse(text);

    // Validate structure
    if (typeof parsed !== 'object' || !Array.isArray(parsed.presets)) {
      console.warn(
        '[GitLabFilterPresetsApi] Invalid config structure, using default',
      );
      return DEFAULT_FILTER_PRESETS_CONFIG;
    }

    // Ensure version exists
    if (!parsed.version) {
      parsed.version = 1;
    }

    // Validate each preset has required fields
    const validPresets = parsed.presets.filter(
      (p: any) =>
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        typeof p.filters === 'object',
    );

    return {
      version: parsed.version,
      presets: validPresets,
    };
  } catch (error) {
    console.error('[GitLabFilterPresetsApi] Failed to parse config:', error);
    return DEFAULT_FILTER_PRESETS_CONFIG;
  }
}

/**
 * Load filter presets from GitLab Snippet
 * Returns default empty config if no snippet exists
 */
export async function loadFilterPresets(
  fullPath: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<FilterPresetsConfig> {
  // Find existing snippet
  const snippet = await findFilterPresetsSnippet(
    fullPath,
    proxyConfig,
    configType,
  );

  if (!snippet) {
    return DEFAULT_FILTER_PRESETS_CONFIG;
  }

  // Get content
  const content = await getSnippetContent(
    fullPath,
    snippet.id,
    proxyConfig,
    configType,
  );

  // Parse content
  return parseFilterPresetsConfig(content);
}

/**
 * Save filter presets to GitLab Snippet
 * Creates new snippet if not exists, updates if exists
 */
export async function saveFilterPresets(
  fullPath: string,
  config: FilterPresetsConfig,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<void> {
  const content = JSON.stringify(config, null, 2);

  // Find existing snippet
  const snippet = await findFilterPresetsSnippet(
    fullPath,
    proxyConfig,
    configType,
  );

  if (snippet) {
    // Update existing
    await updateSnippetContent(
      fullPath,
      snippet.id,
      content,
      proxyConfig,
      configType,
    );
  } else {
    // Create new
    await createFilterPresetsSnippet(
      fullPath,
      content,
      proxyConfig,
      configType,
    );
  }
}

/**
 * Generate a UUID v4
 */
export function generatePresetId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a new preset object
 */
export function createPreset(
  name: string,
  filters: FilterPreset['filters'],
): FilterPreset {
  const now = new Date().toISOString();
  return {
    id: generatePresetId(),
    name,
    filters,
    createdAt: now,
    updatedAt: now,
  };
}
