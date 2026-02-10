/**
 * Factory for creating data providers
 *
 * This factory abstracts provider instantiation and allows
 * adding new data source types without modifying UI code.
 */

import type {
  DataProviderInterface,
  DataProviderConfig,
} from './DataProviderInterface';
import { GitLabAdapter } from '../adapters/GitLabAdapter';

export class DataProviderFactory {
  /**
   * Create a data provider for the given configuration
   *
   * @param config - Provider configuration specifying type and connection details
   * @returns A DataProviderInterface instance
   * @throws Error if provider type is not supported
   */
  static create(config: DataProviderConfig): DataProviderInterface {
    switch (config.type) {
      case 'gitlab':
        return new GitLabAdapter(config);

      case 'azure-devops':
        throw new Error(
          'Azure DevOps provider not yet implemented. Planned for Phase 2.',
        );

      case 'custom':
        throw new Error(
          'Custom data provider not yet implemented. Planned for Phase 2.',
        );

      default:
        throw new Error(
          `Unknown data provider type: ${(config as { type: string }).type}`,
        );
    }
  }
}
