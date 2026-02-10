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

export {
  defaultEditorItems,
  defaultToolbarButtons,
  defaultMenuOptions,
  defaultColumns,
  defaultTaskTypes,
  registerScaleUnit,
} from '@svar-ui/gantt-store';

export { registerEditorItem } from '@svar-ui/react-editor';

export {
  Gantt,
  Fullscreen,
  ContextMenu,
  HeaderMenu,
  Toolbar,
  Tooltip,
  Editor,
  SmartTaskContent,
  Material,
  Willow,
  WillowDark,
};

// Credential management (shared-credentials feature)
export {
  gitlabCredentialManager,
  GitLabCredentialManager,
} from './config/DataSourceCredentialManager';
export { CredentialManager } from './components/CredentialManager';
export { ProjectBrowser } from './components/ProjectBrowser';

// Workspace (new entry point for shared data layer)
export { Workspace } from './components/Workspace';
export { GanttView } from './components/GanttView';

// Context exports
export { DataProvider, useData, useDataOptional } from './contexts/DataContext';

// KanbanView exports
export {
  KanbanView,
  KanbanBoard,
  KanbanList,
  KanbanCard,
} from './components/KanbanView';

// Backward compatibility: GitLabGantt now wraps Workspace
export { GitLabGantt } from './components/GanttChart.jsx';
