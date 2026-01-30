/**
 * Blueprint Service
 *
 * 提供 Blueprint 的建立、套用、工作天計算等核心邏輯。
 */

import type { HolidayEntry } from './GitLabSnippetApi';
import type {
  Blueprint,
  BlueprintItem,
  ApplyBlueprintOptions,
  ApplyBlueprintResult,
} from '../types/blueprint';
import { generateBlueprintId } from '../types/blueprint';
import { removeLinksFromDescription } from '../utils/DescriptionMetadataUtils';

// Gantt ITask type (簡化版，只包含需要的欄位)
interface ITask {
  id: number;
  text: string;
  start?: Date;
  end?: Date;
  details?: string;
  parent?: number;
  labels?: string;
  assigned?: string;
  weight?: number;
  $isMilestone?: boolean;
  $isIssue?: boolean;
  _gitlab?: {
    type?: string;
    iid?: number;
    globalId?: string;
    workItemType?: string;
    startDate?: string;
    dueDate?: string;
    assigneeUsernames?: string; // @username format for Blueprint storage
  };
}

// Gantt ILink type
interface ILink {
  id: number;
  source: number;
  target: number;
  type: string;
}

// === 工作天計算函數 ===

/**
 * 格式化日期為 YYYY-MM-DD 字串
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 標準化日期字串為 YYYY-MM-DD 格式
 * 支援 YYYY-MM-DD 和 YYYY/M/D 格式
 */
function normalizeDateString(dateStr: string): string {
  // 如果已經是 YYYY-MM-DD 格式，直接返回
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // 處理 YYYY/M/D 或 YYYY-M-D 格式
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}

/**
 * 建立假日/補班日的 Set 以加速查詢
 */
function createDateSet(entries: HolidayEntry[]): Set<string> {
  return new Set(entries.map((e) => normalizeDateString(e.date)));
}

/**
 * 檢查某一天是否為工作日
 *
 * @param date - 要檢查的日期
 * @param holidaysSet - 假日 Set
 * @param workdaysSet - 補班日 Set
 * @returns 是否為工作日
 */
export function isWorkday(
  date: Date,
  holidaysSet: Set<string>,
  workdaysSet: Set<string>,
): boolean {
  const dateStr = formatDateToString(date);
  const dayOfWeek = date.getDay();

  // 檢查是否為補班日 (週末但需要上班)
  if (workdaysSet.has(dateStr)) {
    return true;
  }

  // 檢查是否為假日
  if (holidaysSet.has(dateStr)) {
    return false;
  }

  // 檢查是否為週末 (週六=6, 週日=0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  return true;
}

/**
 * 計算兩個日期之間的工作天數
 *
 * @param startDate - 起始日期 (包含)
 * @param endDate - 結束日期 (包含)
 * @param holidays - 假日列表
 * @param workdays - 補班日列表
 * @returns 工作天數
 */
export function calculateWorkdays(
  startDate: Date,
  endDate: Date,
  holidays: HolidayEntry[],
  workdays: HolidayEntry[],
): number {
  const holidaysSet = createDateSet(holidays);
  const workdaysSet = createDateSet(workdays);

  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (isWorkday(current, holidaysSet, workdaysSet)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * 計算從起始日期加上指定工作天數後的日期
 *
 * @param baseDate - 起始日期
 * @param offsetWorkdays - 工作天偏移量 (0 = 同一天)
 * @param holidays - 假日列表
 * @param workdays - 補班日列表
 * @returns 目標日期
 */
export function calculateDateFromOffset(
  baseDate: Date,
  offsetWorkdays: number,
  holidays: HolidayEntry[],
  workdays: HolidayEntry[],
): Date {
  const holidaysSet = createDateSet(holidays);
  const workdaysSet = createDateSet(workdays);

  const result = new Date(baseDate);
  result.setHours(0, 0, 0, 0);

  // offset 為 0 時，找到起始日當天或之後的第一個工作日
  // offset > 0 時，從起始日開始計算 offset 個工作日後的日期
  let workdaysRemaining = offsetWorkdays;

  // 先確保起始日是工作日
  while (!isWorkday(result, holidaysSet, workdaysSet)) {
    result.setDate(result.getDate() + 1);
  }

  // 計算剩餘的工作天
  while (workdaysRemaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isWorkday(result, holidaysSet, workdaysSet)) {
      workdaysRemaining--;
    }
  }

  return result;
}

/**
 * 計算從起始日期加上指定工作天數後的結束日期
 * (start + workdays - 1 個工作天 = end)
 *
 * @param startDate - 起始日期
 * @param workdaysCount - 工作天數
 * @param holidays - 假日列表
 * @param workdays - 補班日列表
 * @returns 結束日期
 */
export function calculateEndDate(
  startDate: Date,
  workdaysCount: number,
  holidays: HolidayEntry[],
  workdays: HolidayEntry[],
): Date {
  // workdays = 1 表示只有當天，offset = 0
  // workdays = 2 表示兩天，offset = 1
  return calculateDateFromOffset(
    startDate,
    workdaysCount - 1,
    holidays,
    workdays,
  );
}

/**
 * 計算某日期相對於基準日期的工作天偏移量
 *
 * @param baseDate - 基準日期
 * @param targetDate - 目標日期
 * @param holidays - 假日列表
 * @param workdays - 補班日列表
 * @returns 工作天偏移量
 */
export function calculateOffset(
  baseDate: Date,
  targetDate: Date,
  holidays: HolidayEntry[],
  workdays: HolidayEntry[],
): number {
  const holidaysSet = createDateSet(holidays);
  const workdaysSet = createDateSet(workdays);

  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  // 如果目標日期早於基準日期，返回負數
  const direction = target >= base ? 1 : -1;
  const start = direction === 1 ? base : target;
  const end = direction === 1 ? target : base;

  let offset = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1); // 從下一天開始計算

  while (current <= end) {
    if (isWorkday(current, holidaysSet, workdaysSet)) {
      offset++;
    }
    current.setDate(current.getDate() + 1);
  }

  return offset * direction;
}

