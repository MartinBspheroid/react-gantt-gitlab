/**
 * Issue Board (Kanban) Type Definitions
 */

/** 單一 Kanban List 的定義 */
export interface IssueBoardList {
  /** UUID */
  id: string;
  /** 顯示名稱 */
  name: string;
  /** 篩選的 label 名稱（AND 邏輯：issue 必須包含所有 labels） */
  labels: string[];
  /** 排序欄位 */
  sortBy: 'position' | 'due_date' | 'created_at' | 'label_priority' | 'id';
  /** 排序順序 */
  sortOrder: 'asc' | 'desc';
}

/** Issue Board 定義 */
export interface IssueBoard {
  /** UUID */
  id: string;
  /** Board 名稱 */
  name: string;
  /** List 定義（順序即為顯示順序） */
  lists: IssueBoardList[];
  /** 是否顯示 Others list（未分類的 issues） */
  showOthers: boolean;
  /** 是否顯示 Closed list（已關閉的 issues） */
  showClosed: boolean;
  /** 預留擴充的 metadata */
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    [key: string]: unknown;
  };
}

/** Snippet 儲存格式 */
export interface IssueBoardStorage {
  version: 1;
  boards: IssueBoard[];
}

/** 預設 Board 模板 */
export const DEFAULT_BOARD_TEMPLATES = {
  kanban: {
    name: 'To Do / In Progress / Done',
    lists: [
      { name: 'To Do', labels: ['todo'], sortBy: 'position', sortOrder: 'asc' },
      {
        name: 'In Progress',
        labels: ['doing'],
        sortBy: 'position',
        sortOrder: 'asc',
      },
      { name: 'Done', labels: ['done'], sortBy: 'position', sortOrder: 'asc' },
    ],
  },
  bugTriage: {
    name: 'Bug Triage',
    lists: [
      { name: 'New', labels: ['bug'], sortBy: 'created_at', sortOrder: 'desc' },
      {
        name: 'Confirmed',
        labels: ['bug', 'confirmed'],
        sortBy: 'label_priority',
        sortOrder: 'asc',
      },
      {
        name: 'In Progress',
        labels: ['bug', 'doing'],
        sortBy: 'due_date',
        sortOrder: 'asc',
      },
    ],
  },
} as const;
