/**
 * Proxy Utilities
 *
 * Centralized proxy configuration for GitLab API requests.
 * This module handles the logic for determining which proxy to use
 * based on environment configuration.
 *
 * Priority:
 * 1. VITE_CORS_PROXY (if configured, works in both dev and production)
 * 2. Vite dev proxy (only in development mode)
 * 3. Direct connection (no proxy)
 */

export interface ProxyConfig {
  gitlabUrl: string;
  token: string;
}

export interface ProxyResult {
  /** The URL to use for the request */
  url: string;
  /** Headers to include in the request */
  headers: HeadersInit;
  /** Which proxy mode is being used */
  mode: 'cors-proxy' | 'vite-proxy' | 'direct';
}

/**
 * Check if CORS proxy is configured
 */
export function hasCorsProxy(): boolean {
  return !!import.meta.env.VITE_CORS_PROXY;
}

/**
 * Get the CORS proxy URL if configured (normalized, no trailing slash)
 */
export function getCorsProxy(): string | undefined {
  const proxy = import.meta.env.VITE_CORS_PROXY;
  if (!proxy) return undefined;
  // Remove trailing slash to avoid double slashes
  return proxy.replace(/\/+$/, '');
}

/**
 * Check if running in development mode
 */
export function isDevMode(): boolean {
  return import.meta.env.DEV;
}

/**
 * Extract hostname from a URL
 */
export function extractHost(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.host;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

/**
 * Determine which proxy mode to use
 */
export function getProxyMode(): 'cors-proxy' | 'vite-proxy' | 'direct' {
  if (hasCorsProxy()) {
    return 'cors-proxy';
  }
  if (isDevMode()) {
    return 'vite-proxy';
  }
  return 'direct';
}

/**
 * Build proxy URL for a given endpoint
 *
 * @param fullUrl - The full GitLab API URL (e.g., https://gitlab.com/api/v4/user)
 * @param config - Proxy configuration containing gitlabUrl
 */
export function buildProxyUrl(fullUrl: string, config: ProxyConfig): string {
  const mode = getProxyMode();

  switch (mode) {
    case 'cors-proxy': {
      const corsProxy = getCorsProxy();
      return `${corsProxy}/${fullUrl}`;
    }
    case 'vite-proxy':
      return fullUrl.replace(config.gitlabUrl, '/api/gitlab-proxy');
    case 'direct':
    default:
      return fullUrl;
  }
}

/**
 * Build headers for REST API requests
 */
export function buildRestHeaders(config: ProxyConfig): HeadersInit {
  const mode = getProxyMode();

  switch (mode) {
    case 'cors-proxy':
    case 'direct':
      return {
        'PRIVATE-TOKEN': config.token,
        'Content-Type': 'application/json',
      };
    case 'vite-proxy':
      return {
        'X-GitLab-Token': config.token,
        'X-GitLab-Host': extractHost(config.gitlabUrl),
        'Content-Type': 'application/json',
      };
  }
}

/**
 * Build headers for GraphQL API requests
 */
export function buildGraphQLHeaders(config: ProxyConfig): HeadersInit {
  const mode = getProxyMode();

  switch (mode) {
    case 'cors-proxy':
    case 'direct':
      return {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      };
    case 'vite-proxy':
      return {
        'X-GitLab-Token': config.token,
        'X-GitLab-Host': extractHost(config.gitlabUrl),
        'Content-Type': 'application/json',
      };
  }
}

/**
 * Get complete proxy configuration for REST API
 */
export function getRestProxyConfig(
  endpoint: string,
  config: ProxyConfig,
): ProxyResult {
  const fullUrl = `${config.gitlabUrl}/api/v4${endpoint}`;
  return {
    url: buildProxyUrl(fullUrl, config),
    headers: buildRestHeaders(config),
    mode: getProxyMode(),
  };
}

/**
 * Get complete proxy configuration for GraphQL API
 */
export function getGraphQLProxyConfig(config: ProxyConfig): ProxyResult {
  const fullUrl = `${config.gitlabUrl}/api/graphql`;
  return {
    url: buildProxyUrl(fullUrl, config),
    headers: buildGraphQLHeaders(config),
    mode: getProxyMode(),
  };
}
