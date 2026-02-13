# React Gantt Chart

A data-source-agnostic Gantt chart component for React. Supports multiple data backends through a pluggable provider interface, with a built-in Azure DevOps demo data set.

- https://farl.github.io/react-gantt-gitlab

## Quick Start

```jsx
import {
  Workspace,
  DataProvider,
  GanttView,
  StaticDataProvider
} from 'react-gantt-gitlab';

// Create a data provider
const provider = new StaticDataProvider({
  tasks: [...],
  links: [...]
});

// Render the Gantt chart
function App() {
  return (
    <DataProvider provider={provider}>
      <Workspace>
        <GanttView />
      </Workspace>
    </DataProvider>
  );
}
```

## Public API

### Core Components

These are the main components for building Gantt chart applications:

| Component    | Description                                                   |
| ------------ | ------------------------------------------------------------- |
| `Workspace`  | Main layout container with sidebar, toolbar, and content area |
| `GanttView`  | The main Gantt chart view component                           |
| `KanbanView` | Kanban board view for task management                         |

### Data Layer

Connect to your data source using these exports:

| Export               | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `DataProvider`       | React context provider that manages data state                   |
| `useData`            | Hook to access data context (throws if outside provider)         |
| `useDataOptional`    | Hook to optionally access data context (returns null if outside) |
| `StaticDataProvider` | Built-in in-memory provider for demos/testing                    |

### Custom Data Providers

Implement the `DataProviderInterface` to connect to any data source:

```typescript
// src/providers/core/DataProviderInterface.ts
interface DataProviderInterface {
  sync(options?: SyncOptions): Promise<DataResponse>;
  syncTask(id: string | number, updates: Partial<ITask>): Promise<ITask>;
  createTask(task: Partial<ITask>): Promise<ITask>;
  deleteTask(id: string | number): Promise<void>;
  createLink(link: Partial<ILink>): Promise<ILink>;
  deleteLink(linkId: string | number): Promise<void>;
  reorderTask(
    taskId: string | number,
    targetId: string | number,
    position: 'before' | 'after',
  ): Promise<void>;
  getFilterOptions(): Promise<FilterOptionsData>;
  checkCanEdit(): Promise<boolean>;
  getConfig(): DataProviderConfig;
}
```

See `src/providers/StaticDataProvider.ts` for a reference implementation.

### Themes

Visual themes for the Gantt chart:

```jsx
import {
  Material,
  Willow,
  WillowDark,
  Shadcn,
  ShadcnDark,
} from 'react-gantt-gitlab';

// Apply theme by wrapping your app
<Material>
  <App />
</Material>;
```

| Theme        | Description                       |
| ------------ | --------------------------------- |
| `Material`   | Material Design theme             |
| `Willow`     | Light theme with clean aesthetics |
| `WillowDark` | Dark variant of Willow theme      |
| `Shadcn`     | shadcn/ui compatible light theme  |
| `ShadcnDark` | shadcn/ui compatible dark theme   |

## Features

### Supported Data Sources

- **Azure DevOps** - Demo data included for quick evaluation
- **Custom Providers** - Extensible `DataProviderInterface` for any data source
- **Pluggable Architecture** - Add new backends by implementing the provider contract

<!-- Screenshot placeholder: add a gantt-chart.png to ./assets/ -->

### How to Start

1. Run `npm install` and then `npm run dev`
2. Open the demo in your browser
3. Use the **+Add** button to add a new project configuration
   - Select the data source type
   - Configure credentials (if required by the provider)
   - Test the connection and save
4. The chart will sync and display tasks from the configured data source

### Core Features

- **Project Configuration**
  - Configure base URL and access tokens for your data source
  - Set up holidays and special working days (stored as provider snippets)
- **Filtering**
  - Simple filter panel for tasks and milestones
- **Milestone Management**
  - Create, edit, and delete milestones
  - Click + next to a milestone to add a child issue
- **Issue / Task Management**
  - Create, edit, and delete issues and tasks
  - Click + next to an issue to add a child task
  - Batch creation supported
- **Inline Editing**
  - Double-click a milestone, issue, or task to open the editor
  - Link to the original data source page from the editor
- **Sorting**
  - Drag-and-drop reordering of issues and tasks
  - Ordering syncs back to the data source
- **Timeline Adjustments**
  - Drag timeline bars to adjust milestone, issue, and task dates
- **Task Links**
  - Click the circles on either side of a timeline bar to create links between tasks
  - Delete or modify links from the editor
- **Time Scale**
  - Adjustable time units (day, week, month)
- **Server / Client Filters**
  - Server-side filters reduce data load for large projects
- **Color Rules**
  - Define color rules based on title or label to display colored stripes on timeline bars (up to three colors)
  - Rules are stored in the project configuration
- **Custom Grid Columns**
  - Choose and reorder columns: Issue ID, Start, Due, Assignee, Weight, Workdays, Iteration, Epic, Labels, Order
- **Blueprints (Templates)**
  - Save a milestone with all its issues, tasks, and relationships as a reusable template
  - Auto-prefix issue names and preserve durations
  - Store locally or share via provider snippets
- **Batch Operations**
  - Multi-select tasks (Shift/Ctrl+click), then right-click > Move In to reassign milestone, parent issue, or epic
- **Drag-to-Create**
  - Drag on the timeline to create a new task bar directly
- **Off-screen Indicators**
  - Arrows point to tasks outside the visible area; click to scroll to them

### Known Issues

- Newly created items inside a milestone may take a moment to appear after sync
- Drag-and-drop between milestones / issues is not yet supported

## Kanban View

![Kanban Screenshot](./assets/kanban-view.png)

### Features

- Kanban boards stored as provider snippets
- Board lists support drag-and-drop reordering

## Workload View

![Workload View Screenshot](./assets/workload-view.png)

- Open from the sidebar
- Filter by assignee and labels to visualize workload
- Adjustable time range
- Drag tasks between assignees or label groups
- Enable "Other" in settings to see unassigned work

## Internal API

The following exports are available but are considered internal building blocks. They may change without notice in any release. Only use these if you need deep customization:

- `Gantt` - Low-level Gantt chart component
- `Toolbar` - Toolbar component (rendered by Workspace)
- `Editor` - Task editor modal
- `ContextMenu` - Right-click context menu
- `HeaderMenu` - Grid column header menu
- `SmartTaskContent` - Task content renderer
- `Tooltip` - Tooltip widget
- `KanbanBoard`, `KanbanList`, `KanbanCard` - Kanban sub-components

## Acknowledgements

- This project is based on [SVAR React Gantt](https://svar.dev/react/gantt/)
