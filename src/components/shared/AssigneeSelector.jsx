/**
 * AssigneeSelector Component
 *
 * 可重用的 assignee 選擇器，支援搜尋和多選
 * 用於 CreateItemDialog 和 Editor
 */

import { useState, useMemo, useCallback } from 'react';
import './AssigneeSelector.css';

/**
 * @typedef {Object} AssigneeOption
 * @property {string} value - 值（通常是 display name）
 * @property {string} label - 顯示文字
 * @property {string} [subtitle] - 副標題（如 @username）
 * @property {string} [username] - GitLab username
 */

/**
 * Assignee 選擇器元件
 * @param {Object} props
 * @param {AssigneeOption[]} props.options - 可選的成員列表
 * @param {string[]} props.selected - 已選擇的值
 * @param {(values: string[]) => void} props.onChange - 選擇變更回調
 * @param {boolean} [props.multiSelect=true] - 是否支援多選
 * @param {boolean} [props.disabled=false] - 是否禁用
 * @param {string} [props.placeholder='Search assignees...'] - 搜尋框 placeholder
 * @param {string} [props.emptyMessage='No members available'] - 無選項時的訊息
 * @param {number} [props.maxHeight=120] - 選項列表最大高度
 */
export function AssigneeSelector({
  options = [],
  selected = [],
  onChange,
  multiSelect = true,
  disabled = false,
  placeholder = 'Search assignees...',
  emptyMessage = 'No members available',
  maxHeight = 120,
}) {
  const [search, setSearch] = useState('');

  // 建立 selected Set 以提升查找效率
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // 過濾選項並將已選擇的排在前面
  const filteredOptions = useMemo(() => {
    let filtered = options;

    // 搜尋過濾
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchLower) ||
          (opt.subtitle && opt.subtitle.toLowerCase().includes(searchLower)),
      );
    }

    // 已選擇的排在前面
    if (selectedSet.size > 0) {
      const selectedItems = filtered.filter((opt) =>
        selectedSet.has(opt.value),
      );
      const unselectedItems = filtered.filter(
        (opt) => !selectedSet.has(opt.value),
      );
      return [...selectedItems, ...unselectedItems];
    }

    return filtered;
  }, [options, search, selectedSet]);

  // 計算可見已選數量
  const visibleSelectedCount = useMemo(() => {
    return filteredOptions.filter((opt) => selectedSet.has(opt.value)).length;
  }, [filteredOptions, selectedSet]);

  // 切換選擇
  const handleToggle = useCallback(
    (value) => {
      if (disabled) return;

      if (multiSelect) {
        const newSelected = selectedSet.has(value)
          ? selected.filter((v) => v !== value)
          : [...selected, value];
        onChange(newSelected);
      } else {
        // 單選模式：切換或取消
        onChange(selectedSet.has(value) ? [] : [value]);
      }
    },
    [disabled, multiSelect, selected, selectedSet, onChange],
  );

  // 全選（僅多選模式）
  const handleSelectAll = useCallback(() => {
    if (!multiSelect || disabled) return;
    const visibleValues = filteredOptions.map((opt) => opt.value);
    const newSelected = [...new Set([...selected, ...visibleValues])];
    onChange(newSelected);
  }, [multiSelect, disabled, filteredOptions, selected, onChange]);

  // 清除選擇
  const handleClearAll = useCallback(() => {
    if (disabled) return;
    if (search.trim()) {
      // 只清除可見的選項
      const visibleValues = new Set(filteredOptions.map((opt) => opt.value));
      onChange(selected.filter((v) => !visibleValues.has(v)));
    } else {
      onChange([]);
    }
  }, [disabled, search, filteredOptions, selected, onChange]);

  const showSearch = options.length > 5;
  const showActions = filteredOptions.length > 0 && multiSelect;

  return (
    <div className={`assignee-selector ${disabled ? 'disabled' : ''}`}>
      {/* 搜尋框 - 選項超過 5 個才顯示 */}
      {showSearch && (
        <div className="as-search">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="as-search-input"
            disabled={disabled}
          />
          {search && (
            <button
              className="as-search-clear"
              onClick={() => setSearch('')}
              title="Clear search"
              type="button"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* 選項列表 */}
      <div className="as-options" style={{ maxHeight }}>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => {
            const isSelected = selectedSet.has(opt.value);
            return (
              <label
                key={opt.value}
                className={`as-option ${isSelected ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(opt.value)}
                  disabled={disabled}
                />
                <span className="as-option-content">
                  <span className="as-option-label">{opt.label}</span>
                  {opt.subtitle && (
                    <span className="as-option-subtitle">{opt.subtitle}</span>
                  )}
                </span>
              </label>
            );
          })
        ) : (
          <div className="as-empty">
            {options.length === 0 ? emptyMessage : 'No matches'}
          </div>
        )}
      </div>

      {/* 快捷操作 + 已選擇提示 */}
      {(showActions || selected.length > 0) && (
        <div className="as-footer">
          {showActions && (
            <div className="as-actions">
              <button
                className="as-action-btn"
                onClick={handleSelectAll}
                disabled={
                  disabled || visibleSelectedCount === filteredOptions.length
                }
                type="button"
              >
                All
              </button>
              <button
                className="as-action-btn"
                onClick={handleClearAll}
                disabled={disabled || visibleSelectedCount === 0}
                type="button"
              >
                None
              </button>
            </div>
          )}
          {selected.length > 0 && (
            <span className="as-selected-hint">{selected.length} selected</span>
          )}
        </div>
      )}
    </div>
  );
}

export default AssigneeSelector;
