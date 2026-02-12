import './SmartTaskContent.css';

/**
 * Get initials from a name (first letter of each word, max 2 characters)
 * @param {string} name - The full name
 * @returns {string} Initials (e.g., "John Doe" -> "JD")
 */
function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Get FontAwesome icon class for work item type
 * @param {string|undefined} workItemType - The work item type (Issue, Task, Bug, Feature, etc.)
 * @returns {string} FontAwesome icon class
 */
function getWorkItemTypeIcon(workItemType) {
  if (!workItemType) return 'fa-circle';

  const type = workItemType.toLowerCase();

  switch (type) {
    case 'bug':
      return 'fa-bug';
    case 'task':
      return 'fa-check-square';
    case 'feature':
      return 'fa-star';
    case 'user story':
    case 'story':
      return 'fa-book';
    case 'issue':
    default:
      return 'fa-circle';
  }
}

/**
 * Get color for work item type icon (dark/light mode compatible)
 * @param {string|undefined} workItemType - The work item type
 * @returns {string} CSS color value
 */
function getWorkItemTypeColor(workItemType) {
  if (!workItemType) return 'var(--wx-color-font, #666)';

  const type = workItemType.toLowerCase();

  switch (type) {
    case 'bug':
      return '#dc3545'; // Red
    case 'task':
      return '#6c757d'; // Gray
    case 'feature':
      return '#ffc107'; // Yellow/Gold
    case 'user story':
    case 'story':
      return '#0dcaf0'; // Cyan
    case 'issue':
    default:
      return '#3983eb'; // Blue
  }
}

/**
 * Smart Task Content Component
 * Displays task information with:
 * - Assignee avatar (16x16px circular, left side)
 * - Work item type icon (next to title)
 * - Task title
 * - Story points badge (right side)
 *
 * @param {Object} props
 * @param {Object} props.data - Task data object
 * @param {string} [props.data.text] - Task title
 * @param {string} [props.data.assigned] - Assignee name
 * @param {string} [props.data.avatarUrl] - Assignee avatar URL
 * @param {number} [props.data.storyPoints] - Story points
 * @param {string} [props.data.workItemType] - Work item type (Bug, Task, Feature, User Story, Issue)
 */
function SmartTaskContent({ data }) {
  const { text = '', assigned, avatarUrl, storyPoints, workItemType } = data;

  const hasAvatar = !!avatarUrl;
  const hasStoryPoints = storyPoints !== undefined && storyPoints !== null;
  const hasAssignee = !!assigned;
  const typeIcon = getWorkItemTypeIcon(workItemType);
  const typeColor = getWorkItemTypeColor(workItemType);

  return (
    <div className="wx-smart-task-container">
      {/* Left side: Avatar */}
      <div className="wx-smart-task-avatar">
        {hasAvatar ? (
          <img
            src={avatarUrl}
            alt={assigned}
            className="wx-avatar-image"
            onError={(e) => {
              // Fallback to initials on image error
              e.target.style.display = 'none';
              const fallback = e.target.nextElementSibling;
              if (fallback) {
                fallback.style.display = 'flex';
              }
            }}
          />
        ) : null}
        {/* Initials fallback - shown when no avatar or image fails */}
        <div
          className="wx-avatar-fallback"
          style={{ display: hasAvatar ? 'none' : 'flex' }}
        >
          {hasAssignee ? getInitials(assigned) : '?'}
        </div>
      </div>

      {/* Middle: Type icon + Title */}
      <div className="wx-smart-task-content">
        <i
          className={`fas ${typeIcon} wx-type-icon`}
          style={{ color: typeColor }}
          title={workItemType || 'Issue'}
        />
        <span className="wx-task-text" title={text}>
          {text}
        </span>
      </div>

      {/* Right side: Story points badge */}
      {hasStoryPoints ? (
        <div className="wx-smart-task-badge">{storyPoints}</div>
      ) : null}
    </div>
  );
}

export default SmartTaskContent;
