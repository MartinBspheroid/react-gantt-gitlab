/**
 * GitLab Snippet API for storing project/group configuration
 * Uses Project/Group Snippets to store holidays/workdays/colorRules settings
 *
 * IMPORTANT: This module supports BOTH project and group configurations.
 * =======================================================================
 * When modifying or adding functions, always ensure:
 * 1. Accept `configType: 'project' | 'group'` parameter
 * 2. Use `getEndpointPrefix()` helper for API paths instead of hardcoding `/projects/`
 * 3. Pass configType through the entire call chain
 *
 * GitLab API endpoint differences:
 * - Project snippets: /projects/:id/snippets
 * - Group snippets: /groups/:id/snippets
 *
 * See GitLabFilterPresetsApi.ts for similar pattern implementation.
 */

import {
  gitlabRestRequest,
  gitlabRestRequestPaginated,
  type GitLabProxyConfig,
} from './GitLabApiUtils';
import type { ColorRule } from '../types/colorRule';

export interface HolidayEntry {
  date: string;
  name?: string;
}

export interface GanttConfig {
  holidays: HolidayEntry[];
  workdays: HolidayEntry[];
  colorRules?: ColorRule[];
}

interface GitLabSnippet {
  id: number;
  title: string;
  file_name: string;
  visibility: string;
  web_url: string;
}

interface GitLabSnippetWithContent extends GitLabSnippet {
  content: string;
}

const SNIPPET_TITLE = 'gantt-config';
const SNIPPET_FILENAME = 'gantt-config.txt';

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
 * Parse a single line of config text
 * Format: "YYYY-MM-DD name" or "YYYY/M/D name" (name is optional)
 */
function parseLine(line: string): HolidayEntry | null {
  const trimmed = line.trim();

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  // Split by whitespace (space or tab)
  const parts = trimmed.split(/[\s\t]+/);
  const dateStr = parts[0];
  const name = parts.slice(1).join(' ') || undefined;

  // Validate date format (basic check)
  // Accept YYYY-MM-DD or YYYY/M/D
  if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(dateStr)) {
    return null;
  }

  return { date: dateStr, name };
}

/**
 * Parse config text into GanttConfig
 * Format:
 * # 假日 (Holidays)
 * 2025-01-01 元旦
 * 2025-02-28
 *
 * # 補班日 (Workdays)
 * 2025-02-08
 *
 * # 顏色規則 (Color Rules)
 * [{"id":"uuid-1","name":"Blocked",...}]
 */
export function parseConfigText(text: string): GanttConfig {
  const lines = text.split('\n');
  const holidays: HolidayEntry[] = [];
  const workdays: HolidayEntry[] = [];
  let colorRules: ColorRule[] = [];

  let currentSection: 'holidays' | 'workdays' | 'colorRules' = 'holidays';
  let colorRulesJson = '';

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    // Check for section headers
    if (trimmed.startsWith('#')) {
      if (trimmed.includes('color') || trimmed.includes('顏色')) {
        currentSection = 'colorRules';
        colorRulesJson = '';
      } else if (trimmed.includes('workday') || trimmed.includes('補班')) {
        currentSection = 'workdays';
      } else if (trimmed.includes('holiday') || trimmed.includes('假日')) {
        currentSection = 'holidays';
      }
      continue;
    }

    if (currentSection === 'colorRules') {
      // Collect JSON content for color rules
      colorRulesJson += line + '\n';
    } else {
      const entry = parseLine(line);
      if (entry) {
        if (currentSection === 'holidays') {
          holidays.push(entry);
        } else if (currentSection === 'workdays') {
          workdays.push(entry);
        }
      }
    }
  }

  // Parse color rules JSON
  if (colorRulesJson.trim()) {
    try {
      colorRules = JSON.parse(colorRulesJson.trim());
    } catch (e) {
      console.warn('[GitLabSnippetApi] Failed to parse color rules:', e);
    }
  }

  return { holidays, workdays, colorRules };
}

/**
 * Format GanttConfig to text
 */