// === Blueprint 建立函數 ===

/**
 * 取得 Milestone 的有效起始日期
 * 如果 Milestone 沒有 start_date，使用最早的 Issue/Task start date
 *
 * @param milestoneTask - Milestone 任務
 * @param childTasks - Milestone 下的所有子任務
 * @returns 有效起始日期，若無法確定則返回 null
 */
export function getMilestoneEffectiveStartDate(
  milestoneTask: ITask,
  childTasks: ITask[],
): Date | null {
  // 優先使用 Milestone 自己的 start date
  if (milestoneTask._gitlab?.startDate) {
    return new Date(milestoneTask._gitlab.startDate);
  }

  if (milestoneTask.start) {
    return new Date(milestoneTask.start);
  }

  // 找出子任務中最早的 start date
  let earliestDate: Date | null = null;

  for (const task of childTasks) {
    if (task.start) {
      const taskStart = new Date(task.start);
      if (!earliestDate || taskStart < earliestDate) {
        earliestDate = taskStart;
      }
    }
  }

  return earliestDate;
}

/**
 * 取得 Milestone 下的所有子任務 (包含巢狀子任務)
 *
 * @param milestoneTask - Milestone 任務
 * @param allTasks - 所有任務
 * @returns 子任務列表
 */
export function getMilestoneChildren(
  milestoneTask: ITask,
  allTasks: ITask[],
): ITask[] {
  const milestoneId = milestoneTask.id;
  const children: ITask[] = [];
  const childIds = new Set<number>();

  // 遞迴收集所有子任務
  function collectChildren(parentId: number) {
    for (const task of allTasks) {
      if (task.parent === parentId && !childIds.has(task.id)) {
        childIds.add(task.id);
        children.push(task);
        // 遞迴收集這個任務的子任務
        collectChildren(task.id);
      }
    }
  }

  collectChildren(milestoneId);

  return children;
}

/**
 * 從 Milestone 建立 Blueprint
 *
 * @param milestoneTask - Milestone 任務
 * @param allTasks - 所有任務
 * @param allLinks - 所有連結
 * @param holidays - 假日列表
 * @param workdays - 補班日列表
 * @param blueprintName - Blueprint 名稱
 * @param storageType - 儲存類型
 * @returns Blueprint
 */
