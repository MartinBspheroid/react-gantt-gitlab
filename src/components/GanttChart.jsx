/**
 * GitLabGantt (Backward Compatibility Wrapper)
 *
 * @deprecated Use GitLabWorkspace instead for new code.
 * This component is kept for backward compatibility.
 */

import { Workspace } from './Workspace';

export function GitLabGantt(props) {
  return <Workspace {...props} />;
}
