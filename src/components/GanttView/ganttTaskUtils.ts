// @ts-nocheck
/**
 * Pure utility functions for working with SVAR Gantt task data.
 * No React dependencies - can be used in hooks and components.
 */

/**
 * Extract tasks array from SVAR Gantt store state
 *
 * IMPORTANT: SVAR Gantt Internal Data Structure
 * ============================================
 * state.tasks is NOT a simple Array or Map. It's a custom class (internally named "Xn")
 * with the following structure:
 *   - _pool: Map<id, task> - Contains ALL tasks (flat structure, including nested children)
 *   - _sort: undefined | function - Sorting configuration
 *
 * The tasks in _pool have a hierarchical relationship via:
 *   - task.parent: number | 0 - Parent task ID (0 = root level)
 *   - task.data: Array<task> - Array of child tasks (for display purposes)
 *   - task.open: boolean - Whether the task's children are expanded
 *
 * @param {Object} state - The state object from api.getState()
 * @returns {Array} Array of task objects
 */
export function getTasksFromState(state) {
  let tasks = state?.tasks || [];

  if (tasks._pool instanceof Map) {
    // SVAR Gantt uses a custom class with _pool Map containing all tasks
    tasks = Array.from(tasks._pool.values());
  } else if (tasks instanceof Map) {
    tasks = Array.from(tasks.values());
  } else if (!Array.isArray(tasks)) {
    // Fallback: Try to convert object to array if needed
    tasks = Object.values(tasks);
  }

  // Filter out any undefined/null entries (sparse arrays or objects)
  return tasks.filter((task) => task != null);
}

/**
 * Get all children (direct and nested) of a task recursively
 * Used for recursive delete feature
 *
 * @param {string|number} taskId - The parent task ID
 * @param {Array} allTasks - Array of all tasks
 * @returns {Array} Array of child task objects (all descendants)
 */
export function getChildrenForTask(taskId, allTasks) {
  const children = [];

  const findChildren = (parentId) => {
    const directChildren = allTasks.filter((t) => t.parent === parentId);
    for (const child of directChildren) {
      children.push(child);
      // Recursively find grandchildren
      findChildren(child.id);
    }
  };

  findChildren(taskId);
  return children;
}

/**
 * Sort task IDs by deletion order (children first, then parents)
 * Provider requires children to be deleted before parents
 *
 * @param {Array} taskIds - Array of task IDs to sort
 * @param {Array} allTasks - Array of all tasks
 * @returns {Array} Sorted array of task IDs
 */
export function sortByDeletionOrder(taskIds, allTasks) {
  // Build depth map (distance from root)
  const depthMap = new Map();

  for (const id of taskIds) {
    const task = allTasks.find((t) => t.id === id);
    if (!task) continue;

    let depth = 0;
    let current = task;
    while (current.parent && current.parent !== 0) {
      depth++;
      current = allTasks.find((t) => t.id === current.parent);
      if (!current) break;
    }
    depthMap.set(id, depth);
  }

  // Sort by depth descending (deepest/children first)
  return [...taskIds].sort(
    (a, b) => (depthMap.get(b) || 0) - (depthMap.get(a) || 0),
  );
}
