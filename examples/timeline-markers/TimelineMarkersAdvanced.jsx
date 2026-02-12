/**
 * Timeline Markers - Advanced Example
 *
 * Demonstrates multiple markers with custom CSS styling,
 * programmatic marker management, and dynamic marker updates.
 */

import { useMemo, useState, useCallback } from 'react';
import { Gantt } from '@svar-ui/react-gantt';
import './TimelineMarkersAdvanced.css';

function TimelineMarkersAdvanced() {
  // Track markers in state for dynamic management
  const [markers, setMarkers] = useState([
    {
      start: new Date(),
      text: 'Today',
      css: 'marker-today',
    },
    {
      start: new Date(2024, 3, 15),
      text: 'Sprint Review',
      css: 'marker-review',
    },
    {
      start: new Date(2024, 3, 22),
      text: 'Code Freeze',
      css: 'marker-freeze',
    },
    {
      start: new Date(2024, 3, 25),
      text: 'Release',
      css: 'marker-release',
    },
  ]);

  const tasks = useMemo(
    () => [
      {
        id: 1,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 10),
        text: 'Design Phase',
        progress: 100,
        type: 'task',
      },
      {
        id: 2,
        start: new Date(2024, 3, 8),
        end: new Date(2024, 3, 18),
        text: 'Development',
        progress: 75,
        type: 'task',
      },
      {
        id: 3,
        start: new Date(2024, 3, 15),
        end: new Date(2024, 3, 22),
        text: 'Testing',
        progress: 40,
        type: 'task',
      },
      {
        id: 4,
        start: new Date(2024, 3, 22),
        end: new Date(2024, 3, 25),
        text: 'Bug Fixes',
        progress: 10,
        type: 'task',
      },
      {
        id: 5,
        start: new Date(2024, 3, 25),
        text: 'Release',
        progress: 0,
        type: 'milestone',
      },
    ],
    [],
  );

  const links = useMemo(
    () => [
      { id: 1, source: 1, target: 2, type: 'e2s' },
      { id: 2, source: 2, target: 3, type: 'e2s' },
      { id: 3, source: 3, target: 4, type: 'e2s' },
      { id: 4, source: 4, target: 5, type: 'e2s' },
    ],
    [],
  );

  const scales = useMemo(
    () => [
      { unit: 'month', step: 1, format: 'MMMM yyyy' },
      { unit: 'week', step: 1, format: 'w' },
      { unit: 'day', step: 1, format: 'd' },
    ],
    [],
  );

  // Add a new marker
  const addMarker = useCallback(() => {
    const newDate = new Date(2024, 3, 10 + Math.floor(Math.random() * 15));
    const newMarker = {
      start: newDate,
      text: `Marker ${markers.length + 1}`,
      css: 'marker-custom',
    };
    setMarkers((prev) => [...prev, newMarker]);
  }, [markers.length]);

  // Remove last marker
  const removeLastMarker = useCallback(() => {
    setMarkers((prev) => prev.slice(0, -1));
  }, []);

  // Clear all custom markers, keep Today
  const resetMarkers = useCallback(() => {
    setMarkers([
      {
        start: new Date(),
        text: 'Today',
        css: 'marker-today',
      },
    ]);
  }, []);

  return (
    <div className="timeline-advanced-container">
      <div className="timeline-controls">
        <h3>Timeline Markers Management</h3>
        <div className="control-buttons">
          <button onClick={addMarker} className="btn-add">
            + Add Random Marker
          </button>
          <button onClick={removeLastMarker} className="btn-remove"
            disabled={markers.length <= 1}
          >
            - Remove Last
          </button>
          <button onClick={resetMarkers} className="btn-reset">
            Reset to Today Only
          </button>
        </div>

        <div className="marker-list">
          <strong>Current Markers ({markers.length}):</strong>
          <ul>
            {markers.map((marker, index) => (
              <li key={index} className={`marker-item ${marker.css}`}>
                {marker.text} - {marker.start.toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>

        <div className="marker-legend">
          <div className="legend-item">
            <span className="legend-color marker-today"></span>
            <span>Today (Red)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color marker-review"></span>
            <span>Sprint Review (Blue)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color marker-freeze"></span>
            <span>Code Freeze (Orange)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color marker-release"></span>
            <span>Release (Green)</span>
          </div>
        </div>
      </div>

      <div className="timeline-chart">
        <Gantt
          tasks={tasks}
          links={links}
          scales={scales}
          markers={markers}
          zoom
        />
      </div>
    </div>
  );
}

export default TimelineMarkersAdvanced;
