/**
 * Color Rule Types
 * 自訂顏色規則的類型定義，用於根據 issue title 或 label 條件匹配顯示不同顏色條紋
 */

/**
 * 匹配類型
 * - 'contains': 簡單文字包含 (不區分大小寫)
 * - 'regex': 正則表達式匹配
 */
export type ColorRuleMatchType = 'contains' | 'regex';

/**
 * 條件類型
 * - 'title': 根據 issue title 匹配
 * - 'label': 根據 issue labels 匹配 (任一 label 符合即可)
 */
export type ColorRuleConditionType = 'title' | 'label';

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
  /** 條件類型 (title 或 label)，預設為 title */
  conditionType?: ColorRuleConditionType;
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
 * 將 labels 字串 (逗號分隔) 轉換為陣列
 * @param labelsString - 以 ', ' 分隔的 labels 字串
 */
export function parseLabelsString(
  labelsString: string | undefined | null,
): string[] {
  if (!labelsString) return [];
  return labelsString.split(', ').filter(Boolean);
}

/**
 * 匹配文字與 pattern (共用邏輯)
 */
export function matchPattern(
  text: string,
  pattern: string,
  matchType: ColorRuleMatchType,
): boolean {
  if (!text) return false;

  if (matchType === 'contains') {
    return text.toLowerCase().includes(pattern.toLowerCase());
  } else if (matchType === 'regex') {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    } catch {
      // Invalid regex pattern, silently skip
      return false;
    }
  }
  return false;
}

/**
 * 檢查 issue 是否符合規則
 * @param title - issue title
 * @param labels - issue labels 陣列
 * @param rule - 顏色規則
 */
export function matchesRule(
  title: string,
  labels: string[],
  rule: ColorRule,
): boolean {
  if (!rule.enabled || !rule.pattern) return false;

  const conditionType = rule.conditionType || 'title'; // 向下相容

  if (conditionType === 'title') {
    return matchPattern(title, rule.pattern, rule.matchType);
  } else {
    // label 條件：任一 label 符合即可
    return (labels || []).some((label) =>
      matchPattern(label, rule.pattern, rule.matchType),
    );
  }
}

/**
 * 取得符合的規則列表 (依優先度排序，最多 3 個)
 * @param title - issue title
 * @param labels - issue labels 陣列
 * @param rules - 所有顏色規則
 */
export function getMatchingRules(
  title: string,
  labels: string[],
  rules: ColorRule[],
): ColorRule[] {
  if (!rules?.length) return [];

  return rules
    .filter((rule) => matchesRule(title, labels, rule))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}
