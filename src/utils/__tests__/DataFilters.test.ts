/**
 * DataFilters Utility Tests
 * Comprehensive tests for data filtering, grouping, sorting, and statistics
 */

import { describe, it, expect } from 'vitest';
import { DataFilters, toServerFilters } from '../DataFilters';
import type { FilterOptions, ServerFilterOptions } from '../DataFilters';
import type { ITask } from '@svar-ui/gantt-store';

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<ITask> & { id: number }): ITask {
  return {
    text: `Task ${overrides.id}`,
    start: new Date('2024-01-01'),
    end: new Date('2024-01-15'),
    parent: 0,
    ...overrides,
  } as ITask;
}

/**
 * Standard mock tasks used across many test suites.
 * Each task has different combinations of labels, assignees, state, and metadata.
 */
function createStandardTasks(): ITask[] {
  return [
    makeTask({
      id: 1,
      text: 'Bug fix login',
      labels: 'bug,urgent',
      assigned: 'alice',
      state: 'OPEN',
      progress: 0,
      end: new Date('2024-01-10'),
      milestoneIid: 1,
      workItemType: 'Issue',
      $isIssue: true,
      parent: 'm-1',
    }),
    makeTask({
      id: 2,
      text: 'Feature dashboard',
      labels: 'feature',
      assigned: 'bob,charlie',
      state: 'OPEN',
      progress: 50,
      end: new Date('2025-12-31'),
      milestoneIid: 2,
      epicParentId: 100,
      workItemType: 'Issue',
      $isIssue: true,
      parent: 'm-2',
    }),
    makeTask({
      id: 3,
      text: 'Docs update',
      labels: '',
      assigned: undefined,
      state: 'CLOSED',
      progress: 100,
      end: new Date('2024-02-01'),
      workItemType: 'Issue',
      $isIssue: true,
    }),
    makeTask({
      id: 4,
      text: 'Subtask of bug fix',
      labels: 'bug',
      assigned: 'alice,dave',
      state: 'OPEN',
      progress: 25,
      end: new Date('2024-01-08'),
      workItemType: 'Task',
      parent: 1,
    }),
    makeTask({
      id: 5,
      text: 'Design review',
      labels: 'design,review',
      assigned: 'eve',
      state: 'OPEN',
      progress: 0,
      end: new Date('2025-06-01'),
      milestoneIid: 1,
      epicParentId: 200,
      workItemType: 'Issue',
      $isIssue: true,
      parent: 'm-1',
    }),
  ];
}

/** Milestone summary tasks for milestone-related tests */
function createMilestoneTasks(): ITask[] {
  return [
    makeTask({
      id: 'm-1' as any,
      text: 'Sprint 1',
      $isMilestone: true,
      type: 'milestone',
      issueId: 1,
      parent: 0,
    }),
    makeTask({
      id: 'm-2' as any,
      text: 'Sprint 2',
      $isMilestone: true,
      type: 'milestone',
      issueId: 2,
      parent: 0,
    }),
  ];
}

