# GitLab Gantt 本地測試指南

## 快速開始

### 1. 安裝依賴

```bash
cd /Users/farl/vibe-coding-project/react-gantt/react-gantt
npm install
```

### 2. 啟動開發服務器

```bash
npm run dev
```

服務器將在 `http://localhost:5173` 啟動

### 3. 訪問 GitLab Integration Demo

打開瀏覽器訪問：

```
http://localhost:5173/gitlab-integration/willow
```

## 配置 GitLab 連線

### 方式一：通過 UI 配置（推薦）

1. 打開 GitLab Integration 頁面
2. 點擊 "**+ Add**" 按鈕
3. 填寫配置表單：

   **For GitLab.com:**

   - Configuration Name: `My GitLab Project`
   - GitLab URL: `https://gitlab.com`
   - Access Token: 你的 Personal Access Token
   - Type: `project`
   - Project ID: 你的專案 ID（例如：`12345` 或 `namespace/project-name`）

   **For Self-Hosted GitLab:**

   - Configuration Name: `Company GitLab`
   - GitLab URL: `https://gitlab.example.com`
   - Access Token: 你的 Personal Access Token
   - Type: `project` 或 `group`
   - Project/Group ID: 你的專案或群組 ID

4. 點擊 "**Test Connection**" 測試連線
5. 測試成功後點擊 "**Save**"
6. 系統會自動載入 GitLab 的 Issues

### 方式二：使用環境變數（可選）

創建 `.env.local` 檔案（不會被 git 追蹤）：

```bash
cp .env.example .env.local
```

編輯 `.env.local` 並填入你的配置：

```env
VITE_GITLAB_URL=https://gitlab.com
VITE_GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
VITE_GITLAB_PROJECT_ID=12345
```

然後修改代碼以使用環境變數（可選步驟）。

## 獲取 GitLab Access Token

### 1. 登入 GitLab

訪問你的 GitLab 實例（gitlab.com 或自架）

### 2. 前往 Access Tokens 頁面

- 點擊右上角頭像
- 選擇 "**Preferences**" 或 "**Settings**"
- 左側選單選擇 "**Access Tokens**"

### 3. 創建新 Token

- Token name: `Gantt Chart Integration`
- Expiration date: 選擇過期日期（建議設定）
- Scopes: 勾選 **`api`** （完整 API 訪問權限）
- 點擊 "**Create personal access token**"

### 4. 複製 Token

⚠️ **重要**: Token 只會顯示一次，請立即複製保存！

格式類似：`glpat-xxxxxxxxxxxxxxxxxxxx`

## 功能測試清單

### ✅ 基本功能

- [ ] 添加 GitLab 配置
- [ ] 測試連線成功
- [ ] 成功載入 Issues
- [ ] 顯示 Milestones 作為分組
- [ ] 查看任務詳細信息

### ✅ 同步功能

- [ ] 點擊 "Sync" 按鈕手動同步
- [ ] 查看最後同步時間
- [ ] 修改任務標題並同步到 GitLab
- [ ] 修改任務日期並同步到 GitLab
- [ ] 修改任務進度

### ✅ 過濾功能

- [ ] 點擊 "Filters" 展開過濾面板
- [ ] 按 Milestone 過濾
- [ ] 按 Label 過濾
- [ ] 按 Assignee 過濾
- [ ] 按 State (opened/closed) 過濾
- [ ] 使用搜尋框搜尋任務

### ✅ 多專案管理

- [ ] 添加第二個 GitLab 配置
- [ ] 在下拉選單中切換專案
- [ ] 編輯現有配置
- [ ] 刪除配置

### ✅ 錯誤處理

- [ ] 測試無效的 Token（應顯示錯誤）
- [ ] 測試無效的 Project ID（應顯示錯誤）
- [ ] 網路斷線情況下的行為

## 測試用 GitLab 專案建議

如果你沒有現成的 GitLab 專案，可以：

