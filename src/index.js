import Gantt from './components/Gantt.jsx';
import Fullscreen from './components/Fullscreen.jsx';
import Toolbar from './components/Toolbar.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import Editor from './components/Editor.jsx';
import HeaderMenu from './components/grid/HeaderMenu.jsx';
import SmartTaskContent from './components/SmartTaskContent.jsx';

import Tooltip from './widgets/Tooltip.jsx';

import Material from './themes/Material.jsx';
import Willow from './themes/Willow.jsx';
import WillowDark from './themes/WillowDark.jsx';
import Shadcn from './themes/Shadcn.jsx';
import ShadcnDark from './themes/ShadcnDark.jsx';

export {
  defaultEditorItems,
  defaultToolbarButtons,
  defaultMenuOptions,
  defaultColumns,
  defaultTaskTypes,
  registerScaleUnit,
} from '@svar-ui/gantt-store';

export { registerEditorItem } from '@svar-ui/react-editor';

/**
 * ============================================================================
 * PUBLIC API - Stable exports for consumers
 * ============================================================================
 *
 * These exports are the primary integration points for using react-gantt-gitlab.
 * They are stable and documented. Internal components may change without notice.
 *
 * Core Pattern:
 *   import { Workspace, DataProvider, GanttView, StaticDataProvider } from 'react-gantt-gitlab';
 *
 *   <DataProvider provider={myProvider}>
 *     <Workspace>
 *       <GanttView />
 *     </Workspace>
 *   </DataProvider>
 */

/**
 * Core Components (Public API)
 *
 * These are the main components for building Gantt chart applications.
 */

/** Workspace - Main layout container with sidebar, toolbar, and content area */
export { Workspace } from './components/Workspace';

/** GanttView - The main Gantt chart view component */
export { GanttView } from './components/GanttView';

/** KanbanView - Kanban board view for task management */
export { KanbanView } from './components/KanbanView';

/**
 * Data Layer (Public API)
 *
 * These provide the data context and hooks for connecting to data sources.
 */

/** DataProvider - React context provider for data operations */
export { DataProvider, useData, useDataOptional } from './contexts/DataContext';

/** StaticDataProvider - In-memory provider for demos and testing */
export { StaticDataProvider } from './providers/StaticDataProvider';

/**
 * Themes (Public API)
 *
 * Visual themes for the Gantt chart.
 */
export { Material, Willow, WillowDark, Shadcn, ShadcnDark };

/**
 * ============================================================================
 * INTERNAL EXPORTS - Subject to change without notice
 * ============================================================================
 *
 * These exports are internal building blocks. They may change in any release.
 * Only use these if you need deep customization and are prepared for breaking
 * changes.
 */

/** @internal Low-level Gantt chart component (use GanttView instead) */
export { Gantt };

/** @internal Fullscreen wrapper component */
export { Fullscreen };

/** @internal Toolbar component (rendered by Workspace) */
export { Toolbar };

/** @internal Context menu component */
export { ContextMenu };

/** @internal Header menu for grid columns */
export { HeaderMenu };

/** @internal Task editor modal component */
export { Editor };

/** @internal Smart task content renderer */
export { SmartTaskContent };

/** @internal Tooltip widget */
export { Tooltip };

/**
 * ============================================================================
 * TYPE EXPORTS
 * ============================================================================
 */

/** @internal Kanban sub-components (use KanbanView instead) */
export { KanbanBoard, KanbanList, KanbanCard } from './components/KanbanView';
