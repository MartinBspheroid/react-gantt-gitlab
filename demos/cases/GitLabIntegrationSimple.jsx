/**
 * GitLab Integration Demo - Simplified for Testing
 */

import { useState } from 'react';

export default function GitLabIntegrationSimple() {
  const [message] = useState(
    'GitLab Integration Test - Component Loaded Successfully!',
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>GitLab Gantt Integration</h1>
      <p style={{ color: 'green', fontSize: '18px' }}>{message}</p>

      <div
        style={{
          marginTop: '20px',
          padding: '15px',
          background: '#f0f0f0',
          borderRadius: '4px',
        }}
      >
        <h3>Quick Test Checklist:</h3>
        <ul>
          <li>✅ React component loaded</li>
          <li>✅ JavaScript executed</li>
          <li>✅ Styles applied</li>
          <li>⏳ Ready to integrate full GitLabGantt component</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => alert('Button works!')}
          style={{
            padding: '10px 20px',
            background: '#1f75cb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Test Button
        </button>
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '15px',
          background: '#fff3cd',
          borderRadius: '4px',
        }}
      >
        <h4>Next Steps:</h4>
        <p>
          If you see this page, the routing and component loading works
          correctly.
        </p>
        <p>The full GitLabGantt component is ready in the main integration.</p>
      </div>
    </div>
  );
}