export function createBlueprintFromMilestone(
  milestoneTask: ITask,
  allTasks: ITask[],
  allLinks: ILink[],
  holidays: HolidayEntry[],
  workdays: HolidayEntry[],
  blueprintName: string,
  storageType: 'snippet' | 'localStorage',
): Blueprint {
  // 取得所有子任務
  const childTasks = getMilestoneChildren(milestoneTask, allTasks);

  // 取得有效起始日期
  const effectiveStartDate = getMilestoneEffectiveStartDate(
    milestoneTask,
    childTasks,
  );

  // 計算 Milestone 的工作天數
  let milestoneWorkdays: number | undefined;
  if (effectiveStartDate && milestoneTask.end) {
    milestoneWorkdays = calculateWorkdays(
      effectiveStartDate,
      new Date(milestoneTask.end),
      holidays,
      workdays,
    );
  }

  // 建立子任務的 IID Set (用於過濾 links)
  const childIidSet = new Set<number>();
  for (const task of childTasks) {
    const iid = task._gitlab?.iid ?? task.id;
    childIidSet.add(iid);
  }

  // 建立 Blueprint Items
  const items: BlueprintItem[] = [];

  for (const task of childTasks) {
    const iid = task._gitlab?.iid ?? task.id;
    const issueType: 'Issue' | 'Task' =
      task._gitlab?.workItemType === 'Task' ? 'Task' : 'Issue';

    // 計算日期相關資訊
    let startOffset: number | null = null;
    let taskWorkdays: number | null = null;

    if (effectiveStartDate && task.start) {
      const taskStart = new Date(task.start);
      startOffset = calculateOffset(
        effectiveStartDate,
        taskStart,
        holidays,
        workdays,
      );

      if (task.end) {
        taskWorkdays = calculateWorkdays(
          taskStart,
          new Date(task.end),
          holidays,
          workdays,
        );
      }
    }

    // 解析 labels (從逗號分隔的字串)
    const labels = task.labels
      ? task.labels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean)
      : undefined;

    // 解析 assignees (優先使用 _gitlab.assigneeUsernames 的 @username 格式)
    const assigneeSource = task._gitlab?.assigneeUsernames || task.assigned;
    const assignees = assigneeSource
      ? assigneeSource
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      : undefined;

    // 計算 parent_iid
    let parentIid = 0;
    if (task.parent && task.parent !== milestoneTask.id) {
      // 找到父任務的 IID
      const parentTask = allTasks.find((t) => t.id === task.parent);
      if (parentTask) {
        parentIid = parentTask._gitlab?.iid ?? parentTask.id;
      }
    }

    // 找出相關的 links
    const blocks: number[] = [];
    const blockedBy: number[] = [];

    for (const link of allLinks) {
      // 只處理 blocks 類型的 links
      if (link.source === iid && childIidSet.has(link.target)) {
        blocks.push(link.target);
      }
      if (link.target === iid && childIidSet.has(link.source)) {
        blockedBy.push(link.source);
      }
    }

    items.push({
      iid,
      issue_type: issueType,
      title: task.text,
      description: task.details,
      start_offset: startOffset,
      workdays: taskWorkdays,
      labels: labels?.length ? labels : undefined,
      assignees: assignees?.length ? assignees : undefined,
      weight: task.weight,
      parent_iid: parentIid,
      blocks: blocks.length ? blocks : undefined,
      blocked_by: blockedBy.length ? blockedBy : undefined,
    });
  }

  const now = new Date().toISOString();

  return {
    id: generateBlueprintId(),
    name: blueprintName,
    created_at: now,
    updated_at: now,
    version: 1,
    storage_type: storageType,
    milestone: {
      title: milestoneTask.text,
      description: milestoneTask.details,
      workdays: milestoneWorkdays,
    },
    items,
  };
}

// === Blueprint 預覽函數 ===

/**
 * 取得 Blueprint 的預覽資訊
 */
export function getBlueprintPreview(
  milestoneTask: ITask,
  allTasks: ITask[],
  allLinks: ILink[],
): {
  issueCount: number;
  taskCount: number;
  linkCount: number;
  items: Array<{ title: string; type: 'Issue' | 'Task' }>;
} {
  const childTasks = getMilestoneChildren(milestoneTask, allTasks);

  let issueCount = 0;
  let taskCount = 0;
  const items: Array<{ title: string; type: 'Issue' | 'Task' }> = [];

  // 建立子任務的 IID Set
  const childIidSet = new Set<number>();
  for (const task of childTasks) {
    const iid = task._gitlab?.iid ?? task.id;
    childIidSet.add(iid);

    const type: 'Issue' | 'Task' =
      task._gitlab?.workItemType === 'Task' ? 'Task' : 'Issue';

    if (type === 'Issue') {
      issueCount++;
    } else {
      taskCount++;
    }

    items.push({ title: task.text, type });
  }

  // 計算相關的 links 數量
  let linkCount = 0;
  for (const link of allLinks) {
    if (childIidSet.has(link.source) && childIidSet.has(link.target)) {
      linkCount++;
    }
  }

  return {
    issueCount,
    taskCount,
    linkCount,
    items,
  };
}

// === Blueprint 套用相關類型 (供 ApplyBlueprintModal 使用) ===

/**
 * 取得新 Milestone 的標題
 */
