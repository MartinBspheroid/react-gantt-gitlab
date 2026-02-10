import { getMatchingRules, parseLabelsString } from '../../types/colorRule';
import './TextCell.css';

/**
 * Convert hex color + opacity to rgba string
 * This matches the approach used in Bars.jsx for consistency
 */
function toRgba(hex, opacity = 1) {
  if (!hex) return 'transparent';
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function TextCell({ row, column }) {
  function getStyle(row, col) {
    return {
      justifyContent: col.align,
      paddingLeft: `${(row.$level - 1) * 20}px`,
    };
  }

  const CellComponent = column && column._cell;
  const colorRules = column?.colorRules;
  const matchedRules = colorRules
    ? getMatchingRules(row.text, parseLabelsString(row.labels), colorRules)
    : [];

  return (
    <div className="wx-pqc08MHU wx-content" style={getStyle(row, column)}>
      {row.data || row.lazy ? (
        <i
          className={`wx-pqc08MHU wx-toggle-icon wxi-menu-${row.open ? 'down' : 'right'}`}
          data-action="open-task"
        />
      ) : (
        <i className="wx-pqc08MHU wx-toggle-placeholder" />
      )}
      <div className="wx-pqc08MHU wx-text">
        {CellComponent ? <CellComponent row={row} column={column} /> : row.text}
      </div>
      {matchedRules.length > 0 && (
        <div className="wx-color-indicators">
          {matchedRules.map((rule) => (
            <span
              key={rule.id}
              className="wx-color-indicator"
              style={{
                backgroundColor: toRgba(rule.color, (rule.opacity ?? 1) * 0.7),
              }}
              title={rule.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TextCell;
