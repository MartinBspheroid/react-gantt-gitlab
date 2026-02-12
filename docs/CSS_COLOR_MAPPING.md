# CSS Color Mapping Document

## Hex to CSS Variable Mapping

### Primary Colors (Brand/Accent)

| Hex     | CSS Variable                     | Usage                               |
| ------- | -------------------------------- | ----------------------------------- |
| #1f75cb | --wx-color-primary               | Primary brand color, links, buttons |
| #1a65b3 | --wx-color-primary-hover         | Primary hover state                 |
| #3983eb | --wx-color-accent-blue           | Accent blue elements                |
| #1f6bd9 | --wx-color-accent-blue-hover     | Accent blue hover                   |
| #37a9ef | --wx-color-accent-light          | Light accent                        |
| #3b82f6 | --wx-color-accent-blue-alt       | Alternative accent blue             |
| #2563eb | --wx-color-accent-blue-alt-hover | Alternative accent hover            |
| #00ba94 | --wx-color-success               | Success states, tasks               |
| #099f81 | --wx-color-success-hover         | Success hover                       |
| #dc2626 | --wx-color-danger                | Danger/error states                 |
| #b91c1c | --wx-color-danger-hover          | Danger hover                        |
| #ad44ab | --wx-color-milestone             | Milestone color                     |
| #d97706 | --wx-color-warning               | Warning color                       |
| #b45309 | --wx-color-warning-hover         | Warning hover                       |
| #f59e0b | --wx-color-warning-alt           | Alternative warning                 |
| #a883e4 | --wx-color-purple                | Purple accent                       |

### Background Colors

| Hex     | CSS Variable                      | Usage                  |
| ------- | --------------------------------- | ---------------------- |
| #ffffff | --wx-color-background             | Primary background     |
| #f9fafb | --wx-color-background-secondary   | Secondary background   |
| #f8f9fa | --wx-color-background-tertiary    | Tertiary background    |
| #f5f5f5 | --wx-color-background-muted       | Muted background       |
| #f3f4f6 | --wx-color-background-gray        | Gray background        |
| #f0f6fa | --wx-color-background-holiday     | Holiday background     |
| #fef2f2 | --wx-color-background-error       | Error background       |
| #fee2e2 | --wx-color-background-error-light | Light error background |
| #f8d7da | --wx-color-background-error-alt   | Alternative error bg   |
| #fef3c7 | --wx-color-background-warning     | Warning background     |
| #dbeafe | --wx-color-background-info        | Info background        |
| #fbfbfb | --wx-color-background-sidebar     | Sidebar background     |
| #f7f7f7 | --wx-color-background-hover       | Hover background       |
| #f1f1f1 | --wx-color-background-active      | Active background      |
| #f9f9f9 | --wx-color-background-light       | Light background       |
| #f0f0f0 | --wx-color-background-neutral     | Neutral background     |
| #fafafa | --wx-color-background-minimal     | Minimal background     |
| #4f525a | --wx-color-background-tooltip     | Tooltip background     |

### Text/Foreground Colors

| Hex     | CSS Variable                    | Usage                  |
| ------- | ------------------------------- | ---------------------- |
| #333333 | --wx-color-text-primary         | Primary text           |
| #374151 | --wx-color-text-secondary       | Secondary text         |
| #384047 | --wx-color-text-tertiary        | Tertiary text          |
| #666666 | --wx-color-text-muted           | Muted text             |
| #9fa1ae | --wx-color-text-subtle          | Subtle text            |
| #6b7280 | --wx-color-text-gray            | Gray text              |
| #9ca3af | --wx-color-text-light           | Light text             |
| #d1d5db | --wx-color-text-lighter         | Lighter text           |
| #ffffff | --wx-color-text-inverse         | Inverse text (on dark) |
| #595b66 | --wx-color-text-sidebar         | Sidebar text           |
| #42454d | --wx-color-text-sidebar-primary | Sidebar primary text   |
| #878994 | --wx-color-text-icon            | Icon color             |
| #999999 | --wx-color-text-placeholder     | Placeholder text       |
| #e6e6e6 | --wx-color-text-tooltip         | Tooltip text           |

### Border Colors

| Hex     | CSS Variable                | Usage            |
| ------- | --------------------------- | ---------------- |
| #dddddd | --wx-color-border           | Default border   |
| #e6e6e6 | --wx-color-border-light     | Light border     |
| #cccccc | --wx-color-border-muted     | Muted border     |
| #e5e7eb | --wx-color-border-gray      | Gray border      |
| #e1e4e8 | --wx-color-border-subtle    | Subtle border    |
| #e0e0e0 | --wx-color-border-light-alt | Alt light border |
| #ebebeb | --wx-color-border-sidebar   | Sidebar border   |
| #eeeeee | --wx-color-border-minimal   | Minimal border   |
| #d1d5db | --wx-color-border-input     | Input border     |
| #c0c3ce | --wx-color-border-control   | Control border   |
| #dcdcde | --wx-color-border-gray-alt  | Alt gray border  |
| #fecaca | --wx-color-border-error     | Error border     |

