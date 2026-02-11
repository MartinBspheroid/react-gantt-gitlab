import {
  parseLabelsString,
  matchPattern,
  matchesRule,
  getMatchingRules,
  type ColorRule,
} from '../colorRule';

// Helper to create a ColorRule for testing
function makeRule(overrides: Partial<ColorRule> & { id: string }): ColorRule {
  return {
    name: 'Test Rule',
    pattern: 'test',
    matchType: 'contains',
    conditionType: 'title',
    color: '#FF0000',
    opacity: 1,
    priority: 1,
    enabled: true,
    ...overrides,
  };
}

describe('colorRule utilities', () => {
  describe('parseLabelsString', () => {
    it('should parse comma-separated labels', () => {
      expect(parseLabelsString('bug, feature, docs')).toEqual([
        'bug',
        'feature',
        'docs',
      ]);
    });

    it('should return empty array for null/undefined', () => {
      expect(parseLabelsString(null)).toEqual([]);
      expect(parseLabelsString(undefined)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(parseLabelsString('')).toEqual([]);
    });

    it('should handle single label', () => {
      expect(parseLabelsString('bug')).toEqual(['bug']);
    });

    it('should filter out empty strings from split', () => {
      expect(parseLabelsString(', , bug, ')).toEqual(['bug']);
    });
  });

  describe('matchPattern', () => {
    describe('contains match type', () => {
      it('should match case-insensitively', () => {
        expect(matchPattern('Hello World', 'hello', 'contains')).toBe(true);
      });

      it('should return true for substring match', () => {
        expect(matchPattern('Authentication Bug', 'auth', 'contains')).toBe(
          true,
        );
      });

      it('should return false when no match', () => {
        expect(matchPattern('Hello World', 'xyz', 'contains')).toBe(false);
      });

      it('should return false for empty text', () => {
        expect(matchPattern('', 'test', 'contains')).toBe(false);
      });

      it('should match empty pattern against any text', () => {
        expect(matchPattern('Hello', '', 'contains')).toBe(true);
      });
    });

    describe('regex match type', () => {
      it('should match using regex pattern', () => {
        expect(matchPattern('bug-123', 'bug-\\d+', 'regex')).toBe(true);
      });

      it('should be case-insensitive by default', () => {
        expect(matchPattern('BUG-123', 'bug-\\d+', 'regex')).toBe(true);
      });

      it('should return false for no regex match', () => {
        expect(matchPattern('feature-xyz', '^bug-\\d+$', 'regex')).toBe(false);
      });

      it('should handle invalid regex gracefully (return false)', () => {
        expect(matchPattern('test', '[invalid', 'regex')).toBe(false);
      });

      it('should support complex regex', () => {
        expect(matchPattern('US-015: Sprint tasks', 'US-\\d{3}', 'regex')).toBe(
          true,
        );
      });
    });

    it('should return false for null/undefined text', () => {
      expect(matchPattern(null as any, 'test', 'contains')).toBe(false);
      expect(matchPattern(undefined as any, 'test', 'regex')).toBe(false);
    });
  });

  describe('matchesRule', () => {
    it('should match title by contains', () => {
      const rule = makeRule({
        id: '1',
        pattern: 'auth',
        conditionType: 'title',
      });
      expect(matchesRule('Authentication bug', [], rule)).toBe(true);
    });

    it('should not match title when pattern not found', () => {
      const rule = makeRule({
        id: '1',
        pattern: 'payment',
        conditionType: 'title',
      });
      expect(matchesRule('Authentication bug', [], rule)).toBe(false);
    });

    it('should match labels when conditionType is label', () => {
      const rule = makeRule({
        id: '1',
        pattern: 'bug',
        conditionType: 'label',
      });
      expect(matchesRule('Some title', ['bug', 'feature'], rule)).toBe(true);
    });

    it('should not match if no labels match', () => {
      const rule = makeRule({
        id: '1',
        pattern: 'critical',
        conditionType: 'label',
      });
      expect(matchesRule('Title', ['bug', 'feature'], rule)).toBe(false);
    });

    it('should return false for disabled rules', () => {
      const rule = makeRule({ id: '1', enabled: false });
      expect(matchesRule('test match', [], rule)).toBe(false);
    });

    it('should return false for rules with empty pattern', () => {
      const rule = makeRule({ id: '1', pattern: '' });
      expect(matchesRule('anything', [], rule)).toBe(false);
    });

    it('should default conditionType to title when not specified', () => {
      const rule = makeRule({ id: '1', pattern: 'hello' });
      delete (rule as any).conditionType;
      expect(matchesRule('hello world', ['unrelated'], rule)).toBe(true);
    });

    it('should match any label in array (label condition)', () => {
      const rule = makeRule({
        id: '1',
        pattern: 'urgent',
        conditionType: 'label',
      });
      expect(matchesRule('Title', ['normal', 'urgent', 'docs'], rule)).toBe(
        true,
      );
    });

    it('should handle null labels array for label condition', () => {
      const rule = makeRule({
        id: '1',
        pattern: 'bug',
        conditionType: 'label',
      });
      expect(matchesRule('Title', null as any, rule)).toBe(false);
    });

    it('should match labels with regex', () => {
      const rule = makeRule({
        id: '1',
        pattern: 'p[0-2]',
        matchType: 'regex',
        conditionType: 'label',
      });
      expect(matchesRule('Title', ['P1', 'feature'], rule)).toBe(true);
    });
  });

  describe('getMatchingRules', () => {
    it('should return matching rules sorted by priority', () => {
      const rules = [
        makeRule({ id: '1', pattern: 'test', priority: 3 }),
        makeRule({ id: '2', pattern: 'test', priority: 1 }),
        makeRule({ id: '3', pattern: 'test', priority: 2 }),
      ];

      const result = getMatchingRules('test task', [], rules);
      expect(result.map((r) => r.id)).toEqual(['2', '3', '1']);
    });

    it('should return at most 3 matching rules', () => {
      const rules = [
        makeRule({ id: '1', pattern: 'a', priority: 1 }),
        makeRule({ id: '2', pattern: 'a', priority: 2 }),
        makeRule({ id: '3', pattern: 'a', priority: 3 }),
        makeRule({ id: '4', pattern: 'a', priority: 4 }),
      ];

      const result = getMatchingRules('a task', [], rules);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toEqual(['1', '2', '3']);
    });

    it('should filter out non-matching rules', () => {
      const rules = [
        makeRule({ id: '1', pattern: 'bug', priority: 1 }),
        makeRule({ id: '2', pattern: 'feature', priority: 2 }),
        makeRule({ id: '3', pattern: 'bug', priority: 3 }),
      ];

      const result = getMatchingRules('bug fix', [], rules);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual(['1', '3']);
    });

    it('should filter out disabled rules', () => {
      const rules = [
        makeRule({ id: '1', pattern: 'test', priority: 1, enabled: true }),
        makeRule({ id: '2', pattern: 'test', priority: 2, enabled: false }),
      ];

      const result = getMatchingRules('test', [], rules);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array for null/empty rules', () => {
      expect(getMatchingRules('test', [], null as any)).toEqual([]);
      expect(getMatchingRules('test', [], [])).toEqual([]);
    });

    it('should return empty array when nothing matches', () => {
      const rules = [
        makeRule({ id: '1', pattern: 'xyz' }),
        makeRule({ id: '2', pattern: 'abc' }),
      ];

      const result = getMatchingRules('nothing matches here', [], rules);
      expect(result).toEqual([]);
    });

    it('should work with mixed title and label conditions', () => {
      const rules = [
        makeRule({
          id: '1',
          pattern: 'auth',
          conditionType: 'title',
          priority: 1,
        }),
        makeRule({
          id: '2',
          pattern: 'bug',
          conditionType: 'label',
          priority: 2,
        }),
        makeRule({
          id: '3',
          pattern: 'payment',
          conditionType: 'title',
          priority: 3,
        }),
      ];

      const result = getMatchingRules(
        'auth login issue',
        ['bug', 'urgent'],
        rules,
      );
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual(['1', '2']);
    });

    it('should handle regex matching in getMatchingRules', () => {
      const rules = [
        makeRule({
          id: '1',
          pattern: '^US-\\d{3}',
          matchType: 'regex',
          priority: 1,
        }),
      ];

      const result = getMatchingRules('US-015: Sprint tasks', [], rules);
      expect(result).toHaveLength(1);
    });
  });

  describe('ColorRule type integration', () => {
    it('should support full rule lifecycle: create, match, get results', () => {
      const rules: ColorRule[] = [
        {
          id: 'rule-1',
          name: 'High Priority',
          pattern: 'P[01]',
          matchType: 'regex',
          conditionType: 'label',
          color: '#FF0000',
          opacity: 0.8,
          priority: 1,
          enabled: true,
        },
        {
          id: 'rule-2',
          name: 'Feature Work',
          pattern: 'feature',
          matchType: 'contains',
          conditionType: 'label',
          color: '#00FF00',
          opacity: 0.7,
          priority: 2,
          enabled: true,
        },
        {
          id: 'rule-3',
          name: 'API Tasks',
          pattern: 'api',
          matchType: 'contains',
          conditionType: 'title',
          color: '#0000FF',
          opacity: 0.9,
          priority: 3,
          enabled: true,
        },
      ];

      const labels = parseLabelsString('P0, feature, docs');
      expect(labels).toEqual(['P0', 'feature', 'docs']);

      const matching = getMatchingRules('API endpoint task', labels, rules);
      expect(matching).toHaveLength(3);
      expect(matching[0].name).toBe('High Priority');
      expect(matching[1].name).toBe('Feature Work');
      expect(matching[2].name).toBe('API Tasks');
    });
  });
});
