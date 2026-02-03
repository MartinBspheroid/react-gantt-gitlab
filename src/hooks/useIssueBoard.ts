/**
 * useIssueBoard Hook
 *
 * React hook for managing Issue Board (Kanban) state and CRUD operations.
 * Uses GitLabIssueBoardApi for persistence to GitLab snippets.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  loadIssueBoards,
  saveIssueBoards,
  createBoard as apiCreateBoard,
  updateBoard as apiUpdateBoard,
  deleteBoard as apiDeleteBoard,
} from '../providers/GitLabIssueBoardApi';
import type { GitLabProxyConfig } from '../providers/GitLabApiUtils';
import type { IssueBoard, IssueBoardList } from '../types/issueBoard';

/** Local storage key for last used board ID */
const LAST_BOARD_KEY_PREFIX = 'kanban-last-board';

/** Generate a UUID for list IDs */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface UseIssueBoardOptions {
  /** GitLab REST API proxy config */
  proxyConfig: GitLabProxyConfig | null;
  /** Full path of the project or group */
  fullPath: string;
  /** Whether this is a group (vs project) */
  isGroup?: boolean;
  /** Auto-load boards on mount */
  autoLoad?: boolean;
}

export interface UseIssueBoardReturn {
  // State
  boards: IssueBoard[];
  currentBoard: IssueBoard | null;
  currentBoardId: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;

  // Board operations
  loadBoards: () => Promise<void>;
  createBoard: (board: Omit<IssueBoard, 'id'>) => Promise<IssueBoard | null>;
  updateBoard: (board: IssueBoard) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  selectBoard: (boardId: string | null) => void;

  // List operations (work on currentBoard)
  addList: (list: Omit<IssueBoardList, 'id'>) => Promise<void>;
  updateList: (list: IssueBoardList) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  reorderLists: (listIds: string[]) => Promise<void>;
}

