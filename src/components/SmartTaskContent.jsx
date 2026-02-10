import './SmartTaskContent.css';

/**
 * Smart Task Content Component
 * Always shows text outside the bar (on the right) for better readability
 */
function SmartTaskContent({ data }) {
  return <div className="wx-smart-task wx-text-out">{data.text || ''}</div>;
}

export default SmartTaskContent;
