import { useMemo } from 'react';
import { Gantt } from '../../src/';

/**
 * Baselines Visualization Demo (PRO Feature)
 *
 * This demo showcases the baselines feature which displays planned dates
 * alongside actual task dates. Baselines help track schedule variance
 * by comparing original planned dates (base_start, base_end) against
 * the current actual dates (start, end).
 *
 * Visual Guide:
 * - Solid bars = Actual dates (current schedule)
 * - Lighter/dashed bars below = Baseline dates (original planned schedule)
 * - Baseline bars are read-only and non-interactive
 */

function GanttBaselines({ skinSettings }) {
  // Demo tasks with both actual dates and baseline (planned) dates
  const tasks = useMemo(
    () => [
      // Project Planning Phase - On schedule
      {
        id: 1,
        start: new Date(2024, 2, 1),
        end: new Date(2024, 2, 15),
        base_start: new Date(2024, 2, 1),
        base_end: new Date(2024, 2, 15),
        text: 'Project Planning (On Schedule)',
        progress: 100,
        parent: 0,
        type: 'task',
      },
      // Development Phase - Behind schedule (actual dates shifted later)
      {
        id: 2,
        start: new Date(2024, 2, 20),
        end: new Date(2024, 3, 5),
        base_start: new Date(2024, 2, 16),
        base_end: new Date(2024, 2, 30),
        text: 'Development (Behind Schedule)',
        progress: 60,
        parent: 0,
        type: 'task',
      },
      // Testing Phase - Ahead of schedule (actual dates shifted earlier)
      {
        id: 3,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 10),
        base_start: new Date(2024, 3, 6),
        base_end: new Date(2024, 3, 20),
        text: 'Testing (Ahead of Schedule)',
        progress: 40,
        parent: 0,
        type: 'task',
      },
      // Milestone - On time
      {
        id: 4,
        start: new Date(2024, 3, 15),
        base_start: new Date(2024, 3, 15),
        text: 'Release Milestone (On Time)',
        progress: 0,
        parent: 0,
        type: 'milestone',
      },
      // Summary task with children showing varied baselines
      {
        id: 5,
        start: new Date(2024, 3, 10),
        end: new Date(2024, 3, 30),
        base_start: new Date(2024, 3, 10),
        base_end: new Date(2024, 3, 25),
        text: 'Implementation Summary',
        progress: 50,
        parent: 0,
        type: 'summary',
        open: true,
      },
      // Child task 1 - Behind
      {
        id: 51,
        start: new Date(2024, 3, 12),
        end: new Date(2024, 3, 18),
        base_start: new Date(2024, 3, 10),
        base_end: new Date(2024, 3, 14),
        text: 'Backend API (Delayed)',
        progress: 80,
        parent: 5,
        type: 'task',
      },
      // Child task 2 - On track
      {
        id: 52,
        start: new Date(2024, 3, 15),
        end: new Date(2024, 3, 22),
        base_start: new Date(2024, 3, 15),
        base_end: new Date(2024, 3, 22),
        text: 'Frontend UI (On Track)',
        progress: 60,
        parent: 5,
        type: 'task',
      },
      // Child task 3 - Ahead
      {
        id: 53,
        start: new Date(2024, 3, 18),
        end: new Date(2024, 3, 24),
        base_start: new Date(2024, 3, 20),
        base_end: new Date(2024, 3, 28),
        text: 'Integration Tests (Early)',
        progress: 30,
        parent: 5,
        type: 'task',
      },
    ],
    [],
  );

  const links = useMemo(
    () => [
      { id: 1, source: 1, target: 2, type: 'e2s' },
      { id: 2, source: 2, target: 3, type: 'e2s' },
      { id: 3, source: 3, target: 4, type: 'e2s' },
      { id: 4, source: 51, target: 52, type: 'e2s' },
      { id: 5, source: 52, target: 53, type: 'e2s' },
    ],
    [],
  );

  const scales = useMemo(
    () => [
      { unit: 'month', step: 1, format: 'MMMM yyyy' },
      { unit: 'day', step: 1, format: 'd' },
    ],
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Explanation Banner */}
      <div
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        <h3
          style={{
            margin: '0 0 12px 0',
            fontSize: '18px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '22px' }}>📊</span>
          Baselines Visualization (PRO Feature)
        </h3>
        <div
          style={{
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap',
            fontSize: '14px',
            lineHeight: '1.5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '24px',
                height: '12px',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: '2px',
                border: '1px solid rgba(255,255,255,0.5)',
              }}
            />
            <span>
              <strong>Solid bars:</strong> Actual dates (current schedule)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '24px',
                height: '8px',
                background: 'rgba(255,255,255,0.4)',
                borderRadius: '2px',
                border: '1px dashed rgba(255,255,255,0.6)',
                marginTop: '4px',
              }}
            />
            <span>
              <strong>Lighter bars below:</strong> Baseline dates (original
              plan)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📍</span>
            <span>
              <strong>Read-only:</strong> Baselines are non-interactive
              visualization
            </span>
          </div>
        </div>
        <p
          style={{
            margin: '12px 0 0 0',
            fontSize: '13px',
            opacity: 0.9,
            fontStyle: 'italic',
          }}
        >
          Compare planned vs actual dates to track schedule variance. Tasks with
          baselines shifted to the right are behind schedule; shifted left are
          ahead.
        </p>
      </div>

      {/* Gantt Chart with Baselines Enabled */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Gantt
          {...skinSettings}
          tasks={tasks}
          links={links}
          scales={scales}
          baselines={true}
          zoom
          cellWidth={50}
        />
      </div>
    </div>
  );
}

export default GanttBaselines;
