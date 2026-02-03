/**
 * GitLab Issue Board API for storing Kanban board configurations
 * Uses Project/Group Snippets to store board definitions
 *
 * IMPORTANT: This module supports BOTH project and group configurations.
 * =======================================================================
 * When modifying or adding functions, always ensure:
 * 1. Accept `configType: 'project' | 'group'` parameter
 * 2. Use `getEndpointPrefix()` helper for API paths instead of hardcoding `/projects/`
 * 3. Pass configType through the entire call chain
 *
 * Snippet naming convention:
 * - Project: gantt-issue-boards
 * - Group: gantt-issue-boards
 *
 * See GitLabSnippetApi.ts for similar pattern implementation.
 */

import {
  gitlabRestRequest,
  gitlabRestRequestPaginated,
  type GitLabProxyConfig,
} from './GitLabApiUtils';
import { getRestProxyConfig } from '../utils/proxyUtils';
import type { IssueBoard, IssueBoardStorage } from '../types/issueBoard';

const SNIPPET_TITLE = 'gantt-issue-boards';
const SNIPPET_FILENAME = 'issue-boards.json';
const STORAGE_VERSION = 1;

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
 * Generate a UUID for board/list IDs
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Find existing issue boards snippet
 */
export async function findIssueBoardsSnippet(
  fullPath: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<GitLabSnippet | null> {
  const prefix = getEndpointPrefix(fullPath, configType);

  try {
    // Use paginated request to handle projects with many snippets
    const snippets = await gitlabRestRequestPaginated<GitLabSnippet>(
      `${prefix}/snippets`,
      proxyConfig,
    );

    return snippets.find((s) => s.title === SNIPPET_TITLE) || null;
  } catch (error) {
    console.error('[GitLabIssueBoardApi] Failed to list snippets:', error);
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
  configType: 'project' | 'group' = 'project',
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
 * Get snippet content by ID
 */
export async function getSnippetContent(
  fullPath: string,
  snippetId: number,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<string> {
  // Fetch raw content directly since the /raw endpoint returns text
  return fetchSnippetRaw(fullPath, snippetId, proxyConfig, configType);
}

/**
 * Create new issue boards snippet
 */
export async function createIssueBoardsSnippet(
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
 * Parse storage JSON into IssueBoardStorage
 */
function parseStorageContent(content: string): IssueBoardStorage {
  try {
    const data = JSON.parse(content);

    // Validate version - silent fallback for version mismatch
    // Future migrations can be handled here if needed

    return {
      version: STORAGE_VERSION,
      boards: data.boards || [],
    };
  } catch (error) {
    console.error('[GitLabIssueBoardApi] Failed to parse storage:', error);
    return {
      version: STORAGE_VERSION,
      boards: [],
    };
  }
}

/**
 * Format storage to JSON string
 */
function formatStorageContent(storage: IssueBoardStorage): string {
  return JSON.stringify(storage, null, 2);
}

/**
 * Load issue boards from GitLab snippet
 * Returns empty array if no snippet exists
 */
export async function loadIssueBoards(
  fullPath: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<IssueBoard[]> {
  // Find existing snippet
  const snippet = await findIssueBoardsSnippet(
    fullPath,
    proxyConfig,
    configType,
  );

  if (!snippet) {
    return [];
  }

  // Get content
  const content = await getSnippetContent(
    fullPath,
    snippet.id,
    proxyConfig,
    configType,
  );

  // Parse content
  const storage = parseStorageContent(content);

  return storage.boards;
}

/**
 * Save issue boards to GitLab snippet
 * Creates new snippet if not exists, updates if exists
 */
export async function saveIssueBoards(
  fullPath: string,
  boards: IssueBoard[],
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<void> {
  const storage: IssueBoardStorage = {
    version: STORAGE_VERSION,
    boards,
  };

  const content = formatStorageContent(storage);

  // Find existing snippet
  const snippet = await findIssueBoardsSnippet(
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
    await createIssueBoardsSnippet(fullPath, content, proxyConfig, configType);
  }
}

/**
 * Create a new board
 * Returns the created board with generated ID
 */
export async function createBoard(
  fullPath: string,
  boardData: Omit<IssueBoard, 'id'>,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<IssueBoard> {
  // Load existing boards
  const boards = await loadIssueBoards(fullPath, proxyConfig, configType);

  // Create new board with generated ID
  const newBoard: IssueBoard = {
    ...boardData,
    id: generateUUID(),
    lists: boardData.lists.map((list) => ({
      ...list,
      id: list.id || generateUUID(),
    })),
    metadata: {
      ...boardData.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  // Add to boards
  boards.push(newBoard);

  // Save
  await saveIssueBoards(fullPath, boards, proxyConfig, configType);

  return newBoard;
}

/**
 * Update an existing board
 */
export async function updateBoard(
  fullPath: string,
  board: IssueBoard,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<void> {
  // Load existing boards
  const boards = await loadIssueBoards(fullPath, proxyConfig, configType);

  // Find and update
  const index = boards.findIndex((b) => b.id === board.id);
  if (index === -1) {
    throw new Error(`Board not found: ${board.id}`);
  }

  boards[index] = {
    ...board,
    metadata: {
      ...board.metadata,
      updatedAt: new Date().toISOString(),
    },
  };

  // Save
  await saveIssueBoards(fullPath, boards, proxyConfig, configType);
}

/**
 * Delete a board
 */
export async function deleteBoard(
  fullPath: string,
  boardId: string,
  proxyConfig: GitLabProxyConfig,
  configType: 'project' | 'group' = 'project',
): Promise<void> {
  // Load existing boards
  const boards = await loadIssueBoards(fullPath, proxyConfig, configType);

  // Remove board
  const filteredBoards = boards.filter((b) => b.id !== boardId);

  if (filteredBoards.length === boards.length) {
    throw new Error(`Board not found: ${boardId}`);
  }

  // Save
  await saveIssueBoards(fullPath, filteredBoards, proxyConfig, configType);
}