export function useIssueBoard({
  proxyConfig,
  fullPath,
  isGroup = false,
  autoLoad = true,
}: UseIssueBoardOptions): UseIssueBoardReturn {
  const [boards, setBoards] = useState<IssueBoard[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive current board from boards and currentBoardId
  const currentBoard = useMemo(() => {
    return boards.find((b) => b.id === currentBoardId) || null;
  }, [boards, currentBoardId]);

  // Config type for API calls
  const configType = isGroup ? 'group' : 'project';

  // Local storage key for this project/group
  const lastBoardKey = `${LAST_BOARD_KEY_PREFIX}-${fullPath}`;

  /**
   * Load boards from GitLab snippet
   */
  const loadBoards = useCallback(async () => {
    if (!proxyConfig || !fullPath) {
      console.log('[useIssueBoard] No proxy config or fullPath, skipping load');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loadedBoards = await loadIssueBoards(
        fullPath,
        proxyConfig,
        configType,
      );
      setBoards(loadedBoards);

      // Restore last used board from local storage
      const lastBoardId = localStorage.getItem(lastBoardKey);
      if (lastBoardId && loadedBoards.some((b) => b.id === lastBoardId)) {
        setCurrentBoardId(lastBoardId);
      } else if (loadedBoards.length > 0) {
        // Default to first board
        setCurrentBoardId(loadedBoards[0].id);
      } else {
        setCurrentBoardId(null);
      }

      console.log('[useIssueBoard] Loaded boards:', loadedBoards.length);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load boards';
      console.error('[useIssueBoard] Load error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [proxyConfig, fullPath, configType, lastBoardKey]);

  /**
   * Select a board by ID
   */
  const selectBoard = useCallback(
    (boardId: string | null) => {
      setCurrentBoardId(boardId);
      if (boardId) {
        localStorage.setItem(lastBoardKey, boardId);
      } else {
        localStorage.removeItem(lastBoardKey);
      }
    },
    [lastBoardKey],
  );

  /**
   * Create a new board
   */
  const createBoard = useCallback(
    async (boardData: Omit<IssueBoard, 'id'>): Promise<IssueBoard | null> => {
      if (!proxyConfig || !fullPath) {
        setError('No proxy config');
        return null;
      }

      setSaving(true);
      setError(null);

      try {
        const newBoard = await apiCreateBoard(
          fullPath,
          boardData,
          proxyConfig,
          configType,
        );

        // Update local state
        setBoards((prev) => [...prev, newBoard]);
        selectBoard(newBoard.id);

        console.log('[useIssueBoard] Created board:', newBoard.id);
        return newBoard;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create board';
        console.error('[useIssueBoard] Create error:', err);
        setError(message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [proxyConfig, fullPath, configType, selectBoard],
  );

  /**
   * Update an existing board (optimistic update)
   * UI updates immediately, API call happens in background
   */
  const updateBoard = useCallback(
    async (board: IssueBoard): Promise<void> => {
      if (!proxyConfig || !fullPath) {
        setError('No proxy config');
        return;
      }

      // Capture previous state for rollback
      const previousBoards = boards;

      // Optimistic update: update local state immediately
      setBoards((prev) => prev.map((b) => (b.id === board.id ? board : b)));
      console.log('[useIssueBoard] Optimistic update board:', board.id);

      // Save to API in background (don't await, don't block UI)
      setSaving(true);
      setError(null);

      apiUpdateBoard(fullPath, board, proxyConfig, configType)
        .then(() => {
          console.log('[useIssueBoard] Board saved to API:', board.id);
        })
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : 'Failed to update board';
          console.error('[useIssueBoard] Update error, rolling back:', err);
          // Rollback on failure
          setBoards(previousBoards);
          setError(message);
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [proxyConfig, fullPath, configType, boards],
  );

  /**
   * Delete a board
   */
  const deleteBoard = useCallback(
    async (boardId: string): Promise<void> => {
      if (!proxyConfig || !fullPath) {
        setError('No proxy config');
        return;
      }

      setSaving(true);
      setError(null);

      try {
        await apiDeleteBoard(fullPath, boardId, proxyConfig, configType);

        // Update local state
        setBoards((prev) => {
          const filtered = prev.filter((b) => b.id !== boardId);

          // If we deleted the current board, select another
          if (currentBoardId === boardId) {
            if (filtered.length > 0) {
              selectBoard(filtered[0].id);
            } else {
              selectBoard(null);
            }
          }

          return filtered;
        });

        console.log('[useIssueBoard] Deleted board:', boardId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete board';
        console.error('[useIssueBoard] Delete error:', err);
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [proxyConfig, fullPath, configType, currentBoardId, selectBoard],
  );

  /**
   * Add a new list to the current board
   */
  const addList = useCallback(
    async (listData: Omit<IssueBoardList, 'id'>): Promise<void> => {
      if (!currentBoard) {
        setError('No board selected');
        return;
      }

      const newList: IssueBoardList = {
        ...listData,
        id: generateUUID(),
      };

      const updatedBoard: IssueBoard = {
        ...currentBoard,
        lists: [...currentBoard.lists, newList],
      };

      await updateBoard(updatedBoard);
    },
    [currentBoard, updateBoard],
  );

  /**
   * Update an existing list in the current board
   */
  const updateList = useCallback(
    async (list: IssueBoardList): Promise<void> => {
      if (!currentBoard) {
        setError('No board selected');
        return;
      }

      const updatedBoard: IssueBoard = {
        ...currentBoard,
        lists: currentBoard.lists.map((l) => (l.id === list.id ? list : l)),
      };

      await updateBoard(updatedBoard);
    },
    [currentBoard, updateBoard],
  );

  /**
   * Delete a list from the current board
   */
  const deleteList = useCallback(
    async (listId: string): Promise<void> => {
      if (!currentBoard) {
        setError('No board selected');
        return;
      }

      const updatedBoard: IssueBoard = {
        ...currentBoard,
        lists: currentBoard.lists.filter((l) => l.id !== listId),
      };

      await updateBoard(updatedBoard);
    },
    [currentBoard, updateBoard],
  );

  /**
   * Reorder lists in the current board
   */
  const reorderLists = useCallback(
    async (listIds: string[]): Promise<void> => {
      if (!currentBoard) {
        setError('No board selected');
        return;
      }

      // Reorder lists based on the new order of IDs
      const reorderedLists = listIds
        .map((id) => currentBoard.lists.find((l) => l.id === id))
        .filter((l): l is IssueBoardList => l !== undefined);

      const updatedBoard: IssueBoard = {
        ...currentBoard,
        lists: reorderedLists,
      };

      await updateBoard(updatedBoard);
    },
    [currentBoard, updateBoard],
  );

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && proxyConfig && fullPath) {
      loadBoards();
    }
  }, [autoLoad, proxyConfig, fullPath, loadBoards]);

  return {
    // State
    boards,
    currentBoard,
    currentBoardId,
    loading,
    saving,
    error,

    // Board operations
    loadBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    selectBoard,

    // List operations
    addList,
    updateList,
    deleteList,
    reorderLists,
  };
}
