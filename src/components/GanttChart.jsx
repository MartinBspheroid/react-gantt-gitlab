/**
 * GitLabGantt (Backward Compatibility Wrapper)
 *
 * @deprecated Use GitLabWorkspace instead for new code.
 * This component is kept for backward compatibility.
 */

import { Workspace } from './Workspace';

export function GitLabGantt(props) {
  // Log deprecation warning in development
  // eslint-disable-next-line no-undef
  if (
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV === 'development'
  ) {
    console.warn(
      '[GitLabGantt] This component is deprecated. ' +
        'Use GitLabWorkspace for new code.',
    );
  }

  return <Workspace {...props} />;
}
