/**
 * Project Settings Types
 * 專案專屬設定的類型定義和 localStorage 工具函數
 */

import type {
  FilterOptions,
  ServerFilterOptions,
} from '../utils/GitLabFilters';

/**
 * 儲存的 Filter 狀態
 * 支援同時儲存 client 和 server filters
 * filterType 為 optional，向後相容舊格式
 */
export interface StoredFilters {
  filterType?: 'client' | 'server';
  clientFilters?: {
    milestoneIds?: number[];
    epicIds?: number[];
    labels?: string[];
    assignees?: string[];
    states?: string[];
    search?: string;
  };
  serverFilters?: ServerFilterOptions;
}

/**
 * Filter 設定
 */
export interface FilterSettings {
  /** 模式：使用 preset 或自訂 filter */
  mode: 'preset' | 'custom';
  /** Preset ID（mode === 'preset' 時使用） */
  presetId?: string;
  /** Preset 是否被修改過（mode === 'preset' 時使用） */
  dirty?: boolean;
  /** 儲存的 filter 狀態 */
  filters?: StoredFilters;
}

/**
 * View mode type
 */
export type ViewMode = 'gantt' | 'kanban';

/**
 * 專案設定
 */
export interface ProjectSettings {
  /** Schema 版本，方便日後升級 */
  version: 1;
  /** Filter 相關設定 */
  filter?: FilterSettings;
  /** 上次使用的視圖模式 */
  viewMode?: ViewMode;
  // 預留給日後擴充
  // ui?: { ... };
  // display?: { ... };
}

// ============================================================
// localStorage Key 常數
// ============================================================

const PROJECT_SETTINGS_PREFIX = 'gitlab-gantt-project-settings';
const LEGACY_PRESET_PREFIX = 'gitlab-gantt-preset';

// ============================================================
// 工具函數
// ============================================================

/**
 * 取得專案設定的 localStorage key
 */
export function getProjectSettingsKey(
  type: 'project' | 'group',
  id: string | number,
): string {
  return `${PROJECT_SETTINGS_PREFIX}-${type}-${id}`;
}

/**
 * 取得舊版 preset localStorage key（向後相容用）
 */
export function getLegacyPresetKey(
  type: 'project' | 'group',
  id: string | number,
): string {
  return `${LEGACY_PRESET_PREFIX}-${type}-${id}`;
}

/**
 * 載入專案設定
 * 包含向後相容處理：如果找到舊格式會自動遷移
 */
export function loadProjectSettings(
  type: 'project' | 'group',
  id: string | number,
): ProjectSettings | null {
  try {
    const key = getProjectSettingsKey(type, id);
    const stored = localStorage.getItem(key);

    if (stored) {
      const settings = JSON.parse(stored) as ProjectSettings;
      // 驗證版本
      if (settings.version === 1) {
        return settings;
      }
    }

    // 嘗試向後相容：讀取舊格式
    const legacyKey = getLegacyPresetKey(type, id);
    const legacyPresetId = localStorage.getItem(legacyKey);

    if (legacyPresetId) {
      // 遷移到新格式
      const migratedSettings: ProjectSettings = {
        version: 1,
        filter: {
          mode: 'preset',
          presetId: legacyPresetId,
          dirty: false,
        },
      };

      // 儲存新格式
      saveProjectSettings(type, id, migratedSettings);

      // 刪除舊 key
      localStorage.removeItem(legacyKey);

      console.log(
        `[ProjectSettings] Migrated legacy preset key: ${legacyKey} -> ${key}`,
      );

      return migratedSettings;
    }

    return null;
  } catch (error) {
    console.error('[ProjectSettings] Failed to load settings:', error);
    return null;
  }
}

/**
 * 儲存專案設定
 */
