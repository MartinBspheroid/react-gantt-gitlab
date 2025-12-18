/**
 * useCellDimensions Hook
 * Manages cell width, height, and length unit settings with localStorage persistence
 * Extracted from GitLabGantt for reuse in WorkloadView
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

export interface UseCellDimensionsReturn {
  cellWidth: number;
  cellWidthDisplay: number;
  handleCellWidthChange: (value: number) => void;
  cellHeight: number;
  cellHeightDisplay: number;
  handleCellHeightChange: (value: number) => void;
  lengthUnit: string;
  setLengthUnit: (unit: string) => void;
  effectiveCellWidth: number;
}

export function useCellDimensions(
  storagePrefix: string,
): UseCellDimensionsReturn {
  // Load settings from localStorage with defaults
  const [cellWidth, setCellWidth] = useState(() => {
    const saved = localStorage.getItem(`${storagePrefix}-cell-width`);
    return saved ? Number(saved) : 40;
  });

  // Display value for slider (updates immediately for smooth UX)
  const [cellWidthDisplay, setCellWidthDisplay] = useState(cellWidth);
  const cellWidthTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [cellHeight, setCellHeight] = useState(() => {
    const saved = localStorage.getItem(`${storagePrefix}-cell-height`);
    return saved ? Number(saved) : 38;
  });

  // Display value for slider (updates immediately for smooth UX)
  const [cellHeightDisplay, setCellHeightDisplay] = useState(cellHeight);
  const cellHeightTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [lengthUnit, setLengthUnit] = useState(() => {
    const saved = localStorage.getItem(`${storagePrefix}-length-unit`);
    return saved || 'day';
  });

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

  // Save cell width to localStorage
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-cell-width`, cellWidth.toString());
  }, [storagePrefix, cellWidth]);

  // Save cell height to localStorage
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-cell-height`, cellHeight.toString());
  }, [storagePrefix, cellHeight]);

  // Save length unit to localStorage
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}-length-unit`, lengthUnit);
  }, [storagePrefix, lengthUnit]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (cellWidthTimerRef.current) {
        clearTimeout(cellWidthTimerRef.current);
      }
      if (cellHeightTimerRef.current) {
        clearTimeout(cellHeightTimerRef.current);
      }
    };
  }, []);

  return {
    cellWidth,
    cellWidthDisplay,
    handleCellWidthChange,
    cellHeight,
    cellHeightDisplay,
    handleCellHeightChange,
    lengthUnit,
    setLengthUnit,
    effectiveCellWidth,
  };
}
