# Milestone Implementation - Complete Documentation

## 目標

支援 GitLab Milestones 作為 Gantt Chart 的 top-level tasks，實現階層結構：

```
Milestone (Top-level)
  └─ Issue (Child of Milestone)
      └─ Task/Subtask (Child of Issue)
```

## 實作狀態

### ✅ 已完成功能

1. **Milestone 資料獲取與轉換**

   - GraphQL 查詢 milestones（project/group level）
   - 轉換 milestone 為 Gantt task 格式
   - 設定 milestone 的時區處理（T00:00:00 和 T23:59:59）
   - 處理沒有日期的 milestone（預設 +30 天）

2. **Milestone CRUD 操作**

   - ✅ 創建：使用 REST API `POST /projects/:id/milestones`
   - ✅ 更新：使用 REST API `PUT /projects/:id/milestones/:milestone_id`
   - ✅ 刪除：暫不支援（GitLab API 限制，只能 close）
   - ✅ 時區處理：統一使用 `formatDateForGitLab()` 方法

3. **階層結構**

   - Milestone 作為 root level tasks（parent = 0）
   - Issue 可以屬於 milestone（透過 milestoneWidget）
   - Subtask 可以屬於 issue（透過 hierarchyWidget）
   - 正確處理 3 層結構

4. **排序邏輯**

   - Root level：Milestone 優先（依 dueDate > startDate > title）
   - Root level：Standalone issues 其次（依 displayOrder > id）
   - Milestone 內的 issues：依 displayOrder > id
   - Issue 內的 subtasks：依 displayOrder > id

5. **UI 整合**

   - 透過 Toolbar 的 "Add Task" 建立 milestone
   - 透過 Editor 編輯 milestone 屬性
   - 支援拖曳調整 milestone 日期
   - Milestone 更新事件正確同步到 GitLab

6. **防護邏輯**
   - 防止在 milestone 下直接建立 subtask
   - 防止建立 3 層以上的階層
   - Milestone 的更新會正確路由到 `updateMilestone` 方法

## 技術實作細節

### 1. 資料獲取與轉換

#### 查詢 Milestones（GitLabGraphQLProvider.ts:197-213）

```typescript
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
          webPath
          createdAt
          updatedAt
        }
      }
    }
  }
`;
```

#### 轉換 Milestone 為 Task（GitLabGraphQLProvider.ts）

```typescript
import { createMilestoneTaskId } from '../utils/MilestoneIdUtils';

private convertMilestoneToTask(milestone: any): ITask {
  // 使用字串 ID 格式避免與 work item IID 衝突
  // 格式："m-{iid}"（例如 "m-1", "m-8"）
  const milestoneTaskId = createMilestoneTaskId(milestone.iid);

  // 時區處理：確保使用本地時區
  const startDate = milestone.startDate
    ? new Date(milestone.startDate + 'T00:00:00')
    : milestone.createdAt
      ? new Date(milestone.createdAt)
      : new Date();

  // 沒有 due date 時預設 +30 天
  const endDate = milestone.dueDate
    ? new Date(milestone.dueDate + 'T23:59:59')
    : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: milestoneTaskId,  // 字串格式："m-1"
    text: milestone.title,
    start: startDate,
    end: endDate,
    duration: Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))),
    type: 'task', // 使用 'task' 而非 'summary' 以支援 baseline
    parent: 0,
    details: milestone.description || '',
    $isMilestone: true, // 自訂標記供 CSS 使用
    _gitlab: {
      type: 'milestone',
      id: milestone.iid,        // 用於 UI 識別
      globalId: milestone.id,   // 用於 REST API
      web_url: webUrl,
    },
  };
}
```

**關鍵決策**：

- **ID 格式**：Milestone task ID = `"m-{iid}"`（字串格式），避免與 work item IID 衝突
  - 舊格式 `10000 + iid` 已棄用，因為當專案有超過 10000 個 issue 時會產生衝突
  - 工具函數在 `src/utils/MilestoneIdUtils.ts`
- **Type**：使用 `'task'` 而非 `'summary'`，因為需要支援 baseline 功能
- **時區**：加上 `T00:00:00` 和 `T23:59:59` 確保本地時區解析
- **Global ID**：儲存完整的 `gid://gitlab/Milestone/1130` 供 REST API 使用

### 2. Milestone 更新邏輯

#### 關鍵發現：REST API 使用內部 ID

GitLab REST API 的 `milestone_id` 參數需要使用**內部 ID**（從 globalId 提取），而不是 iid：

- ❌ **錯誤**：使用 iid（例如：1）→ 404 Not Found
- ✅ **正確**：使用內部 ID（例如：1130，從 `gid://gitlab/Milestone/1130` 提取）

