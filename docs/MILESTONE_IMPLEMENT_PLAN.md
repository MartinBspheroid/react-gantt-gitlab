Implementation Plan - Support GitLab Milestones as Top-Level Tasks
Goal Description
Enable GitLab Milestones to be displayed as top-level tasks in the Gantt chart. Issues belonging to a milestone should be grouped under that milestone. Issues without a milestone should remain at the root level. This ensures the hierarchy: Milestone -> Issue -> Subtask.

User Review Required
IMPORTANT

This change modifies the task hierarchy. Issues that were previously at the root level will now be children of their assigned Milestone (if any). This only affects the
GitLabGraphQLProvider
. New features: Milestone creation and enhanced sorting.

Proposed Changes
[Providers]
[MODIFY]
GitLabGraphQLProvider.ts
Milestone Creation:
Add
createMilestone(milestone: Partial)
method.
Use GraphQL mutation milestoneCreate (or REST if GraphQL is complex/unavailable, but prefer GraphQL).
Return the new Milestone as a Task.
Sorting:
Update
sortTasksByOrder
:
For root level (parent 0):
Separate Milestones and standalone Issues.
Sort Milestones by dueDate (ascending) or startDate or title. Let's pick dueDate then startDate then title.
Sort standalone Issues by displayOrder (if available) or createdAt.
Concatenate: Milestones first, then Issues? Or mix them? Usually Milestones are high-level containers, so maybe Milestones first.
For inside Milestones (parent = milestone ID):
Sort Issues by displayOrder or createdAt.
For Subtasks (parent = issue ID):
Keep existing logic (displayOrder or createdAt).
[MODIFY]
GitLabDataProvider.ts
Add
createMilestone
implementation (REST API) to maintain parity, though
GitLabGraphQLProvider
is the active one.
[Hooks]
[MODIFY]
useGitLabSync.ts
Add
createMilestone
to
GitLabSyncResult
interface and implementation.
Expose it to the component.
[Components]
[MODIFY]
GitLabGantt.jsx
Update add-task handler:
If creating at root level, ask user if they want to create a "Task" or "Milestone".
Or provide a separate UI action for "Add Milestone".
For now, let's intercept add-task at root level and ask via confirm or prompt? Or just default to Task and allow converting?
Better: If ev.parent is 0, prompt: "Create (1) Task or (2) Milestone?".
Call
createMilestone
if Milestone is chosen.
[Interactions]
[MODIFY]
GitLabGraphQLProvider.ts
Milestone Updates:
Add updateMilestone(id: TID, task: Partial<ITask>) method using milestoneUpdate mutation.
Update
updateWorkItem
(or
performUpdate
) to check task.\_gitlab.type. If 'milestone', call updateMilestone.
Milestone Deletion:
Add deleteMilestone(id: TID) method using milestoneDelete mutation.
Update
deleteWorkItem
to check if ID corresponds to a Milestone (might need to check \_gitlab.type or query first).
Milestone Assignment (Drag-and-Drop):
In
performUpdate
for Issues:
Check if task.parent has changed.
If task.parent is a Milestone ID (string/global ID):
Call workItemUpdate with milestoneWidget: { milestoneId: parentId }.
Ensure we don't also try to set hierarchyWidget (parent) to the milestone ID (which would fail).
If task.parent is 0 (moved to root):
Call workItemUpdate with milestoneWidget: { milestoneId: null }.
If task.parent is an Issue ID (subtask):
Existing logic for hierarchy.
Verification Plan
Automated Tests
Run npm run build to verify type safety.
Manual Verification
Milestone CRUD:
Create a Milestone (already verified).
Rename the Milestone. Verify persistence.
Change Dates of the Milestone. Verify persistence.
Delete the Milestone. Verify removal.
Milestone Assignment:
Drag an Issue into a Milestone. Verify it stays there after reload.
Drag an Issue out of a Milestone (to root). Verify it stays at root.
Drag an Issue from one Milestone to another. Verify change.
Hierarchy:
Ensure Subtasks still work correctly when moving their parent Issue into/out of Milestones.
Check that Issues belonging to a Milestone appear inside that Milestone.
Check that Issues not in a Milestone appear at the top level.
Check that Subtasks appear inside their parent Issues (not directly under Milestone).
There are no existing automated tests for the provider logic in the codebase (based on file list). I will rely on manual verification via the UI.
