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

### 已知問題

- 新建 milestone 裡面的 issue, task 會隔一小段時間同步後才會正常顯示
- 目前不支援拖到其他 Milestone / Issue 底下

## Workload View

![Workload View Screenshot](./assets/workload-view.png)

- 從側邊欄開啟
- 可以用 Assignee 和 Labels 來篩選，觀察工作負荷量
- 可以調整時間
- 可以上下拖曳將工作指派到不同人或是移動到不同的 Labels
- 在設定裡面可以開啟 Other，看到還沒有指派的工作

## Acknowledgements

- This project is based on [SVAR React Gantt](https://svar.dev/react/gantt/)
