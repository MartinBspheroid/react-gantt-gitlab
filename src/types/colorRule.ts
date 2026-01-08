/**
 * Color Rule Types
 * 自訂顏色規則的類型定義，用於根據 issue title 條件匹配顯示不同顏色條紋
 */

/**
 * 匹配類型
 * - 'contains': 簡單文字包含 (不區分大小寫)
 * - 'regex': 正則表達式匹配
 */
export type ColorRuleMatchType = 'contains' | 'regex';

/**
 * 顏色規則
 */
export interface ColorRule {
  /** 唯一識別碼 (UUID v4) */
  id: string;
  /** 規則名稱 (使用者自訂) */
  name: string;
  /** 匹配模式 (文字或正則表達式) */
  pattern: string;
  /** 匹配類型 */
  matchType: ColorRuleMatchType;
  /** 條紋顏色 (hex 格式，如 '#FF0000') */
  color: string;
  /** 顏色透明度 (0-1，預設為 1) */
  opacity?: number;
  /** 優先順序 (數字越小優先度越高，用於條紋排序) */
  priority: number;
  /** 是否啟用 */
  enabled: boolean;
}

/**
 * 檢查 issue title 是否符合規則
 */
export function matchesRule(title: string, rule: ColorRule): boolean {
  if (!rule.enabled || !title || !rule.pattern) return false;

  if (rule.matchType === 'contains') {
    return title.toLowerCase().includes(rule.pattern.toLowerCase());
  } else if (rule.matchType === 'regex') {
    try {
      const regex = new RegExp(rule.pattern, 'i');
      return regex.test(title);
    } catch {
      // Invalid regex pattern, silently skip
      return false;
    }
  }
  return false;
}

/**
 * 取得符合的規則列表 (依優先度排序，最多 3 個)
 */
export function getMatchingRules(
  title: string,
  rules: ColorRule[],
): ColorRule[] {
  if (!title || !rules?.length) return [];

  return rules
    .filter((rule) => matchesRule(title, rule))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}
