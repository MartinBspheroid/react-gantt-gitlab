import { renderWorkItemIcon } from '../../utils/WorkItemTypeIcons.tsx';
import './SmartTaskContent.css';

function SmartTaskContent({ data }) {
  const icon = renderWorkItemIcon(data, 'fontawesome');

  return (
    <div className="wx-smart-task wx-text-out">
      {icon && <span className="wx-task-type-icon">{icon}</span>}
      <span className="wx-task-text">{data.text || ''}</span>
    </div>
  );
}

export default SmartTaskContent;
