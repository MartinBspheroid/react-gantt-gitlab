import { useRef, useEffect, useState } from 'react';
import './SmartTaskContent.css';

/**
 * Smart Task Content Component
 * Automatically decides whether to show text inside or outside the bar
 * based on the bar's width
 */
function SmartTaskContent({ data }) {
  const barRef = useRef(null);
  const [showTextOutside, setShowTextOutside] = useState(false);
  const MIN_WIDTH_FOR_TEXT = 80; // Minimum bar width to show text inside (in pixels)

  useEffect(() => {
    if (!barRef.current) return;

    // Get the parent bar element's width
    const barElement = barRef.current.closest('.wx-bar');
    if (!barElement) return;

    const checkWidth = () => {
      const barWidth = barElement.offsetWidth;
      // If bar is too narrow, show text outside
      setShowTextOutside(barWidth < MIN_WIDTH_FOR_TEXT);
    };

    // Check width initially
    checkWidth();

    // Set up ResizeObserver to handle dynamic width changes
    const resizeObserver = new ResizeObserver(checkWidth);
    resizeObserver.observe(barElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  if (data.type === 'milestone') {
    // Milestones always show text outside on the right
    return (
      <div className="wx-smart-task wx-text-out" ref={barRef}>
        {data.text || ''}
      </div>
    );
  }

  if (showTextOutside) {
    // Show text outside the bar (on the right)
    return (
      <div className="wx-smart-task wx-text-out" ref={barRef}>
        {data.text || ''}
      </div>
    );
  }

  // Show text inside the bar
  return (
    <div className="wx-smart-task wx-content" ref={barRef}>
      {data.text || ''}
    </div>
  );
}

export default SmartTaskContent;
