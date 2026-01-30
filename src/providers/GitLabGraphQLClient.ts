/**
 * GitLab GraphQL Client
 * Handles GraphQL API requests for GitLab
 */

import { getGraphQLProxyConfig } from '../utils/proxyUtils';

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
   * Get proxy configuration using centralized utilities
   */
  private getProxyConfig() {
    return getGraphQLProxyConfig(this.config);
  }

  /**
   * Execute GraphQL query
   *
   * Error handling includes detection of common configuration issues:
   * - "project not found" may indicate a group was configured as a project
   * - "group not found" may indicate a project was configured as a group
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @param signal - Optional AbortSignal for request cancellation
   */
  async query<T>(
    query: string,
    variables?: Record<string, any>,
    signal?: AbortSignal,
  ): Promise<T> {
    const proxyConfig = this.getProxyConfig();

    const response = await fetch(proxyConfig.url, {
      method: 'POST',
      headers: proxyConfig.headers,
      body: JSON.stringify({ query, variables }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map((e) => e.message).join(', ');

      // Check for common configuration type mismatch errors
      // This helps users understand when they've configured a group as a project or vice versa
      const lowerError = errorMessage.toLowerCase();
      if (
        lowerError.includes('project') &&
        (lowerError.includes('not found') ||
          lowerError.includes('does not exist'))
      ) {
        throw new Error(
          `Project not found. If "${variables?.fullPath}" is a GitLab Group (not a Project), ` +
            `please edit the configuration and change Type from "Project" to "Group". ` +
            `Original error: ${errorMessage}`,
        );
      }
      if (
        lowerError.includes('group') &&
        (lowerError.includes('not found') ||
          lowerError.includes('does not exist'))
      ) {
        throw new Error(
          `Group not found. If "${variables?.fullPath}" is a GitLab Project (not a Group), ` +
            `please edit the configuration and change Type from "Group" to "Project". ` +
            `Original error: ${errorMessage}`,
        );
      }

      throw new Error(`GraphQL errors: ${errorMessage}`);
    }

    if (!result.data) {
      throw new Error('GraphQL response has no data');
    }

    return result.data;
  }

  /**
   * Execute GraphQL mutation
   *
   * @param mutation - GraphQL mutation string
   * @param variables - Mutation variables
   * @param signal - Optional AbortSignal for request cancellation
   */
  async mutate<T>(
    mutation: string,
    variables?: Record<string, any>,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.query<T>(mutation, variables, signal);
  }
}
