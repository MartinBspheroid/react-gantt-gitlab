/**
 * GitLab Blueprint API
 *
 * 支援兩種儲存方式：
 * 1. GitLab Snippet (團隊共享，僅 Project 模式支援)
 * 2. localStorage (個人使用，所有模式都支援)
 *
 * IMPORTANT: GitLab 不支援 Group Snippets
 * @see https://gitlab.com/gitlab-org/gitlab/-/issues/15958
 */

import {
  gitlabRestRequest,
  gitlabRestRequestPaginated,
  type GitLabProxyConfig,
} from './GitLabApiUtils';
import { getRestProxyConfig } from '../utils/proxyUtils';
import {
  type Blueprint,
  type BlueprintConfig,
  DEFAULT_BLUEPRINT_CONFIG,
  BLUEPRINT_SNIPPET,
  getBlueprintStorageKey,
} from '../types/blueprint';

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

// === localStorage 操作 ===

/**
 * 從 localStorage 載入 Blueprints
 */
export function loadBlueprintsFromLocalStorage(
  configType: 'project' | 'group',
  id: string | number,
): BlueprintConfig {
  try {
    const key = getBlueprintStorageKey(configType, id);
    const data = localStorage.getItem(key);

    if (!data) {
      return DEFAULT_BLUEPRINT_CONFIG;
    }

    const parsed = JSON.parse(data);
    return validateBlueprintConfig(parsed);
  } catch (error) {
    console.error(
      '[GitLabBlueprintApi] Failed to load from localStorage:',
      error,
    );
    return DEFAULT_BLUEPRINT_CONFIG;
  }
}

/**
 * 儲存 Blueprints 到 localStorage
 */
export function saveBlueprintsToLocalStorage(
  configType: 'project' | 'group',
  id: string | number,
  config: BlueprintConfig,
): void {
  try {
    const key = getBlueprintStorageKey(configType, id);
    localStorage.setItem(key, JSON.stringify(config));
  } catch (error) {
    console.error(
      '[GitLabBlueprintApi] Failed to save to localStorage:',
      error,
    );
    throw error;
  }
}

// === GitLab Snippet 操作 ===

/**
 * 尋找現有的 Blueprint Snippet
 */