#### 更新 Milestone（GitLabGraphQLProvider.ts）

```typescript
import { extractMilestoneIid } from '../utils/MilestoneIdUtils';

async updateMilestone(id: TID, milestone: Partial<ITask>): Promise<void> {
  // 從 globalId 或 task ID 提取內部 ID
  // globalId 格式: "gid://gitlab/Milestone/1130"
  // task ID 格式: "m-{iid}"（例如 "m-1"）
  let milestoneId: string;

  if (milestone._gitlab?.globalId) {
    const match = milestone._gitlab.globalId.match(/\/Milestone\/(\d+)$/);
    if (match) {
      milestoneId = match[1]; // 提取 "1130"
    } else {
      // Fallback: 從 task ID 提取 iid
      const extractedIid = extractMilestoneIid(id);
      milestoneId = String(milestone._gitlab.id || extractedIid);
    }
  } else if (milestone._gitlab?.id) {
    milestoneId = String(milestone._gitlab.id);
  } else {
    // 從 task ID 提取 iid（格式："m-{iid}"）
    const extractedIid = extractMilestoneIid(id);
    if (extractedIid !== null) {
      milestoneId = String(extractedIid);
    } else {
      throw new Error(`Cannot determine milestone ID from task ID: ${id}`);
    }
  }

  // 建立 payload
  const payload: any = {};
  if (milestone.text !== undefined) payload.title = milestone.text;
  if (milestone.details !== undefined) payload.description = milestone.details;
  if (milestone.start !== undefined) {
    payload.start_date = milestone.start ? this.formatDateForGitLab(milestone.start) : null;
  }
  if (milestone.end !== undefined) {
    payload.due_date = milestone.end ? this.formatDateForGitLab(milestone.end) : null;
  }

  // 使用 REST API
  const updatedMilestone = await gitlabRestRequest(
    `/projects/${encodedProjectId}/milestones/${milestoneId}`,
    {
      gitlabUrl: this.config.gitlabUrl,
      token: this.config.token,
      isDev: this.isDev,
    },
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}
```

#### 路由邏輯（GitLabGraphQLProvider.ts）

```typescript
async updateWorkItem(id: TID, task: Partial<ITask>): Promise<void> {
  // 使用 _gitlab.type 檢查是否為 milestone
  // 不再使用 ID >= 10000 的方式（已棄用）
  if (task._gitlab?.type === 'milestone') {
    console.log('[GitLabGraphQL] Detected milestone update, routing to updateMilestone');
    return this.updateMilestone(id, task);
  }

  // 一般 work item 的更新邏輯...
}
```

### 3. 時區處理策略

所有日期操作統一使用 `formatDateForGitLab()` 方法，確保本地時區一致性：

