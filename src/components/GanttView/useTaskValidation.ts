import { useMemo } from 'react';

/**
 * Validates task structure and parent relationships
 * Logs validation issues to console
 *
 * @param {Array} tasks - Array of tasks to validate
 * @returns {Object} Validation results and filtered valid tasks
 */
export function useTaskValidation(tasks) {
  return useMemo(() => {
    // Validate tasks structure
    const invalidTasks = tasks.filter((task) => {
      return !task.id || !task.text || !task.start;
    });

    if (invalidTasks.length > 0) {
      console.error('[GanttView RENDER] Found invalid tasks:', invalidTasks);
    }

    // Check for orphaned children (parent doesn't exist in the list)
    const taskIds = new Set(tasks.map((t) => t.id));
    const orphanedTasks = tasks.filter((task) => {
      return task.parent && task.parent !== 0 && !taskIds.has(task.parent);
    });

    if (orphanedTasks.length > 0) {
      // Separate Issues with Epic parents from other orphaned tasks
      const issuesWithEpicParent = orphanedTasks.filter((task) => {
        // Check if this Issue has Epic parent stored in metadata
        return task._source?.epicParentId;
      });

      const tasksWithMissingParent = orphanedTasks.filter((task) => {
        // Everything else: Tasks with missing parents, or Issues with missing milestones
        return !task._source?.epicParentId;
      });

      if (issuesWithEpicParent.length > 0) {
        // Get unique Epic IDs
        const epicIds = new Set(
          issuesWithEpicParent.map((t) => t._source?.epicParentId),
        );

        // These are Issues with Epic parents - Epics are not supported yet
        console.info(
          '[GanttView] Some issues belong to Epics (not supported):',
          {
            epicIds: Array.from(epicIds),
            affectedIssues: issuesWithEpicParent.length,
            note: 'Epic support is not implemented. These issues will appear at root level.',
          },
        );
      }

      if (tasksWithMissingParent.length > 0) {
        // This is an actual error - Tasks with missing parents
        // Collect unique missing parent IDs
        const missingParentIds = new Set(
          tasksWithMissingParent.map((t) => t.parent),
        );
        console.error(
          '[GanttView RENDER] Found orphaned tasks (parent does not exist):',
          {
            count: tasksWithMissingParent.length,
            orphanedTaskIds: tasksWithMissingParent.map((t) => ({
              id: t.id,
              parent: t.parent,
              text: t.text,
              type: t.type,
              _source: t._source?.type,
            })),
            missingParentIds: Array.from(missingParentIds),
          },
        );
      }
    }

    return {
      invalidTasks,
      orphanedTasks,
      validTasks: tasks,
    };
  }, [tasks]);
}