export async function findBlueprintSnippet(
  fullPath: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<GitLabSnippet | null> {
  // Group 模式不支援 Snippets
  if (configType === 'group') {
    console.log('[GitLabBlueprintApi] Group mode: Snippets not supported');
    return null;
  }

  const prefix = getEndpointPrefix(fullPath, configType);

  try {
    // Use paginated request to handle projects with many snippets (>20 default)
    const snippets = await gitlabRestRequestPaginated<GitLabSnippet>(
      `${prefix}/snippets`,
      proxyConfig,
    );

    return snippets.find((s) => s.title === BLUEPRINT_SNIPPET.TITLE) || null;
  } catch (error) {
    console.error('[GitLabBlueprintApi] Failed to list snippets:', error);
    return null;
  }
}

/**
 * 取得 Snippet 原始內容
 * Uses centralized proxy utilities for consistent behavior
 */
async function fetchSnippetRaw(
  fullPath: string,
  snippetId: number,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<string> {
  const prefix = getEndpointPrefix(fullPath, configType);
  const endpoint = `${prefix}/snippets/${snippetId}/raw`;

  const { url, headers } = getRestProxyConfig(endpoint, proxyConfig);

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch snippet content: ${response.statusText}`);
  }

  return response.text();
}

/**
 * 建立新的 Blueprint Snippet
 */
async function createBlueprintSnippet(
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
        title: BLUEPRINT_SNIPPET.TITLE,
        file_name: BLUEPRINT_SNIPPET.FILENAME,
        content: content,
        visibility: BLUEPRINT_SNIPPET.VISIBILITY,
      }),
    },
  );

  return snippet;
}

/**
 * 更新 Snippet 內容
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
 * 從 GitLab Snippet 載入 Blueprints
 */
export async function loadBlueprintsFromSnippet(
  fullPath: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<BlueprintConfig> {
  // Group 模式不支援 Snippets
  if (configType === 'group') {
    return DEFAULT_BLUEPRINT_CONFIG;
  }

  // Find existing snippet
  const snippet = await findBlueprintSnippet(fullPath, proxyConfig, configType);

  if (!snippet) {
    return DEFAULT_BLUEPRINT_CONFIG;
  }

  // Get content
  const content = await fetchSnippetRaw(
    fullPath,
    snippet.id,
    proxyConfig,
    configType,
  );

  // Parse content
  try {
    const parsed = JSON.parse(content);
    return validateBlueprintConfig(parsed);
  } catch (error) {
    console.error(
      '[GitLabBlueprintApi] Failed to parse snippet content:',
      error,
    );
    return DEFAULT_BLUEPRINT_CONFIG;
  }
}

/**
 * 儲存 Blueprints 到 GitLab Snippet
 */
export async function saveBlueprintsToSnippet(
  fullPath: string,
  config: BlueprintConfig,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group',
): Promise<void> {
  // Group 模式不支援 Snippets
  if (configType === 'group') {
    throw new Error('Group mode does not support Snippets');
  }

  const content = JSON.stringify(config, null, 2);

  // Find existing snippet
  const snippet = await findBlueprintSnippet(fullPath, proxyConfig, configType);

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
    await createBlueprintSnippet(fullPath, content, proxyConfig, configType);
  }
}

// === 統一 API ===

/**
 * 載入所有 Blueprints (合併 localStorage 和 Snippet)
 * 使用 Map 以 ID 為 key 來避免重複
 */
export async function loadAllBlueprints(
  fullPath: string,
  proxyConfig: GitLabProxyConfig | null,
  configType: 'project' | 'group',
  id: string | number,
): Promise<Blueprint[]> {
  // 使用 Map 來追蹤已經載入的 Blueprint，避免重複
  const blueprintMap = new Map<string, Blueprint>();

  // 1. 載入 localStorage 的 Blueprints
  const localConfig = loadBlueprintsFromLocalStorage(configType, id);
  for (const bp of localConfig.blueprints) {
    // 確保 storage_type 正確
    blueprintMap.set(bp.id, { ...bp, storage_type: 'localStorage' });
  }

  // 2. 載入 Snippet 的 Blueprints (僅 Project 模式且有 proxyConfig)
  if (configType === 'project' && proxyConfig) {
    try {
      const snippetConfig = await loadBlueprintsFromSnippet(
        fullPath,
        proxyConfig,
        configType,
      );
      for (const bp of snippetConfig.blueprints) {
        // Snippet 的 Blueprint 優先（因為是團隊共享的）
        // 如果 ID 已存在，表示可能是從 localStorage 遷移到 snippet 的情況
        blueprintMap.set(bp.id, { ...bp, storage_type: 'snippet' });
      }
    } catch (error) {
      console.warn('[GitLabBlueprintApi] Failed to load from snippet:', error);
    }
  }

  return Array.from(blueprintMap.values());
}

/**
 * 新增 Blueprint
 */
export async function addBlueprint(
  blueprint: Blueprint,
  fullPath: string,
  proxyConfig: GitLabProxyConfig | null,
  configType: 'project' | 'group',
  id: string | number,
): Promise<void> {
  const storageType = blueprint.storage_type;

  if (storageType === 'localStorage') {
    const config = loadBlueprintsFromLocalStorage(configType, id);
    config.blueprints.push(blueprint);
    saveBlueprintsToLocalStorage(configType, id, config);
  } else if (storageType === 'snippet') {
    if (!proxyConfig) {
      throw new Error('proxyConfig is required for snippet storage');
    }
    if (configType === 'group') {
      throw new Error('Group mode does not support Snippets');
    }

    const config = await loadBlueprintsFromSnippet(
      fullPath,
      proxyConfig,
      configType,
    );
    config.blueprints.push(blueprint);
    await saveBlueprintsToSnippet(fullPath, config, proxyConfig, configType);
  }
}

/**
 * 刪除 Blueprint
 */
export async function deleteBlueprint(
  blueprintId: string,
  storageType: 'snippet' | 'localStorage',
  fullPath: string,
  proxyConfig: GitLabProxyConfig | null,
  configType: 'project' | 'group',
  id: string | number,
): Promise<void> {
  if (storageType === 'localStorage') {
    const config = loadBlueprintsFromLocalStorage(configType, id);
    config.blueprints = config.blueprints.filter((bp) => bp.id !== blueprintId);
    saveBlueprintsToLocalStorage(configType, id, config);
  } else if (storageType === 'snippet') {
    if (!proxyConfig) {
      throw new Error('proxyConfig is required for snippet storage');
    }
    if (configType === 'group') {
      throw new Error('Group mode does not support Snippets');
    }

    const config = await loadBlueprintsFromSnippet(
      fullPath,
      proxyConfig,
      configType,
    );
    config.blueprints = config.blueprints.filter((bp) => bp.id !== blueprintId);
    await saveBlueprintsToSnippet(fullPath, config, proxyConfig, configType);
  }
}

/**
 * 更新 Blueprint 名稱
 */
export async function updateBlueprintName(
  blueprintId: string,
  newName: string,
  storageType: 'snippet' | 'localStorage',
  fullPath: string,
  proxyConfig: GitLabProxyConfig | null,
  configType: 'project' | 'group',
  id: string | number,
): Promise<void> {
  if (storageType === 'localStorage') {
    const config = loadBlueprintsFromLocalStorage(configType, id);
    const bp = config.blueprints.find((b) => b.id === blueprintId);
    if (bp) {
      bp.name = newName;
      bp.updated_at = new Date().toISOString();
      saveBlueprintsToLocalStorage(configType, id, config);
    }
  } else if (storageType === 'snippet') {
    if (!proxyConfig) {
      throw new Error('proxyConfig is required for snippet storage');
    }
    if (configType === 'group') {
      throw new Error('Group mode does not support Snippets');
    }

    const config = await loadBlueprintsFromSnippet(
      fullPath,
      proxyConfig,
      configType,
    );
    const bp = config.blueprints.find((b) => b.id === blueprintId);
    if (bp) {
      bp.name = newName;
      bp.updated_at = new Date().toISOString();
      await saveBlueprintsToSnippet(fullPath, config, proxyConfig, configType);
    }
  }
}

// === 驗證函數 ===

/**
 * 驗證並修正 BlueprintConfig
 */
function validateBlueprintConfig(parsed: unknown): BlueprintConfig {
  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_BLUEPRINT_CONFIG;
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.blueprints)) {
    return DEFAULT_BLUEPRINT_CONFIG;
  }

  // 驗證每個 Blueprint
  const validBlueprints = obj.blueprints.filter((bp: unknown) => {
    if (typeof bp !== 'object' || bp === null) return false;
    const b = bp as Record<string, unknown>;
    return (
      typeof b.id === 'string' &&
      typeof b.name === 'string' &&
      typeof b.milestone === 'object' &&
      Array.isArray(b.items)
    );
  }) as Blueprint[];

  return {
    version: 1,
    blueprints: validBlueprints,
  };
}

/**
 * 檢查是否可以使用 Snippet 儲存
 */
export function canUseSnippetStorage(configType: 'project' | 'group'): boolean {
  return configType === 'project';
}
