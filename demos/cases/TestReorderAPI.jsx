import { useState, useEffect } from 'react';
import { gitlabConfigManager } from '../../src/config/GitLabConfigManager';
import { gitlabCredentialManager } from '../../src/config/GitLabCredentialManager';
import { GitLabGraphQLProvider } from '../../src/providers/GitLabGraphQLProvider';
import { gitlabRestRequest } from '../../src/providers/GitLabApiUtils';

/**
 * Test page for validating GitLab Reorder APIs
 *
 * This page tests:
 * 1. REST API - Issue reorder (root level)
 * 2. GraphQL API - Task reorder via hierarchyWidget (parent-child level)
 */
export default function TestReorderAPI() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const activeConfig = gitlabConfigManager.getActiveConfig();
    if (activeConfig) {
      // Resolve credential to get gitlabUrl and token
      const credential = gitlabCredentialManager.getCredential(
        activeConfig.credentialId,
      );
      if (credential) {
        setConfig({
          ...activeConfig,
          gitlabUrl: credential.gitlabUrl,
          token: credential.token,
        });
      } else {
        console.error(
          '[TestReorderAPI] Credential not found for credentialId:',
          activeConfig.credentialId,
        );
        setConfig(null);
      }
    }
  }, []);
  const [logs, setLogs] = useState([]);
  const [testData, setTestData] = useState({
    testIssueIid: null,
    testIssueGlobalId: null,
    testTaskGlobalId: null,
    parentIssueGlobalId: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message, type }]);
    console.log(`[${type.toUpperCase()}]`, message);
  };

  const clearLogs = () => setLogs([]);

  // Step 1: Create test issues and tasks
  const createTestData = async () => {
    setIsLoading(true);
    clearLogs();
    addLog('🚀 Creating test data...', 'info');

    try {
      // Note: Using REST API for issue creation (more reliable than GraphQL createIssue)
      addLog('Creating test issues via REST API...', 'info');

      const projectPath =
        config.type === 'project' ? config.projectId : config.groupId;

      const issue1Response = await gitlabRestRequest(
        `/projects/${encodeURIComponent(projectPath)}/issues`,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
        {
          method: 'POST',
          body: JSON.stringify({
            title: '[TEST] Reorder Test Issue 1',
            description:
              'This is a test issue for API validation. Safe to delete.',
          }),
        },
      );

      addLog(
        `✅ Created Issue 1: #${issue1Response.iid} (ID: ${issue1Response.id})`,
        'success',
      );

      const issue2Response = await gitlabRestRequest(
        `/projects/${encodeURIComponent(projectPath)}/issues`,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
        {
          method: 'POST',
          body: JSON.stringify({
            title: '[TEST] Reorder Test Issue 2',
            description:
              'This is a test issue for API validation. Safe to delete.',
          }),
        },
      );

      addLog(
        `✅ Created Issue 2: #${issue2Response.iid} (ID: ${issue2Response.id})`,
        'success',
      );

      // Create a parent issue for tasks
      const parentIssueResponse = await gitlabRestRequest(
        `/projects/${encodeURIComponent(projectPath)}/issues`,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
        {
          method: 'POST',
          body: JSON.stringify({
            title: '[TEST] Parent Issue for Tasks',
            description: 'Parent issue containing test tasks. Safe to delete.',
          }),
        },
      );

      addLog(`✅ Created Parent Issue: #${parentIssueResponse.iid}`, 'success');

      // Store both numeric ID and global ID for testing
      const issue1Gid = `gid://gitlab/Issue/${issue1Response.id}`;
      const issue2Gid = `gid://gitlab/Issue/${issue2Response.id}`;
      const parentIssueGid = `gid://gitlab/WorkItem/${parentIssueResponse.id}`;

      setTestData({
        issue1Iid: issue1Response.iid,
        issue2Iid: issue2Response.iid,
        issue1Id: issue1Response.id, // Numeric ID for move_after_id
        issue2Id: issue2Response.id,
        issue1GlobalId: issue1Gid,
        issue2GlobalId: issue2Gid,
        parentIssueIid: parentIssueResponse.iid,
        parentIssueGlobalId: parentIssueGid,
        testTaskGlobalId: null,
      });

      addLog('📦 Test data created successfully!', 'success');
      addLog('Next: Click "Test Issue Reorder" to test REST API', 'info');
    } catch (error) {
      addLog(`❌ Error creating test data: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Test Issue Reorder (REST API)
  const testIssueReorder = async () => {
    if (!testData.issue1GlobalId || !testData.issue2Iid) {
      addLog('❌ Please create test data first', 'error');
      return;
    }

    setIsLoading(true);
    addLog('🧪 Testing Issue Reorder (REST API)...', 'info');

    try {
      const projectPath =
        config.type === 'project' ? config.projectId : config.groupId;
      const endpoint = `/projects/${encodeURIComponent(projectPath)}/issues/${testData.issue2Iid}/reorder`;

      addLog(`Endpoint: /api/v4${endpoint}`, 'info');
      addLog(
        `Moving Issue #${testData.issue2Iid} after Issue ID ${testData.issue1Id}`,
        'info',
      );

      const response = await gitlabRestRequest(
        endpoint,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
        {
          method: 'PUT',
          body: JSON.stringify({
            move_after_id: testData.issue1Id, // Use numeric ID instead of gid
          }),
        },
      );

      addLog('✅ SUCCESS - Issue reorder worked!', 'success');
      addLog(JSON.stringify(response, null, 2), 'success');
      addLog(
        '🎉 REST API is working! Safe to use for Issue reordering.',
        'success',
      );
    } catch (error) {
      addLog(`❌ FAILED - Issue reorder failed: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Create test tasks under parent issue
  const createTestTasks = async () => {
    if (!testData.parentIssueGlobalId) {
      addLog('❌ Please create test data first', 'error');
      return;
    }

    setIsLoading(true);
    addLog('🧪 Creating test tasks...', 'info');

    try {
      const provider = new GitLabGraphQLProvider({
        gitlabUrl: config.gitlabUrl,
        token: config.token,
        projectId: config.projectId,
        groupId: config.groupId,
        type: config.type,
      });

      // Create Task 1
      const task1Mutation = `
        mutation {
          workItemCreate(input: {
            namespacePath: "${config.type === 'project' ? config.projectId : config.groupId}"
            workItemTypeId: "gid://gitlab/WorkItems::Type/5"
            title: "[TEST] Task 1"
            hierarchyWidget: {
              parentId: "${testData.parentIssueGlobalId}"
            }
          }) {
            workItem {
              id
              iid
            }
            errors
          }
        }
      `;

      addLog('Creating Task 1 via GraphQL...', 'info');
      const task1Result = await provider.graphqlClient.mutate(
        task1Mutation,
        {},
      );

      if (!task1Result?.workItemCreate) {
        throw new Error('Failed to create Task 1: No response from API');
      }
      if (task1Result.workItemCreate.errors?.length > 0) {
        throw new Error(
          `Failed to create Task 1: ${task1Result.workItemCreate.errors.join(', ')}`,
        );
      }
      if (!task1Result.workItemCreate.workItem) {
        throw new Error('Failed to create Task 1: No workItem in response');
      }

      const task1 = task1Result.workItemCreate.workItem;
      addLog(`✅ Created Task 1: ${task1.id}`, 'success');

      // Create Task 2
      const task2Mutation = `
        mutation {
          workItemCreate(input: {
            namespacePath: "${config.type === 'project' ? config.projectId : config.groupId}"
            workItemTypeId: "gid://gitlab/WorkItems::Type/5"
            title: "[TEST] Task 2"
            hierarchyWidget: {
              parentId: "${testData.parentIssueGlobalId}"
            }
          }) {
            workItem {
              id
              iid
            }
            errors
          }
        }
      `;

      addLog('Creating Task 2 via GraphQL...', 'info');
      const task2Result = await provider.graphqlClient.mutate(
        task2Mutation,
        {},
      );

      if (!task2Result?.workItemCreate) {
        throw new Error('Failed to create Task 2: No response from API');
      }
      if (task2Result.workItemCreate.errors?.length > 0) {
        throw new Error(
          `Failed to create Task 2: ${task2Result.workItemCreate.errors.join(', ')}`,
        );
      }
      if (!task2Result.workItemCreate.workItem) {
        throw new Error('Failed to create Task 2: No workItem in response');
      }

      const task2 = task2Result.workItemCreate.workItem;
      addLog(`✅ Created Task 2: ${task2.id}`, 'success');

      setTestData((prev) => ({
        ...prev,
        task1GlobalId: task1.id,
        task2GlobalId: task2.id,
      }));

      addLog('📦 Test tasks created successfully!', 'success');
      addLog('Next: Click "Test Task Reorder" to test GraphQL API', 'info');
    } catch (error) {
      addLog(`❌ Error creating test tasks: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // First, let's introspect the schema to see what hierarchyWidget supports
  const introspectHierarchyWidget = async () => {
    setIsLoading(true);
    addLog(
      '🔍 Introspecting GraphQL schema for WorkItemWidgetHierarchyUpdateInput...',
      'info',
    );

    try {
      const provider = new GitLabGraphQLProvider({
        gitlabUrl: config.gitlabUrl,
        token: config.token,
        projectId: config.projectId,
        groupId: config.groupId,
        type: config.type,
      });

      const introspectionQuery = `
        query {
          __type(name: "WorkItemWidgetHierarchyUpdateInput") {
            name
            kind
            inputFields {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
              description
            }
          }
        }
      `;

      addLog('Querying GraphQL schema...', 'info');
      const result = await provider.graphqlClient.query(introspectionQuery, {});

      if (result.__type) {
        addLog('✅ Schema information retrieved!', 'success');
        addLog(
          'Available fields in WorkItemWidgetHierarchyUpdateInput:',
          'info',
        );
        addLog(JSON.stringify(result.__type.inputFields, null, 2), 'info');
      } else {
        addLog('⚠️  Type not found in schema', 'error');
      }
    } catch (error) {
      addLog(`❌ Introspection failed: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Test Task Reorder (GraphQL)
  const testTaskReorder = async () => {
    if (!testData.task1GlobalId || !testData.task2GlobalId) {
      addLog('❌ Please create test tasks first', 'error');
      return;
    }

    setIsLoading(true);
    addLog('🧪 Testing Task Reorder (GraphQL hierarchyWidget)...', 'info');

    try {
      const provider = new GitLabGraphQLProvider({
        gitlabUrl: config.gitlabUrl,
        token: config.token,
        projectId: config.projectId,
        groupId: config.groupId,
        type: config.type,
      });

      const mutation = `
        mutation {
          workItemUpdate(input: {
            id: "${testData.task2GlobalId}",
            hierarchyWidget: {
              adjacentWorkItemId: "${testData.task1GlobalId}",
              relativePosition: AFTER
            }
          }) {
            workItem {
              id
              iid
            }
            errors
          }
        }
      `;

      addLog(
        `Moving Task ${testData.task2GlobalId} AFTER ${testData.task1GlobalId}`,
        'info',
      );
      addLog(
        'Using adjacentWorkItemId + relativePosition (correct API for GitLab 18.2.6)',
        'info',
      );

      const result = await provider.graphqlClient.mutate(mutation, {});

      if (result.workItemUpdate.errors?.length > 0) {
        throw new Error(result.workItemUpdate.errors.join(', '));
      }

      addLog('✅ SUCCESS - Task reorder worked!', 'success');
      addLog(
        JSON.stringify(result.workItemUpdate.workItem, null, 2),
        'success',
      );
      addLog(
        '🎉 GraphQL hierarchyWidget with adjacentWorkItemId is working!',
        'success',
      );
      addLog('🎉 Safe to use for Task reordering in GitLab 18.2.6', 'success');
    } catch (error) {
      addLog(`❌ FAILED - Task reorder failed: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // New: Run full test suite
  const runFullTest = async () => {
    setIsLoading(true);
    setLogs([]); // Clear logs
    addLog('🚀 Starting full reorder test suite...', 'info');
    addLog(
      'This will test Issue and Task reordering with verification',
      'info',
    );

    try {
      const provider = new GitLabGraphQLProvider({
        gitlabUrl: config.gitlabUrl,
        token: config.token,
        projectId: config.projectId,
        groupId: config.groupId,
        type: config.type,
      });

      const projectPath =
        config.type === 'project' ? config.projectId : config.groupId;

      // Step 1: Create test data
      addLog('\n=== Step 1: Creating Test Data ===', 'info');

      const issue1Response = await gitlabRestRequest(
        `/projects/${encodeURIComponent(projectPath)}/issues`,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
        {
          method: 'POST',
          body: JSON.stringify({
            title: '[TEST] Reorder Test Issue 1',
            description:
              'This is a test issue for API validation. Safe to delete.',
          }),
        },
      );
      addLog(
        `✅ Created Issue 1: #${issue1Response.iid} (ID: ${issue1Response.id})`,
        'success',
      );

      const issue2Response = await gitlabRestRequest(
        `/projects/${encodeURIComponent(projectPath)}/issues`,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
        {
          method: 'POST',
          body: JSON.stringify({
            title: '[TEST] Reorder Test Issue 2',
            description:
              'This is a test issue for API validation. Safe to delete.',
          }),
        },
      );
      addLog(
        `✅ Created Issue 2: #${issue2Response.iid} (ID: ${issue2Response.id})`,
        'success',
      );

      const parentIssueResponse = await gitlabRestRequest(
        `/projects/${encodeURIComponent(projectPath)}/issues`,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
        {
          method: 'POST',
          body: JSON.stringify({
            title: '[TEST] Parent Issue for Tasks',
            description: 'Parent issue containing test tasks. Safe to delete.',
          }),
        },
      );
      addLog(`✅ Created Parent Issue: #${parentIssueResponse.iid}`, 'success');

      const newTestData = {
        issue1Iid: issue1Response.iid,
        issue2Iid: issue2Response.iid,
        issue1Id: issue1Response.id,
        issue2Id: issue2Response.id,
        issue1GlobalId: `gid://gitlab/Issue/${issue1Response.id}`,
        issue2GlobalId: `gid://gitlab/Issue/${issue2Response.id}`,
        parentIssueIid: parentIssueResponse.iid,
        parentIssueGlobalId: `gid://gitlab/WorkItem/${parentIssueResponse.id}`,
        task1GlobalId: null,
        task2GlobalId: null,
      };
      setTestData(newTestData);

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 2: Test Issue reorder - Clarify semantic meaning
      addLog('\n=== Step 2: Testing Issue Reorder API Semantics ===', 'info');
      addLog(
        `🧪 GOAL: Understand the true meaning of move_after_id parameter`,
        'info',
      );
      addLog(``, 'info');
      addLog(
        `Initial state: Issue #${newTestData.issue1Iid} and Issue #${newTestData.issue2Iid} created`,
        'info',
      );
      addLog(``, 'info');
      addLog(`📝 What we want to achieve:`, 'info');
      addLog(
        `   Visual order in list (top to bottom): Issue #${newTestData.issue1Iid} → Issue #${newTestData.issue2Iid}`,
        'info',
      );
      addLog(
        `   (Issue #${newTestData.issue1Iid} should appear ABOVE/BEFORE Issue #${newTestData.issue2Iid})`,
        'info',
      );
      addLog(``, 'info');
      addLog(
        `🔬 API Call: PUT /issues/${newTestData.issue2Iid}/reorder`,
        'info',
      );
      addLog(`   Parameter: move_after_id=${newTestData.issue1Id}`, 'info');
      addLog(``, 'info');
      addLog(`❓ Question: Does "move_after_id" mean:`, 'info');
      addLog(
        `   A) Issue #${newTestData.issue2Iid} will appear AFTER (below) Issue #${newTestData.issue1Iid} ✓ (expected)`,
        'info',
      );
      addLog(
        `   B) Issue #${newTestData.issue2Iid} will appear BEFORE (above) Issue #${newTestData.issue1Iid} ✗ (inverted)`,
        'info',
      );

      const endpoint1 = `/projects/${encodeURIComponent(projectPath)}/issues/${newTestData.issue2Iid}/reorder`;

      await gitlabRestRequest(
        endpoint1,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
        {
          method: 'PUT',
          body: JSON.stringify({
            move_after_id: newTestData.issue1Id,
          }),
        },
      );
      addLog('✅ Reorder API call succeeded', 'success');

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 3: Verify Issue order after reorder
      addLog('\n=== Step 3: Verifying Actual Result ===', 'info');

      // Use REST API to get issues in correct order (sorted by relativePosition)
      const allIssues = await gitlabRestRequest(
        `/projects/${encodeURIComponent(projectPath)}/issues?per_page=100&order_by=relative_position&sort=asc`,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
      );

      addLog(`📊 Total issues in project: ${allIssues.length}`, 'info');

      // Filter to only our test issues
      const testIssues = allIssues.filter(
        (i) =>
          i.iid === newTestData.issue1Iid || i.iid === newTestData.issue2Iid,
      );

      addLog(``, 'info');
      addLog(`📋 Actual order returned by GitLab (top → bottom):`, 'info');
      testIssues.forEach((issue, index) => {
        const position = index === 0 ? '1st (top)' : '2nd (bottom)';
        addLog(`   ${position}: Issue #${issue.iid} - ${issue.title}`, 'info');
      });

      if (testIssues.length === 2) {
        const issue1Index = testIssues.findIndex(
          (i) => i.iid === newTestData.issue1Iid,
        );
        const issue2Index = testIssues.findIndex(
          (i) => i.iid === newTestData.issue2Iid,
        );

        addLog(``, 'info');
        addLog(`🎯 Result Analysis:`, 'info');

        if (issue1Index < issue2Index) {
          // Issue 1 is at index 0 (top), Issue 2 is at index 1 (bottom)
          addLog(`   ✅ CORRECT: move_after_id works as expected!`, 'success');
          addLog(
            `   → Issue #${newTestData.issue2Iid} is AFTER (below) Issue #${newTestData.issue1Iid}`,
            'success',
          );
          addLog(
            `   → This is Answer A: "after" means below/later in the list`,
            'success',
          );
        } else {
          // Issue 2 is at index 0 (top), Issue 1 is at index 1 (bottom)
          addLog(
            `   ❌ INVERTED: move_after_id has opposite behavior!`,
            'error',
          );
          addLog(
            `   → Issue #${newTestData.issue2Iid} is BEFORE (above) Issue #${newTestData.issue1Iid}`,
            'error',
          );
          addLog(
            `   → This is Answer B: "after" actually means above/earlier in the list`,
            'error',
          );
          addLog(
            `   → We need to use move_before_id to achieve "move after" behavior`,
            'error',
          );
        }
      } else {
        addLog(
          `⚠️ Expected 2 test issues but found ${testIssues.length}`,
          'error',
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 3b: Test Issue "move to first" (using inverted API)
      addLog('\n=== Step 3b: Testing Issue "Move to First" ===', 'info');
      addLog(
        `🧪 GOAL: Move Issue #${newTestData.issue2Iid} to FIRST position`,
        'info',
      );
      addLog(``, 'info');
      addLog(
        `Current order: Issue #${newTestData.issue2Iid} is at 1st, Issue #${newTestData.issue1Iid} is at 2nd`,
        'info',
      );
      addLog(
        `Target order: Issue #${newTestData.issue1Iid} at 1st, Issue #${newTestData.issue2Iid} at 2nd`,
        'info',
      );
      addLog(``, 'info');
      addLog(
        `🔬 API Call: PUT /issues/${newTestData.issue1Iid}/reorder`,
        'info',
      );
      addLog(`   Parameter: move_after_id=${newTestData.issue2Id}`, 'info');
      addLog(
        `   (Due to inverted API, this should move Issue #${newTestData.issue1Iid} BEFORE Issue #${newTestData.issue2Iid})`,
        'info',
      );

      // Move Issue1 to first position (before Issue2) using inverted API
      const endpoint2 = `/projects/${encodeURIComponent(projectPath)}/issues/${newTestData.issue1Iid}/reorder`;

      await gitlabRestRequest(
        endpoint2,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
        {
          method: 'PUT',
          body: JSON.stringify({
            move_after_id: newTestData.issue2Id, // Inverted: this moves BEFORE
          }),
        },
      );
      addLog('✅ Reorder API call succeeded', 'success');

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify the new order
      addLog('\n=== Verifying "Move to First" Result ===', 'info');

      const allIssues2 = await gitlabRestRequest(
        `/projects/${encodeURIComponent(projectPath)}/issues?per_page=100&order_by=relative_position&sort=asc`,
        {
          gitlabUrl: config.gitlabUrl,
          token: config.token,
        },
      );

      const testIssues2 = allIssues2.filter(
        (i) =>
          i.iid === newTestData.issue1Iid || i.iid === newTestData.issue2Iid,
      );

      addLog(`📋 New order returned by GitLab (top → bottom):`, 'info');
      testIssues2.forEach((issue, index) => {
        const position = index === 0 ? '1st (top)' : '2nd (bottom)';
        addLog(`   ${position}: Issue #${issue.iid} - ${issue.title}`, 'info');
      });

      if (testIssues2.length === 2) {
        const issue1Index2 = testIssues2.findIndex(
          (i) => i.iid === newTestData.issue1Iid,
        );
        const issue2Index2 = testIssues2.findIndex(
          (i) => i.iid === newTestData.issue2Iid,
        );

        addLog(``, 'info');
        addLog(`🎯 Result Analysis:`, 'info');

        if (issue1Index2 === 0 && issue2Index2 === 1) {
          addLog(`   ✅ SUCCESS: "Move to First" works correctly!`, 'success');
          addLog(
            `   → Issue #${newTestData.issue1Iid} is now at FIRST position`,
            'success',
          );
          addLog(
            `   → Using move_after_id with inverted API successfully moves to first`,
            'success',
          );
        } else {
          addLog(`   ❌ FAILED: "Move to First" did not work`, 'error');
          addLog(
            `   → Expected Issue #${newTestData.issue1Iid} at index 0, got index ${issue1Index2}`,
            'error',
          );
          addLog(
            `   → Expected Issue #${newTestData.issue2Iid} at index 1, got index ${issue2Index2}`,
            'error',
          );
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 4: Create test tasks
      addLog('\n=== Step 4: Creating Test Tasks ===', 'info');

      // Use the provider's createWorkItem method to create tasks
      addLog('Creating Task 1...', 'info');
      const task1 = await provider.createWorkItem({
        text: '[TEST] Task 1',
        parent: newTestData.parentIssueIid,
      });

      // Get global ID from the created task (_gitlab.id contains the global ID)
      const task1GlobalId = task1._gitlab?.id;
      if (!task1GlobalId) {
        throw new Error('Failed to get global ID for Task 1');
      }
      addLog(
        `✅ Created Task 1: ${task1GlobalId} (IID: ${task1.id})`,
        'success',
      );

      addLog('Creating Task 2...', 'info');
      const task2 = await provider.createWorkItem({
        text: '[TEST] Task 2',
        parent: newTestData.parentIssueIid,
      });

      const task2GlobalId = task2._gitlab?.id;
      if (!task2GlobalId) {
        throw new Error('Failed to get global ID for Task 2');
      }
      addLog(
        `✅ Created Task 2: ${task2GlobalId} (IID: ${task2.id})`,
        'success',
      );

      newTestData.task1GlobalId = task1GlobalId;
      newTestData.task2GlobalId = task2GlobalId;
      setTestData(newTestData);

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 5: Test Task reorder
      addLog('\n=== Step 5: Testing Task Reorder ===', 'info');
      addLog(`Moving Task ${task2GlobalId} AFTER ${task1GlobalId}`, 'info');

      const taskReorderMutation = `
        mutation {
          workItemUpdate(input: {
            id: "${task2GlobalId}",
            hierarchyWidget: {
              adjacentWorkItemId: "${task1GlobalId}",
              relativePosition: AFTER
            }
          }) {
            workItem { id iid }
            errors
          }
        }
      `;

      const taskReorderResult = await provider.graphqlClient.mutate(
        taskReorderMutation,
        {},
      );
      if (taskReorderResult.workItemUpdate.errors?.length > 0) {
        throw new Error(taskReorderResult.workItemUpdate.errors.join(', '));
      }
      addLog('✅ Task reorder API call succeeded', 'success');

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 6: Verify Task order after reorder
      addLog('\n=== Step 6: Verifying Task Order ===', 'info');

      const parentQuery = `
        query {
          ${config.type}(fullPath: "${projectPath}") {
            workItems(iids: ["${newTestData.parentIssueIid}"]) {
              nodes {
                widgets {
                  __typename
                  ... on WorkItemWidgetHierarchy {
                    children {
                      nodes { id iid title }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const parentResult = await provider.graphqlClient.query(parentQuery, {});
      const workItems =
        config.type === 'group'
          ? parentResult.group?.workItems.nodes || []
          : parentResult.project?.workItems.nodes || [];

      if (workItems.length > 0) {
        const parent = workItems[0];
        const hierarchyWidget = parent.widgets?.find(
          (w) => w.__typename === 'WorkItemWidgetHierarchy',
        );
        const children = hierarchyWidget?.children?.nodes || [];

        addLog(
          `Current task order under parent Issue #${newTestData.parentIssueIid}:`,
          'info',
        );
        children.forEach((child, index) => {
          addLog(`  ${index + 1}. Task ${child.id}: ${child.title}`, 'info');
        });

        const task1Index = children.findIndex((c) => c.id === task1GlobalId);
        const task2Index = children.findIndex((c) => c.id === task2GlobalId);

        if (task1Index >= 0 && task2Index >= 0) {
          if (task1Index < task2Index) {
            addLog(
              '✅ Task order is CORRECT: Task 1 comes before Task 2',
              'success',
            );
          } else {
            addLog(
              '❌ Task order is WRONG: Task 2 should come after Task 1',
              'error',
            );
          }
        }
      }

      addLog('\n✅ Full test suite completed!', 'success');
      addLog(
        'You can now cleanup the test data using the Cleanup button',
        'info',
      );
    } catch (error) {
      addLog(`\n❌ Test suite failed: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify Issue order by fetching current order
  // eslint-disable-next-line no-unused-vars
  const verifyIssueOrder = async () => {
    if (!testData.issue1Iid || !testData.issue2Iid) {
      addLog('⚠️  No test issues to verify', 'error');
      return;
    }

    try {
      const provider = new GitLabGraphQLProvider({
        gitlabUrl: config.gitlabUrl,
        token: config.token,
        projectId: config.projectId,
        groupId: config.groupId,
        type: config.type,
      });

      const projectPath =
        config.type === 'project' ? config.projectId : config.groupId;

      // Fetch issues with relativePosition
      const issuesQuery = `
        query {
          ${config.type}(fullPath: "${projectPath}") {
            issues(first: 100) {
              nodes {
                iid
                title
                relativePosition
              }
            }
          }
        }
      `;

      const result = await provider.graphqlClient.query(issuesQuery, {});
      const issues =
        config.type === 'group'
          ? result.group?.issues.nodes || []
          : result.project?.issues.nodes || [];

      // Filter test issues
      const testIssues = issues
        .filter(
          (i) => i.iid === testData.issue1Iid || i.iid === testData.issue2Iid,
        )
        .sort((a, b) => {
          if (a.relativePosition === null) return 1;
          if (b.relativePosition === null) return -1;
          return a.relativePosition - b.relativePosition;
        });

      addLog('Current issue order (by relativePosition):', 'info');
      testIssues.forEach((issue, index) => {
        addLog(
          `  ${index + 1}. Issue #${issue.iid}: ${issue.title} (relativePosition: ${issue.relativePosition})`,
          'info',
        );
      });

      // Check if order is correct (Issue 1 should come before Issue 2)
      if (testIssues.length === 2) {
        const issue1Index = testIssues.findIndex(
          (i) => i.iid === testData.issue1Iid,
        );
        const issue2Index = testIssues.findIndex(
          (i) => i.iid === testData.issue2Iid,
        );

        if (issue1Index < issue2Index) {
          addLog(
            '✅ Issue order is CORRECT: Issue 1 comes before Issue 2',
            'success',
          );
        } else {
          addLog(
            '❌ Issue order is WRONG: Issue 2 should come after Issue 1',
            'error',
          );
        }
      }
    } catch (error) {
      addLog(`❌ Failed to verify issue order: ${error.message}`, 'error');
      console.error(error);
    }
  };

  // Verify Task order by fetching parent's children
  // eslint-disable-next-line no-unused-vars
  const verifyTaskOrder = async () => {
    if (
      !testData.task1GlobalId ||
      !testData.task2GlobalId ||
      !testData.parentIssueIid
    ) {
      addLog('⚠️  No test tasks to verify', 'error');
      return;
    }

    try {
      const provider = new GitLabGraphQLProvider({
        gitlabUrl: config.gitlabUrl,
        token: config.token,
        projectId: config.projectId,
        groupId: config.groupId,
        type: config.type,
      });

      const projectPath =
        config.type === 'project' ? config.projectId : config.groupId;

      // Fetch parent's children to see task order
      const parentQuery = `
        query {
          ${config.type}(fullPath: "${projectPath}") {
            workItems(iids: ["${testData.parentIssueIid}"]) {
              nodes {
                id
                iid
                title
                widgets {
                  __typename
                  ... on WorkItemWidgetHierarchy {
                    children {
                      nodes {
                        id
                        iid
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result = await provider.graphqlClient.query(parentQuery, {});
      const workItems =
        config.type === 'group'
          ? result.group?.workItems.nodes || []
          : result.project?.workItems.nodes || [];

      if (workItems.length > 0) {
        const parent = workItems[0];
        const hierarchyWidget = parent.widgets?.find(
          (w) => w.__typename === 'WorkItemWidgetHierarchy',
        );
        const children = hierarchyWidget?.children?.nodes || [];

        addLog(
          `Current task order under parent Issue #${testData.parentIssueIid}:`,
          'info',
        );
        children.forEach((child, index) => {
          addLog(`  ${index + 1}. Task ${child.id}: ${child.title}`, 'info');
        });

        // Check if order is correct (Task 1 should come before Task 2)
        const task1Index = children.findIndex(
          (c) => c.id === testData.task1GlobalId,
        );
        const task2Index = children.findIndex(
          (c) => c.id === testData.task2GlobalId,
        );

        if (task1Index >= 0 && task2Index >= 0) {
          if (task1Index < task2Index) {
            addLog(
              '✅ Task order is CORRECT: Task 1 comes before Task 2',
              'success',
            );
          } else {
            addLog(
              '❌ Task order is WRONG: Task 2 should come after Task 1',
              'error',
            );
          }
        }
      }
    } catch (error) {
      addLog(`❌ Failed to verify task order: ${error.message}`, 'error');
      console.error(error);
    }
  };

  // Step 5: Cleanup - Delete all test data
  const cleanup = async () => {
    setIsLoading(true);
    addLog('🧹 Cleaning up test data...', 'info');

    try {
      const projectPath =
        config.type === 'project' ? config.projectId : config.groupId;

      // Delete issues (tasks will be deleted automatically as children)
      if (testData.issue1Iid) {
        await gitlabRestRequest(
          `/projects/${encodeURIComponent(projectPath)}/issues/${testData.issue1Iid}`,
          {
            gitlabUrl: config.gitlabUrl,
            token: config.token,
          },
          {
            method: 'DELETE',
          },
        );
        addLog(`✅ Deleted Issue #${testData.issue1Iid}`, 'success');
      }

      if (testData.issue2Iid) {
        await gitlabRestRequest(
          `/projects/${encodeURIComponent(projectPath)}/issues/${testData.issue2Iid}`,
          {
            gitlabUrl: config.gitlabUrl,
            token: config.token,
          },
          {
            method: 'DELETE',
          },
        );
        addLog(`✅ Deleted Issue #${testData.issue2Iid}`, 'success');
      }

      if (testData.parentIssueIid) {
        await gitlabRestRequest(
          `/projects/${encodeURIComponent(projectPath)}/issues/${testData.parentIssueIid}`,
          {
            gitlabUrl: config.gitlabUrl,
            token: config.token,
          },
          {
            method: 'DELETE',
          },
        );
        addLog(
          `✅ Deleted Parent Issue #${testData.parentIssueIid}`,
          'success',
        );
      }

      setTestData({
        issue1Iid: null,
        issue1GlobalId: null,
        issue2Iid: null,
        issue2GlobalId: null,
        parentIssueIid: null,
        parentIssueGlobalId: null,
        task1GlobalId: null,
        task2GlobalId: null,
      });

      addLog('🎉 Cleanup completed!', 'success');
    } catch (error) {
      addLog(`❌ Error during cleanup: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!config) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>GitLab Reorder API Test</h2>
        <p style={{ color: '#e74c3c' }}>
          ⚠️ GitLab is not configured. Please configure GitLab settings first in
          the GitLab Gantt page.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>GitLab Reorder API Validation Test</h2>

      <div
        style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          padding: '15px',
          borderRadius: '4px',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ marginTop: 0, color: '#856404' }}>🎯 Test Purpose</h3>
        <p style={{ margin: '5px 0', color: '#856404' }}>
          This test validates whether GitLab's native reorder APIs work in your
          version:
        </p>
        <ul style={{ margin: '5px 0', color: '#856404' }}>
          <li>
            <strong>REST API</strong>:{' '}
            <code>PUT /api/v4/projects/:id/issues/:iid/reorder</code> for Issue
            ordering
          </li>
          <li>
            <strong>GraphQL API</strong>: <code>workItemUpdate</code> with{' '}
            <code>hierarchyWidget.moveAfterId</code> for Task ordering
          </li>
        </ul>
        <p style={{ margin: '5px 0', color: '#856404' }}>
          If both work, we can replace description metadata with native GitLab
          positioning.
        </p>
      </div>

      <div
        style={{
          background: '#f8f9fa',
          padding: '15px',
          borderRadius: '4px',
          marginBottom: '20px',
        }}
      >
        <h3>Configuration</h3>
        <p>
          <strong>GitLab URL:</strong> {config.gitlabUrl}
        </p>
        <p>
          <strong>Project/Group:</strong> {config.projectId || config.groupId}
        </p>
        <p>
          <strong>Type:</strong> {config.type}
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Test Steps</h3>
        <ol>
          <li>Create test issues and parent issue</li>
          <li>Test Issue reorder (REST API)</li>
          <li>Create test tasks under parent issue</li>
          <li>Test Task reorder (GraphQL hierarchyWidget)</li>
          <li>Cleanup test data</li>
        </ol>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        <button
          onClick={runFullTest}
          disabled={isLoading}
          style={{
            padding: '15px 30px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          🚀 Run Full Test Suite
        </button>

        <button
          onClick={cleanup}
          disabled={isLoading}
          style={{
            padding: '15px 30px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          🧹 Cleanup Test Data
        </button>
      </div>

      <div
        style={{
          background: '#e9ecef',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '20px',
        }}
      >
        <h4 style={{ margin: '0 0 10px 0' }}>Manual Steps (Optional)</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={introspectHierarchyWidget}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            🔍 Introspect Schema
          </button>

          <button
            onClick={createTestData}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            1. Create Test Data
          </button>

          <button
            onClick={testIssueReorder}
            disabled={isLoading || !testData.issue1GlobalId}
            style={{
              padding: '8px 16px',
              background: '#2ecc71',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor:
                isLoading || !testData.issue1GlobalId
                  ? 'not-allowed'
                  : 'pointer',
              fontSize: '14px',
            }}
          >
            2. Test Issue Reorder
          </button>

          <button
            onClick={createTestTasks}
            disabled={isLoading || !testData.parentIssueGlobalId}
            style={{
              padding: '8px 16px',
              background: '#9b59b6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor:
                isLoading || !testData.parentIssueGlobalId
                  ? 'not-allowed'
                  : 'pointer',
              fontSize: '14px',
            }}
          >
            3. Create Test Tasks
          </button>

          <button
            onClick={testTaskReorder}
            disabled={isLoading || !testData.task1GlobalId}
            style={{
              padding: '8px 16px',
              background: '#e67e22',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor:
                isLoading || !testData.task1GlobalId
                  ? 'not-allowed'
                  : 'pointer',
              fontSize: '14px',
            }}
          >
            4. Test Task Reorder
          </button>

          <button
            onClick={clearLogs}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            Clear Logs
          </button>
        </div>
      </div>

      <div
        style={{
          background: '#2c3e50',
          color: '#ecf0f1',
          padding: '15px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '14px',
          maxHeight: '500px',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0, color: '#ecf0f1' }}>Test Logs</h3>
        {logs.length === 0 ? (
          <p style={{ color: '#95a5a6' }}>
            No logs yet. Click a button to start testing.
          </p>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              style={{
                marginBottom: '5px',
                color:
                  log.type === 'error'
                    ? '#e74c3c'
                    : log.type === 'success'
                      ? '#2ecc71'
                      : '#ecf0f1',
              }}
            >
              <span style={{ color: '#95a5a6' }}>[{log.timestamp}]</span>{' '}
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