export function formatConfigText(config: GanttConfig): string {
  const lines: string[] = [];

  // Holidays section
  lines.push('# 假日 (Holidays)');
  for (const entry of config.holidays) {
    if (entry.name) {
      lines.push(`${entry.date} ${entry.name}`);
    } else {
      lines.push(entry.date);
    }
  }

  lines.push('');

  // Workdays section
  lines.push('# 補班日 (Workdays)');
  for (const entry of config.workdays) {
    if (entry.name) {
      lines.push(`${entry.date} ${entry.name}`);
    } else {
      lines.push(entry.date);
    }
  }

  // Color rules section (if any rules exist)
  if (config.colorRules && config.colorRules.length > 0) {
    lines.push('');
    lines.push('# 顏色規則 (Color Rules)');
    lines.push(JSON.stringify(config.colorRules, null, 2));
  }

  return lines.join('\n');
}

/**
 * Find existing gantt-config snippet
 */
export async function findGanttConfigSnippet(
  fullPath: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<GitLabSnippet | null> {
  const prefix = getEndpointPrefix(fullPath, configType);
  console.log('[GitLabSnippetApi] findGanttConfigSnippet:', {
    fullPath,
    configType,
    prefix,
  });

  try {
    // Use paginated request to handle projects with many snippets (>20 default)
    const snippets = await gitlabRestRequestPaginated<GitLabSnippet>(
      `${prefix}/snippets`,
      proxyConfig,
    );

    return snippets.find((s) => s.title === SNIPPET_TITLE) || null;
  } catch (error) {
    console.error('[GitLabSnippetApi] Failed to list snippets:', error);
    return null;
  }
}

/**
 * Get snippet content by ID
 */
export async function getSnippetContent(
  fullPath: string,
  snippetId: number,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
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
    const response = await fetchSnippetRaw(
      fullPath,
      snippetId,
      proxyConfig,
      configType,
    );
    return response;
  }

  return content;
}

/**
 * Fetch raw snippet content (handles non-JSON response)
 */
async function fetchSnippetRaw(
  fullPath: string,
  snippetId: number,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
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
 * Create new gantt-config snippet
 */
export async function createGanttConfigSnippet(
  fullPath: string,
  content: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<GitLabSnippet> {
  const prefix = getEndpointPrefix(fullPath, configType);

  const snippet = await gitlabRestRequest<GitLabSnippet>(
    `${prefix}/snippets`,
    proxyConfig,
    {
      method: 'POST',
      body: JSON.stringify({
        title: SNIPPET_TITLE,
        file_name: SNIPPET_FILENAME,
        content: content,
        visibility: 'private',
      }),
    },
  );

  return snippet;
}

/**
 * Update existing snippet content
 */
export async function updateSnippetContent(
  fullPath: string,
  snippetId: number,
  content: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
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
 * Load gantt config from GitLab
 * Returns null if no config exists
 *
 * IMPORTANT: This function supports both project and group snippets.
 * When adding new features that use snippets, ensure you pass the correct configType.
 * - For projects: configType = 'project', fullPath = project path (e.g., 'group/project')
 * - For groups: configType = 'group', fullPath = group path (e.g., 'group/subgroup')
 */
export async function loadGanttConfig(
  fullPath: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<GanttConfig | null> {
  // Find existing snippet
  const snippet = await findGanttConfigSnippet(
    fullPath,
    proxyConfig,
    configType,
  );

  if (!snippet) {
    return null;
  }

  // Get content
  const content = await getSnippetContent(
    fullPath,
    snippet.id,
    proxyConfig,
    configType,
  );

  // Parse content
  return parseConfigText(content);
}

/**
 * Save gantt config to GitLab
 * Creates new snippet if not exists, updates if exists
 *
 * IMPORTANT: This function supports both project and group snippets.
 * When adding new features that use snippets, ensure you pass the correct configType.
 * - For projects: configType = 'project', fullPath = project path (e.g., 'group/project')
 * - For groups: configType = 'group', fullPath = group path (e.g., 'group/subgroup')
 */
export async function saveGanttConfig(
  fullPath: string,
  config: GanttConfig,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<void> {
  const content = formatConfigText(config);

  // Find existing snippet
  const snippet = await findGanttConfigSnippet(
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
    await createGanttConfigSnippet(fullPath, content, proxyConfig, configType);
  }
}
