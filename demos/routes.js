import BasicInit from './cases/BasicInit.tsx';
import GanttProvider from './cases/GanttProvider.tsx';
import GanttBatchProvider from './cases/GanttBatchProvider.tsx';
import GanttBackend from './cases/GanttBackend.tsx';
import GanttScales from './cases/GanttScales.tsx';
import GanttGrid from './cases/GanttGrid.tsx';
import GanttNoGrid from './cases/GanttNoGrid.tsx';
import GanttFixedColumns from './cases/GanttFixedColumns.tsx';
import GanttFlexColumns from './cases/GanttFlexColumns.tsx';
import GanttReadOnly from './cases/GanttReadOnly.tsx';
import GanttPreventActions from './cases/GanttPreventActions.tsx';
import GanttForm from './cases/GanttForm.tsx';
import GanttSizes from './cases/GanttSizes.tsx';
import GanttMultiple from './cases/GanttMultiple.tsx';
import GanttPerformance from './cases/GanttPerformance.tsx';

import GanttTooltips from './cases/GanttTooltips.tsx';
import GanttToolbar from './cases/GanttToolbar.tsx';
import GanttToolbarCustom from './cases/GanttToolbarCustom.tsx';
import GanttToolbarButtons from './cases/GanttToolbarButtons.tsx';
import GanttText from './cases/GanttText.tsx';
import GanttLocale from './cases/GanttLocale.tsx';
import GanttStartEnd from './cases/GanttStartEnd.tsx';
import GanttFullscreen from './cases/GanttFullscreen.tsx';
import GanttZoom from './cases/GanttZoom.tsx';
import GanttCustomZoom from './cases/GanttCustomZoom.tsx';
import GanttLengthUnit from './cases/GanttLengthUnit.tsx';
import GanttTaskTypes from './cases/GanttTaskTypes.tsx';
import ChartCellBorders from './cases/ChartBorders.tsx';
import ContextMenu from './cases/ContextMenu.tsx';
import ContextMenuHandler from './cases/ContextMenuHandler.tsx';
import ContextMenuOptions from './cases/ContextMenuOptions.tsx';
import GanttHolidays from './cases/GanttHolidays.tsx';
import GanttWorkingDays from './cases/GanttWorkingDays.tsx';
import GanttSort from './cases/GanttSort.tsx';
import GanttCustomSort from './cases/GanttCustomSort.tsx';
import GanttSummariesProgress from './cases/GanttSummariesProgress.tsx';
import GanttSummariesNoDrag from './cases/GanttSummariesNoDrag.tsx';
import GanttSummariesConvert from './cases/GanttSummariesConvert.tsx';
import GanttEditor from './cases/GanttEditor.tsx';
import GanttEditorConfig from './cases/GanttEditorConfig.tsx';
import GanttEditorCustomControls from './cases/GanttEditorCustomControls.tsx';
import GanttEditorComments from './cases/GanttEditorComments.tsx';
import GanttEditorTasks from './cases/GanttEditorTasks.tsx';
import GanttScaleUnit from './cases/GanttScaleUnit.tsx';
import GanttDurationUnitHour from './cases/GanttDurationUnitHour.tsx';
import GanttDurationUnitChanges from './cases/GanttDurationUnitChanges.tsx';
import GanttMinScaleUnit from './cases/GanttMinScaleUnit.tsx';
import HeaderMenu from './cases/GridHeaderMenu.tsx';
import GridInlineEditors from './cases/GridInlineEditors.tsx';
import GanttEditorReadonly from './cases/GanttEditorReadonly.tsx';
import GanttEditorValidation from './cases/GanttEditorValidation.tsx';
import AzureDevOpsPortfolio from './cases/AzureDevOpsPortfolio.tsx';
import WorkloadViewDemo from './cases/WorkloadView.tsx';
import GanttProjectBoundaries from './cases/GanttProjectBoundaries.tsx';
import GanttRowGrouping from './cases/GanttRowGrouping.tsx';
import GanttBaselines from './cases/GanttBaselines.tsx';
import ShadcnVisualVerification from './cases/ShadcnVisualVerification.tsx';
import GanttColorRules from './cases/GanttColorRules.tsx';
import GanttTimelineMarkers from './cases/GanttTimelineMarkers.tsx';

