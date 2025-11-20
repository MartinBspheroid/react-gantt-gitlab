# Milestone Implementation - Detailed Plan

## 目標

支援 GitLab Milestones 作為 Gantt Chart 的 top-level tasks，實現階層結構：

```
Milestone (Top-level)
  └─ Issue (Child of Milestone)
      └─ Task/Subtask (Child of Issue)
```

## 現狀分析

### ✅ 已完成

1. **GitLabDataProvider.createMilestone()** - REST API 版本已實作但未使用
2. **Milestone 資料結構** - `GitLabMilestone` interface 已定義
3. **計劃文件** - 初版計劃已建立

### ❌ 待完成

1. **GitLabGraphQLProvider.createMilestone()** - 主要使用的 provider 缺少實作
2. **Milestone 排序邏輯** - `sortTasksByOrder()` 未處理 milestone
3. **UI 支援** - GitLabGantt.jsx 沒有建立 milestone 的選項
4. **Update/Delete** - Milestone 的更新和刪除邏輯
5. **Milestone 關聯** - 將 Issue 拖曳到 Milestone 的邏輯

## 技術挑戰

### 1. GitLab API 限制

- **問題**：目前只查詢 `workItems(types: [ISSUE, TASK])`，不包含 Milestone
- **解決方案**：Milestone 在 GitLab 中是獨立的資源，需要額外查詢
- **API**：使用 `project.milestones` 或 `group.milestones` query

### 2. 資料結構差異

- **Work Item**：有 `workItemType`, `widgets`, `iid`
- **Milestone**：有 `id`, `title`, `due_date`, `start_date`，但沒有 workItemType
- **需要**：統一轉換為 `ITask` 格式

### 3. 階層關係

- **Issue → Milestone**：透過 `WorkItemWidgetMilestone`
- **Task → Issue**：透過 `WorkItemWidgetHierarchy`
- **需要**：在 `convertWorkItemToTask()` 中正確設定 parent

### 4. 排序邏輯

- **Milestone**：依 due_date > start_date > title 排序
- **Issue (standalone)**：依 displayOrder > id 排序
- **Issue (in milestone)**：依 displayOrder > id 排序
- **Task (subtask)**：依 displayOrder > id 排序

## 詳細實作步驟

### Phase 1: 資料獲取與轉換

#### 1.1 修改 `getData()` - 同時查詢 Milestones 和 Work Items

**檔案**: `src/providers/GitLabGraphQLProvider.ts`
**位置**: Line 104-238

```typescript
async getData(options: GitLabSyncOptions = {}): Promise<GitLabDataResponse> {
  // 建立兩個 query：
  // 1. Work Items query (現有)
  // 2. Milestones query (新增)

  const milestonesQuery = `
    query getMilestones($fullPath: ID!) {
      ${this.config.type}(fullPath: $fullPath) {
        milestones(state: active, first: 100) {
          nodes {
            id
            iid
            title
            description
            state
            dueDate
            startDate
            webUrl
            createdAt
            updatedAt
          }
        }
      }
    }
  `;

  // 執行兩個查詢
  const [workItemsResult, milestonesResult] = await Promise.all([
    this.graphqlClient.query(workItemsQuery, variables),
    this.graphqlClient.query(milestonesQuery, variables)
  ]);

  // 轉換 milestones 為 tasks
  const milestoneTasks = this.convertMilestonesToTasks(milestones);

  // 合併 tasks
  const allTasks = [...milestoneTasks, ...convertedWorkItems];

  // 排序
  const sortedTasks = this.sortTasksByOrder(allTasks);
}
```

#### 1.2 新增 `convertMilestoneToTask()` 方法

**檔案**: `src/providers/GitLabGraphQLProvider.ts`
**位置**: 新增在 `convertWorkItemToTask()` 附近

