import { useState, useMemo } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';
import Shadcn from '../../src/themes/Shadcn.jsx';
import ShadcnDark from '../../src/themes/ShadcnDark.jsx';
import './ShadcnVisualVerification.css';

/**
 * Shadcn Visual Verification Demo
 *
 * Renders the Gantt chart inside a shadcn-themed container with a theme switcher
 * for visual verification of:
 * - Colors matching shadcn palette
 * - Borders and radius consistency
 * - Typography alignment
 * - Dark mode functionality
 */
function ShadcnVisualVerification() {
  const [theme, setTheme] = useState('light');
  const data = useMemo(() => getData(), []);

  const ThemeWrapper = theme === 'dark' ? ShadcnDark : Shadcn;

  return (
    <div className="shadcn-verification-container">
      {/* Theme Switcher */}
      <div className="shadcn-theme-switcher">
        <span className="shadcn-theme-label">Theme:</span>
        <div className="shadcn-theme-buttons">
          <button
            className={`shadcn-theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
            data-testid="theme-light"
          >
            <span className="shadcn-theme-icon">☀️</span>
            Light
          </button>
          <button
            className={`shadcn-theme-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
            data-testid="theme-dark"
          >
            <span className="shadcn-theme-icon">🌙</span>
            Dark
          </button>
        </div>
      </div>

      {/* Verification Panel */}
      <div className="shadcn-verification-panel">
        <h3 className="shadcn-panel-title">Visual Verification Checklist</h3>
        <ul className="shadcn-checklist">
          <li className="shadcn-checklist-item" data-testid="check-colors">
            <span className="shadcn-check">✓</span>
            Colors match shadcn palette
          </li>
          <li className="shadcn-checklist-item" data-testid="check-borders">
            <span className="shadcn-check">✓</span>
            Borders and radius consistent
          </li>
          <li className="shadcn-checklist-item" data-testid="check-typography">
            <span className="shadcn-check">✓</span>
            Typography aligns with design system
          </li>
          <li className="shadcn-checklist-item" data-testid="check-darkmode">
            <span className="shadcn-check">✓</span>
            Dark mode works correctly
          </li>
        </ul>
      </div>

      {/* Gantt Chart */}
      <div className="shadcn-gantt-wrapper" data-testid="gantt-container">
        <ThemeWrapper>
          <Gantt
            tasks={data.tasks}
            links={data.links}
            scales={data.scales}
            data-testid="gantt-chart"
          />
        </ThemeWrapper>
      </div>

      {/* Theme Info */}
      <div className="shadcn-theme-info" data-testid="theme-info">
        <p>
          Current theme:{' '}
          <strong>{theme === 'dark' ? 'Shadcn Dark' : 'Shadcn Light'}</strong>
        </p>
        <p className="shadcn-theme-class">
          CSS Class:{' '}
          <code>
            {theme === 'dark' ? 'wx-shadcn-dark-theme' : 'wx-shadcn-theme'}
          </code>
        </p>
      </div>
    </div>
  );
}

export default ShadcnVisualVerification;
