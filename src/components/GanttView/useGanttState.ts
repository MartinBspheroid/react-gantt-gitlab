/**
 * useGanttState Hook
 * Extracted state management from GanttView to reduce component size
 * Handles: UI state (modals, settings), grid configuration, and view settings
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

export function useGanttState() {
  // === UI State ===
  const [api, setApi] = useState(null);
  const [internalShowSettings, setInternalShowSettings] = useState(false);
  const [internalShowViewOptions, setInternalShowViewOptions] = useState(false);

  // === Modal State ===
  const [showMoveInModal, setShowMoveInModal] = useState(false);
  const [moveInProcessing, setMoveInProcessing] = useState(false);
  const [showSaveBlueprintModal, setShowSaveBlueprintModal] = useState(false);
  const [showApplyBlueprintModal, setShowApplyBlueprintModal] = useState(false);
  const [showBlueprintManager, setShowBlueprintManager] = useState(false);
  const [selectedMilestoneForBlueprint, setSelectedMilestoneForBlueprint] =
    useState(null);

  // === Create/Delete Dialog State ===
  const [createItemDialogOpen, setCreateItemDialogOpen] = useState(false);
  const [createItemDialogType, setCreateItemDialogType] = useState('milestone');
  const [createItemDialogContext, setCreateItemDialogContext] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogItems, setDeleteDialogItems] = useState([]);
  const [discardChangesDialogOpen, setDiscardChangesDialogOpen] =
    useState(false);

  // === Edit State ===
  // NOTE: setDateEditable is not used yet but kept for future feature to toggle date editing
  const [dateEditable, setDateEditable] = useState(true);

  // === Grid Configuration ===
  const [cellWidth, setCellWidth] = useState(() => {
    const saved = localStorage.getItem('gantt-cell-width');
    return saved ? Number(saved) : 40;
  });

  // Display value for slider (updates immediately for smooth UX)
  const [cellWidthDisplay, setCellWidthDisplay] = useState(cellWidth);
  const cellWidthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cellHeight, setCellHeight] = useState(() => {
    const saved = localStorage.getItem('gantt-cell-height');
    return saved ? Number(saved) : 38;
  });

  // Display value for slider (updates immediately for smooth UX)
  const [cellHeightDisplay, setCellHeightDisplay] = useState(cellHeight);
  const cellHeightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced cell width update to reduce re-renders
  const handleCellWidthChange = useCallback((value: number) => {
    setCellWidthDisplay(value);
    if (cellWidthTimerRef.current) {
      clearTimeout(cellWidthTimerRef.current);
    }
    cellWidthTimerRef.current = setTimeout(() => {
      setCellWidth(value);
    }, 100);
  }, []);

  // Debounced cell height update to reduce re-renders
  const handleCellHeightChange = useCallback((value: number) => {
    setCellHeightDisplay(value);
    if (cellHeightTimerRef.current) {
      clearTimeout(cellHeightTimerRef.current);
    }
    cellHeightTimerRef.current = setTimeout(() => {
      setCellHeight(value);
    }, 100);
  }, []);

  // === Unit & View Settings ===
  const [lengthUnit, setLengthUnit] = useState(() => {
    const saved = localStorage.getItem('gantt-length-unit');
    return saved || 'day';
  });

  // Show/hide column settings panel
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // === Grouping State ===
  const [groupBy, setGroupBy] = useState(() => {
    const saved = localStorage.getItem('gantt-group-by');
    return saved || 'none';
  });

  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    const saved = localStorage.getItem('gantt-collapsed-groups');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // === Effective Cell Width (based on unit) ===
  // Calculate effective cellWidth based on lengthUnit
  const effectiveCellWidth = useMemo(() => {
    if (lengthUnit === 'day') {
      // Only in 'day' mode, use user-controlled cellWidth
      return cellWidth;
    }
    // For other units, use fixed defaults
    switch (lengthUnit) {
      case 'hour':
        return 80; // Wider cells for hour view to reduce total count
      case 'week':
        return 100;
      case 'month':
        return 120;
      case 'quarter':
        return 150;
      default:
        return cellWidth;
    }
  }, [lengthUnit, cellWidth]);

  // === Persist to localStorage ===
  // Save cell width to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-cell-width', cellWidth.toString());
  }, [cellWidth]);

  // Save cell height to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-cell-height', cellHeight.toString());
  }, [cellHeight]);

  // Save length unit to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-length-unit', lengthUnit);
  }, [lengthUnit]);

  // Save grouping state to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-group-by', groupBy);
  }, [groupBy]);

  // Save collapsed groups to localStorage
  useEffect(() => {
    localStorage.setItem(
      'gantt-collapsed-groups',
      JSON.stringify(Array.from(collapsedGroups)),
    );
  }, [collapsedGroups]);

  // Toggle group collapse
  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  return {
    // UI State
    api,
    setApi,
    internalShowSettings,
    setInternalShowSettings,
    internalShowViewOptions,
    setInternalShowViewOptions,

    // Modals
    showMoveInModal,
    setShowMoveInModal,
    moveInProcessing,
    setMoveInProcessing,
    showSaveBlueprintModal,
    setShowSaveBlueprintModal,
    showApplyBlueprintModal,
    setShowApplyBlueprintModal,
    showBlueprintManager,
    setShowBlueprintManager,
    selectedMilestoneForBlueprint,
    setSelectedMilestoneForBlueprint,

    // Create/Delete Dialogs
    createItemDialogOpen,
    setCreateItemDialogOpen,
    createItemDialogType,
    setCreateItemDialogType,
    createItemDialogContext,
    setCreateItemDialogContext,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteDialogItems,
    setDeleteDialogItems,
    discardChangesDialogOpen,
    setDiscardChangesDialogOpen,

    // Edit State
    dateEditable,
    setDateEditable,

    // Grid Config
    cellWidth,
    setCellWidth,
    cellWidthDisplay,
    setCellWidthDisplay,
    cellHeight,
    setCellHeight,
    cellHeightDisplay,
    setCellHeightDisplay,
    handleCellWidthChange,
    handleCellHeightChange,

    // Unit & View
    lengthUnit,
    setLengthUnit,
    showColumnSettings,
    setShowColumnSettings,
    effectiveCellWidth,

    // Grouping
    groupBy,
    setGroupBy,
    collapsedGroups,
    setCollapsedGroups,
    toggleGroupCollapse,
  };
}