```typescript
private convertMilestoneToTask(milestone: any): ITask {
  return {
    id: milestone.iid, // 使用 iid 作為 ID
    text: `[Milestone] ${milestone.title}`,
    start: milestone.startDate ? new Date(milestone.startDate) : undefined,
    end: milestone.dueDate ? new Date(milestone.dueDate) : undefined,
    type: 'summary',
    parent: 0, // Milestone 永遠在 root level
    open: true, // 預設展開
    details: milestone.description || '',
    _gitlab: {
      type: 'milestone',
      id: milestone.iid,
      globalId: milestone.id, // GID 用於 mutation
      web_url: milestone.webUrl,
    },
  };
}
```

#### 1.3 修改 `convertWorkItemToTask()` - 設定 Milestone 為 Parent

**檔案**: `src/providers/GitLabGraphQLProvider.ts`
**位置**: Line 375-479

```typescript
private convertWorkItemToTask(workItem: WorkItem): ITask {
  // ... 現有程式碼 ...

  // 檢查 milestone widget
  const milestoneWidget = workItem.widgets.find(
    (w) => w.__typename === 'WorkItemWidgetMilestone'
  ) as any;

  // 決定 parent
  let parent = 0;
  if (hierarchyWidget?.parent) {
    // 如果有 hierarchy parent，代表是 subtask
    parent = Number(hierarchyWidget.parent.iid);
  } else if (milestoneWidget?.milestone) {
    // 如果有 milestone，代表是 milestone 的 child issue
    parent = Number(milestoneWidget.milestone.id); // 使用 milestone IID
  }
  // 否則 parent = 0 (root level standalone issue)

  return {
    // ...
    parent,
    // ...
  };
}
```

### Phase 2: 排序邏輯

#### 2.1 修改 `sortTasksByOrder()`

**檔案**: `src/providers/GitLabGraphQLProvider.ts`
**位置**: Line 244-285

```typescript
private sortTasksByOrder(tasks: ITask[]): ITask[] {
  // 依照 parent 分組
  const grouped = new Map<number | string, ITask[]>();
  tasks.forEach((task) => {
    const parentId = task.parent || 0;
    if (!grouped.has(parentId)) {
      grouped.set(parentId, []);
    }
    grouped.get(parentId)!.push(task);
  });

  // 對每個 group 排序
  grouped.forEach((group, parentId) => {
    if (parentId === 0) {
      // Root level: 分離 Milestones 和 Issues
      const milestones = group.filter((t) => t._gitlab?.type === 'milestone');
      const issues = group.filter((t) => t._gitlab?.type !== 'milestone');

      // Milestones: 依 due_date > start_date > title
      milestones.sort((a, b) => {
        if (a.end && b.end) return a.end.getTime() - b.end.getTime();
        if (a.end) return -1;
        if (b.end) return 1;
        if (a.start && b.start) return a.start.getTime() - b.start.getTime();
        if (a.start) return -1;
        if (b.start) return 1;
        return (a.text || '').localeCompare(b.text || '');
      });

      // Issues: 依 displayOrder > id
      issues.sort((a, b) => {
        const orderA = a.$custom?.displayOrder;
        const orderB = b.$custom?.displayOrder;
        if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;
        return (a.id as number) - (b.id as number);
      });

      // 合併: Milestones 在前
      grouped.set(parentId, [...milestones, ...issues]);
    } else {
      // Non-root level: 依 displayOrder > id
      group.sort((a, b) => {
        const orderA = a.$custom?.displayOrder;
        const orderB = b.$custom?.displayOrder;
        if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;
        return (a.id as number) - (b.id as number);
      });
    }
  });

  // 遞迴排序
  const result: ITask[] = [];
  const addTasksRecursively = (parentId: number | string) => {
    const children = grouped.get(parentId) || [];
    children.forEach((task) => {
      result.push(task);
      addTasksRecursively(task.id!);
    });
  };
  addTasksRecursively(0);

  return result;
}
```

### Phase 3: CRUD 操作

#### 3.1 實作 `createMilestone()`

**檔案**: `src/providers/GitLabGraphQLProvider.ts`
**位置**: 新增在 `createWorkItem()` 附近

