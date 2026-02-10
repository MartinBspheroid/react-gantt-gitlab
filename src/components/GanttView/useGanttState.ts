/**
 * useGanttState Hook
 * Extracted state management from GanttView to reduce component size
 * Handles: UI state (modals, settings), grid configuration, and view settings
 */

import { useState, useCallback, useMemo } from 'react';

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
  const [dateEditable, setDateEditable] = useState(true);

  // === Grid Configuration ===
  const [cellWidth, setCellWidth] = useState(() => {
    const saved = localStorage.getItem('gantt-cell-width');
    return saved ? Number(saved) : 40;
  });

  const [cellWidthDisplay, setCellWidthDisplay] = useState(cellWidth);

  const [cellHeight, setCellHeight] = useState(() => {
    const saved = localStorage.getItem('gantt-cell-height');
    return saved ? Number(saved) : 38;
  });

  const [cellHeightDisplay, setCellHeightDisplay] = useState(cellHeight);

  const handleCellWidthChange = useCallback((value) => {
    setCellWidth(value);
    localStorage.setItem('gantt-cell-width', String(value));
  }, []);

  const handleCellHeightChange = useCallback((value) => {
    setCellHeight(value);
    localStorage.setItem('gantt-cell-height', String(value));
  }, []);

  // === Unit & View Settings ===
  const [lengthUnit, setLengthUnit] = useState(() => {
    const saved = localStorage.getItem('gantt-length-unit');
    return saved || 'day';
  });

  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // === Effective Cell Width (based on unit) ===
  const effectiveCellWidth = useMemo(() => {
    if (lengthUnit === 'custom' || lengthUnit === 'week') {
      return cellWidth;
    }

    if (lengthUnit === 'hour') {
      return 80; // Wider cells for hour view
    }

    if (lengthUnit === '3-hour') {
      return 100;
    }

    if (lengthUnit === '6-hour') {
      return 120;
    }

    if (lengthUnit === '12-hour') {
      return 150;
    }

    return cellWidth;
  }, [cellWidth, lengthUnit]);

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
  };
}
