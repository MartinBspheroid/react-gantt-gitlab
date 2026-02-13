/**
 * Workload View Demo
 * Display work distribution by Assignee/Label with overlap visualization
 */

import { useMemo } from 'react';
import { StaticDataProvider } from '../../src/providers/StaticDataProvider.ts';
import { DataProvider } from '../../src/contexts/DataContext';
import { WorkloadView } from '../../src/components/WorkloadView.tsx';
import { tasks, links } from '../azureDevOpsData.js';

export default function WorkloadViewDemo() {
  const provider = useMemo(
    () => new StaticDataProvider({ tasks, links, canEdit: true }),
    [],
  );

  return (
    <DataProvider provider={provider} autoSync={true}>
      <WorkloadView />
    </DataProvider>
  );
}
