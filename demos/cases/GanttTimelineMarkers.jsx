import { useMemo, useState, useCallback } from 'react';
import { Gantt, Editor } from '../../src/';
import { Alert, Locale, Field, DatePicker } from '@svar-ui/react-core';
import './GanttTimelineMarkers.css';

/**
 * Timeline Markers Demo
 *
 * Demonstrates the timeline markers feature that allows placing
 * vertical marker lines on the Gantt chart at specific dates.
 *
 * Markers can be used to indicate:
 * - Project milestones
 * - Release dates
 * - Sprint boundaries
 * - Important deadlines
 * - Custom events
 *
 * Each marker supports:
 * - Custom date placement
 * - Text label
 * - Custom CSS class for styling
 * - Visual distinction through colors
 */
export default function GanttTimelineMarkers({ skinSettings }) {
  // Editable marker dates for interactive demo
  const [milestoneDate, setMilestoneDate] = useState(new Date(2024, 3, 15));
  const [releaseDate, setReleaseDate] = useState(new Date(2024, 3, 30));
  const [reviewDate, setReviewDate] = useState(new Date(2024, 4, 10));
  const [deadlineDate, setDeadlineDate] = useState(new Date(2024, 4, 20));

  const [api, setApi] = useState();

  // Define markers with different styles and purposes
  const markers = useMemo(
    () => [
      {
        start: milestoneDate,
        text: 'Phase 1 Milestone',
        css: 'milestone-marker',
      },
      {
        start: releaseDate,
        text: 'Release Date',
        css: 'release-marker',
      },
      {
        start: reviewDate,
        text: 'Code Review',
        css: 'review-marker',
      },
      {
        start: deadlineDate,
        text: 'Final Deadline',
        css: 'deadline-marker',
      },
    ],
    [milestoneDate, releaseDate, reviewDate, deadlineDate],
  );

  // Demo tasks that relate to the markers
  const tasks = useMemo(
    () => [
      {
        id: 1,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 10),
        text: 'Planning Phase',
        progress: 100,
        parent: 0,
        type: 'task',
      },
      {
        id: 2,
        start: new Date(2024, 3, 8),
        end: new Date(2024, 3, 20),
        text: 'Development Sprint 1',
        progress: 75,
        parent: 0,
        type: 'task',
      },
      {
        id: 3,
        start: new Date(2024, 3, 18),
        end: new Date(2024, 3, 28),
        text: 'Development Sprint 2',
        progress: 40,
        parent: 0,
        type: 'task',
      },
      {
        id: 4,
        start: new Date(2024, 3, 25),
        end: new Date(2024, 4, 8),
        text: 'Testing & QA',
        progress: 20,
        parent: 0,
        type: 'task',
      },
      {
        id: 5,
        start: new Date(2024, 4, 5),
        end: new Date(2024, 4, 18),
        text: 'Bug Fixes & Polish',
        progress: 0,
        parent: 0,
        type: 'task',
      },
      {
        id: 6,
        start: new Date(2024, 3, 15),
        text: 'Phase 1 Complete',
        progress: 0,
        parent: 0,
        type: 'milestone',
      },
      {
        id: 7,
        start: new Date(2024, 3, 30),
        text: 'Beta Release',
        progress: 0,
        parent: 0,
        type: 'milestone',
      },
      {
        id: 8,
        start: new Date(2024, 4, 20),
        text: 'Production Launch',
        progress: 0,
        parent: 0,
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
      { id: 5, source: 2, target: 6, type: 'e2s' },
      { id: 6, source: 3, target: 7, type: 'e2s' },
      { id: 7, source: 5, target: 8, type: 'e2s' },
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

  // Initialize Gantt API
  const init = useCallback((gApi) => {
    setApi(gApi);
  }, []);

  return (
    <div className="wx-markers-demo demo">
      <Locale>
        <div className="wx-markers-demo explanation-banner">
          <Alert type="info">
            <strong>Timeline Markers Demo:</strong> Vertical markers indicate
            important dates on the timeline. Each marker has a custom style and
            label. Try adjusting the dates below to move the markers
            dynamically.
          </Alert>
        </div>

        <div className="wx-markers-demo controls-bar">
          <Field label="Phase 1 Milestone" position="left">
            {({ id }) => (
              <DatePicker
                value={milestoneDate}
                id={id}
                onChange={({ value }) => setMilestoneDate(value)}
              />
            )}
          </Field>
          <Field label="Release Date" position="left">
            {({ id }) => (
              <DatePicker
                value={releaseDate}
                id={id}
                onChange={({ value }) => setReleaseDate(value)}
              />
            )}
          </Field>
          <Field label="Code Review" position="left">
            {({ id }) => (
              <DatePicker
                value={reviewDate}
                id={id}
                onChange={({ value }) => setReviewDate(value)}
              />
            )}
          </Field>
          <Field label="Final Deadline" position="left">
            {({ id }) => (
              <DatePicker
                value={deadlineDate}
                id={id}
                onChange={({ value }) => setDeadlineDate(value)}
              />
            )}
          </Field>
        </div>

        {/* Legend */}
        <div className="wx-markers-demo legend-bar">
          <div className="legend-item">
            <span className="legend-marker milestone"></span>
            <span>Milestone</span>
          </div>
          <div className="legend-item">
            <span className="legend-marker release"></span>
            <span>Release</span>
          </div>
          <div className="legend-item">
            <span className="legend-marker review"></span>
            <span>Review</span>
          </div>
          <div className="legend-item">
            <span className="legend-marker deadline"></span>
            <span>Deadline</span>
          </div>
        </div>
      </Locale>

      <div className="wx-markers-demo gantt-container">
        <Gantt
          {...skinSettings}
          init={init}
          tasks={tasks}
          links={links}
          scales={scales}
          markers={markers}
          start={new Date(2024, 2, 25)}
          end={new Date(2024, 4, 25)}
          zoom
        />
        {api && <Editor api={api} />}
      </div>
    </div>
  );
}