export function getNewMilestoneTitle(
  blueprint: Blueprint,
  options: ApplyBlueprintOptions,
): string {
  if (
    options.milestone_naming.mode === 'custom' &&
    options.milestone_naming.custom_title
  ) {
    return options.milestone_naming.custom_title;
  }

  const prefix = options.milestone_naming.prefix || '';
  return prefix + blueprint.milestone.title;
}

/**
 * 取得新 Item 的標題
 *
 * @param originalTitle - 原始標題
 * @param options - 套用選項
 * @param itemType - 項目類型 ('Issue' 或 'Task')
 */
export function getNewItemTitle(
  originalTitle: string,
  options: ApplyBlueprintOptions,
  itemType?: 'Issue' | 'Task',
): string {
  // 根據 itemType 決定是否加上前綴
  const shouldAddPrefix =
    itemType === 'Task'
      ? options.item_naming.add_task_prefix
      : options.item_naming.add_issue_prefix;

  if (!shouldAddPrefix) {
    return originalTitle;
  }

  const prefix = options.item_naming.prefix || '';
  return prefix + originalTitle;
}

// === Blueprint 套用相關介面 ===

/**
 * GitLab Provider 介面 (套用 Blueprint 所需的方法)
 */
export interface BlueprintProvider {
  createMilestone(milestone: {
    text: string;
    details?: string;
    start?: Date;
    end?: Date;
  }): Promise<{
    id: number;
    _gitlab?: {
      iid?: number;
      globalId?: string;
      webUrl?: string;
    };
  }>;

  createWorkItem(task: {
    text: string;
    details?: string;
    start?: Date;
    end?: Date;
    parent?: number;
    labels?: string;
    assigned?: string;
    weight?: number;
    _gitlab?: {
      milestoneGlobalId?: string;
    };
  }): Promise<{
    id: number;
    _gitlab?: {
      iid?: number;
      globalId?: string;
    };
  }>;

  createIssueLink(link: {
    source: number;
    target: number;
    type: string;
  }): Promise<void>;
}

/**
 * 套用 Blueprint 建立新的 Milestone 和 Issues/Tasks
 *
 * @param blueprint - 要套用的 Blueprint
 * @param options - 套用選項
 * @param provider - GitLab 資料提供者
 * @param holidays - 假日列表
 * @param workdays - 補班日列表
 * @returns 套用結果報告
 */
