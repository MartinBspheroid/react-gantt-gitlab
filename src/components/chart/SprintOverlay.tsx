import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Sprint, SprintCapacityInfo } from '../../types/azure-devops';
import './SprintOverlay.css';

interface SprintOverlayProps {
  sprints: Sprint[];
  scales: {
    start: Date;
    cellWidth: number;
    lengthUnitWidth?: number;
    minUnit?: string;
  } | null;
  scrollLeft: number;
  chartWidth: number;
  chartRef: React.RefObject<HTMLElement>;
  onSprintClick?: (sprint: Sprint) => void;
}

interface SprintDetailModalProps {
  sprint: Sprint;
  onClose: () => void;
  position: { top: number; left: number };
}

function SprintDetailModal({
  sprint,
  onClose,
  position,
}: SprintDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const formatDate = (date: Date | null) => {
    if (!date) return 'Not set';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const utilization =
    sprint.capacity && sprint.capacity > 0
      ? Math.round(((sprint.assignedWork || 0) / sprint.capacity) * 100)
      : 0;

  return (
    <div
      ref={modalRef}
      className="sprint-detail-modal"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 1000,
      }}
    >
      <div className="sprint-detail-header">
        <span className="sprint-detail-name">{sprint.name}</span>
        <button className="sprint-detail-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="sprint-detail-content">
        <div className="sprint-detail-row">
          <span className="sprint-detail-label">Dates:</span>
          <span className="sprint-detail-value">
            {formatDate(sprint.startDate)} - {formatDate(sprint.finishDate)}
          </span>
        </div>
        <div className="sprint-detail-row">
          <span className="sprint-detail-label">Capacity:</span>
          <span className="sprint-detail-value">
            {sprint.capacity ? `${sprint.capacity.toFixed(1)}h` : 'Not set'}
          </span>
        </div>
        <div className="sprint-detail-row">
          <span className="sprint-detail-label">Assigned:</span>
          <span className="sprint-detail-value">
            {(sprint.assignedWork || 0).toFixed(1)}h ({utilization}%)
          </span>
        </div>
        <div className="sprint-detail-row">
          <span className="sprint-detail-label">Remaining:</span>
          <span className="sprint-detail-value">
            {(sprint.remainingWork || 0).toFixed(1)}h
          </span>
        </div>
        <div className="sprint-detail-progress">
          <div className="sprint-detail-progress-bar">
            <div
              className={`sprint-detail-progress-fill sprint-status-${sprint.assignedWork && sprint.capacity && sprint.assignedWork > sprint.capacity ? 'over' : sprint.assignedWork && sprint.capacity && sprint.assignedWork / sprint.capacity > 0.85 ? 'near' : 'under'}`}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function getCapacityStatus(sprint: Sprint): 'under' | 'near' | 'over' {
  if (!sprint.capacity || sprint.capacity <= 0) return 'under';
  const utilization = (sprint.assignedWork || 0) / sprint.capacity;
  if (utilization > 1) return 'over';
  if (utilization > 0.85) return 'near';
  return 'under';
}

function SprintOverlay({
  sprints,
  scales,
  scrollLeft,
  chartWidth,
  chartRef,
  onSprintClick,
}: SprintOverlayProps) {
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });

  const sprintPositions = useMemo(() => {
    if (!scales || !sprints.length) return [];

    const cellWidth = scales.lengthUnitWidth || scales.cellWidth || 40;
    const timelineStart = new Date(scales.start);

    return sprints
      .filter((sprint) => sprint.startDate && sprint.finishDate)
      .map((sprint) => {
        const startOffset = sprint.startDate
          ? Math.floor(
              (sprint.startDate.getTime() - timelineStart.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0;

        const endOffset = sprint.finishDate
          ? Math.ceil(
              (sprint.finishDate.getTime() - timelineStart.getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1
          : 0;

        const left = startOffset * cellWidth;
        const width = (endOffset - startOffset) * cellWidth;

        const isVisible =
          left + width > scrollLeft - cellWidth &&
          left < scrollLeft + chartWidth + cellWidth;

        return {
          sprint,
          left,
          width,
          isVisible,
        };
      });
  }, [sprints, scales, scrollLeft, chartWidth]);

  const handleSprintClick = useCallback(
    (e: React.MouseEvent, sprint: Sprint) => {
      e.stopPropagation();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setModalPosition({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 250),
      });
      setSelectedSprint(sprint);
      onSprintClick?.(sprint);
    },
    [onSprintClick],
  );

  const handleCloseModal = useCallback(() => {
    setSelectedSprint(null);
  }, []);

  const formatDateRange = (sprint: Sprint) => {
    const format = (date: Date | null) => {
      if (!date) return '';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    };
    return `${format(sprint.startDate)} - ${format(sprint.finishDate)}`;
  };

  if (!sprintPositions.length) return null;

  return (
    <>
      <div className="sprint-overlay-container">
        {sprintPositions.map(({ sprint, left, width, isVisible }) => {
          if (!isVisible) return null;

          const status = getCapacityStatus(sprint);
          const capacityPercent =
            sprint.capacity && sprint.capacity > 0
              ? Math.min(
                  ((sprint.assignedWork || 0) / sprint.capacity) * 100,
                  100,
                )
              : 0;

          return (
            <div
              key={sprint.id}
              className={`sprint-band ${sprint.isCurrent ? 'sprint-current' : ''}`}
              style={{
                left: `${left}px`,
                width: `${width}px`,
              }}
              onClick={(e) => handleSprintClick(e, sprint)}
            >
              <div className="sprint-header">
                <span className="sprint-name">{sprint.name}</span>
                <span className="sprint-dates">{formatDateRange(sprint)}</span>
              </div>
              <div className="sprint-capacity-bar">
                <div
                  className={`sprint-capacity-fill sprint-status-${status}`}
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {selectedSprint && (
        <SprintDetailModal
          sprint={selectedSprint}
          onClose={handleCloseModal}
          position={modalPosition}
        />
      )}
    </>
  );
}

export default SprintOverlay;
export type { SprintOverlayProps, Sprint, SprintCapacityInfo };
