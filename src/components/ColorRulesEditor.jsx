/**
 * Color Rules Editor Component
 * UI for managing color rules that highlight tasks based on title patterns
 */

import { useState, useCallback } from 'react';
import './ColorRulesEditor.css';

// Predefined color palette (without alpha, will be combined with opacity)
const PREDEFINED_COLORS = [
  '#FF0000', // Red
  '#FF6B00', // Orange
  '#FFD700', // Gold
  '#00BA94', // Green (same as GitLab Task)
  '#00BFFF', // Deep Sky Blue
  '#3983EB', // Blue (same as GitLab Issue)
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#000000', // Black
];

/**
 * Generate a UUID v4
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Extract hex color from rgba or hex string
 */
function extractHexColor(color) {
  if (!color) return '#FF0000';
  if (color.startsWith('#')) return color;
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }
  return '#FF0000';
}

/**
 * Convert hex color to rgba with opacity
 */
function hexToRgba(hex, opacity) {
  if (!hex) return 'transparent';
  // If it's already rgba, extract the hex first
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
    hex = extractHexColor(hex);
  }
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Extract opacity from rgba or return default
 */
function extractOpacity(color) {
  if (!color) return 1;
  if (color.startsWith('#')) return 1;
  const match = color.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return 1;
}

/**
 * Test if a pattern matches a sample text
 */
function testPattern(text, pattern, matchType) {
  if (!text || !pattern) return false;

  if (matchType === 'contains') {
    return text.toLowerCase().includes(pattern.toLowerCase());
  } else if (matchType === 'regex') {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    } catch {
      return false;
    }
  }
  return false;
}

