/**
 * Azure DevOps Portfolio Demo
 *
 * Demonstrates a realistic project portfolio with 100+ work items
 * using the StaticDataProvider (no API calls needed).
 */

import { useMemo } from 'react';
import { Workspace } from '../../src/components/Workspace/Workspace';
import { StaticDataProvider } from '../../src/providers/StaticDataProvider';
import { tasks, links } from '../azureDevOpsData';

export default function AzureDevOpsPortfolio() {
  const provider = useMemo(
    () => new StaticDataProvider({ tasks, links, canEdit: true }),
    [],
  );

  return <Workspace provider={provider} autoSync={true} />;
}