```typescript
async createMilestone(milestone: Partial<ITask>): Promise<ITask> {
  const mutation = `
    mutation createMilestone($input: MilestoneCreateInput!) {
      milestoneCreate(input: $input) {
        milestone {
          id
          iid
          title
          description
          state
          dueDate
          startDate
          webUrl
        }
        errors
      }
    }
  `;

  const input: any = {
    projectPath: this.getFullPath(), // 或 groupPath
    title: milestone.text || 'New Milestone',
  };

  if (milestone.details) {
    input.description = milestone.details;
  }
  if (milestone.start) {
    input.startDate = this.formatDateForGitLab(milestone.start);
  }
  if (milestone.end) {
    input.dueDate = this.formatDateForGitLab(milestone.end);
  }

  const result = await this.graphqlClient.query(mutation, { input });

  if (result.milestoneCreate.errors?.length > 0) {
    throw new Error(result.milestoneCreate.errors.join(', '));
  }

  return this.convertMilestoneToTask(result.milestoneCreate.milestone);
}
```

#### 3.2 實作 `updateMilestone()`

**檔案**: `src/providers/GitLabGraphQLProvider.ts`

```typescript
async updateMilestone(id: TID, updates: Partial<ITask>): Promise<void> {
  // 先查詢 milestone 的 global ID
  const milestone = await this.getMilestoneByIid(id);

  const mutation = `
    mutation updateMilestone($input: MilestoneUpdateInput!) {
      milestoneUpdate(input: $input) {
        milestone {
          id
          title
        }
        errors
      }
    }
  `;

  const input: any = {
    id: milestone.id, // Global ID
  };

  if (updates.text) input.title = updates.text;
  if (updates.details !== undefined) input.description = updates.details;
  if (updates.start) input.startDate = this.formatDateForGitLab(updates.start);
  if (updates.end) input.dueDate = this.formatDateForGitLab(updates.end);

  const result = await this.graphqlClient.query(mutation, { input });

  if (result.milestoneUpdate.errors?.length > 0) {
    throw new Error(result.milestoneUpdate.errors.join(', '));
  }
}
```

#### 3.3 實作 `deleteMilestone()`

**檔案**: `src/providers/GitLabGraphQLProvider.ts`

```typescript
async deleteMilestone(id: TID): Promise<void> {
  // GitLab Milestone 沒有 delete mutation，只能 close
  const milestone = await this.getMilestoneByIid(id);

  const mutation = `
    mutation closeMilestone($input: MilestoneUpdateInput!) {
      milestoneUpdate(input: $input) {
        milestone {
          id
          state
        }
        errors
      }
    }
  `;

  const result = await this.graphqlClient.query(mutation, {
    input: { id: milestone.id, state: 'closed' }
  });

  if (result.milestoneUpdate.errors?.length > 0) {
    throw new Error(result.milestoneUpdate.errors.join(', '));
  }
}
```

#### 3.4 修改 `updateWorkItem()` - 處理 Milestone Assignment

**檔案**: `src/providers/GitLabGraphQLProvider.ts`
**位置**: Line 485-509

```typescript
async updateWorkItem(id: TID, task: Partial<ITask>): Promise<void> {
  // 檢查 parent 變更 - 可能是 milestone assignment
  if (task.parent !== undefined) {
    const currentTask = /* 從 cache 或 query 取得 */;
    const newParent = task.parent;

    // 判斷 parent 類型
    if (newParent === 0) {
      // 移到 root - 移除 milestone
      await this.updateWorkItemMilestone(id, null);
    } else {
      // 檢查 parent 是 milestone 還是 issue
      const parentTask = /* 從 cache 取得 */;
      if (parentTask._gitlab?.type === 'milestone') {
        // 設定 milestone
        await this.updateWorkItemMilestone(id, newParent);
      } else {
        // 設定 hierarchy parent (subtask)
        await this.updateWorkItemHierarchy(id, newParent);
      }
    }
  }

  // 其他欄位更新...
}

private async updateWorkItemMilestone(workItemId: TID, milestoneId: TID | null): Promise<void> {
  // 使用 milestoneWidget 更新
  const mutation = `
    mutation updateMilestone($input: WorkItemUpdateInput!) {
      workItemUpdate(input: $input) {
        workItem { id }
        errors
      }
    }
  `;

  const milestoneGlobalId = milestoneId
    ? await this.getMilestoneGlobalId(milestoneId)
    : null;

  await this.graphqlClient.query(mutation, {
    input: {
      id: await this.getWorkItemGlobalId(workItemId),
      milestoneWidget: { milestoneId: milestoneGlobalId }
    }
  });
}
```

