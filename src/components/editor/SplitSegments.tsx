// @ts-nocheck
import { useCallback, useMemo } from 'react';
import './SplitSegments.css';

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function SplitSegments({ value, onChange, readonly }) {
  const segments = useMemo(() => {
    if (!value || !Array.isArray(value) || value.length === 0) {
      return [];
    }
    return value;
  }, [value]);

  const handleSegmentChange = useCallback(
    (index, field, newValue) => {
      if (readonly || !onChange) return;

      const newSegments = [...segments];
      const segment = { ...newSegments[index] };
      segment[field] =
        field === 'start' || field === 'end' ? parseDate(newValue) : newValue;

      // Recalculate duration
      if (segment.start && segment.end) {
        const diff = segment.end.getTime() - segment.start.getTime();
        segment.duration = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }

      newSegments[index] = segment;
      onChange(newSegments);
    },
    [segments, onChange, readonly],
  );

  const handleAddSegment = useCallback(() => {
    if (readonly || !onChange) return;

    const lastSegment = segments[segments.length - 1];
    let newStart;
    let newEnd;

    if (lastSegment?.end) {
      newStart = new Date(lastSegment.end.getTime() + 24 * 60 * 60 * 1000);
      newEnd = new Date(newStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      newStart = new Date();
      newEnd = new Date(newStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const newSegment = {
      id: `segment_${Date.now()}`,
      start: newStart,
      end: newEnd,
      duration: 7,
    };

    onChange([...segments, newSegment]);
  }, [segments, onChange, readonly]);

  const handleRemoveSegment = useCallback(
    (index) => {
      if (readonly || !onChange || segments.length <= 1) return;

      const newSegments = segments.filter((_, i) => i !== index);
      onChange(newSegments);
    },
    [segments, onChange, readonly],
  );

  const handleMergeSegments = useCallback(() => {
    if (readonly || !onChange || segments.length <= 1) return;
    onChange([]);
  }, [segments, onChange, readonly]);

  if (segments.length === 0) {
    return (
      <div className="wx-split-segments-empty">
        <span className="wx-split-segments-hint">
          Task is not split. Use context menu to split.
        </span>
      </div>
    );
  }

  return (
    <div className="wx-split-segments">
      <div className="wx-split-segments-header">
        <span>Segments ({segments.length})</span>
        {!readonly && (
          <div className="wx-split-segments-actions">
            <button
              type="button"
              className="wx-split-segments-btn"
              onClick={handleAddSegment}
              title="Add segment"
            >
              +
            </button>
            <button
              type="button"
              className="wx-split-segments-btn wx-split-segments-merge"
              onClick={handleMergeSegments}
              title="Merge all segments"
            >
              Merge
            </button>
          </div>
        )}
      </div>
      <div className="wx-split-segments-list">
        {segments.map((segment, index) => (
          <div key={segment.id || index} className="wx-split-segment-item">
            <div className="wx-split-segment-number">#{index + 1}</div>
            <div className="wx-split-segment-fields">
              <label>
                Start:
                <input
                  type="date"
                  value={
                    segment.start
                      ? segment.start.toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) =>
                    handleSegmentChange(index, 'start', e.target.value)
                  }
                  disabled={readonly}
                />
              </label>
              <label>
                End:
                <input
                  type="date"
                  value={
                    segment.end ? segment.end.toISOString().split('T')[0] : ''
                  }
                  onChange={(e) =>
                    handleSegmentChange(index, 'end', e.target.value)
                  }
                  disabled={readonly}
                />
              </label>
              <span className="wx-split-segment-duration">
                {segment.duration || 0} days
              </span>
            </div>
            {!readonly && segments.length > 1 && (
              <button
                type="button"
                className="wx-split-segment-remove"
                onClick={() => handleRemoveSegment(index)}
                title="Remove segment"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SplitSegments;
