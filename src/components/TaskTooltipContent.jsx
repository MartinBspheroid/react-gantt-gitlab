import { format } from 'date-fns';
import './TaskTooltipContent.css';

function TaskTooltipContent(props) {
  const { data } = props;

  if (!data) return null;

  const isMilestone = data.$isMilestone || data._gitlab?.type === 'milestone';
  const isTask = data._gitlab?.workItemType === 'Task';

  const typeLabel = isMilestone ? 'Milestone' : isTask ? 'Task' : 'Issue';
  const iid = data._gitlab?.iid || data.id;

  const stateDisplay = data.state || data._gitlab?.state || 'opened';
  const stateLabel =
    stateDisplay.toLowerCase() === 'closed' ? 'Closed' : 'Open';
  const stateClass =
    stateDisplay.toLowerCase() === 'closed' ? 'closed' : 'open';

  const weight = data.weight ?? data._gitlab?.weight;
  const assigneeDisplay = data.assigned || 'Unassigned';

  const dateFormat = 'MMM d, yyyy';
  const startDate = data.start
    ? format(new Date(data.start), dateFormat)
    : 'Not set';
  const endDate = data.end ? format(new Date(data.end), dateFormat) : 'Not set';

  const truncateDescription = (text, maxLength = 150) => {
    if (!text) return null;
    const stripped = text.replace(/<[^>]*>/g, '').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
  };
  const description = truncateDescription(data.details);

  const getTypeIcon = () => {
    if (isMilestone) {
      return <i className="far fa-flag" style={{ color: '#ad44ab' }}></i>;
    }
    if (isTask) {
      return (
        <i className="far fa-square-check" style={{ color: '#00ba94' }}></i>
      );
    }
    return <i className="far fa-clipboard" style={{ color: '#3983eb' }}></i>;
  };

  return (
    <div className="task-tooltip-content">
      <div className="task-tooltip-header">
        {getTypeIcon()}
        <span className="task-tooltip-type">{typeLabel}</span>
        <span className="task-tooltip-iid">#{iid}</span>
        <span className={`task-tooltip-state ${stateClass}`}>{stateLabel}</span>
      </div>

      <div className="task-tooltip-title">{data.text}</div>

      <div className="task-tooltip-row">
        <span className="task-tooltip-label">Assignee:</span>
        <span className="task-tooltip-value">{assigneeDisplay}</span>
      </div>

      {weight !== undefined && weight !== null && (
        <div className="task-tooltip-row">
          <span className="task-tooltip-label">Story Points:</span>
          <span className="task-tooltip-value">{weight}</span>
        </div>
      )}

      <div className="task-tooltip-row">
        <span className="task-tooltip-label">Start:</span>
        <span className="task-tooltip-value">{startDate}</span>
      </div>

      <div className="task-tooltip-row">
        <span className="task-tooltip-label">Due:</span>
        <span className="task-tooltip-value">{endDate}</span>
      </div>

      {description && (
        <div className="task-tooltip-description">
          <span className="task-tooltip-label">Description:</span>
          <p className="task-tooltip-description-text">{description}</p>
        </div>
      )}
    </div>
  );
}

export default TaskTooltipContent;