### Semantic Status Colors

| Hex     | CSS Variable                    | Usage          |
| ------- | ------------------------------- | -------------- |
| #dc2626 | --wx-color-status-error         | Error status   |
| #b91c1c | --wx-color-status-error-dark    | Dark error     |
| #721c24 | --wx-color-status-error-text    | Error text     |
| #28a745 | --wx-color-status-success       | Success status |
| #059669 | --wx-color-status-success-dark  | Dark success   |
| #10b981 | --wx-color-status-success-alt   | Alt success    |
| #d97706 | --wx-color-status-warning       | Warning status |
| #b45309 | --wx-color-status-warning-dark  | Dark warning   |
| #fcd34d | --wx-color-status-warning-light | Light warning  |
| #3b82f6 | --wx-color-status-info          | Info status    |
| #1d4ed8 | --wx-color-status-info-dark     | Dark info      |
| #1976d2 | --wx-color-status-info-alt      | Alt info       |
| #6c5ce7 | --wx-color-status-purple        | Purple status  |
| #a29bfe | --wx-color-status-purple-light  | Light purple   |

### Gantt-Specific Mappings

| Hex     | CSS Variable                 | Usage                |
| ------- | ---------------------------- | -------------------- |
| #eaedf5 | --wx-gantt-select-color      | Selection color      |
| #eaedf5 | --wx-gantt-select-background | Selection background |
| #9fa1ae | --wx-gantt-link-color        | Link lines color     |
| #1d1e26 | --wx-chart-border            | Chart borders        |
| #2c2f33 | --wx-chart-text              | Chart text           |

### Shadows

| Hex                    | CSS Variable        | Usage           |
| ---------------------- | ------------------- | --------------- |
| rgba(0, 0, 0, 0.5)     | --wx-shadow-overlay | Overlay shadows |
| rgba(44, 47, 60, 0.06) | --wx-shadow-sm      | Small shadows   |
| rgba(44, 47, 60, 0.12) | --wx-shadow-md      | Medium shadows  |
| rgba(0, 0, 0, 0.15)    | --wx-shadow-lg      | Large shadows   |

## Files Changed

### Component CSS Files

- src/components/ColorRulesEditor.css
- src/components/SaveBlueprintModal.css
- src/components/GanttView/GanttView.css
- src/components/Workspace/SharedToolbar.css
- src/components/Workspace/Workspace.css
- src/components/Editor.css
- src/components/Fullscreen.css
- src/components/ContextMenu.css
- src/components/BlueprintManager.css
- src/components/ApplyBlueprintModal.css
- src/components/MoveInModal.css
- src/components/SmartTaskContent.css
- src/components/Resizer.css
- src/components/LabelCell.css
- src/components/Layout.css
- src/components/TimeScale.css
- src/components/WorkloadView.css
- src/components/WorkloadChart.css
- src/components/KanbanView/KanbanView.css
- src/components/KanbanView/KanbanList.css
- src/components/KanbanView/KanbanCard.css
- src/components/KanbanView/KanbanBoard.css
- src/components/KanbanView/SortControl.css
- src/components/KanbanView/ListEditDialog.css
- src/components/KanbanView/BoardSettingsModal.css
- src/components/KanbanView/BoardSelector.css
- src/components/KanbanView/KanbanBoardDnd.css
- src/components/chart/Bars.css
- src/components/chart/DrawBarConfirmDialog.css
- src/components/chart/RowHoverOverlay.css
- src/components/chart/Chart.css
- src/components/chart/Links.css
- src/components/chart/OffscreenArrows.css
- src/components/grid/Grid.css
- src/components/grid/ActionCell.css
- src/components/grid/TextCell.css
- src/components/grid/DateEditCell.css
- src/components/editor/WorkdaysInput.css
- src/components/editor/NullableDatePicker.css
- src/components/editor/Links.css
- src/components/editor/DateTimePicker.css
- src/components/shared/modal-close-button.css
- src/components/shared/AssigneeSelector.css
- src/components/shared/SettingsModal.css
- src/components/shared/DatePickerPopup.css
- src/components/shared/TodayMarker.css
- src/components/shared/dialogs/CreateItemDialog.css
- src/components/shared/dialogs/BaseDialog.css

### Widget CSS Files

- src/widgets/Tooltip.css
- src/widgets/IconButton.css

### Demo CSS Files

- demos/custom/\*.css
- demos/cases/\*.css
- demos/common/Index.css

## Summary

- **Total CSS files audited:** ~49
- **Total hex values replaced:** ~109
- **Categories covered:**
  - Backgrounds
  - Text/Foreground
  - Borders
  - Hover/Active states
  - Shadows
  - Status/Semantic colors