### Phase 4: Hook 整合

#### 4.1 修改 `useGitLabSync.ts`

**檔案**: `src/hooks/useGitLabSync.ts`
**位置**: Line 211 (移除註解)

```typescript
// 移除這行註解
// // createMilestone removed - not supported by current provider

/**
 * Create a new milestone
 */
const createMilestone = useCallback(
  async (milestone: Partial<ITask>): Promise<ITask> => {
    if (!provider) {
      throw new Error('GitLab provider not initialized');
    }

    // 檢查 provider 是否支援
    if (!('createMilestone' in provider)) {
      throw new Error('Current provider does not support milestone creation');
    }

    try {
      const createdMilestone = await (provider as any).createMilestone(
        milestone,
      );

      console.log('[useGitLabSync] Milestone created:', createdMilestone);

      // 添加到 local state
      setTasks((prevTasks) => [...prevTasks, createdMilestone]);

      return createdMilestone;
    } catch (error) {
      console.error('Failed to create milestone:', error);
      throw error;
    }
  },
  [provider],
);

// 在 return 中加入
return {
  tasks,
  links,
  milestones,
  epics,
  syncState,
  sync,
  syncTask,
  createTask,
  createMilestone, // 新增
  deleteTask,
  createLink,
  deleteLink,
};
```

#### 4.2 更新 `GitLabSyncResult` interface

**檔案**: `src/hooks/useGitLabSync.ts`
**位置**: Line 23-38

```typescript
export interface GitLabSyncResult {
  tasks: ITask[];
  links: ILink[];
  milestones: GitLabMilestone[];
  epics: GitLabEpic[];
  syncState: SyncState;
  sync: (options?: GitLabSyncOptions) => Promise<void>;
  syncTask: (id: number | string, updates: Partial<ITask>) => Promise<void>;
  createTask: (task: Partial<ITask>) => Promise<ITask>;
  createMilestone: (milestone: Partial<ITask>) => Promise<ITask>; // 新增
  deleteTask: (id: number | string) => Promise<void>;
  createLink: (link: Partial<ILink>) => Promise<void>;
  deleteLink: (
    linkId: number | string,
    sourceId: number | string,
  ) => Promise<void>;
}
```

### Phase 5: UI 整合

#### 5.1 修改 `GitLabGantt.jsx` - Add Task Intercept

**檔案**: `src/components/GitLabGantt.jsx`
**位置**: Line 531-562