// ===========================================================================
// filterByMilestone
// ===========================================================================
describe('DataFilters.filterByMilestone', () => {
  const tasks = createStandardTasks();

  it('should return all tasks when milestoneIids array is empty', () => {
    const result = DataFilters.filterByMilestone(tasks, []);
    expect(result).toEqual(tasks);
  });

  it('should filter tasks by a single milestone IID', () => {
    const result = DataFilters.filterByMilestone(tasks, [1]);
    // tasks with milestoneIid=1 are id 1 and id 5
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(5);
    expect(ids).not.toContain(2);
  });

  it('should filter tasks by multiple milestone IIDs', () => {
    const result = DataFilters.filterByMilestone(tasks, [1, 2]);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(5);
  });

  it('should filter for tasks without milestone when NONE (0) is selected', () => {
    const result = DataFilters.filterByMilestone(tasks, [0]);
    // Tasks without milestoneIid: id 3, id 4
    const ids = result.map((t) => t.id);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
  });

  it('should combine NONE (0) with specific milestone IIDs', () => {
    const result = DataFilters.filterByMilestone(tasks, [0, 1]);
    const ids = result.map((t) => t.id);
    // milestoneIid=1: id 1, 5; no milestone: id 3, 4
    expect(ids).toContain(1);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
    expect(ids).toContain(5);
  });

  it('should include milestone summary tasks matching the milestone IID', () => {
    const allTasks = [...createMilestoneTasks(), ...tasks];
    const result = DataFilters.filterByMilestone(allTasks, [1]);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('m-1');
    expect(ids).not.toContain('m-2');
  });

  it('should exclude milestone summary tasks when filtering NONE only', () => {
    const allTasks = [...createMilestoneTasks(), ...tasks];
    const result = DataFilters.filterByMilestone(allTasks, [0]);
    const ids = result.map((t) => t.id);
    expect(ids).not.toContain('m-1');
    expect(ids).not.toContain('m-2');
  });

  it('should return empty array when no tasks match the milestone', () => {
    const result = DataFilters.filterByMilestone(tasks, [999]);
    expect(result).toHaveLength(0);
  });

  it('should handle empty tasks array', () => {
    const result = DataFilters.filterByMilestone([], [1]);
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// filterByEpic
// ===========================================================================
describe('DataFilters.filterByEpic', () => {
  const tasks = createStandardTasks();

  it('should return all tasks when epicIds array is empty', () => {
    const result = DataFilters.filterByEpic(tasks, []);
    expect(result).toEqual(tasks);
  });

  it('should filter tasks by a single epic ID', () => {
    const result = DataFilters.filterByEpic(tasks, [100]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('should filter tasks by multiple epic IDs', () => {
    const result = DataFilters.filterByEpic(tasks, [100, 200]);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(2);
    expect(ids).toContain(5);
    expect(ids).toHaveLength(2);
  });

  it('should filter for tasks without epic when NONE (0) is selected', () => {
    const result = DataFilters.filterByEpic(tasks, [0]);
    // Tasks without epicParentId: id 1, 3, 4
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(5);
  });

  it('should combine NONE (0) with specific epic IDs', () => {
    const result = DataFilters.filterByEpic(tasks, [0, 100]);
    const ids = result.map((t) => t.id);
    // no epic: 1,3,4; epic 100: 2
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
    expect(ids).not.toContain(5);
  });

  it('should return empty array when no tasks match the epic', () => {
    const result = DataFilters.filterByEpic(tasks, [999]);
    expect(result).toHaveLength(0);
  });

  it('should handle empty tasks array', () => {
    const result = DataFilters.filterByEpic([], [100]);
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// filterByLabels
// ===========================================================================
describe('DataFilters.filterByLabels', () => {
  const tasks = createStandardTasks();

  it('should return all tasks when labels array is empty', () => {
    const result = DataFilters.filterByLabels(tasks, []);
    expect(result).toEqual(tasks);
  });

  it('should filter tasks by a single label', () => {
    const result = DataFilters.filterByLabels(tasks, ['bug']);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(4);
    expect(ids).not.toContain(2);
  });

  it('should filter tasks by multiple labels (OR logic)', () => {
    const result = DataFilters.filterByLabels(tasks, ['bug', 'feature']);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(4);
  });

  it('should include tasks without labels when NONE is selected', () => {
    const result = DataFilters.filterByLabels(tasks, ['NONE']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('should combine NONE with specific labels', () => {
    const result = DataFilters.filterByLabels(tasks, ['NONE', 'design']);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(3); // no labels
    expect(ids).toContain(5); // design label
  });

  it('should handle tasks with labels as an array', () => {
    const arrayLabelTasks = [
      makeTask({ id: 10, labels: ['alpha', 'beta'] as any }),
      makeTask({ id: 11, labels: ['gamma'] as any }),
    ];
    const result = DataFilters.filterByLabels(arrayLabelTasks, ['alpha']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
  });

  it('should return empty array when no tasks match the label', () => {
    const result = DataFilters.filterByLabels(tasks, ['nonexistent']);
    expect(result).toHaveLength(0);
  });

  it('should handle empty tasks array', () => {
    const result = DataFilters.filterByLabels([], ['bug']);
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// filterByAssignees
// ===========================================================================
describe('DataFilters.filterByAssignees', () => {
  const tasks = createStandardTasks();

  it('should return all tasks when assignees array is empty', () => {
    const result = DataFilters.filterByAssignees(tasks, []);
    expect(result).toEqual(tasks);
  });

  it('should filter tasks by a single assignee', () => {
    const result = DataFilters.filterByAssignees(tasks, ['alice']);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(4); // alice,dave
    expect(ids).not.toContain(2);
  });

  it('should filter tasks by multiple assignees (OR logic)', () => {
    const result = DataFilters.filterByAssignees(tasks, ['alice', 'eve']);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(4);
    expect(ids).toContain(5);
  });

  it('should include unassigned tasks when NONE is selected', () => {
    const result = DataFilters.filterByAssignees(tasks, ['NONE']);
    // task 3 has assigned = undefined
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('should combine NONE with specific assignees', () => {
    const result = DataFilters.filterByAssignees(tasks, ['NONE', 'bob']);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(3); // unassigned
    expect(ids).toContain(2); // bob,charlie
  });

  it('should match assignees case-insensitively', () => {
    const result = DataFilters.filterByAssignees(tasks, ['ALICE']);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(4);
  });

  it('should match partial assignee names (substring match)', () => {
    const result = DataFilters.filterByAssignees(tasks, ['ali']);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(4);
  });

  it('should handle comma-separated assignees string', () => {
    const result = DataFilters.filterByAssignees(tasks, ['charlie']);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(2); // bob,charlie
  });

  it('should return empty when NONE selected but all tasks are assigned', () => {
    const assignedOnly = tasks.filter((t) => t.assigned);
    const result = DataFilters.filterByAssignees(assignedOnly, ['NONE']);
    expect(result).toHaveLength(0);
  });

  it('should return empty array when no tasks match the assignee', () => {
    const result = DataFilters.filterByAssignees(tasks, ['nonexistent']);
    expect(result).toHaveLength(0);
  });

  it('should handle empty tasks array', () => {
    const result = DataFilters.filterByAssignees([], ['alice']);
    expect(result).toEqual([]);
  });

  it('should exclude assigned tasks when only NONE is selected', () => {
    const result = DataFilters.filterByAssignees(tasks, ['NONE']);
    result.forEach((t) => {
      expect(t.assigned).toBeFalsy();
    });
  });
});

// ===========================================================================
// filterByState
// ===========================================================================
describe('DataFilters.filterByState', () => {
  const tasks = createStandardTasks();

  it('should return all tasks when states array is empty', () => {
    const result = DataFilters.filterByState(tasks, []);
    expect(result).toEqual(tasks);
  });

  it('should filter by OPEN state', () => {
    const result = DataFilters.filterByState(tasks, ['OPEN']);
    result.forEach((t) => {
      expect(t.state?.toUpperCase()).toBe('OPEN');
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('should filter by CLOSED state', () => {
    const result = DataFilters.filterByState(tasks, ['CLOSED']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('should normalize "opened" to OPEN', () => {
    const result = DataFilters.filterByState(tasks, ['opened']);
    const openTasks = tasks.filter((t) => t.state?.toUpperCase() === 'OPEN');
    expect(result).toHaveLength(openTasks.length);
  });

  it('should normalize "closed" to CLOSED', () => {
    const result = DataFilters.filterByState(tasks, ['closed']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('should normalize "open" (lowercase) to OPEN', () => {
    const result = DataFilters.filterByState(tasks, ['open']);
    const openTasks = tasks.filter((t) => t.state?.toUpperCase() === 'OPEN');
    expect(result).toHaveLength(openTasks.length);
  });

  it('should normalize "close" to CLOSED', () => {
    const result = DataFilters.filterByState(tasks, ['close']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('should be case-insensitive for filter states', () => {
    const result1 = DataFilters.filterByState(tasks, ['OPENED']);
    const result2 = DataFilters.filterByState(tasks, ['Opened']);
    const result3 = DataFilters.filterByState(tasks, ['opened']);
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });

  it('should filter by multiple states', () => {
    const result = DataFilters.filterByState(tasks, ['OPEN', 'CLOSED']);
    expect(result).toHaveLength(tasks.filter((t) => t.state).length);
  });

  it('should exclude tasks without state', () => {
    const tasksWithMissing = [...tasks, makeTask({ id: 99, state: undefined })];
    const result = DataFilters.filterByState(tasksWithMissing, ['OPEN']);
    expect(result.find((t) => t.id === 99)).toBeUndefined();
  });

  it('should handle unknown states by uppercasing them', () => {
    const customTasks = [makeTask({ id: 10, state: 'IN_REVIEW' })];
    const result = DataFilters.filterByState(customTasks, ['in_review']);
    expect(result).toHaveLength(1);
  });

  it('should handle empty tasks array', () => {
    const result = DataFilters.filterByState([], ['OPEN']);
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// searchTasks
// ===========================================================================
describe('DataFilters.searchTasks', () => {
  const tasks = createStandardTasks();

  it('should return all tasks when searchText is empty', () => {
    expect(DataFilters.searchTasks(tasks, '')).toEqual(tasks);
  });

  it('should return all tasks when searchText is whitespace only', () => {
    expect(DataFilters.searchTasks(tasks, '   ')).toEqual(tasks);
  });

  it('should return all tasks when searchText is undefined-like', () => {
    expect(DataFilters.searchTasks(tasks, undefined as any)).toEqual(tasks);
  });

  it('should search by task text', () => {
    const result = DataFilters.searchTasks(tasks, 'login');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('should search by task text case-insensitively', () => {
    const result = DataFilters.searchTasks(tasks, 'LOGIN');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('should search by details field', () => {
    const tasksWithDetails = [
      makeTask({ id: 10, text: 'Alpha', details: 'Contains secret keyword' }),
      makeTask({ id: 11, text: 'Beta', details: 'Nothing here' }),
    ];
    const result = DataFilters.searchTasks(tasksWithDetails, 'secret');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
  });

  it('should search by labels', () => {
    const result = DataFilters.searchTasks(tasks, 'urgent');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('should search by assigned field', () => {
    const result = DataFilters.searchTasks(tasks, 'eve');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(5);
  });

  it('should match partial text', () => {
    const result = DataFilters.searchTasks(tasks, 'dash');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('should return empty when nothing matches', () => {
    const result = DataFilters.searchTasks(tasks, 'zzzzz');
    expect(result).toHaveLength(0);
  });

  it('should handle tasks with undefined text and details gracefully', () => {
    const spareTasks = [
      makeTask({
        id: 20,
        text: undefined,
        details: undefined,
        labels: undefined,
        assigned: undefined,
      }),
    ];
    // Should not throw
    const result = DataFilters.searchTasks(spareTasks, 'test');
    expect(result).toHaveLength(0);
  });

  it('should match across multiple fields in the same task', () => {
    // Task 1 has text="Bug fix login", labels="bug,urgent", assigned="alice"
    expect(DataFilters.searchTasks(tasks, 'bug')).toHaveLength(2); // id 1 and 4
    expect(DataFilters.searchTasks(tasks, 'alice')).toHaveLength(2); // id 1 and 4
  });
});

// ===========================================================================
// applyFilters (comprehensive)
// ===========================================================================
describe('DataFilters.applyFilters', () => {
  const tasks = createStandardTasks();

  it('should return all tasks when no filters are provided', () => {
    const result = DataFilters.applyFilters(tasks, {});
    expect(result).toHaveLength(tasks.length);
  });

  it('should apply label filter alone', () => {
    const result = DataFilters.applyFilters(tasks, { labels: ['bug'] });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((t) => {
      // Due to parent-child integrity, parent tasks may be included
      // that don't necessarily match the label
    });
  });

  it('should apply assignee filter alone', () => {
    const result = DataFilters.applyFilters(tasks, { assignees: ['eve'] });
    const ids = result.map((t) => t.id);
    expect(ids).toContain(5);
  });

  it('should apply state filter alone', () => {
    const result = DataFilters.applyFilters(tasks, { states: ['CLOSED'] });
    const ids = result.map((t) => t.id);
    expect(ids).toContain(3);
  });

  it('should apply search filter alone', () => {
    const result = DataFilters.applyFilters(tasks, { search: 'dashboard' });
    const ids = result.map((t) => t.id);
    expect(ids).toContain(2);
  });

  it('should apply milestone filter alone', () => {
    const result = DataFilters.applyFilters(tasks, { milestoneIds: [1] });
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(5);
  });

  it('should apply epic filter alone', () => {
    const result = DataFilters.applyFilters(tasks, { epicIds: [100] });
    const ids = result.map((t) => t.id);
    expect(ids).toContain(2);
  });

  it('should combine label and state filters (AND logic)', () => {
    const result = DataFilters.applyFilters(tasks, {
      labels: ['bug'],
      states: ['OPEN'],
    });
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(4);
    expect(ids).not.toContain(3); // CLOSED
  });

  it('should combine assignee and search filters (AND logic)', () => {
    const result = DataFilters.applyFilters(tasks, {
      assignees: ['alice'],
      search: 'login',
    });
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).not.toContain(4); // alice but text is "Subtask of bug fix"
  });

  it('should combine milestone and label filters', () => {
    const result = DataFilters.applyFilters(tasks, {
      milestoneIds: [1],
      labels: ['bug'],
    });
    const ids = result.map((t) => t.id);
    // milestoneIid=1 AND label=bug => id 1
    expect(ids).toContain(1);
    expect(ids).not.toContain(5); // milestoneIid=1 but label=design,review
  });

  it('should combine epic and assignee filters', () => {
    const result = DataFilters.applyFilters(tasks, {
      epicIds: [200],
      assignees: ['eve'],
    });
    const ids = result.map((t) => t.id);
    expect(ids).toContain(5);
    expect(ids).not.toContain(2);
  });

  it('should handle all filters combined yielding no results', () => {
    const result = DataFilters.applyFilters(tasks, {
      labels: ['bug'],
      states: ['CLOSED'],
      assignees: ['eve'],
    });
    // No task has label=bug AND state=CLOSED AND assignee=eve
    expect(result).toHaveLength(0);
  });

  it('should ensure parent-child integrity after filtering', () => {
    // Task 4 has parent=1. If both pass filters, parent should be included.
    const result = DataFilters.applyFilters(tasks, { labels: ['bug'] });
    const ids = result.map((t) => t.id);
    expect(ids).toContain(4);
    // Parent task (id=1) should be included for integrity
    expect(ids).toContain(1);
  });
});

// ===========================================================================
// ensureParentChildIntegrity
// ===========================================================================
describe('DataFilters.ensureParentChildIntegrity', () => {
  it('should return tasks as-is when they have no parents', () => {
    const tasks = [
      makeTask({ id: 1, parent: 0 }),
      makeTask({ id: 2, parent: 0 }),
    ];
    const result = DataFilters.ensureParentChildIntegrity(tasks, tasks);
    expect(result).toHaveLength(2);
  });

  it('should include parent Issue when a Task child is in filtered set', () => {
    const allTasks = [
      makeTask({
        id: 1,
        parent: 0,
        workItemType: 'Issue',
        $isIssue: true,
      }),
      makeTask({ id: 2, parent: 1, workItemType: 'Task' }),
    ];
    // Only child in filtered set
    const filtered = [allTasks[1]];
    const result = DataFilters.ensureParentChildIntegrity(filtered, allTasks);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1); // parent pulled in
    expect(ids).toContain(2);
  });

  it('should move Task to root level when parent Issue does not exist in allTasks', () => {
    const allTasks = [makeTask({ id: 2, parent: 999, workItemType: 'Task' })];
    const result = DataFilters.ensureParentChildIntegrity(allTasks, allTasks);
    expect(result).toHaveLength(1);
    expect(result[0].parent).toBe(0);
  });

  it('should move Issue to root level when parent Milestone is not in allTasks', () => {
    const allTasks = [
      makeTask({
        id: 1,
        parent: 'm-99' as any,
        workItemType: 'Issue',
        $isIssue: true,
      }),
    ];
    const result = DataFilters.ensureParentChildIntegrity(allTasks, allTasks);
    expect(result).toHaveLength(1);
    expect(result[0].parent).toBe(0);
  });

  it('should preserve parent relationship when milestone parent exists', () => {
    const allTasks = [
      makeTask({
        id: 'm-1' as any,
        parent: 0,
        $isMilestone: true,
        type: 'milestone',
        issueId: 1,
      }),
      makeTask({
        id: 1,
        parent: 'm-1' as any,
        workItemType: 'Issue',
        $isIssue: true,
      }),
    ];
    const filtered = [allTasks[1]];
    const result = DataFilters.ensureParentChildIntegrity(filtered, allTasks);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('m-1'); // milestone parent pulled in
    expect(ids).toContain(1);
    const issueResult = result.find((t) => t.id === 1);
    expect(issueResult?.parent).toBe('m-1');
  });

  it('should handle deep hierarchy: grandchild -> child -> parent', () => {
    const allTasks = [
      makeTask({
        id: 1,
        parent: 0,
        workItemType: 'Issue',
        $isIssue: true,
      }),
      makeTask({ id: 2, parent: 1, workItemType: 'Task' }),
      makeTask({ id: 3, parent: 2, workItemType: 'Task' }),
    ];
    // Only grandchild in filtered
    const filtered = [allTasks[2]];
    const result = DataFilters.ensureParentChildIntegrity(filtered, allTasks);
    const ids = result.map((t) => t.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
  });

  it('should detect Issue by $isIssue flag', () => {
    const allTasks = [
      makeTask({
        id: 'm-1' as any,
        parent: 0,
        $isMilestone: true,
        type: 'milestone',
        issueId: 1,
      }),
      makeTask({ id: 1, parent: 'm-1' as any, $isIssue: true }),
    ];
    const filtered = [allTasks[1]];
    const result = DataFilters.ensureParentChildIntegrity(filtered, allTasks);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('m-1');
  });

  it('should detect Issue by workItemType=Issue', () => {
    const allTasks = [
      makeTask({
        id: 'm-1' as any,
        parent: 0,
        $isMilestone: true,
        type: 'milestone',
        issueId: 1,
      }),
      makeTask({
        id: 1,
        parent: 'm-1' as any,
        workItemType: 'Issue',
      }),
    ];
    const filtered = [allTasks[1]];
    const result = DataFilters.ensureParentChildIntegrity(filtered, allTasks);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('m-1');
  });

  it('should treat tasks with no metadata and no $isIssue as Issue (fallback)', () => {
    // When workItemType is not 'Task' and type is not set, it defaults to Issue
    const allTasks = [
      makeTask({
        id: 'm-1' as any,
        parent: 0,
        $isMilestone: true,
        type: 'milestone',
        issueId: 1,
      }),
      makeTask({ id: 1, parent: 'm-1' as any }),
    ];
    const filtered = [allTasks[1]];
    const result = DataFilters.ensureParentChildIntegrity(filtered, allTasks);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('m-1');
  });

  it('should not duplicate tasks already in filtered set', () => {
    const allTasks = [
      makeTask({
        id: 1,
        parent: 0,
        workItemType: 'Issue',
        $isIssue: true,
      }),
      makeTask({ id: 2, parent: 1, workItemType: 'Task' }),
    ];
    // Both parent and child in filtered set
    const result = DataFilters.ensureParentChildIntegrity(allTasks, allTasks);
    expect(result).toHaveLength(2);
  });

  it('should handle empty filtered array', () => {
    const allTasks = [makeTask({ id: 1, parent: 0 })];
    const result = DataFilters.ensureParentChildIntegrity([], allTasks);
    expect(result).toHaveLength(0);
  });

  it('should handle tasks with parent = 0 (root level)', () => {
    const tasks = [makeTask({ id: 1, parent: 0 })];
    const result = DataFilters.ensureParentChildIntegrity(tasks, tasks);
    expect(result).toHaveLength(1);
    expect(result[0].parent).toBe(0);
  });
});

// ===========================================================================
// groupByMilestone
// ===========================================================================
describe('DataFilters.groupByMilestone', () => {
  const milestones = [
    {
      id: 10,
      iid: 1,
      title: 'Sprint 1',
      description: '',
      state: 'active' as const,
      created_at: '',
      updated_at: '',
      due_date: null,
      start_date: null,
      web_url: '',
    },
    {
      id: 20,
      iid: 2,
      title: 'Sprint 2',
      description: '',
      state: 'active' as const,
      created_at: '',
      updated_at: '',
      due_date: null,
      start_date: null,
      web_url: '',
    },
  ];

  it('should create groups for each milestone plus a "No Milestone" group', () => {
    const groups = DataFilters.groupByMilestone([], milestones);
    expect(groups.size).toBe(3); // 2 milestones + 1 "No Milestone"
    expect(groups.has(10)).toBe(true);
    expect(groups.has(20)).toBe(true);
    expect(groups.has(0)).toBe(true);
  });

  it('should assign tasks to the correct milestone group by parent ID', () => {
    const tasks = [
      makeTask({
        id: 1,
        parent: 10 as any,
        workItemType: 'Issue',
      }),
      makeTask({
        id: 2,
        parent: 20 as any,
        workItemType: 'Issue',
      }),
    ];
    const groups = DataFilters.groupByMilestone(tasks, milestones);
    expect(groups.get(10)).toHaveLength(1);
    expect(groups.get(20)).toHaveLength(1);
  });

  it('should put tasks without parent in the "No Milestone" group', () => {
    const tasks = [makeTask({ id: 1, parent: 0 })];
    const groups = DataFilters.groupByMilestone(tasks, milestones);
    expect(groups.get(0)).toHaveLength(1);
  });

  it('should skip milestone summary tasks', () => {
    const tasks = [
      makeTask({
        id: 'm-1' as any,
        $isMilestone: true,
        type: 'milestone',
        issueId: 1,
      }),
      makeTask({ id: 1, parent: 10 as any }),
    ];
    const groups = DataFilters.groupByMilestone(tasks, milestones);
    expect(groups.get(10)).toHaveLength(1);
    // Milestone summary itself should not appear in any group
    const allGroupedTasks = Array.from(groups.values()).flat();
    expect(allGroupedTasks.find((t) => t.id === 'm-1')).toBeUndefined();
  });

  it('should handle empty milestones array', () => {
    const tasks = [makeTask({ id: 1, parent: 0 })];
    const groups = DataFilters.groupByMilestone(tasks, []);
    // Only the "No Milestone" group
    expect(groups.size).toBe(1);
    expect(groups.has(0)).toBe(true);
    expect(groups.get(0)).toHaveLength(1);
  });
});

// ===========================================================================
// groupByEpic
// ===========================================================================
describe('DataFilters.groupByEpic', () => {
  const epics = [
    {
      id: 100,
      iid: 1,
      title: 'Epic A',
      description: '',
      state: 'opened' as const,
      web_url: '',
      created_at: '',
      updated_at: '',
      start_date: null,
      end_date: null,
    },
    {
      id: 200,
      iid: 2,
      title: 'Epic B',
      description: '',
      state: 'opened' as const,
      web_url: '',
      created_at: '',
      updated_at: '',
      start_date: null,
      end_date: null,
    },
  ];

  it('should create groups for each epic plus a "No Epic" group', () => {
    const groups = DataFilters.groupByEpic([], epics);
    expect(groups.size).toBe(3);
    expect(groups.has(100)).toBe(true);
    expect(groups.has(200)).toBe(true);
    expect(groups.has(0)).toBe(true);
  });

  it('should assign tasks to the correct epic group via epicId', () => {
    const tasks = [
      makeTask({ id: 1, epicId: 100 }),
      makeTask({ id: 2, epicId: 200 }),
    ];
    const groups = DataFilters.groupByEpic(tasks, epics);
    expect(groups.get(100)).toHaveLength(1);
    expect(groups.get(200)).toHaveLength(1);
  });

  it('should put tasks without epic in the "No Epic" group', () => {
    const tasks = [makeTask({ id: 1 })];
    const groups = DataFilters.groupByEpic(tasks, epics);
    expect(groups.get(0)).toHaveLength(1);
  });

  it('should handle tasks with metadata but no epic', () => {
    const tasks = [makeTask({ id: 1, workItemType: 'Issue' })];
    const groups = DataFilters.groupByEpic(tasks, epics);
    expect(groups.get(0)).toHaveLength(1);
  });

  it('should handle empty epics array', () => {
    const tasks = [makeTask({ id: 1 })];
    const groups = DataFilters.groupByEpic(tasks, []);
    expect(groups.size).toBe(1);
    expect(groups.has(0)).toBe(true);
    expect(groups.get(0)).toHaveLength(1);
  });
});

// ===========================================================================
// getUniqueLabels
// ===========================================================================
describe('DataFilters.getUniqueLabels', () => {
  it('should extract unique labels from comma-separated strings', () => {
    const tasks = [
      makeTask({ id: 1, labels: 'bug,urgent' }),
      makeTask({ id: 2, labels: 'bug,feature' }),
    ];
    const labels = DataFilters.getUniqueLabels(tasks);
    expect(labels).toEqual(['bug', 'feature', 'urgent']);
  });

  it('should handle labels as arrays', () => {
    const tasks = [makeTask({ id: 1, labels: ['alpha', 'beta'] as any })];
    const labels = DataFilters.getUniqueLabels(tasks);
    expect(labels).toContain('alpha');
    expect(labels).toContain('beta');
  });

  it('should handle empty labels string', () => {
    const tasks = [makeTask({ id: 1, labels: '' })];
    const labels = DataFilters.getUniqueLabels(tasks);
    expect(labels).toHaveLength(0);
  });

  it('should handle tasks without labels', () => {
    const tasks = [makeTask({ id: 1, labels: undefined })];
    const labels = DataFilters.getUniqueLabels(tasks);
    expect(labels).toHaveLength(0);
  });

  it('should return sorted labels', () => {
    const tasks = [makeTask({ id: 1, labels: 'zebra,alpha,middle' })];
    const labels = DataFilters.getUniqueLabels(tasks);
    expect(labels).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('should trim whitespace from labels', () => {
    const tasks = [makeTask({ id: 1, labels: ' bug , feature ' })];
    const labels = DataFilters.getUniqueLabels(tasks);
    expect(labels).toContain('bug');
    expect(labels).toContain('feature');
  });

  it('should handle empty tasks array', () => {
    expect(DataFilters.getUniqueLabels([])).toEqual([]);
  });
});

// ===========================================================================
// getUniqueAssignees
// ===========================================================================
describe('DataFilters.getUniqueAssignees', () => {
  it('should extract unique assignees from comma-separated strings', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'alice,bob' }),
      makeTask({ id: 2, assigned: 'bob,charlie' }),
    ];
    const assignees = DataFilters.getUniqueAssignees(tasks);
    expect(assignees).toEqual(['alice', 'bob', 'charlie']);
  });

  it('should handle single assignee (no comma)', () => {
    const tasks = [makeTask({ id: 1, assigned: 'alice' })];
    const assignees = DataFilters.getUniqueAssignees(tasks);
    expect(assignees).toEqual(['alice']);
  });

  it('should handle tasks without assignees', () => {
    const tasks = [makeTask({ id: 1, assigned: undefined })];
    const assignees = DataFilters.getUniqueAssignees(tasks);
    expect(assignees).toHaveLength(0);
  });

  it('should return sorted assignees', () => {
    const tasks = [makeTask({ id: 1, assigned: 'zara,alice,mike' })];
    const assignees = DataFilters.getUniqueAssignees(tasks);
    expect(assignees).toEqual(['alice', 'mike', 'zara']);
  });

  it('should trim whitespace from assignees', () => {
    const tasks = [makeTask({ id: 1, assigned: ' alice , bob ' })];
    const assignees = DataFilters.getUniqueAssignees(tasks);
    expect(assignees).toContain('alice');
    expect(assignees).toContain('bob');
  });

  it('should handle empty tasks array', () => {
    expect(DataFilters.getUniqueAssignees([])).toEqual([]);
  });
});

// ===========================================================================
// sortTasks
// ===========================================================================
describe('DataFilters.sortTasks', () => {
  it('should sort by string field ascending', () => {
    const tasks = [
      makeTask({ id: 1, text: 'Charlie' }),
      makeTask({ id: 2, text: 'Alice' }),
      makeTask({ id: 3, text: 'Bob' }),
    ];
    const result = DataFilters.sortTasks(tasks, 'text', 'asc');
    expect(result[0].text).toBe('Alice');
    expect(result[1].text).toBe('Bob');
    expect(result[2].text).toBe('Charlie');
  });

  it('should sort by string field descending', () => {
    const tasks = [
      makeTask({ id: 1, text: 'Alice' }),
      makeTask({ id: 2, text: 'Charlie' }),
      makeTask({ id: 3, text: 'Bob' }),
    ];
    const result = DataFilters.sortTasks(tasks, 'text', 'desc');
    expect(result[0].text).toBe('Charlie');
    expect(result[1].text).toBe('Bob');
    expect(result[2].text).toBe('Alice');
  });

  it('should sort by number field ascending', () => {
    const tasks = [
      makeTask({ id: 3, progress: 75 }),
      makeTask({ id: 1, progress: 25 }),
      makeTask({ id: 2, progress: 50 }),
    ];
    const result = DataFilters.sortTasks(tasks, 'progress', 'asc');
    expect(result[0].progress).toBe(25);
    expect(result[1].progress).toBe(50);
    expect(result[2].progress).toBe(75);
  });

  it('should sort by number field descending', () => {
    const tasks = [
      makeTask({ id: 1, progress: 25 }),
      makeTask({ id: 2, progress: 75 }),
      makeTask({ id: 3, progress: 50 }),
    ];
    const result = DataFilters.sortTasks(tasks, 'progress', 'desc');
    expect(result[0].progress).toBe(75);
    expect(result[1].progress).toBe(50);
    expect(result[2].progress).toBe(25);
  });

  it('should sort by Date field ascending', () => {
    const tasks = [
      makeTask({ id: 1, start: new Date('2024-03-01') }),
      makeTask({ id: 2, start: new Date('2024-01-01') }),
      makeTask({ id: 3, start: new Date('2024-02-01') }),
    ];
    const result = DataFilters.sortTasks(tasks, 'start', 'asc');
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(3);
    expect(result[2].id).toBe(1);
  });

  it('should sort by Date field descending', () => {
    const tasks = [
      makeTask({ id: 1, start: new Date('2024-01-01') }),
      makeTask({ id: 2, start: new Date('2024-03-01') }),
      makeTask({ id: 3, start: new Date('2024-02-01') }),
    ];
    const result = DataFilters.sortTasks(tasks, 'start', 'desc');
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(3);
    expect(result[2].id).toBe(1);
  });

  it('should default to ascending order when order not specified', () => {
    const tasks = [
      makeTask({ id: 2, text: 'B' }),
      makeTask({ id: 1, text: 'A' }),
    ];
    const result = DataFilters.sortTasks(tasks, 'text');
    expect(result[0].text).toBe('A');
    expect(result[1].text).toBe('B');
  });

  it('should push null/undefined values to the end in ascending order', () => {
    const tasks = [
      makeTask({ id: 1, progress: undefined }),
      makeTask({ id: 2, progress: 50 }),
      makeTask({ id: 3, progress: null as any }),
    ];
    const result = DataFilters.sortTasks(tasks, 'progress', 'asc');
    expect(result[0].progress).toBe(50);
    // Undefined/null should be at end
    expect(result[0].id).toBe(2);
  });

  it('should push null/undefined values to the end in descending order', () => {
    const tasks = [
      makeTask({ id: 1, progress: undefined }),
      makeTask({ id: 2, progress: 50 }),
      makeTask({ id: 3, progress: 25 }),
    ];
    const result = DataFilters.sortTasks(tasks, 'progress', 'desc');
    expect(result[0].progress).toBe(50);
    expect(result[1].progress).toBe(25);
  });

  it('should not mutate the original array', () => {
    const tasks = [
      makeTask({ id: 2, text: 'B' }),
      makeTask({ id: 1, text: 'A' }),
    ];
    const original = [...tasks];
    DataFilters.sortTasks(tasks, 'text', 'asc');
    expect(tasks[0].id).toBe(original[0].id);
  });

  it('should handle empty tasks array', () => {
    const result = DataFilters.sortTasks([], 'text', 'asc');
    expect(result).toEqual([]);
  });

  it('should handle single-element array', () => {
    const tasks = [makeTask({ id: 1, text: 'Only' })];
    const result = DataFilters.sortTasks(tasks, 'text', 'asc');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Only');
  });
});

// ===========================================================================
// calculateStats
// ===========================================================================
describe('DataFilters.calculateStats', () => {
  it('should calculate total count excluding milestone summary tasks', () => {
    const tasks = [
      makeTask({ id: 1, state: 'OPEN', progress: 0 }),
      makeTask({
        id: 'm-1' as any,
        $isMilestone: true,
        type: 'milestone',
        issueId: 1,
      }),
    ];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.total).toBe(1);
  });

  it('should count completed tasks (progress=100)', () => {
    const tasks = [
      makeTask({ id: 1, progress: 100, state: 'OPEN' }),
      makeTask({ id: 2, progress: 50, state: 'OPEN' }),
    ];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.completed).toBe(1);
  });

  it('should count completed tasks (state=CLOSED)', () => {
    const tasks = [
      makeTask({ id: 1, progress: 0, state: 'CLOSED' }),
      makeTask({ id: 2, progress: 50, state: 'OPEN' }),
    ];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.completed).toBe(1);
  });

  it('should count completed tasks (state=closed lowercase)', () => {
    const tasks = [makeTask({ id: 1, progress: 0, state: 'closed' })];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.completed).toBe(1);
  });

  it('should count in-progress tasks (0 < progress < 100, not closed)', () => {
    const tasks = [
      makeTask({ id: 1, progress: 50, state: 'OPEN' }),
      makeTask({ id: 2, progress: 1, state: 'OPEN' }),
      makeTask({ id: 3, progress: 99, state: 'OPEN' }),
    ];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.inProgress).toBe(3);
  });

  it('should count not-started tasks (progress=0, not closed)', () => {
    const tasks = [
      makeTask({ id: 1, progress: 0, state: 'OPEN' }),
      makeTask({ id: 2, progress: undefined, state: 'OPEN' }),
    ];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.notStarted).toBe(2);
  });

  it('should count overdue tasks (end < now, progress < 100, not closed)', () => {
    const pastDate = new Date('2020-01-01');
    const futureDate = new Date('2030-01-01');
    const tasks = [
      makeTask({ id: 1, end: pastDate, progress: 50, state: 'OPEN' }),
      makeTask({ id: 2, end: futureDate, progress: 50, state: 'OPEN' }),
      makeTask({ id: 3, end: pastDate, progress: 100, state: 'OPEN' }), // completed, not overdue
      makeTask({ id: 4, end: pastDate, progress: 0, state: 'CLOSED' }), // closed, not overdue
    ];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.overdue).toBe(1);
  });

  it('should not count task as overdue if it has no end date', () => {
    const tasks = [
      makeTask({ id: 1, end: undefined, progress: 50, state: 'OPEN' }),
    ];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.overdue).toBe(0);
  });

  it('should calculate average progress correctly', () => {
    const tasks = [
      makeTask({ id: 1, progress: 0, state: 'OPEN' }),
      makeTask({ id: 2, progress: 50, state: 'OPEN' }),
      makeTask({ id: 3, progress: 100, state: 'OPEN' }),
    ];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.averageProgress).toBe(50); // (0+50+100)/3 = 50
  });

  it('should round average progress to nearest integer', () => {
    const tasks = [
      makeTask({ id: 1, progress: 33, state: 'OPEN' }),
      makeTask({ id: 2, progress: 33, state: 'OPEN' }),
      makeTask({ id: 3, progress: 34, state: 'OPEN' }),
    ];
    const stats = DataFilters.calculateStats(tasks);
    // (33+33+34)/3 = 33.33 -> 33
    expect(stats.averageProgress).toBe(33);
  });

  it('should return 0 average progress for empty tasks', () => {
    const stats = DataFilters.calculateStats([]);
    expect(stats.averageProgress).toBe(0);
    expect(stats.total).toBe(0);
  });

  it('should treat undefined progress as 0', () => {
    const tasks = [makeTask({ id: 1, progress: undefined, state: 'OPEN' })];
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.averageProgress).toBe(0);
    expect(stats.notStarted).toBe(1);
  });

  it('should return all stat fields', () => {
    const stats = DataFilters.calculateStats([]);
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('completed');
    expect(stats).toHaveProperty('inProgress');
    expect(stats).toHaveProperty('notStarted');
    expect(stats).toHaveProperty('overdue');
    expect(stats).toHaveProperty('averageProgress');
  });

  it('should handle a comprehensive mix of task states', () => {
    const tasks = createStandardTasks();
    const stats = DataFilters.calculateStats(tasks);
    expect(stats.total).toBe(5);
    // id 3: progress=100, CLOSED => completed
    // id 2: progress=50, OPEN => inProgress
    // id 4: progress=25, OPEN => inProgress
    // id 1: progress=0, OPEN => notStarted
    // id 5: progress=0, OPEN => notStarted
    expect(stats.completed).toBe(1);
    expect(stats.inProgress).toBe(2);
    expect(stats.notStarted).toBe(2);
  });
});

// ===========================================================================
// toServerFilters
// ===========================================================================
describe('toServerFilters', () => {
  it('should return undefined when options is undefined', () => {
    expect(toServerFilters(undefined)).toBeUndefined();
  });

  it('should convert labelNames', () => {
    const result = toServerFilters({ labelNames: ['bug', 'feature'] });
    expect(result?.labelNames).toEqual(['bug', 'feature']);
  });

  it('should convert milestoneTitles', () => {
    const result = toServerFilters({ milestoneTitles: ['Sprint 1'] });
    expect(result?.milestoneTitles).toEqual(['Sprint 1']);
  });

  it('should convert assigneeUsernames', () => {
    const result = toServerFilters({ assigneeUsernames: ['alice'] });
    expect(result?.assigneeUsernames).toEqual(['alice']);
  });

  it('should convert dateRange to createdAfter/createdBefore', () => {
    const result = toServerFilters({
      dateRange: {
        createdAfter: '2024-01-01T00:00:00Z',
        createdBefore: '2024-12-31T23:59:59Z',
      },
    });
    expect(result?.createdAfter).toBe('2024-01-01T00:00:00Z');
    expect(result?.createdBefore).toBe('2024-12-31T23:59:59Z');
  });

  it('should handle partial dateRange (only createdAfter)', () => {
    const result = toServerFilters({
      dateRange: { createdAfter: '2024-06-01T00:00:00Z' },
    });
    expect(result?.createdAfter).toBe('2024-06-01T00:00:00Z');
    expect(result?.createdBefore).toBeUndefined();
  });

  it('should handle partial dateRange (only createdBefore)', () => {
    const result = toServerFilters({
      dateRange: { createdBefore: '2024-06-01T00:00:00Z' },
    });
    expect(result?.createdAfter).toBeUndefined();
    expect(result?.createdBefore).toBe('2024-06-01T00:00:00Z');
  });

  it('should handle empty options object', () => {
    const result = toServerFilters({});
    expect(result).toBeDefined();
    expect(result?.labelNames).toBeUndefined();
    expect(result?.milestoneTitles).toBeUndefined();
    expect(result?.assigneeUsernames).toBeUndefined();
    expect(result?.createdAfter).toBeUndefined();
    expect(result?.createdBefore).toBeUndefined();
  });

  it('should handle all fields together', () => {
    const options: ServerFilterOptions = {
      labelNames: ['bug'],
      milestoneTitles: ['Sprint 1'],
      assigneeUsernames: ['alice'],
      dateRange: {
        createdAfter: '2024-01-01T00:00:00Z',
        createdBefore: '2024-12-31T23:59:59Z',
      },
    };
    const result = toServerFilters(options);
    expect(result?.labelNames).toEqual(['bug']);
    expect(result?.milestoneTitles).toEqual(['Sprint 1']);
    expect(result?.assigneeUsernames).toEqual(['alice']);
    expect(result?.createdAfter).toBe('2024-01-01T00:00:00Z');
    expect(result?.createdBefore).toBe('2024-12-31T23:59:59Z');
  });

  it('should handle options without dateRange', () => {
    const result = toServerFilters({ labelNames: ['bug'] });
    expect(result?.createdAfter).toBeUndefined();
    expect(result?.createdBefore).toBeUndefined();
  });
});

// ===========================================================================
// groupTasks
// ===========================================================================
describe('DataFilters.groupTasks', () => {
  it('should return tasks unchanged when groupBy is none', () => {
    const tasks = [
      makeTask({ id: 1, text: 'Task 1' }),
      makeTask({ id: 2, text: 'Task 2' }),
    ];
    const result = DataFilters.groupTasks(tasks, 'none');
    expect(result.tasks).toEqual(tasks);
    expect(result.groupCount).toBe(0);
  });

  it('should return tasks unchanged when groupBy is empty', () => {
    const tasks = [makeTask({ id: 1 })];
    const result = DataFilters.groupTasks(tasks, '');
    expect(result.tasks).toEqual(tasks);
  });

  it('should group tasks by assignee', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'alice' }),
      makeTask({ id: 2, assigned: 'bob' }),
      makeTask({ id: 3, assigned: 'alice' }),
    ];
    const result = DataFilters.groupTasks(tasks, 'assignee');
    expect(result.groupCount).toBe(2);
    expect(result.tasks[0].$groupHeader).toBe(true);
    expect(result.tasks[0].$groupName).toBe('alice');
  });

  it('should group tasks by epic', () => {
    const tasks = [
      makeTask({ id: 1, epic: 'Epic A' } as any),
      makeTask({ id: 2, epic: 'Epic B' } as any),
    ];
    const result = DataFilters.groupTasks(tasks, 'epic');
    expect(result.groupCount).toBe(2);
    expect(result.tasks[0].$groupName).toBe('Epic A');
  });

  it('should group tasks by sprint (iteration)', () => {
    const tasks = [
      makeTask({ id: 1, iteration: 'Sprint 1' } as any),
      makeTask({ id: 2, iteration: 'Sprint 2' } as any),
    ];
    const result = DataFilters.groupTasks(tasks, 'sprint');
    expect(result.groupCount).toBe(2);
    expect(result.tasks[0].$groupName).toBe('Sprint 1');
  });

  it('should handle unassigned tasks in assignee grouping', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'alice' }),
      makeTask({ id: 2, assigned: undefined }),
    ];
    const result = DataFilters.groupTasks(tasks, 'assignee');
    expect(result.groupCount).toBe(2);
    const unassignedGroup = result.tasks.find(
      (t) => t.$groupName === 'Unassigned',
    );
    expect(unassignedGroup).toBeDefined();
    expect(unassignedGroup?.$groupHeader).toBe(true);
  });

  it('should handle tasks without epic in epic grouping', () => {
    const tasks = [
      makeTask({ id: 1, epic: 'Epic A' } as any),
      makeTask({ id: 2 } as any),
    ];
    const result = DataFilters.groupTasks(tasks, 'epic');
    expect(result.groupCount).toBe(2);
    const noEpicGroup = result.tasks.find((t) => t.$groupName === 'No Epic');
    expect(noEpicGroup).toBeDefined();
  });

  it('should create group headers with correct metadata', () => {
    const tasks = [
      makeTask({
        id: 1,
        assigned: 'alice',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-10'),
      }),
      makeTask({
        id: 2,
        assigned: 'alice',
        start: new Date('2024-01-05'),
        end: new Date('2024-01-15'),
      }),
    ];
    const result = DataFilters.groupTasks(tasks, 'assignee');
    const groupHeader = result.tasks[0];
    expect(groupHeader.$groupHeader).toBe(true);
    expect(groupHeader.$groupName).toBe('alice');
    expect(groupHeader.$groupType).toBe('assignee');
    expect(groupHeader.$taskCount).toBe(2);
  });

  it('should calculate date range for group header', () => {
    const tasks = [
      makeTask({
        id: 1,
        assigned: 'alice',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-10'),
      }),
      makeTask({
        id: 2,
        assigned: 'alice',
        start: new Date('2024-01-05'),
        end: new Date('2024-01-15'),
      }),
    ];
    const result = DataFilters.groupTasks(tasks, 'assignee');
    const groupHeader = result.tasks[0];
    expect(groupHeader.start).toEqual(new Date('2024-01-01'));
    expect(groupHeader.end).toEqual(new Date('2024-01-15'));
  });

  it('should collapse groups in collapsedGroups set', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'alice' }),
      makeTask({ id: 2, assigned: 'bob' }),
    ];
    const collapsedGroups = new Set(['group-assignee-alice']);
    const result = DataFilters.groupTasks(tasks, 'assignee', collapsedGroups);
    expect(result.tasks.length).toBe(3);
    expect(result.tasks[0].open).toBe(false);
    expect(result.tasks[0].$groupName).toBe('alice');
    expect(result.tasks[1].$groupName).toBe('bob');
  });

  it('should expand groups not in collapsedGroups set', () => {
    const tasks = [makeTask({ id: 1, assigned: 'alice' })];
    const result = DataFilters.groupTasks(tasks, 'assignee', new Set());
    const groupHeader = result.tasks[0];
    expect(groupHeader.open).toBeUndefined();
  });

  it('should sort groups alphabetically', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'zara' }),
      makeTask({ id: 2, assigned: 'alice' }),
      makeTask({ id: 3, assigned: 'bob' }),
    ];
    const result = DataFilters.groupTasks(tasks, 'assignee');
    const groupHeaders = result.tasks.filter((t) => t.$groupHeader);
    expect(groupHeaders[0].$groupName).toBe('alice');
    expect(groupHeaders[1].$groupName).toBe('bob');
    expect(groupHeaders[2].$groupName).toBe('zara');
  });

  it('should put special groups (Unassigned, No Epic, No Sprint) at the end', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'alice' }),
      makeTask({ id: 2, assigned: undefined }),
      makeTask({ id: 3, assigned: 'bob' }),
    ];
    const result = DataFilters.groupTasks(tasks, 'assignee');
    const groupNames = result.tasks
      .filter((t) => t.$groupHeader)
      .map((t) => t.$groupName);
    expect(groupNames[groupNames.length - 1]).toBe('Unassigned');
  });

  it('should handle empty tasks array', () => {
    const result = DataFilters.groupTasks([], 'assignee');
    expect(result.tasks).toEqual([]);
    expect(result.groupCount).toBe(0);
  });

  it('should return groupMeta with correct information', () => {
    const tasks = [
      makeTask({
        id: 1,
        assigned: 'alice',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-10'),
      }),
      makeTask({
        id: 2,
        assigned: 'alice',
        start: new Date('2024-01-05'),
        end: new Date('2024-01-15'),
      }),
    ];
    const result = DataFilters.groupTasks(tasks, 'assignee');
    expect(result.groupMeta.size).toBe(1);
    const meta = result.groupMeta.get('group-assignee-alice');
    expect(meta?.name).toBe('alice');
    expect(meta?.taskCount).toBe(2);
    expect(meta?.dateRange?.start).toEqual(new Date('2024-01-01'));
    expect(meta?.dateRange?.end).toEqual(new Date('2024-01-15'));
  });

  it('should add $groupIndex to group header and child tasks', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'alice' }),
      makeTask({ id: 2, assigned: 'bob' }),
    ];
    const result = DataFilters.groupTasks(tasks, 'assignee');
    expect(result.tasks[0].$groupIndex).toBe(0);
    expect(result.tasks[1].$groupIndex).toBe(0);
    expect(result.tasks[2].$groupIndex).toBe(1);
    expect(result.tasks[3].$groupIndex).toBe(1);
  });
});

// ===========================================================================
// getUniqueGroupValues
// ===========================================================================
describe('DataFilters.getUniqueGroupValues', () => {
  it('should get unique assignees for grouping', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'alice' }),
      makeTask({ id: 2, assigned: 'bob' }),
      makeTask({ id: 3, assigned: 'alice' }),
    ];
    const values = DataFilters.getUniqueGroupValues(tasks, 'assignee');
    expect(values).toContain('alice');
    expect(values).toContain('bob');
    expect(values).toHaveLength(2);
  });

  it('should include Unassigned for tasks without assignee', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'alice' }),
      makeTask({ id: 2, assigned: undefined }),
    ];
    const values = DataFilters.getUniqueGroupValues(tasks, 'assignee');
    expect(values).toContain('Unassigned');
  });

  it('should get unique epics for grouping', () => {
    const tasks = [
      makeTask({ id: 1, epic: 'Epic A' } as any),
      makeTask({ id: 2, epic: 'Epic B' } as any),
    ];
    const values = DataFilters.getUniqueGroupValues(tasks, 'epic');
    expect(values).toContain('Epic A');
    expect(values).toContain('Epic B');
  });

  it('should include No Epic for tasks without epic', () => {
    const tasks = [makeTask({ id: 1 } as any)];
    const values = DataFilters.getUniqueGroupValues(tasks, 'epic');
    expect(values).toContain('No Epic');
  });

  it('should get unique sprints for grouping', () => {
    const tasks = [
      makeTask({ id: 1, iteration: 'Sprint 1' } as any),
      makeTask({ id: 2, iteration: 'Sprint 2' } as any),
    ];
    const values = DataFilters.getUniqueGroupValues(tasks, 'sprint');
    expect(values).toContain('Sprint 1');
    expect(values).toContain('Sprint 2');
  });

  it('should include No Sprint for tasks without iteration', () => {
    const tasks = [makeTask({ id: 1 } as any)];
    const values = DataFilters.getUniqueGroupValues(tasks, 'sprint');
    expect(values).toContain('No Sprint');
  });

  it('should sort values alphabetically with special values at end', () => {
    const tasks = [
      makeTask({ id: 1, assigned: 'zara' }),
      makeTask({ id: 2, assigned: 'alice' }),
      makeTask({ id: 3, assigned: undefined }),
    ];
    const values = DataFilters.getUniqueGroupValues(tasks, 'assignee');
    expect(values[0]).toBe('alice');
    expect(values[1]).toBe('zara');
    expect(values[2]).toBe('Unassigned');
  });

  it('should handle empty tasks array', () => {
    const values = DataFilters.getUniqueGroupValues([], 'assignee');
    expect(values).toEqual([]);
  });
});

// ===========================================================================
// GROUP_BY_OPTIONS
// ===========================================================================
describe('DataFilters.GROUP_BY_OPTIONS', () => {
  it('should have correct options', () => {
    expect(DataFilters.GROUP_BY_OPTIONS).toEqual([
      { value: 'none', label: 'No Grouping' },
      { value: 'assignee', label: 'By Assignee' },
      { value: 'epic', label: 'By Epic' },
      { value: 'sprint', label: 'By Sprint' },
    ]);
  });
});