export async function applyBlueprint(
  blueprint: Blueprint,
  options: ApplyBlueprintOptions,
  provider: BlueprintProvider,
  holidays: HolidayEntry[],
  workdays: HolidayEntry[],
): Promise<ApplyBlueprintResult> {
  const result: ApplyBlueprintResult = {
    success: true,
    created: [],
    failed: [],
    links_created: 0,
    links_failed: 0,
  };

  // 原始 IID -> 新建 IID 的映射表
  const iidMapping = new Map<number, number>();

  // 原始 IID -> 新建 globalId 的映射表 (用於 link)
  const globalIdMapping = new Map<number, string>();

  try {
    // 1. 建立 Milestone
    const milestoneTitle = getNewMilestoneTitle(blueprint, options);

    // 計算 Milestone 結束日期
    let milestoneEndDate: Date | undefined;
    if (blueprint.milestone.workdays) {
      milestoneEndDate = calculateEndDate(
        options.start_date,
        blueprint.milestone.workdays,
        holidays,
        workdays,
      );
    }

    const createdMilestone = await provider.createMilestone({
      text: milestoneTitle,
      details: blueprint.milestone.description,
      start: options.start_date,
      end: milestoneEndDate,
    });

    result.milestone = {
      iid: createdMilestone._gitlab?.iid || 0,
      title: milestoneTitle,
      web_url: createdMilestone._gitlab?.webUrl,
    };

    const milestoneGlobalId = createdMilestone._gitlab?.globalId;

    // 2. 準備建立順序：先建立沒有父層的 Items，再建立有父層的
    // 依照 parent_iid 排序，確保父層先建立
    const sortedItems = [...blueprint.items].sort((a, b) => {
      // parent_iid 為 0 的優先
      if (a.parent_iid === 0 && b.parent_iid !== 0) return -1;
      if (a.parent_iid !== 0 && b.parent_iid === 0) return 1;
      // 如果 a 的 parent_iid 等於 b 的 iid，b 應該先建
      if (a.parent_iid === b.iid) return 1;
      if (b.parent_iid === a.iid) return -1;
      return 0;
    });

    // 進行拓撲排序以確保父層級在子層級之前
    const orderedItems = topologicalSort(sortedItems);

    // 3. 建立 Issues/Tasks
    for (const item of orderedItems) {
      try {
        // 計算日期
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (item.start_offset !== null) {
          startDate = calculateDateFromOffset(
            options.start_date,
            item.start_offset,
            holidays,
            workdays,
          );

          if (item.workdays !== null) {
            endDate = calculateEndDate(
              startDate,
              item.workdays,
              holidays,
              workdays,
            );
          }
        }

        // 取得父層的新 IID (如果有的話)
        let parentIid: number | undefined;
        if (item.parent_iid !== 0) {
          parentIid = iidMapping.get(item.parent_iid);
          // 如果父層建立失敗，跳過此 Item
          if (!parentIid) {
            throw new Error(
              `Parent item (IID: ${item.parent_iid}) was not created`,
            );
          }
        }

        // 準備 Labels
        const labels =
          options.apply_labels && item.labels?.length
            ? item.labels.join(', ')
            : undefined;

        // 準備 Assignees
        const assignees =
          options.apply_assignees && item.assignees?.length
            ? item.assignees.join(', ')
            : undefined;

        // Clean description metadata from original issue
        // Blueprint items may contain GANTT_METADATA from the original issue's description,
        // which references old IIDs. We need to remove it before creating the new issue.
        // Links will be created later via createIssueLink (which may use new metadata fallback).
        const cleanDescription = item.description
          ? removeLinksFromDescription(item.description)
          : undefined;

        // 建立 Work Item
        const createdItem = await provider.createWorkItem({
          text: getNewItemTitle(item.title, options, item.issue_type),
          details: cleanDescription,
          start: startDate,
          end: endDate,
          parent: parentIid,
          labels,
          assigned: assignees,
          weight: item.weight,
          _gitlab: milestoneGlobalId ? { milestoneGlobalId } : undefined,
        });

        // 更新映射表
        const newIid = createdItem._gitlab?.iid || createdItem.id;
        iidMapping.set(item.iid, newIid);

        if (createdItem._gitlab?.globalId) {
          globalIdMapping.set(item.iid, createdItem._gitlab.globalId);
        }

        result.created.push({
          original_iid: item.iid,
          new_iid: newIid,
          title: item.title,
          issue_type: item.issue_type,
        });
      } catch (error) {
        console.error(
          `[BlueprintService] Failed to create item ${item.iid}:`,
          error,
        );
        result.success = false;
        result.failed.push({
          original_iid: item.iid,
          title: item.title,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 4. 建立依賴關係 (Links)
    for (const item of blueprint.items) {
      // 只處理有 blocks 關係的項目
      if (!item.blocks?.length) continue;

      const sourceIid = iidMapping.get(item.iid);
      if (!sourceIid) continue;

      for (const blockedIid of item.blocks) {
        const targetIid = iidMapping.get(blockedIid);
        if (!targetIid) {
          result.links_failed++;
          continue;
        }

        try {
          await provider.createIssueLink({
            source: sourceIid,
            target: targetIid,
            type: 'e2s', // Gantt link type for "blocks"
          });
          result.links_created++;
        } catch (error) {
          console.error(
            `[BlueprintService] Failed to create link ${item.iid} -> ${blockedIid}:`,
            error,
          );
          result.links_failed++;
          result.success = false;
        }
      }
    }
  } catch (error) {
    console.error('[BlueprintService] Failed to apply blueprint:', error);
    result.success = false;

    // 如果 Milestone 建立失敗
    if (!result.milestone) {
      throw error;
    }
  }

  return result;
}

/**
 * 拓撲排序，確保父層在子層之前
 */
function topologicalSort(items: BlueprintItem[]): BlueprintItem[] {
  const sorted: BlueprintItem[] = [];
  const visited = new Set<number>();
  const temp = new Set<number>();

  // 建立 iid -> item 映射
  const itemMap = new Map<number, BlueprintItem>();
  for (const item of items) {
    itemMap.set(item.iid, item);
  }

  function visit(item: BlueprintItem) {
    if (visited.has(item.iid)) return;
    if (temp.has(item.iid)) {
      // 循環依賴，直接返回
      console.warn(
        `[BlueprintService] Circular dependency detected: ${item.iid}`,
      );
      return;
    }

    temp.add(item.iid);

    // 先訪問父層
    if (item.parent_iid !== 0) {
      const parent = itemMap.get(item.parent_iid);
      if (parent && !visited.has(parent.iid)) {
        visit(parent);
      }
    }

    temp.delete(item.iid);
    visited.add(item.iid);
    sorted.push(item);
  }

  for (const item of items) {
    if (!visited.has(item.iid)) {
      visit(item);
    }
  }

  return sorted;
}
