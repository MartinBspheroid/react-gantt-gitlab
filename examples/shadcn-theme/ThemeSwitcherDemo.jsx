/**
 * Shadcn Theme - Theme Switcher Demo
 *
 * Demonstrates dynamic theme switching between light and dark modes
 * using shadcn/ui design system tokens.
 */

import { useState, useMemo } from 'react';
import { Gantt } from '@svar-ui/react-gantt';
import { Shadcn, ShadcnDark } from '@svar-ui/react-gantt/themes';
import './ThemeSwitcherDemo.css';

function ThemeSwitcherDemo() {
  const [theme, setTheme] = useState('light');

  const tasks = useMemo(
    () => [
      {
        id: 1,
        start: new Date(2024, 3, 1),
        end: new Date(2024, 3, 10),
        text: 'Project Planning',
        progress: 100,
        type: 'task',
      },
      {
        id: 2,
        start: new Date(2024, 3, 8),
        end: new Date(2024, 3, 20),
        text: 'Development',
        progress: 60,
        type: 'task',
      },
      {
        id: 3,
        start: new Date(2024, 3, 18),
        end: new Date(2024, 3, 25),
        text: 'Testing',
        progress: 30,
        type: 'task',
      },
      {
        id: 4,
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

  const ThemeWrapper = theme === 'dark' ? ShadcnDark : Shadcn;

  return (
    <div className="theme-switcher-demo">
      <div className="theme-controls">
        <h3>Theme Switcher Demo</h3>
        <p className="theme-description">
          Toggle between light and dark themes. The Gantt chart automatically
          adapts to the selected shadcn/ui theme with proper color contrasts and
          visual hierarchy.
        </p>

        <div className="theme-toggle">
          <button
            className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            <span className="theme-icon">☀️</span>
            Light Theme
          </button>
          <button
            className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <span className="theme-icon">🌙</span>
            Dark Theme
          </button>
        </div>

        <div className="theme-info">
          <p>
            Current theme class:{' '}
            <code>
              {theme === 'dark' ? 'wx-shadcn-dark-theme' : 'wx-shadcn-theme'}
            </code>
          </p>
        </div>
      </div>

      <div className="theme-gantt-container">
        <ThemeWrapper>
          <Gantt tasks={tasks} links={links} scales={scales} zoom />
        </ThemeWrapper>
      </div>
    </div>
  );
}

export default ThemeSwitcherDemo;