```typescript
// Intercept add-task to distinguish between Task and Milestone
ganttApi.intercept('add-task', (ev) => {
  // 檢查是否在 root level (parent === 0)
  const isRootLevel = !ev.target || ev.target === 0 || ev.mode !== 'child';

  if (isRootLevel) {
    // Root level: 詢問要建立 Task 還是 Milestone
    const choice = prompt(
      'Create:\n1. Task (GitLab Issue)\n2. Milestone\n\nEnter 1 or 2:',
    );

    if (choice === '2') {
      // 建立 Milestone
      const title = prompt('Enter Milestone title:', 'New Milestone');
      if (!title) return false;

      const description = prompt('Enter description (optional):');

      // 標記為 milestone
      ev.task._createAsMilestone = true;
      ev.task.text = title;
      if (description) ev.task.details = description;

      return true;
    } else if (choice === '1') {
      // 建立 Task - 使用現有邏輯
      // Fall through to existing logic
    } else {
      return false; // 取消
    }
  }

  // 檢查 subtask under subtask
  if (ev.mode === 'child' && ev.target && ev.target !== 0) {
    const parentTask = ganttApi.getTask(ev.target);
    if (parentTask && parentTask.parent && parentTask.parent !== 0) {
      alert(
        'Cannot create subtasks under a subtask. Only two levels are allowed.',
      );
      return false;
    }

    // 不能在 milestone 下建立 subtask
    if (parentTask && parentTask._gitlab?.type === 'milestone') {
      alert(
        'Cannot create subtasks under a milestone. Create an Issue instead.',
      );
      return false;
    }
  }

  // 現有的 Task title 輸入邏輯
  const title = prompt('Enter Task title:', ev.task.text || 'New Task');
  if (!title) return false;

  ev.task.text = title;

  const description = prompt('Enter description (optional):');
  if (description) ev.task.details = description;

  return true;
});
```

#### 5.2 修改 `add-task` Handler

**檔案**: `src/components/GitLabGantt.jsx`
**位置**: Line 565-595

```typescript
ganttApi.on('add-task', async (ev) => {
  if (ev.skipHandler) return;

  try {
    if (ev.task._createAsMilestone) {
      // 建立 Milestone
      console.log('[GitLab] Creating Milestone...');
      const newMilestone = await createMilestone(ev.task);

      console.log('[GitLab] Milestone created:', newMilestone);

      // 刪除 temp task
      ganttApi.exec('delete-task', { id: ev.id, skipHandler: true });
    } else {
      // 建立 Task (現有邏輯)
      console.log('[GitLab] Creating Task...');
      const newTask = await createTask(ev.task);

      console.log('[GitLab] Item created from GitLab:', {
        tempId: ev.id,
        newId: newTask.id,
        newTask,
      });

      ganttApi.exec('delete-task', { id: ev.id, skipHandler: true });
    }
  } catch (error) {
    console.error('Failed to create item:', error);
    alert(`Failed to create item: ${error.message}`);
    ganttApi.exec('delete-task', { id: ev.id, skipHandler: true });
  }
});
```

#### 5.3 Hook 中取得 `createMilestone`

**檔案**: `src/components/GitLabGantt.jsx`
**位置**: Line 113-125

```typescript
const {
  tasks: allTasks,
  links,
  milestones,
  epics,
  syncState,
  sync,
  syncTask,
  createTask,
  createMilestone, // 新增
  deleteTask,
  createLink,
  deleteLink,
} = useGitLabSync(provider, autoSync);
```

#### 5.4 更新 `init` callback dependencies

**檔案**: `src/components/GitLabGantt.jsx`
**位置**: Line 751

```typescript
[
  syncTask,
  createTask,
  createMilestone,
  deleteTask,
  createLink,
  deleteLink,
  links,
  syncWithFoldState,
];
```

### Phase 6: 防止不當操作

#### 6.1 防止編輯 Milestone Summary Bar

**檔案**: `src/components/GitLabGantt.jsx`
**位置**: Line 360 (update-task handler)

```typescript
ganttApi.on('update-task', (ev) => {
  // 防止修改 milestone summary task
  if (ev.task._gitlab?.type === 'milestone') {
    console.log('[GitLab] Milestone updates should use editor');
    return; // 不處理 drag 等操作
  }

  // ... 現有邏輯
});
```

#### 6.2 防止刪除有 children 的 Milestone

**檔案**: `src/components/GitLabGantt.jsx`
**位置**: Line 598 (delete-task intercept)

