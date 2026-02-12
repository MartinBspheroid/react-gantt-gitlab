/**
 * Shadcn Theme - Custom Variable Overrides
 *
 * Demonstrates how to override specific shadcn CSS custom properties
 * to customize the Gantt appearance while maintaining theme consistency.
 */

import { useMemo } from 'react';
import { Gantt } from '@svar-ui/react-gantt';
import { Shadcn } from '@svar-ui/react-gantt/themes';
import './CustomVariableOverrides.css';

function CustomVariableOverrides() {
  const tasks = useMemo(
    () => [
      {
        id: 1,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 10),
        text: 'Custom Styled Task',
        progress: 100,
        type: 'task',
      },
      {
        id: 2,
        start: new Date(2024, 3, 8),
        end: new Date(2024, 3, 20),
        text: 'Brand Color Task',
        progress: 60,
        type: 'task',
      },
      {
        id: 3,
        start: new Date(2024, 3, 18),
        end: new Date(2024, 3, 25),
        text: 'Custom Border Task',
        progress: 30,
        type: 'task',
      },
      {
        id: 4,
        start: new Date(2024, 3, 25),
        text: 'Custom Milestone',
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

  return (
    <div className="custom-variables-demo">
      <div className="custom-variables-info">
        <h3>Custom Variable Overrides</h3>
        <p>
          This example demonstrates overriding specific CSS custom properties to
          customize the Gantt chart appearance while maintaining shadcn/ui theme
          consistency.
        </p>

        <div className="overrides-list">
          <h4>Custom Overrides Applied:</h4>
          <ul>
            <li>
              <code>--primary</code>: Custom purple brand color
            </li>
            <li>
              <code>--border-radius</code>: Increased to 12px
            </li>
            <li>
              <code>--task-bar-height</code>: Taller bars (32px)
            </li>
            <li>
              <code>--grid-line-color</code>: Subtle gray lines
            </li>
          </ul>
        </div>
      </div>

      <div className="custom-gantt-wrapper">
        <Shadcn>
          <div className="custom-theme-override">
            <Gantt tasks={tasks} links={links} scales={scales} zoom />
          </div>
        </Shadcn>
      </div>
    </div>
  );
}

export default CustomVariableOverrides;
