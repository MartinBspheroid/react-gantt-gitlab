import { useContext, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import storeContext from '../../context';
import { useStore } from '@svar-ui/lib-react';
import './Links.css';

const LIBRARY_LINK_OFFSET_MAX = 20;
const LIBRARY_BASELINE_Y_OFFSET = 7;
const LIBRARY_BAR_CENTER_ADJUST = 3;
const LIBRARY_ARROW_WIDTH = 5;
const LIBRARY_ARROW_HEIGHT = 3;
const DETOUR_PADDING = 10;

function getLinkEndpoints(linkType) {
  const isFromStart = linkType === 's2s' || linkType === 's2e';
  const isToStart = linkType === 'e2s' || linkType === 's2s';
  return { isFromStart, isToStart };
}

function getTaskConnectionX(task, isStart) {
  return isStart ? task.$x : task.$x + task.$w;
}

function generateArrowPoints(endX, endY, isToStart) {
  const w = LIBRARY_ARROW_WIDTH;
  const h = LIBRARY_ARROW_HEIGHT;

  return isToStart
    ? `${endX - w},${endY - h},${endX - w},${endY + h},${endX},${endY}`
    : `${endX + w},${endY + h},${endX + w},${endY - h},${endX},${endY}`;
}

function generatePathPoints(points) {
  return points.map(([x, y]) => `${x},${y}`).join(',');
}

function hasVisibleBar(task) {
  if (!task) return false;

  if (
    task.$x == null ||
    task.$y == null ||
    task.$w == null ||
    task.$h == null
  ) {
    return false;
  }
  if (task.$w <= 0 || task.$h <= 0) {
    return false;
  }

  const isGitLabMilestone =
    task.$isMilestone || task._gitlab?.type === 'milestone';
  if (isGitLabMilestone) {
    return true;
  }

  if (task.type === 'summary') {
    return true;
  }

  return !!task._gitlab?.dueDate;
}

function calculateLinkPath(
  link,
  sourceTask,
  targetTask,
  cellHeight,
  cellWidth,
  baselines,
) {
  const { isFromStart, isToStart } = getLinkEndpoints(link.type);

  const linkOffset = Math.min(cellWidth / 2, LIBRARY_LINK_OFFSET_MAX);
  const barCenterOffset =
    Math.round(cellHeight / 2) - LIBRARY_BAR_CENTER_ADJUST;

  const sourceY = baselines
    ? sourceTask.$y - LIBRARY_BASELINE_Y_OFFSET
    : sourceTask.$y;
  const targetY = baselines
    ? targetTask.$y - LIBRARY_BASELINE_Y_OFFSET
    : targetTask.$y;

  const startX = getTaskConnectionX(sourceTask, isFromStart);
  const startY = sourceY + barCenterOffset;

  const endX = getTaskConnectionX(targetTask, isToStart);
  const endY = targetY + barCenterOffset;

  const turnX1 = startX + (isFromStart ? -linkOffset : linkOffset);
  const turnX2 = endX + (isToStart ? -linkOffset : linkOffset);

  const needsDetour = turnX1 >= turnX2;

  let pathPoints;
  let midPoint;

  if (needsDetour) {
    const isTargetAbove = targetY < sourceY;
    const detourTask = isTargetAbove ? targetTask : sourceTask;
    const detourBaseY = isTargetAbove ? targetY : sourceY;
    const barHeight = detourTask.$h;
    const detourY = detourBaseY + barHeight + DETOUR_PADDING;

    const points = [
      [startX, startY],
      [turnX1, startY],
      [turnX1, detourY],
      [turnX2, detourY],
      [turnX2, endY],
      [endX, endY],
    ];
    pathPoints = generatePathPoints(points);
    midPoint = points[2];
  } else {
    const midX = turnX1;
    const midY = (startY + endY) / 2;
    pathPoints = generatePathPoints([
      [startX, startY],
      [turnX1, startY],
      [turnX1, endY],
      [endX, endY],
    ]);
    midPoint = [midX, midY];
  }

  return {
    points: `${pathPoints},${generateArrowPoints(endX, endY, isToStart)}`,
    midPoint,
  };
}

function getLinkTypeLabel(type) {
  const labels = {
    e2s: 'End to Start',
    s2s: 'Start to Start',
    e2e: 'End to End',
    s2e: 'Start to End',
  };
  return labels[type] || type;
}

function LinkDetailsPopup({ link, sourceTask, targetTask, position, onClose }) {
  const popupRef = useRef(null);

  const handleClickOutside = useCallback(
    (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    },
    [onClose],
  );

  useState(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  if (!position) return null;

  const style = {
    position: 'fixed',
    left: `${Math.min(position.x, window.innerWidth - 280)}px`,
    top: `${Math.min(position.y, window.innerHeight - 200)}px`,
    zIndex: 10000,
  };

  return (
    <div ref={popupRef} className="wx-link-details-popup" style={style}>
      <div className="wx-link-details-header">Dependency Details</div>
      <div className="wx-link-details-row">
        <span className="wx-link-details-label">Type:</span>
        <span className="wx-link-details-value">
          {getLinkTypeLabel(link.type)}
        </span>
      </div>
      <div className="wx-link-details-row">
        <span className="wx-link-details-label">Source:</span>
        <span className="wx-link-details-value">
          {sourceTask?.text || link.source}
        </span>
      </div>
      <div className="wx-link-details-row">
        <span className="wx-link-details-label">Target:</span>
        <span className="wx-link-details-value">
          {targetTask?.text || link.target}
        </span>
      </div>
      {link.lag !== undefined && link.lag !== 0 && (
        <div className="wx-link-details-row">
          <span className="wx-link-details-label">Lag:</span>
          <span className="wx-link-details-value">
            {link.lag > 0 ? '+' : ''}
            {link.lag} day{Math.abs(link.lag) !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      <button className="wx-link-details-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

export default function Links() {
  const api = useContext(storeContext);
  const links = useStore(api, '_links');
  const tasks = useStore(api, '_tasks');
  const cellHeight = useStore(api, 'cellHeight');
  const cellWidth = useStore(api, 'cellWidth');
  const baselines = useStore(api, 'baselines');

  const [hoveredLink, setHoveredLink] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);

  const taskMap = useMemo(() => {
    const map = new Map();
    (tasks || []).forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const highlightedTaskIds = useMemo(() => {
    if (!hoveredLink && !selectedLink) return new Set();
    const link = hoveredLink || selectedLink;
    return new Set([link.source, link.target]);
  }, [hoveredLink, selectedLink]);

  const processedLinks = useMemo(() => {
    return (links || [])
      .map((link) => {
        const sourceTask = taskMap.get(link.source);
        const targetTask = taskMap.get(link.target);

        if (hasVisibleBar(sourceTask) && hasVisibleBar(targetTask)) {
          const { points, midPoint } = calculateLinkPath(
            link,
            sourceTask,
            targetTask,
            cellHeight,
            cellWidth,
            baselines,
          );
          return {
            ...link,
            $p: points,
            $midPoint: midPoint,
            sourceTask,
            targetTask,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [links, taskMap, cellHeight, cellWidth, baselines]);

  const handleLinkClick = useCallback((e, link) => {
    e.stopPropagation();
    setSelectedLink(link);
    setPopupPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleLinkMouseEnter = useCallback((link) => {
    setHoveredLink(link);
  }, []);

  const handleLinkMouseLeave = useCallback(() => {
    setHoveredLink(null);
  }, []);

  const handleClosePopup = useCallback(() => {
    setSelectedLink(null);
    setPopupPosition(null);
  }, []);

  const getLinkClassName = useCallback(
    (link) => {
      const isHovered = hoveredLink?.id === link.id;
      const isSelected = selectedLink?.id === link.id;
      const isHighlighted = isHovered || isSelected;

      let className = 'wx-dkx3NwEn wx-line';
      if (isHighlighted) {
        className += ' wx-line-highlighted';
      }
      return className;
    },
    [hoveredLink, selectedLink],
  );

  return (
    <>
      <svg className="wx-dkx3NwEn wx-links">
        {processedLinks.map((link) => (
          <g key={link.id}>
            <polyline
              className={getLinkClassName(link)}
              points={link.$p}
              onClick={(e) => handleLinkClick(e, link)}
              onMouseEnter={() => handleLinkMouseEnter(link)}
              onMouseLeave={handleLinkMouseLeave}
            />
            {link.lag !== undefined && link.lag !== 0 && link.$midPoint && (
              <g
                className="wx-link-lag-group"
                onClick={(e) => handleLinkClick(e, link)}
                onMouseEnter={() => handleLinkMouseEnter(link)}
                onMouseLeave={handleLinkMouseLeave}
              >
                <rect
                  className="wx-link-lag-bg"
                  x={link.$midPoint[0] - 15}
                  y={link.$midPoint[1] - 8}
                  width="30"
                  height="16"
                  rx="3"
                />
                <text
                  className="wx-link-lag-text"
                  x={link.$midPoint[0]}
                  y={link.$midPoint[1] + 4}
                  textAnchor="middle"
                >
                  {link.lag > 0 ? '+' : ''}
                  {link.lag}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>

      {selectedLink &&
        createPortal(
          <LinkDetailsPopup
            link={selectedLink}
            sourceTask={selectedLink.sourceTask}
            targetTask={selectedLink.targetTask}
            position={popupPosition}
            onClose={handleClosePopup}
          />,
          document.body,
        )}

      <style>{`
        .wx-line-highlighted {
          stroke: var(--wx-gantt-link-color, #4a90d9) !important;
          stroke-width: 3 !important;
          filter: drop-shadow(0 0 4px var(--wx-gantt-link-color, #4a90d9));
        }
        
        .wx-link-lag-group {
          cursor: pointer;
          pointer-events: all;
        }
        
        .wx-link-lag-bg {
          fill: var(--wx-gantt-link-marker-background, #eaedf5);
          stroke: var(--wx-gantt-link-color, #9fa1ae);
          stroke-width: 1;
        }
        
        .wx-link-lag-text {
          font-size: 10px;
          font-weight: 500;
          fill: var(--wx-gantt-link-marker-color, #9fa1ae);
          pointer-events: none;
          user-select: none;
        }
        
        .wx-link-details-popup {
          background: var(--wx-gantt-modal-background, #fff);
          border: 1px solid var(--wx-gantt-border-color, #e6e6e6);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 12px 16px;
          min-width: 240px;
          font-family: var(--wx-font-family, system-ui, -apple-system, sans-serif);
          font-size: 13px;
        }
        
        .wx-link-details-header {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--wx-gantt-border-color, #e6e6e6);
          color: var(--wx-color-font, #333);
        }
        
        .wx-link-details-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .wx-link-details-label {
          color: var(--wx-gantt-modal-hint-text, #666);
          font-size: 12px;
        }
        
        .wx-link-details-value {
          color: var(--wx-color-font, #333);
          font-weight: 500;
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .wx-link-details-close {
          margin-top: 12px;
          padding: 6px 12px;
          background: var(--wx-gantt-control-background, #f8f9fa);
          border: 1px solid var(--wx-gantt-control-border, #e0e0e0);
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          color: var(--wx-gantt-control-text, #666);
          width: 100%;
        }
        
        .wx-link-details-close:hover {
          background: var(--wx-gantt-button-hover-background, #f5f5f5);
        }
      `}</style>
    </>
  );
}