```typescript
ganttApi.intercept('delete-task', (ev) => {
  if (ev.skipHandler) return true;

  const task = ganttApi.getTask(ev.id);

  // 檢查是否為 milestone with children
  if (task._gitlab?.type === 'milestone') {
    const children = allTasksRef.current.filter((t) => t.parent === task.id);
    if (children.length > 0) {
      alert(
        `Cannot delete milestone "${task.text}" because it contains ${children.length} issue(s). Please move or delete them first.`,
      );
      return false;
    }
  }

  const taskTitle = task ? task.text : `Task ${ev.id}`;
  const confirmed = confirm(
    `Are you sure you want to delete "${taskTitle}"?\n\nThis will permanently delete the task from GitLab.`,
  );

  return confirmed;
});
```

## 測試計畫

### 手動測試檢查清單

#### Milestone CRUD

- [ ] 建立 Milestone：在 root level 建立，確認出現在最上層
- [ ] 編輯 Milestone 標題：透過 editor 修改，確認同步到 GitLab
- [ ] 編輯 Milestone 日期：拖曳或 editor 修改，確認同步
- [ ] 刪除空 Milestone：確認可以刪除
- [ ] 刪除有 Issue 的 Milestone：確認被阻擋

#### Milestone Assignment

- [ ] 拖曳 Issue 到 Milestone：確認變成 child
- [ ] 拖曳 Issue 離開 Milestone：確認回到 root level
- [ ] 拖曳 Issue 從 Milestone A 到 Milestone B：確認 milestone 變更
- [ ] Reload 後確認關係保持

#### 排序

- [ ] 多個 Milestones：確認依 due date 排序
- [ ] Milestone 與 standalone Issue：確認 Milestone 在前
- [ ] Milestone 內的 Issues：確認可以拖曳排序
- [ ] 排序持久化：reload 後確認順序保持

#### 階層

- [ ] Issue 在 Milestone 下有 Subtask：確認 3 層結構正確
- [ ] 不能在 Milestone 下直接建立 Subtask：確認被阻擋
- [ ] Subtask 的 parent Issue 移動到 Milestone：確認 Subtask 跟著移動

#### Fold/Unfold State

- [ ] 展開/收起 Milestone：確認 children 顯示/隱藏
- [ ] Sync 後 fold state 保持：確認不會重設

## 潛在風險與注意事項

### 1. API 限制

- GitLab Milestone 沒有 delete mutation，只能 close
- Group-level milestone 與 project-level milestone API 不同
- 需要處理 milestone 的 global ID 轉換

### 2. 效能考量

- 兩個獨立查詢（work items + milestones）可能較慢
- 考慮使用 parallel queries 優化

### 3. 資料一致性

- Milestone 的 IID 與 Work Item 的 IID 可能重複
- 需要在 `_gitlab.type` 中明確標示類型
- Cache 策略需要考慮 milestone 資料

### 4. UI/UX

- 使用者可能不清楚何時建立 Task vs Milestone
- Milestone bar 的顏色需要區別（建議使用不同樣式）
- Milestone 不應該顯示 progress bar

### 5. 向後相容

- 現有的 Issue-Task 階層不應受影響
- 沒有 milestone 的 Issue 應該維持在 root level
- displayOrder 系統應該繼續運作

## 時程估計

- Phase 1 (資料獲取): 2-3 小時
- Phase 2 (排序邏輯): 1-2 小時
- Phase 3 (CRUD 操作): 3-4 小時
- Phase 4 (Hook 整合): 1 小時
- Phase 5 (UI 整合): 2-3 小時
- Phase 6 (防護邏輯): 1 小時
- 測試與修復: 2-3 小時

**總計**: 約 12-18 小時

## 成功標準

1. ✅ 可以在 UI 建立 Milestone
2. ✅ Milestone 顯示在 Gantt chart 最上層
3. ✅ 可以拖曳 Issue 到 Milestone 下
4. ✅ 可以編輯 Milestone 的標題、日期、描述
5. ✅ 可以刪除 Milestone（若無 children）
6. ✅ 排序正確且持久化
7. ✅ Fold/unfold state 正常運作
8. ✅ 所有操作同步到 GitLab
9. ✅ Reload 後資料正確載入
10. ✅ 不影響現有 Issue-Task 階層功能
