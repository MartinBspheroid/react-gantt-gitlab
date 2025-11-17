/**
 * GitLab GraphQL Client
 * Handles GraphQL API requests for GitLab
 */

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface GitLabGraphQLConfig {
  gitlabUrl: string;
  token: string;
}

export class GitLabGraphQLClient {
  private config: GitLabGraphQLConfig;

  constructor(config: GitLabGraphQLConfig) {
    this.config = config;
  }

  /**
   * Check if running in dev mode
   */
  private get isDev(): boolean {
    return import.meta.env.DEV;
  }

  /**
   * Get GraphQL endpoint URL
   */
  private getEndpoint(): string {
    // In development, use Vite proxy
    if (this.isDev) {
      return '/api/gitlab-proxy/api/graphql';
    }

    // In production, check if CORS proxy is configured
    const corsProxy = import.meta.env.VITE_CORS_PROXY;
    const endpoint = `${this.config.gitlabUrl}/api/graphql`;

    if (corsProxy) {
      return `${corsProxy}/${endpoint}`;
    }

    return endpoint;
  }

  /**
   * Get request headers
   */
  private getHeaders(): HeadersInit {
    if (this.isDev) {
      return {
        'X-GitLab-Token': this.config.token,
        'Content-Type': 'application/json',
      };
    }
    return {
      Authorization: `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Execute GraphQL query
   */
  async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const endpoint = this.getEndpoint();
    const headers = this.getHeaders();

    console.log('[GitLabGraphQL] Executing query:', {
      endpoint,
      query,
      variables,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map((e) => e.message).join(', ');
      throw new Error(`GraphQL errors: ${errorMessage}`);
    }

    if (!result.data) {
      throw new Error('GraphQL response has no data');
    }

    console.log('[GitLabGraphQL] Query result:', result.data);

    return result.data;
  }

  /**
   * Execute GraphQL mutation
   */
  async mutate<T>(
    mutation: string,
    variables?: Record<string, any>,
  ): Promise<T> {
    return this.query<T>(mutation, variables);
  }
}
