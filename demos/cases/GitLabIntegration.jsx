/**
 * GitLab Integration Demo
 * Complete example of GitLab Gantt integration with all features
 */

import { GitLabGantt } from '../../src/components/GitLabGantt.jsx';

export default function GitLabIntegration() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <GitLabGantt autoSync={false} />
    </div>
  );
}
