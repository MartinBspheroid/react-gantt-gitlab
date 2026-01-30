/**
 * Shared utilities for GitLab API providers
 */

import type {
  SyncProgressCallback,
  SyncResourceType,
} from '../types/syncProgress';
import { createProgressMessage } from '../types/syncProgress';
import {
  buildProxyUrl,
  buildRestHeaders,
  type ProxyConfig,
} from '../utils/proxyUtils';

export interface GitLabProxyConfig {
  gitlabUrl: string;
  token: string;
  isDev?: boolean;
}

/**
 * Convert GitLab URL to proxy URL with CORS proxy or Vite dev proxy
 * @deprecated Use buildProxyUrl from proxyUtils instead
 */
export function getProxyUrl(url: string, config: GitLabProxyConfig): string {
  return buildProxyUrl(url, config);
}

/**
 * Get headers for REST API requests
 * @deprecated Use buildRestHeaders from proxyUtils instead
 */
export function getRestHeaders(config: GitLabProxyConfig): HeadersInit {
  return buildRestHeaders(config);
}

/**
 * Make a REST API request to GitLab with proxy support
 *
 * Error handling includes detection of common configuration issues:
 * - 404 on /projects/:id/snippets may indicate the path is a Group, not a Project
 * - 404 on /groups/:id/snippets may indicate the path is a Project, not a Group
 *
 * @param endpoint - API endpoint (without base URL)
 * @param config - GitLab proxy config
 * @param options - Additional fetch options
 * @param signal - Optional AbortSignal for request cancellation
 */
export async function gitlabRestRequest<T = any>(
  endpoint: string,
  config: GitLabProxyConfig,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = `${config.gitlabUrl}/api/v4${endpoint}`;
  const proxyUrl = getProxyUrl(url, config);

  const response = await fetch(proxyUrl, {
    ...options,
    headers: {
      ...getRestHeaders(config),
      ...options.headers,
    },
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText || response.statusText;
    }

    // Provide clearer guidance for common 404 errors caused by configuration type mismatch
    // This helps users understand when they've configured a group as a project or vice versa
    if (response.status === 404) {
      if (endpoint.includes('/projects/') && endpoint.includes('/snippets')) {
        // Extract path from endpoint for clearer message
        const pathMatch = endpoint.match(/\/projects\/([^/]+)/);
        const path = pathMatch
          ? decodeURIComponent(pathMatch[1])
          : 'the configured path';
        throw new Error(
          `Project "${path}" not found (404). If this is a GitLab Group (not a Project), ` +
            `please edit the configuration and change Type from "Project" to "Group".`,
        );
      }
      if (endpoint.includes('/groups/') && endpoint.includes('/snippets')) {
        // GitLab does NOT support Group Snippets - this is expected to fail.
        // See: https://gitlab.com/gitlab-org/gitlab/-/issues/15958
        // Group Snippets is a requested feature that has not been implemented.
        // The calling code handles this by disabling Holidays/ColorRules/Presets for groups.
        const pathMatch = endpoint.match(/\/groups\/([^/]+)/);
        const path = pathMatch
          ? decodeURIComponent(pathMatch[1])
          : 'the configured path';

        throw new Error(
          `Group Snippets are not supported by GitLab. ` +
            `Holidays, Color Rules, and Filter Presets are not available for group "${path}".`,
        );
      }
    }

    throw new Error(`GitLab API error: ${errorMessage}`);
  }

  // Handle empty responses (e.g., DELETE requests)
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {} as T;
  }

  const text = await response.text();
  if (!text || text.trim() === '') {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Make a paginated REST API request to GitLab
 * Automatically fetches all pages and returns combined results
 *
 * Note: GitLab REST API default per_page is 20, and some proxies may not
 * correctly forward query parameters. This function handles pagination
 * to ensure all items are fetched regardless of per_page limitations.
 *
 * @param endpoint - Base endpoint (without pagination params)
 * @param config - GitLab proxy config
 * @param options - Additional fetch options
 * @param maxPages - Maximum pages to fetch (default: 50, ~1000 items with per_page=20)
 * @param signal - Optional AbortSignal for request cancellation
 * @param onProgress - Optional callback for progress updates
 * @param resourceType - Resource type for progress messages
 * @returns Combined array of all items from all pages
 */
export async function gitlabRestRequestPaginated<T = any>(
  endpoint: string,
  config: GitLabProxyConfig,
  options: RequestInit = {},
  maxPages: number = 50,
  signal?: AbortSignal,
  onProgress?: SyncProgressCallback,
  resourceType?: SyncResourceType,
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  let hasMore = true;
  let totalPages: number | undefined;

  // Determine if endpoint already has query params
  const separator = endpoint.includes('?') ? '&' : '?';

  while (hasMore && page <= maxPages) {
    // Check if aborted before each request
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    const paginatedEndpoint = `${endpoint}${separator}page=${page}&per_page=100`;
    const url = `${config.gitlabUrl}/api/v4${paginatedEndpoint}`;
    const proxyUrl = getProxyUrl(url, config);

    const response = await fetch(proxyUrl, {
      ...options,
      headers: {
        ...getRestHeaders(config),
        ...options.headers,
      },
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      throw new Error(`GitLab API error: ${errorMessage}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      break;
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      break;
    }

    const items = JSON.parse(text) as T[];

    if (!Array.isArray(items) || items.length === 0) {
      hasMore = false;
    } else {
      allItems.push(...items);

      // Check pagination headers to determine if there are more pages
      const totalPagesHeader = response.headers.get('x-total-pages');
      const nextPage = response.headers.get('x-next-page');

      if (totalPagesHeader) {
        totalPages = parseInt(totalPagesHeader, 10);
      }

      // Report progress if callback provided
      if (onProgress && resourceType) {
        onProgress({
          resource: resourceType,
          currentPage: page,
          totalPages,
          itemsFetched: allItems.length,
          message: createProgressMessage(resourceType, page, totalPages),
        });
      }

      if (totalPages && page >= totalPages) {
        hasMore = false;
      } else if (nextPage) {
        page = parseInt(nextPage, 10);
      } else {
        // If no pagination headers, check if we got fewer items than requested
        // This indicates we've reached the last page
        if (items.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }
  }

  if (page > maxPages && hasMore) {
    console.warn(
      `[GitLabApiUtils] Reached max pages limit (${maxPages}) for endpoint: ${endpoint}`,
    );
  }

  return allItems;
}