export function saveProjectSettings(
  type: 'project' | 'group',
  id: string | number,
  settings: ProjectSettings,
): void {
  try {
    const key = getProjectSettingsKey(type, id);
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (error) {
    console.error('[ProjectSettings] Failed to save settings:', error);
  }
}

/**
 * 更新專案的 Filter 設定
 */
export function updateProjectFilterSettings(
  type: 'project' | 'group',
  id: string | number,
  filter: FilterSettings | undefined,
): void {
  const settings = loadProjectSettings(type, id) || { version: 1 };
  settings.filter = filter;
  saveProjectSettings(type, id, settings);
}

/**
 * 更新專案的 ViewMode 設定
 */
export function updateProjectViewMode(
  type: 'project' | 'group',
  id: string | number,
  viewMode: ViewMode,
): void {
  const settings = loadProjectSettings(type, id) || { version: 1 };
  settings.viewMode = viewMode;
  saveProjectSettings(type, id, settings);
}

/**
 * 讀取專案的 ViewMode 設定
 * @returns ViewMode or undefined if not set
 */
export function getProjectViewMode(
  type: 'project' | 'group',
  id: string | number,
): ViewMode | undefined {
  const settings = loadProjectSettings(type, id);
  return settings?.viewMode;
}

/**
 * 從 FilterOptions 建立 StoredFilters
 * 支援同時儲存 client 和 server filters
 */
export function createStoredFilters(
  filterOptions: FilterOptions,
  serverFilters?: ServerFilterOptions,
): StoredFilters {
  const result: StoredFilters = {};

  // Always store client filters if present
  const hasClientFilters =
    (filterOptions.milestoneIds?.length ?? 0) > 0 ||
    (filterOptions.epicIds?.length ?? 0) > 0 ||
    (filterOptions.labels?.length ?? 0) > 0 ||
    (filterOptions.assignees?.length ?? 0) > 0 ||
    (filterOptions.states?.length ?? 0) > 0 ||
    !!filterOptions.search;

  if (hasClientFilters) {
    result.clientFilters = {
      milestoneIds: filterOptions.milestoneIds,
      epicIds: filterOptions.epicIds,
      labels: filterOptions.labels,
      assignees: filterOptions.assignees,
      states: filterOptions.states,
      search: filterOptions.search,
    };
  }

  // Always store server filters if present
  if (serverFilters) {
    const hasServerFilters =
      (serverFilters.labelNames?.length ?? 0) > 0 ||
      (serverFilters.milestoneTitles?.length ?? 0) > 0 ||
      (serverFilters.assigneeUsernames?.length ?? 0) > 0 ||
      !!serverFilters.dateRange?.createdAfter ||
      !!serverFilters.dateRange?.createdBefore;

    if (hasServerFilters) {
      result.serverFilters = serverFilters;
    }
  }

  return result;
}

/**
 * 從 StoredFilters 還原為 FilterOptions (client filters only)
 * Server filters should be accessed directly via stored.serverFilters
 */
export function restoreFilterOptions(stored: StoredFilters): FilterOptions {
  return {
    milestoneIds: stored.clientFilters?.milestoneIds,
    epicIds: stored.clientFilters?.epicIds,
    labels: stored.clientFilters?.labels,
    assignees: stored.clientFilters?.assignees,
    states: stored.clientFilters?.states,
    search: stored.clientFilters?.search,
  };
}

/**
 * 檢查 server filters 是否有值
 */
export function hasServerFilters(filters?: StoredFilters): boolean {
  if (!filters?.serverFilters) return false;
  const sf = filters.serverFilters;
  return (
    (sf.labelNames?.length ?? 0) > 0 ||
    (sf.milestoneTitles?.length ?? 0) > 0 ||
    (sf.assigneeUsernames?.length ?? 0) > 0 ||
    !!sf.dateRange?.createdAfter ||
    !!sf.dateRange?.createdBefore
  );
}

/**
 * 檢查 client filters 是否有值
 */
export function hasClientFilters(filters?: StoredFilters): boolean {
  if (!filters?.clientFilters) return false;
  const cf = filters.clientFilters;
  return (
    (cf.milestoneIds?.length ?? 0) > 0 ||
    (cf.epicIds?.length ?? 0) > 0 ||
    (cf.labels?.length ?? 0) > 0 ||
    (cf.assignees?.length ?? 0) > 0 ||
    (cf.states?.length ?? 0) > 0 ||
    !!cf.search
  );
}

/**
 * 檢查 filter 是否為空
 */
export function isFilterEmpty(filters?: StoredFilters): boolean {
  if (!filters) return true;
  return !hasServerFilters(filters) && !hasClientFilters(filters);
}

// ============================================================
// Preset Filter Helpers
// 用於檢查 preset.filters 物件（直接包含 client filter 欄位 + serverFilters 子物件）
// ============================================================

/**
 * 檢查 preset filters 是否有 server filters
 * @param presetFilters - preset.filters 物件
 */
export function presetHasServerFilters(presetFilters?: {
  serverFilters?: ServerFilterOptions;
}): boolean {
  if (!presetFilters?.serverFilters) return false;
  const sf = presetFilters.serverFilters;
  return (
    (sf.labelNames?.length ?? 0) > 0 ||
    (sf.milestoneTitles?.length ?? 0) > 0 ||
    (sf.assigneeUsernames?.length ?? 0) > 0 ||
    !!sf.dateRange?.createdAfter ||
    !!sf.dateRange?.createdBefore
  );
}

/**
 * 檢查 preset filters 是否有 client filters
 * @param presetFilters - preset.filters 物件
 */
export function presetHasClientFilters(presetFilters?: {
  milestoneIds?: number[];
  epicIds?: number[];
  labels?: string[];
  assignees?: string[];
  states?: string[];
  search?: string;
}): boolean {
  if (!presetFilters) return false;
  return (
    (presetFilters.milestoneIds?.length ?? 0) > 0 ||
    (presetFilters.epicIds?.length ?? 0) > 0 ||
    (presetFilters.labels?.length ?? 0) > 0 ||
    (presetFilters.assignees?.length ?? 0) > 0 ||
    (presetFilters.states?.length ?? 0) > 0 ||
    !!presetFilters.search
  );
}