export const links = [
  [
    '/azure-portfolio/:skin',
    'Azure DevOps Portfolio',
    AzureDevOpsPortfolio,
    'AzureDevOpsPortfolio',
  ],
  ['/workload/:skin', 'Workload View', WorkloadViewDemo, 'WorkloadView'],
  ['/grouping/:skin', 'Row Grouping', GanttRowGrouping, 'GanttRowGrouping'],
  [
    '/boundaries/:skin',
    'Project Boundaries',
    GanttProjectBoundaries,
    'GanttProjectBoundaries',
  ],
  [
    '/baselines/:skin',
    'Baselines Visualization',
    GanttBaselines,
    'GanttBaselines',
  ],
  [
    '/shadcn-visual/:skin',
    'Shadcn Visual Verification',
    ShadcnVisualVerification,
    'ShadcnVisualVerification',
  ],
  ['/color-rules/:skin', 'Color Rules', GanttColorRules, 'GanttColorRules'],
  [
    '/timeline-markers/:skin',
    'Timeline Markers',
    GanttTimelineMarkers,
    'GanttTimelineMarkers',
  ],
  ['Demos', null, null, null],
  ['/base/:skin', 'Basic Gantt', BasicInit, 'BasicInit'],

  ['/sizes/:skin', 'Scale / cell sizes', GanttSizes, 'GanttSizes'],
  [
    '/cell-borders/:skin',
    'Chart cell borders',
    ChartCellBorders,
    'ChartBorders',
  ],
  ['/scales/:skin', 'Custom scales', GanttScales, 'GanttScales'],
  ['/start-end/:skin', 'Start/end dates', GanttStartEnd, 'GanttStartEnd'],
  [
    '/custom-scale/:skin',
    'Custom scale unit',
    GanttScaleUnit,
    'GanttScaleUnit',
  ],
  [
    '/custom-min-scale/:skin',
    'Custom minimal scale unit',
    GanttMinScaleUnit,
    'GanttMinScaleUnit',
  ],

  ['/holidays/:skin', 'Holidays', GanttHolidays, 'GanttHolidays'],
  [
    '/working-days/:skin',
    'Working Days Calendar',
    GanttWorkingDays,
    'GanttWorkingDays',
  ],

  ['/templates/:skin', 'Custom text', GanttText, 'GanttText'],
  ['/tooltips/:skin', 'Tooltips', GanttTooltips, 'GanttTooltips'],

  ['/task-types/:skin', 'Task types', GanttTaskTypes, 'GanttTaskTypes'],
  [
    '/summary-progress/:skin',
    'Summary tasks with auto progress',
    GanttSummariesProgress,
    'GanttSummariesProgress',
  ],
  [
    '/summary-no-drag/:skin',
    'No drag for summary tasks',
    GanttSummariesNoDrag,
    'GanttSummariesNoDrag',
  ],
  [
    '/summary-convert/:skin',
    'Auto convert to summary tasks',
    GanttSummariesConvert,
    'GanttSummariesConvert',
  ],

  ['/zoom/:skin', 'Zoom', GanttZoom, 'GanttZoom'],
  ['/custom-zoom/:skin', 'Custom Zoom', GanttCustomZoom, 'GanttCustomZoom'],
  [
    '/length-unit/:skin',
    'Length unit (rounding)',
    GanttLengthUnit,
    'GanttLengthUnit',
  ],
  [
    '/duration-unit/:skin',
    'Duration unit: hour',
    GanttDurationUnitHour,
    'GanttDurationUnitHour',
  ],
  [
    '/duration-changes/:skin',
    'Duration unit: changes',
    GanttDurationUnitChanges,
    'GanttDurationUnitChanges',
  ],
  ['/no-grid/:skin', 'No grid', GanttNoGrid, 'GanttNoGrid'],
  [
    '/grid-fill-space-columns/:skin',
    'Flexible grid columns',
    GanttFlexColumns,
    'GanttFlexColumns',
  ],
  [
    '/grid-fixed-columns/:skin',
    'Fixed grid columns',
    GanttFixedColumns,
    'GanttFixedColumns',
  ],
  ['/grid-custom-columns/:skin', 'Custom grid columns', GanttGrid, 'GanttGrid'],
  [
    '/grid-inline-editors/:skin',
    'Grid inline editors',
    GridInlineEditors,
    'GridInlineEditors',
  ],

  ['/toolbar/:skin', 'Toolbar', GanttToolbar, 'GanttToolbar'],
  [
    '/toolbar-buttons/:skin',
    'Toolbar: limited buttons',
    GanttToolbarButtons,
    'GanttToolbarButtons',
  ],
  [
    '/toolbar-custom/:skin',
    'Toolbar: custom buttons',
    GanttToolbarCustom,
    'GanttToolbarCustom',
  ],
  ['/context-menu/:skin', 'Context menu', ContextMenu, 'ContextMenu'],
  [
    '/menu-handler/:skin',
    'Context menu: limiting options',
    ContextMenuHandler,
    'ContextMenuHandler',
  ],
  [
    '/menu-options/:skin',
    'Context menu: custom options',
    ContextMenuOptions,
    'ContextMenuOptions',
  ],
  [
    '/header-menu/:skin',
    'Header menu: hiding columns',
    HeaderMenu,
    'GridHeaderMenu',
  ],
  ['/custom-edit-form/:skin', 'Custom editor', GanttForm, 'GanttForm'],
  ['/locale/:skin', 'Locales', GanttLocale, 'GanttLocale'],
  ['/fullscreen/:skin', 'Fullscreen', GanttFullscreen, 'GanttFullscreen'],
  ['/readonly/:skin', 'Readonly mode', GanttReadOnly, 'GanttReadOnly'],

  [
    '/prevent-actions/:skin',
    'Preventing actions',
    GanttPreventActions,
    'GanttPreventActions',
  ],
  [
    '/gantt-multiple/:skin',
    'Many Gantts per page',
    GanttMultiple,
    'GanttMultiple',
  ],
  ['/performance/:skin', 'Performance', GanttPerformance, 'GanttPerformance'],

  ['/sorting/:skin', 'Custom sorting', GanttSort, 'GanttSort'],
  ['/sorting-api/:skin', 'Sort by API', GanttCustomSort, 'GanttCustomSort'],

  ['/backend/:skin', 'Backend data', GanttBackend, 'GanttBackend'],
  [
    '/backend-provider/:skin',
    'Saving to backend',
    GanttProvider,
    'GanttProvider',
  ],
  [
    '/backend-provider-batch/:skin',
    'Saving to backend (batch)',
    GanttBatchProvider,
    'GanttBatchProvider',
  ],
  ['/editor/:skin', 'Editor', GanttEditor, 'GanttEditor'],
  [
    '/editor-config/:skin',
    'Editor: custom settings',
    GanttEditorConfig,
    'GanttEditorConfig',
  ],
  [
    '/editor-custom-controls/:skin',
    'Editor: custom controls',
    GanttEditorCustomControls,
    'GanttEditorCustomControls',
  ],
  [
    '/editor-comments/:skin',
    'Editor: custom comments',
    GanttEditorComments,
    'GanttEditorComments',
  ],
  [
    '/editor-tasks/:skin',
    'Editor: custom tasks',
    GanttEditorTasks,
    'GanttEditorTasks',
  ],
  [
    '/editor-readonly/:skin',
    'Editor: readonly',
    GanttEditorReadonly,
    'GanttEditorReadonly',
  ],
  [
    '/editor-validation/:skin',
    'Editor: validation',
    GanttEditorValidation,
    'GanttEditorValidation',
  ],
];
