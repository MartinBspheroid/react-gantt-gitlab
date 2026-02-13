/**
 * useGanttColumns Hook Tests
 * Tests for cell rendering components (DateCell, WorkdaysCell, TaskTitleCell)
 * and editor items configuration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { useGanttColumns } from '../useGanttColumns';

// Mock the ColumnSettingsDropdown module
vi.mock('../../ColumnSettingsDropdown.tsx', () => ({
  buildColumnsFromSettings: vi.fn().mockReturnValue([]),
}));

// Mock DateEditCell
vi.mock('../../grid/DateEditCell.tsx', () => ({
  default: () => null,
}));

function renderColumns(overrides = {}) {
  return renderHook(() =>
    useGanttColumns({
      api: null,
      columnSettings: [],
      labelColorMap: new Map(),
      labelPriorityMap: new Map(),
      dateEditable: true,
      countWorkdays: vi.fn().mockReturnValue(5),
      ...overrides,
    }),
  );
}

describe('useGanttColumns', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // DateCell
  // =========================================================================

  describe('DateCell', () => {
    it('should show "None" for regular task without source date', () => {
      const { result } = renderColumns();
      const DateCell = result.current.DateCell;

      const { container } = render(
        <DateCell
          row={{ _source: {} }}
          column={{ id: 'start' }}
        />,
      );

      expect(container.textContent).toBe('None');
    });

    it('should format date as YY/MM/DD', () => {
      const { result } = renderColumns();
      const DateCell = result.current.DateCell;

      const { container } = render(
        <DateCell
          row={{ start: new Date('2025-03-15'), _source: { startDate: '2025-03-15' } }}
          column={{ id: 'start' }}
        />,
      );

      expect(container.textContent).toBe('25/03/15');
    });

    it('should always show dates for milestones (skip source check)', () => {
      const { result } = renderColumns();
      const DateCell = result.current.DateCell;

      const { container } = render(
        <DateCell
          row={{
            $isMilestone: true,
            start: new Date('2025-06-01'),
            _source: {},
          }}
          column={{ id: 'start' }}
        />,
      );

      expect(container.textContent).toBe('25/06/01');
    });

    it('should show "None" when date value is null', () => {
      const { result } = renderColumns();
      const DateCell = result.current.DateCell;

      const { container } = render(
        <DateCell
          row={{
            $isMilestone: true,
            start: null,
            _source: {},
          }}
          column={{ id: 'start' }}
        />,
      );

      expect(container.textContent).toBe('None');
    });

    it('should handle string dates', () => {
      const { result } = renderColumns();
      const DateCell = result.current.DateCell;

      const { container } = render(
        <DateCell
          row={{ end: '2025-12-25', _source: { dueDate: '2025-12-25' } }}
          column={{ id: 'end' }}
        />,
      );

      expect(container.textContent).toBe('25/12/25');
    });

    it('should check dueDate source field for end column', () => {
      const { result } = renderColumns();
      const DateCell = result.current.DateCell;

      // Has startDate but no dueDate - end column should show None
      const { container } = render(
        <DateCell
          row={{ end: new Date(), _source: { startDate: '2025-01-01' } }}
          column={{ id: 'end' }}
        />,
      );

      expect(container.textContent).toBe('None');
    });
  });

  // =========================================================================
  // WorkdaysCell
  // =========================================================================

  describe('WorkdaysCell', () => {
    it('should show workday count with "d" suffix', () => {
      const countWorkdays = vi.fn().mockReturnValue(5);
      const { result } = renderColumns({ countWorkdays });
      const WorkdaysCell = result.current.WorkdaysCell;

      const { container } = render(
        <WorkdaysCell
          row={{ start: new Date('2025-01-06'), end: new Date('2025-01-10') }}
        />,
      );

      expect(container.textContent).toBe('5d');
    });

    it('should return empty string when start is missing', () => {
      const { result } = renderColumns();
      const WorkdaysCell = result.current.WorkdaysCell;

      const { container } = render(
        <WorkdaysCell row={{ start: null, end: new Date() }} />,
      );

      expect(container.textContent).toBe('');
    });

    it('should return empty string when end is missing', () => {
      const { result } = renderColumns();
      const WorkdaysCell = result.current.WorkdaysCell;

      const { container } = render(
        <WorkdaysCell row={{ start: new Date(), end: null }} />,
      );

      expect(container.textContent).toBe('');
    });

    it('should return empty string when workdays is 0', () => {
      const countWorkdays = vi.fn().mockReturnValue(0);
      const { result } = renderColumns({ countWorkdays });
      const WorkdaysCell = result.current.WorkdaysCell;

      const { container } = render(
        <WorkdaysCell
          row={{ start: new Date(), end: new Date() }}
        />,
      );

      expect(container.textContent).toBe('');
    });
  });

  // =========================================================================
  // TaskTitleCell
  // =========================================================================

  describe('TaskTitleCell', () => {
    it('should render milestone with flag icon and purple color', () => {
      const { result } = renderColumns();
      const TaskTitleCell = result.current.TaskTitleCell;

      const { container } = render(
        <TaskTitleCell row={{ $isMilestone: true, text: 'Sprint 1' }} />,
      );

      expect(container.textContent).toContain('Sprint 1');
      const icon = container.querySelector('.far.fa-flag');
      expect(icon).not.toBeNull();
    });

    it('should render Task type with check icon and green color', () => {
      const { result } = renderColumns();
      const TaskTitleCell = result.current.TaskTitleCell;

      const { container } = render(
        <TaskTitleCell
          row={{ text: 'Task 1', _source: { workItemType: 'Task' } }}
        />,
      );

      expect(container.textContent).toContain('Task 1');
      const icon = container.querySelector('.far.fa-square-check');
      expect(icon).not.toBeNull();
    });

    it('should render Issue type with clipboard icon and blue color', () => {
      const { result } = renderColumns();
      const TaskTitleCell = result.current.TaskTitleCell;

      const { container } = render(
        <TaskTitleCell
          row={{ text: 'Issue 1', _source: { workItemType: 'Issue' } }}
        />,
      );

      expect(container.textContent).toContain('Issue 1');
      const icon = container.querySelector('.far.fa-clipboard');
      expect(icon).not.toBeNull();
    });

    it('should render group header with group name and task count', () => {
      const { result } = renderColumns();
      const TaskTitleCell = result.current.TaskTitleCell;

      const { container } = render(
        <TaskTitleCell
          row={{
            $groupHeader: true,
            $groupType: 'assignee',
            $groupName: 'Alice',
            $taskCount: 5,
            text: '',
          }}
        />,
      );

      expect(container.textContent).toContain('Alice');
      expect(container.textContent).toContain('5 tasks');
      const icon = container.querySelector('.fas.fa-user');
      expect(icon).not.toBeNull();
    });

    it('should use folder icon for unknown group type', () => {
      const { result } = renderColumns();
      const TaskTitleCell = result.current.TaskTitleCell;

      const { container } = render(
        <TaskTitleCell
          row={{
            $groupHeader: true,
            $groupType: 'unknown',
            $groupName: 'Group',
            $taskCount: 3,
            text: '',
          }}
        />,
      );

      const icon = container.querySelector('.fas.fa-folder');
      expect(icon).not.toBeNull();
    });

    it('should use epic icon for epic group type', () => {
      const { result } = renderColumns();
      const TaskTitleCell = result.current.TaskTitleCell;

      const { container } = render(
        <TaskTitleCell
          row={{
            $groupHeader: true,
            $groupType: 'epic',
            $groupName: 'Epic 1',
            $taskCount: 2,
            text: '',
          }}
        />,
      );

      const icon = container.querySelector('.fas.fa-layer-group');
      expect(icon).not.toBeNull();
    });

    it('should use sprint icon for sprint group type', () => {
      const { result } = renderColumns();
      const TaskTitleCell = result.current.TaskTitleCell;

      const { container } = render(
        <TaskTitleCell
          row={{
            $groupHeader: true,
            $groupType: 'sprint',
            $groupName: 'Sprint 1',
            $taskCount: 4,
            text: '',
          }}
        />,
      );

      const icon = container.querySelector('.fas.fa-repeat');
      expect(icon).not.toBeNull();
    });
  });

  // =========================================================================
  // columns configuration
  // =========================================================================

  describe('columns', () => {
    it('should always have Task Title as first column', () => {
      const { result } = renderColumns();

      expect(result.current.columns[0].id).toBe('text');
      expect(result.current.columns[0].header).toBe('Task Title');
    });

    it('should always have add-task as last column', () => {
      const { result } = renderColumns();
      const lastCol = result.current.columns[result.current.columns.length - 1];

      expect(lastCol.id).toBe('add-task');
      expect(lastCol.width).toBe(50);
    });
  });

  // =========================================================================
  // editorItems
  // =========================================================================

  describe('editorItems', () => {
    it('should have 6 editor items with correct keys', () => {
      const { result } = renderColumns();

      expect(result.current.editorItems).toHaveLength(6);
      const keys = result.current.editorItems.map((item) => item.key);
      expect(keys).toEqual([
        'text',
        'details',
        'start',
        'end',
        'workdays',
        'links',
      ]);
    });

    it('should use nullable-date comp for date fields', () => {
      const { result } = renderColumns();
      const startItem = result.current.editorItems.find((i) => i.key === 'start');
      const endItem = result.current.editorItems.find((i) => i.key === 'end');

      expect(startItem!.comp).toBe('nullable-date');
      expect(endItem!.comp).toBe('nullable-date');
    });
  });
});
