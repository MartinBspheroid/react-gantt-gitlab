/**
 * Shared utilities for GitLab API providers
 */

export interface GitLabProxyConfig {
  gitlabUrl: string;
  token: string;
  isDev?: boolean;
}

/**
 * Convert GitLab URL to proxy URL in dev mode or with CORS proxy
 */
export function getProxyUrl(url: string, config: GitLabProxyConfig): string {
  const isDev = config.isDev ?? import.meta.env.DEV;

  // In development, use Vite proxy
  if (isDev) {
    return url.replace(config.gitlabUrl, '/api/gitlab-proxy');
  }

  // In production, check if CORS proxy is configured
  const corsProxy = import.meta.env.VITE_CORS_PROXY;
  if (corsProxy) {
    // Add CORS proxy prefix to the URL
    return `${corsProxy}/${url}`;
  }

  // No proxy, return original URL
  return url;
}

/**
 * Get headers for REST API requests
 */
export function getRestHeaders(config: GitLabProxyConfig): HeadersInit {
  const isDev = config.isDev ?? import.meta.env.DEV;

  if (isDev) {
    // In dev mode, send token via custom header for proxy
    return {
      'X-GitLab-Token': config.token,
      'Content-Type': 'application/json',
    };
  }

  // In production, use standard GitLab private token header
  return {
    'PRIVATE-TOKEN': config.token,
    'Content-Type': 'application/json',
  };
}

/**
 * Make a REST API request to GitLab with proxy support
 */
export async function gitlabRestRequest<T = any>(
  endpoint: string,
  config: GitLabProxyConfig,
  options: RequestInit = {},
): Promise<T> {
  const url = `${config.gitlabUrl}/api/v4${endpoint}`;
  const proxyUrl = getProxyUrl(url, config);

  const response = await fetch(proxyUrl, {
    ...options,
    headers: {
      ...getRestHeaders(config),
      ...options.headers,
    },
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

  return response.json();
}