export function ColorRulesEditor({
  rules = [],
  onRulesChange,
  canEdit = true,
  saving = false,
}) {
  const [editingRule, setEditingRule] = useState(null);
  const [testText, setTestText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    pattern: '',
    matchType: 'contains',
    color: PREDEFINED_COLORS[0],
    opacity: 1,
  });

  // Add a new rule
  const handleAddRule = useCallback(() => {
    if (!newRule.name.trim() || !newRule.pattern.trim()) return;

    const rule = {
      id: generateId(),
      name: newRule.name.trim(),
      pattern: newRule.pattern.trim(),
      matchType: newRule.matchType,
      color: newRule.color,
      opacity: newRule.opacity,
      priority: rules.length,
      enabled: true,
    };

    onRulesChange([...rules, rule]);
    setNewRule({
      name: '',
      pattern: '',
      matchType: 'contains',
      color: PREDEFINED_COLORS[0],
      opacity: 1,
    });
    setShowAddForm(false);
  }, [newRule, rules, onRulesChange]);

  // Delete a rule
  const handleDeleteRule = useCallback((id) => {
    onRulesChange(rules.filter(r => r.id !== id));
  }, [rules, onRulesChange]);

  // Toggle rule enabled state
  const handleToggleEnabled = useCallback((id) => {
    onRulesChange(rules.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  }, [rules, onRulesChange]);

  // Update a rule
  const handleUpdateRule = useCallback((id, updates) => {
    onRulesChange(rules.map(r =>
      r.id === id ? { ...r, name: updates.name, pattern: updates.pattern, matchType: updates.matchType, color: updates.color, opacity: updates.opacity } : r
    ));
    setEditingRule(null);
  }, [rules, onRulesChange]);

  // Move rule up in priority
  const handleMoveUp = useCallback((index) => {
    if (index <= 0) return;
    const newRules = [...rules];
    [newRules[index - 1], newRules[index]] = [newRules[index], newRules[index - 1]];
    // Update priorities
    newRules.forEach((r, i) => r.priority = i);
    onRulesChange(newRules);
  }, [rules, onRulesChange]);

  // Move rule down in priority
  const handleMoveDown = useCallback((index) => {
    if (index >= rules.length - 1) return;
    const newRules = [...rules];
    [newRules[index], newRules[index + 1]] = [newRules[index + 1], newRules[index]];
    // Update priorities
    newRules.forEach((r, i) => r.priority = i);
    onRulesChange(newRules);
  }, [rules, onRulesChange]);

  // Start editing a rule
  const startEditing = useCallback((rule) => {
    const color = rule.color || '#FF0000';
    setEditingRule({
      ...rule,
      color: color.startsWith('#') ? color : extractHexColor(color),
      opacity: rule.opacity ?? 1,
    });
  }, []);

  return (
    <div className="color-rules-editor">
      {/* Test Area - moved to top */}
      <div className="color-rules-test">
        <label>Test Pattern:</label>
        <input
          type="text"
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Enter issue title to test matching..."
        />
        {testText && (
          <div className="color-rules-test-results">
            Matched rules:
            {rules.filter(r => r.enabled && testPattern(testText, r.pattern, r.matchType)).map(r => (
              <span
                key={r.id}
                className="matched-rule-tag"
                style={{ backgroundColor: hexToRgba(r.color, r.opacity ?? 1) }}
              >
                {r.name}
              </span>
            ))}
            {rules.filter(r => r.enabled && testPattern(testText, r.pattern, r.matchType)).length === 0 && (
              <span className="no-match">No match</span>
            )}
          </div>
        )}
      </div>

      {/* Rules List */}
      <div className="color-rules-list">
        {rules.length === 0 ? (
          <div className="color-rules-empty">
            No color rules defined. Click the button below to add a rule.
          </div>
        ) : (
          rules.map((rule, index) => (
            <div
              key={rule.id}
              className={`color-rule-item ${!rule.enabled ? 'disabled' : ''}`}
            >
              <div
                className="color-rule-color-preview"
                style={{ backgroundColor: hexToRgba(rule.color, rule.opacity ?? 1) }}
              />
              <div className="color-rule-info">
                <div className="color-rule-name">{rule.name}</div>
                <div className="color-rule-pattern">
                  {rule.matchType === 'regex' ? (
                    <span className="pattern-type">regex:</span>
                  ) : (
                    <span className="pattern-type">contains:</span>
                  )}
                  <code>{rule.pattern}</code>
                </div>
              </div>

              {canEdit && (
                <div className="color-rule-actions">
                  <button
                    className="color-rule-btn"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    title="Move Up"
                  >
                    <i className="fas fa-chevron-up" />
                  </button>
                  <button
                    className="color-rule-btn"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === rules.length - 1}
                    title="Move Down"
                  >
                    <i className="fas fa-chevron-down" />
                  </button>
                  <button
                    className="color-rule-btn"
                    onClick={() => handleToggleEnabled(rule.id)}
                    title={rule.enabled ? 'Disable' : 'Enable'}
                  >
                    <i className={`fas ${rule.enabled ? 'fa-eye' : 'fa-eye-slash'}`} />
                  </button>
                  <button
                    className="color-rule-btn"
                    onClick={() => startEditing(rule)}
                    title="Edit"
                  >
                    <i className="fas fa-edit" />
                  </button>
                  <button
                    className="color-rule-btn danger"
                    onClick={() => handleDeleteRule(rule.id)}
                    title="Delete"
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Rule Form */}
      {canEdit && (
        <>
          {showAddForm ? (
            <div className="color-rule-add-form">
              <div className="form-row">
                <label>Rule Name</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g., Urgent Tasks"
                />
              </div>
              <div className="form-row">
                <label>Match Type</label>
                <select
                  value={newRule.matchType}
                  onChange={(e) => setNewRule({ ...newRule, matchType: e.target.value })}
                >
                  <option value="contains">Contains Text</option>
                  <option value="regex">Regular Expression</option>
                </select>
              </div>
              <div className="form-row">
                <label>Pattern</label>
                <input
                  type="text"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                  placeholder={newRule.matchType === 'regex' ? 'e.g., \\[urgent\\]' : 'e.g., [urgent]'}
                />
              </div>
              <div className="form-row">
                <label>Stripe Color</label>
                <div className="color-picker">
                  {PREDEFINED_COLORS.map(color => (
                    <button
                      key={color}
                      className={`color-option ${newRule.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewRule({ ...newRule, color })}
                    />
                  ))}
                  <input
                    type="color"
                    value={newRule.color}
                    onChange={(e) => setNewRule({ ...newRule, color: e.target.value })}
                    className="color-input"
                  />
                </div>
              </div>
              <div className="form-row">
                <label>Opacity: {Math.round(newRule.opacity * 100)}%</label>
                <div className="opacity-slider-container">
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={newRule.opacity}
                    onChange={(e) => setNewRule({ ...newRule, opacity: parseFloat(e.target.value) })}
                    className="opacity-slider"
                  />
                  <div
                    className="opacity-preview"
                    style={{ backgroundColor: hexToRgba(newRule.color, newRule.opacity) }}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleAddRule}
                  disabled={!newRule.name.trim() || !newRule.pattern.trim()}
                >
                  Add
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="color-rule-add-btn"
              onClick={() => setShowAddForm(true)}
            >
              <i className="fas fa-plus" /> Add Color Rule
            </button>
          )}
        </>
      )}

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="color-rule-modal-overlay" onClick={() => setEditingRule(null)}>
          <div className="color-rule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Rule</h3>
              <button className="modal-close" onClick={() => setEditingRule(null)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>Rule Name</label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Match Type</label>
                <select
                  value={editingRule.matchType}
                  onChange={(e) => setEditingRule({ ...editingRule, matchType: e.target.value })}
                >
                  <option value="contains">Contains Text</option>
                  <option value="regex">Regular Expression</option>
                </select>
              </div>
              <div className="form-row">
                <label>Pattern</label>
                <input
                  type="text"
                  value={editingRule.pattern}
                  onChange={(e) => setEditingRule({ ...editingRule, pattern: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Stripe Color</label>
                <div className="color-picker">
                  {PREDEFINED_COLORS.map(color => (
                    <button
                      key={color}
                      className={`color-option ${editingRule.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditingRule({ ...editingRule, color })}
                    />
                  ))}
                  <input
                    type="color"
                    value={editingRule.color}
                    onChange={(e) => setEditingRule({ ...editingRule, color: e.target.value })}
                    className="color-input"
                  />
                </div>
              </div>
              <div className="form-row">
                <label>Opacity: {Math.round(editingRule.opacity * 100)}%</label>
                <div className="opacity-slider-container">
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={editingRule.opacity}
                    onChange={(e) => setEditingRule({ ...editingRule, opacity: parseFloat(e.target.value) })}
                    className="opacity-slider"
                  />
                  <div
                    className="opacity-preview"
                    style={{ backgroundColor: hexToRgba(editingRule.color, editingRule.opacity) }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => handleUpdateRule(editingRule.id, editingRule)}
              >
                Save
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setEditingRule(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="color-rules-saving">
          <i className="fas fa-spinner fa-spin" /> Saving...
        </div>
      )}
    </div>
  );
}
