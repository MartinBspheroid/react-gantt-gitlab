/**
 * Tests for baseline visualization logic.
 *
 * Since ParentBaselineBracket is defined inside Bars.jsx and not exported,
 * we test the baseline bracket geometry calculations and rendering logic
 * that the component uses.
 */

describe('Baseline Rendering Logic', () => {
  // Replicate BRACKET_CONFIG from Bars.jsx
  const BRACKET_CONFIG = {
    GAP: 10,
    ARM_LENGTH: 3,
    DROP_HEIGHT: 4,
    STROKE_WIDTH: 4,
  };

  describe('BRACKET_CONFIG constants', () => {
    it('should have reasonable gap between bar and bracket', () => {
      expect(BRACKET_CONFIG.GAP).toBeGreaterThan(0);
      expect(BRACKET_CONFIG.GAP).toBeLessThanOrEqual(20);
    });

    it('should have arm length smaller than drop height for subtle slant', () => {
      expect(BRACKET_CONFIG.ARM_LENGTH).toBeLessThanOrEqual(
        BRACKET_CONFIG.DROP_HEIGHT,
      );
    });
  });

  describe('bracket geometry calculations', () => {
    // These mirror the calculations inside ParentBaselineBracket
    function calculateBracket(task, cellWidth = 40) {
      const { GAP, ARM_LENGTH, DROP_HEIGHT } = BRACKET_CONFIG;
      const x = task.$x_base;
      const width = task.$w_base;
      const bracketTop = task.$y + task.$h + GAP;

      const minWidth = cellWidth || 40;
      const armLength = width < minWidth ? width / 2 : ARM_LENGTH;

      const points = `0,${DROP_HEIGHT} ${armLength},0 ${width - armLength},0 ${width},${DROP_HEIGHT}`;

      return { x, width, bracketTop, armLength, points };
    }

    it('should position bracket below the task bar', () => {
      const task = { $x_base: 100, $w_base: 200, $y: 50, $h: 30 };
      const result = calculateBracket(task);
      // bracket top = task.$y + task.$h + GAP = 50 + 30 + 10 = 90
      expect(result.bracketTop).toBe(90);
    });

    it('should use the baseline x position', () => {
      const task = { $x_base: 150, $w_base: 200, $y: 50, $h: 30 };
      const result = calculateBracket(task);
      expect(result.x).toBe(150);
    });

    it('should use the baseline width', () => {
      const task = { $x_base: 100, $w_base: 250, $y: 50, $h: 30 };
      const result = calculateBracket(task);
      expect(result.width).toBe(250);
    });

    it('should use normal arm length for wide bars', () => {
      const task = { $x_base: 100, $w_base: 200, $y: 50, $h: 30 };
      const result = calculateBracket(task, 40);
      expect(result.armLength).toBe(BRACKET_CONFIG.ARM_LENGTH);
    });

    it('should scale down arm length for narrow bars', () => {
      const task = { $x_base: 100, $w_base: 20, $y: 50, $h: 30 };
      const result = calculateBracket(task, 40);
      // When width (20) < cellWidth (40), armLength = width / 2 = 10
      expect(result.armLength).toBe(10);
    });

    it('should generate correct SVG polyline points for normal width', () => {
      const task = { $x_base: 0, $w_base: 200, $y: 0, $h: 30 };
      const result = calculateBracket(task, 40);
      // points: "0,4 3,0 197,0 200,4"
      expect(result.points).toBe('0,4 3,0 197,0 200,4');
    });

    it('should generate symmetric points for narrow bars', () => {
      const task = { $x_base: 0, $w_base: 10, $y: 0, $h: 30 };
      const result = calculateBracket(task, 40);
      // armLength = 10 / 2 = 5
      // points: "0,4 5,0 5,0 10,4"
      expect(result.points).toBe('0,4 5,0 5,0 10,4');
    });

    it('should handle zero width gracefully', () => {
      const task = { $x_base: 0, $w_base: 0, $y: 0, $h: 30 };
      const result = calculateBracket(task, 40);
      expect(result.armLength).toBe(0);
      expect(result.width).toBe(0);
    });
  });

  describe('baseline visibility logic', () => {
    // Mirrors the condition in Bars.jsx: baselinesValue && !task.$skip_baseline
    function shouldShowBaseline(baselinesEnabled, task) {
      return baselinesEnabled && !task.$skip_baseline;
    }

    function isParentBaseline(task) {
      return !!task.$parent;
    }

    function isMilestoneBaseline(task) {
      return task.type === 'milestone' || task.$isMilestone;
    }

    it('should show baseline when baselines enabled and not skipped', () => {
      expect(shouldShowBaseline(true, {})).toBe(true);
    });

    it('should not show baseline when baselines disabled', () => {
      expect(shouldShowBaseline(false, {})).toBe(false);
    });

    it('should not show baseline when task has $skip_baseline', () => {
      expect(shouldShowBaseline(true, { $skip_baseline: true })).toBe(false);
    });

    it('should detect parent task for bracket baseline', () => {
      expect(isParentBaseline({ $parent: 5 })).toBe(true);
      expect(isParentBaseline({ $parent: 0 })).toBe(false);
      expect(isParentBaseline({})).toBe(false);
    });

    it('should detect milestone by type', () => {
      expect(isMilestoneBaseline({ type: 'milestone' })).toBe(true);
      expect(isMilestoneBaseline({ type: 'task' })).toBeFalsy();
    });

    it('should detect milestone by $isMilestone flag', () => {
      expect(isMilestoneBaseline({ $isMilestone: true })).toBe(true);
      expect(isMilestoneBaseline({ $isMilestone: false })).toBeFalsy();
    });
  });

  describe('baseline style calculation', () => {
    function baselineStyle(task) {
      return {
        left: `${task.$x_base}px`,
        top: `${task.$y_base}px`,
        width: `${task.$w_base}px`,
        height: `${task.$h_base}px`,
      };
    }

    it('should generate correct CSS for non-parent baseline', () => {
      const task = {
        $x_base: 100,
        $y_base: 55,
        $w_base: 200,
        $h_base: 8,
      };
      const style = baselineStyle(task);
      expect(style).toEqual({
        left: '100px',
        top: '55px',
        width: '200px',
        height: '8px',
      });
    });

    it('should handle zero-width baseline (no date change)', () => {
      const task = {
        $x_base: 100,
        $y_base: 55,
        $w_base: 0,
        $h_base: 8,
      };
      const style = baselineStyle(task);
      expect(style.width).toBe('0px');
    });
  });

  describe('label offset calculation', () => {
    // Mirrors getLabelOffset from Bars.jsx
    const LINK_OFFSET_MAX = 20;
    const LABEL_GAP = 4;

    function getLabelOffset(cellWidth) {
      const linkOffset = Math.min(cellWidth / 2, LINK_OFFSET_MAX);
      return linkOffset + LABEL_GAP;
    }

    it('should use half cellWidth for narrow cells', () => {
      // cellWidth=20 → linkOffset = 10, total = 14
      expect(getLabelOffset(20)).toBe(14);
    });

    it('should cap at LINK_OFFSET_MAX for wide cells', () => {
      // cellWidth=100 → linkOffset = min(50, 20) = 20, total = 24
      expect(getLabelOffset(100)).toBe(24);
    });

    it('should handle cellWidth exactly at threshold', () => {
      // cellWidth=40 → linkOffset = min(20, 20) = 20, total = 24
      expect(getLabelOffset(40)).toBe(24);
    });

    it('should handle very small cellWidth', () => {
      // cellWidth=4 → linkOffset = 2, total = 6
      expect(getLabelOffset(4)).toBe(6);
    });
  });
});