### 選項 1: 使用 GitLab.com 公開專案

你可以測試任何公開專案，例如：

- GitLab 官方專案: `https://gitlab.com/gitlab-org/gitlab`
- Project ID: `278964`

但注意：公開專案需要有效 token，且無法測試寫入功能。

### 選項 2: 創建測試專案

1. 在 GitLab.com 創建新專案
2. 添加一些測試 Issues：
   - 設定 Title
   - 設定 Due date
   - 添加 Labels
   - 分配 Assignees
   - 添加 Milestone
3. 創建 Issue Relations (blocked by / blocks)
4. 使用這個專案測試完整功能

### 測試 Issue 範例

```
Issue 1: Setup project infrastructure
- Due date: 2024-12-31
- Labels: setup, high-priority
- Milestone: v1.0

Issue 2: Implement authentication
- Due date: 2025-01-15
- Labels: feature, backend
- Milestone: v1.0
- Blocked by: Issue 1

Issue 3: Design UI
- Due date: 2025-01-10
- Labels: feature, frontend
- Milestone: v1.0

Issue 4: Integration testing
- Due date: 2025-01-20
- Labels: testing
- Milestone: v1.0
- Blocked by: Issue 2, Issue 3
```

## 常見問題排除

### Q: 啟動報錯 "Cannot find module"

**A**: 確保已安裝所有依賴：

```bash
npm install
```

### Q: Token 認證失敗

**A**: 檢查：

1. Token 是否正確複製（不能有多餘空格）
2. Token 是否有 `api` scope
3. Token 是否已過期
4. GitLab URL 是否正確（包含 https://）

### Q: Project ID 找不到

**A**: Project ID 獲取方式：

1. 進入你的 GitLab 專案頁面
2. 在專案名稱下方可以看到 "Project ID: 12345"
3. 或使用 URL 路徑：`namespace/project-name`

### Q: 無法載入 Milestones 或 Epics

**A**:

- Milestones: 確保專案有創建 Milestones
- Epics: 需要 GitLab Premium/Ultimate 授權，且必須使用 Group 類型配置

### Q: Issues 無法同步回 GitLab

**A**: 檢查：

1. Token 權限（需要 Maintainer+ 角色才能編輯）
2. 專案是否為唯讀
3. 瀏覽器控制台是否有錯誤訊息

### Q: CORS 錯誤

**A**:

- GitLab.com 和自架 GitLab 通常不會有 CORS 問題
- 如果遇到，可能需要後端代理（參考 GITLAB_INTEGRATION.md）

## 開發模式下的 Hot Reload

修改任何檔案後，Vite 會自動重新載入：

- `src/` 下的組件檔案
- `demos/` 下的測試檔案
- CSS 樣式

不需要重啟服務器。

## 查看瀏覽器控制台

按 F12 打開開發者工具，可以看到：

- GitLab API 請求
- 同步操作日誌
- 錯誤訊息（如果有）

## 其他測試頁面

專案包含 76+ 個範例頁面，可以在左側選單瀏覽：

- Basic Gantt: `/base/willow`
- Backend data: `/backend/willow`
- Toolbar: `/toolbar/willow`
- **GitLab Integration**: `/gitlab-integration/willow`

## 生產建置測試

```bash
# 建置專案
npm run build

# 預覽建置結果
npm run preview
```

## 需要幫助？

1. 查看詳細文件：[GITLAB_INTEGRATION.md](./GITLAB_INTEGRATION.md)
2. 查看範例代碼：`demos/cases/GitLabIntegration.jsx`
3. 查看 GitLab API 文件：https://docs.gitlab.com/ee/api/
4. 查看 react-gantt 文件：https://docs.svar.dev/gantt/

## 測試數據持久化

配置數據儲存在瀏覽器的 localStorage 中：

- Key: `gitlab_gantt_configs`
- 清除測試數據：瀏覽器控制台執行 `localStorage.clear()`
