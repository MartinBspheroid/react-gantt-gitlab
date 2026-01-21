# React Gantt for GitLab

https://react-gantt-gitlab-8d7d33.pages.rayark.io/

## GitLab Gantt

![GitLab Gantt Screenshot](./assets/gitlab-gantt.png)

- 設置 GitLab 專案
  - 需要 Base URL, Access Token
  - 設置國定假日和特殊工作日 (使用 GitLab Snippets 存放)
- 簡易的篩選器
- 新增/編輯/刪除 GitLab Milestone
  - 在旁邊按 + 可以新增內層 Issue
- 新增/編輯/刪除 GitLab Issue
  - 在旁邊按 + 可以新增內層 Task
- 新增/編輯/刪除 GitLab Task
- 雙擊打開 Milestone, Issue, Task 編輯器
  - 可以從編輯器連進 GitLab 頁面
- 支援 Issue / Task 排序
  - 與 GitLab 內的排序連動
- 在時間軸調整 Milestone / Issue / Task 時間
- 可以設置 Issue/Task 之間的連結 (Link)
  - 點擊時間bar兩旁的圓圈，可以進入 Link 設置，點另外一個圓圈就會連結
  - 可以在編輯視窗裡面刪除/修改連線
- 支援調整的時距
- 使用 Server / Client Filter 用來對 Issues, Tasks 進行篩選
  - 使用 Server 篩選器可以大幅改善過多 Issues 讀取的狀況
- Color Rule 色彩規則功能
  - 用標題設定條件，來讓 time bar 顯示指定的顏色條紋（最多顯示三個顏色）
  - 會儲存在專案 snippet (必須要有 Maintainer 權限)
- Grid Column 可自訂需要的欄位和順序
  - 包含: Issue ID, Start, Due, Assignee, Weight, Workdays, Iteration, Epic, Labels, Order(手動排序)
- 建立 Blueprint (範本) 功能
  - 現在可以把一個 milestone 裡面所有的 issues/tasks 以及它們之間的關聯性全部包成一個範本，下次要做類似的事情的時候就可以直接新增這個範本。可以自動幫忙把 issues 的名字加上 prefix，也能保持他們原本的工期。
  - 範本可以存在 local 也可以存在 snippet 裡面共享。
- 批次將 Issues / Tasks 重新指定 Milestone / Issues parent / Epic
  - 左邊的任務清單可以按著 shift / ctrl 複選，然後按右鍵找到 Move In 選項，就可以開啟 ui 決定要放入的 Milestone / Issue / Epic

### 已知問題

- 新建 milestone 裡面的 issue, task 會隔一小段時間同步後才會正常顯示
- 目前不支援拖曳到其他 Milestone / Issue 底下

## Workload View

![Workload View Screenshot](./assets/workload-view.png)

- 從側邊欄開啟
- 可以用 Assignee 和 Labels 來篩選，觀察工作負荷量
- 可以調整時間
- 可以上下拖曳將工作指派到不同人或是移動到不同的 Labels
- 在設定裡面可以開啟 Other，看到還沒有指派的工作

## Acknowledgements

- This project is based on [SVAR React Gantt](https://svar.dev/react/gantt/)