```typescript
private formatDateForGitLab(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**應用位置**：

1. 創建 work item（GitLabGraphQLProvider.ts:1069, 1072）
2. 創建 milestone（GitLabGraphQLProvider.ts:1295, 1299, 1304）
3. 更新 milestone（GitLabGraphQLProvider.ts:1378, 1382）

**錯誤案例**（已修正）：

- ❌ `toISOString().split('T')[0]` → 會轉換為 UTC，造成日期偏移
- ✅ `formatDateForGitLab(date)` → 使用本地時區

### 4. UI 互動處理

#### 移除 Milestone 更新跳過邏輯（GitLabGantt.jsx:653）

原本的程式碼會跳過 milestone 的更新：

```typescript
// ❌ 已移除
if (ev.task._gitlab?.type === 'milestone') {
  return; // 這會導致 milestone 更新無法同步
}
```

移除這個檢查後，milestone 的拖曳和編輯才能正確同步到 GitLab。

#### Milestone 創建 UI（GitLabGantt.jsx:413-432）

```typescript
const handleAddMilestone = async () => {
  if (!api) return;

  const title = prompt('Enter Milestone title:', 'New Milestone');
  if (!title) return;

  const description = prompt('Enter description (optional):');
  const startDateStr = prompt('Enter start date (YYYY-MM-DD, optional):');
  const dueDateStr = prompt('Enter due date (YYYY-MM-DD, optional):');

  try {
    const milestone = {
      text: title,
      details: description || '',
      parent: 0,
      ...(startDateStr && { start: new Date(startDateStr) }),
      ...(dueDateStr && { end: new Date(dueDateStr) }),
    };

    const newMilestone = await createMilestone(milestone);
    // Gantt API 會自動更新顯示
  } catch (error) {
    console.error('Failed to create milestone:', error);
    alert(`Failed to create milestone: ${error.message}`);
  }
};
```

### 5. 排序邏輯（GitLabGraphQLProvider.ts:287-365）

```typescript
private sortTasksByOrder(tasks: ITask[]): ITask[] {
  // 依照 parent 分組
  const tasksByParent = new Map<number | string, ITask[]>();
  tasks.forEach((task) => {
    const parentId = task.parent || 0;
    if (!tasksByParent.has(parentId)) {
      tasksByParent.set(parentId, []);
    }
    tasksByParent.get(parentId)!.push(task);
  });

  const sortedTasks: ITask[] = [];
  tasksByParent.forEach((parentTasks, parentId) => {
    if (parentId === 0) {
      // Root level: 分離 milestones 和 issues
      const milestones = parentTasks.filter((t) => t._gitlab?.type === 'milestone');
      const issues = parentTasks.filter((t) => t._gitlab?.type !== 'milestone');

      // Milestones: 依 due date > start date > title
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

      // 合併: Milestones 在前，Issues 在後
      sortedTasks.push(...milestones, ...issues);
    } else {
      // Non-root level: 依 displayOrder > id
      parentTasks.sort((a, b) => {
        const orderA = a.$custom?.displayOrder;
        const orderB = b.$custom?.displayOrder;
        if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;
        return (a.id as number) - (b.id as number);
      });
      sortedTasks.push(...parentTasks);
    }
  });

  return sortedTasks;
}
```

## API 使用總結

### GraphQL API

**使用時機**：查詢資料

```graphql
query getMilestones($fullPath: ID!) {
  project(fullPath: $fullPath) {
    milestones(state: active, first: 100) {
      nodes {
        id # gid://gitlab/Milestone/1130
        iid # 1
        title
        description
        dueDate # "2025-11-25"
        startDate # "2025-11-24"
      }
    }
  }
}
```

### REST API

**使用時機**：創建和更新 milestone（GraphQL 不支援）

```
POST /api/v4/projects/:id/milestones
PUT /api/v4/projects/:id/milestones/:milestone_id
```

**重要**：`milestone_id` 參數使用內部 ID（從 globalId 提取），不是 iid！

## 測試檢查清單

### ✅ Milestone CRUD

- [x] 建立 milestone（透過 UI 對話框）
- [x] 編輯 milestone 標題（透過 editor）
- [x] 編輯 milestone 日期（拖曳 bar）
- [x] 日期正確同步到 GitLab（無時區偏移）

### ✅ 階層結構

- [x] Milestone 顯示在 root level
- [x] Issue 可以屬於 milestone（透過 milestoneWidget）
- [x] Subtask 可以屬於 issue（透過 hierarchyWidget）
- [x] 3 層結構正確顯示

### ✅ 排序

- [x] Milestone 依 due date 排序
- [x] Milestone 在 root level issues 之前
- [x] 排序在 sync 後保持

### ✅ 時區處理

- [x] 創建時使用本地時區
- [x] 更新時使用本地時區
- [x] 同一天的 milestone 可以顯示（00:00:00 到 23:59:59）

## 已知限制

1. **刪除 Milestone**：GitLab API 不支援刪除 milestone，只能關閉（close）
2. **Group Milestone**：目前只測試了 project-level milestone
3. **Milestone Assignment**：尚未實作透過拖曳將 issue 指派給 milestone
4. **Milestone 進度**：Milestone 沒有進度條（progress bar）

## 未來改進方向

1. **拖曳指派**：實作將 issue 拖曳到 milestone 的功能
2. **批次操作**：支援批次更新 milestone
3. **Milestone 進度計算**：自動計算 milestone 內 issues 的完成率
4. **Group Milestone**：完整測試 group-level milestone 支援
5. **Milestone 過濾**：UI 上提供 milestone 過濾選項

## 參考文件

- [GitLab Milestones API](https://docs.gitlab.com/api/milestones/)
- [GitLab GraphQL API](https://docs.gitlab.com/api/graphql/)
- GitLab Work Items Widget: MilestoneWidget

## 變更歷史

### 2025-11-21

- ✅ 修正 milestone 創建時的時區問題
- ✅ 實作 milestone 更新功能（使用 REST API）
- ✅ 發現並修正 REST API 需要使用內部 ID 而非 iid
- ✅ 移除 update-task 事件中對 milestone 的跳過邏輯
- ✅ 完成所有時區處理的統一（使用 formatDateForGitLab）

### 之前

- ✅ 實作 milestone 資料獲取與轉換
- ✅ 實作 milestone 創建功能（使用 REST API）
- ✅ 實作排序邏輯（milestone 優先）
- ✅ 實作 3 層階層結構
