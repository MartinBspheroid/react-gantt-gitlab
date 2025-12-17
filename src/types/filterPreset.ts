/**
 * Filter Preset Types
 * Types for saving and managing filter presets stored in GitLab Snippets
 */

import type { FilterOptions } from '../utils/GitLabFilters';

/**
 * A single filter preset
 */
export interface FilterPreset {
  /** Unique identifier (UUID v4) */
  id: string;
  /** User-defined name for the preset */
  name: string;
  /** The filter options to apply when this preset is selected */
  filters: FilterOptions;
  /** ISO 8601 timestamp when the preset was created */
  createdAt: string;
  /** ISO 8601 timestamp when the preset was last updated */
  updatedAt: string;
}

/**
 * Configuration stored in the GitLab Snippet
 */
export interface FilterPresetsConfig {
  /** Schema version for future migrations */
  version: 1;
  /** Array of saved presets */
  presets: FilterPreset[];
}

/**
 * Default empty configuration
 */
export const DEFAULT_FILTER_PRESETS_CONFIG: FilterPresetsConfig = {
  version: 1,
  presets: [],
};

/**
 * Snippet metadata constants
 */
export const FILTER_PRESETS_SNIPPET = {
  TITLE: 'gantt-filter-presets',
  FILENAME: 'filter-presets.json',
  VISIBILITY: 'private' as const,
};
