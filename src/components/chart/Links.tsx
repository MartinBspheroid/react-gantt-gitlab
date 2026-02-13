// @ts-nocheck
import { useContext, useMemo } from 'react';
import storeContext from '../../context';
import { useStore } from '@svar-ui/lib-react';
import './Links.css';

/**
 * ====================================================================
 * Library Hardcoded Constants (@svar-ui/gantt-store)
 * ====================================================================
 * 來源：node_modules/@svar-ui/gantt-store/dist/index.js
 * 注意：如果 library 更新這些值，這裡也需要同步更新
 */

/** `const gt = 20` - link 水平偏移距離上限 */
const LIBRARY_LINK_OFFSET_MAX = 20;

/** `u = s ? e.$y - 7 : e.$y` - baseline 啟用時的 Y 座標偏移 */
const LIBRARY_BASELINE_Y_OFFSET = 7;

/** `const r = Math.round(a / 2) - 3` - bar 中心垂直位置的微調值 */
const LIBRARY_BAR_CENTER_ADJUST = 3;

/** `ha` function - 箭頭水平尺寸 (±5) */
const LIBRARY_ARROW_WIDTH = 5;

/** `ha` function - 箭頭垂直尺寸 (±3) */
const LIBRARY_ARROW_HEIGHT = 3;

/**
 * ====================================================================
 * Custom Constants
 * ====================================================================
 */

/** 繞過 bar 時，路徑與 bar 之間的間距 */
const DETOUR_PADDING = 10;

/**
 * ====================================================================
 * Helper Functions
 * ====================================================================
 */

/**
 * 根據 link type 判斷起點/終點位置
 * @param {string} linkType - 'e2s' | 's2s' | 'e2e' | 's2e'
 */
function getLinkEndpoints(linkType) {
  const isFromStart = linkType === 's2s' || linkType === 's2e';
  const isToStart = linkType === 'e2s' || linkType === 's2s';
  return { isFromStart, isToStart };
}

/**
 * 計算任務的連接點 X 座標
 */
function getTaskConnectionX(task, isStart) {
  return isStart ? task.$x : task.$x + task.$w;
}

/**
 * 生成箭頭的 polyline points（與 library 的 ha 函數一致）
 */
function generateArrowPoints(endX, endY, isToStart) {
  const w = LIBRARY_ARROW_WIDTH;
  const h = LIBRARY_ARROW_HEIGHT;

  return isToStart
    ? `${endX - w},${endY - h},${endX - w},${endY + h},${endX},${endY}`
    : `${endX + w},${endY + h},${endX + w},${endY - h},${endX},${endY}`;
}

/**
 * 生成路徑的 polyline points
 */
function generatePathPoints(points) {
  return points.map(([x, y]) => `${x},${y}`).join(',');
}

/**
 * Check if a task has a visible bar
 *
 * Logic (consistent with OffscreenArrows.jsx):
 * 1. Must have coordinate info ($x, $y, $w, $h)
 * 2. Milestones: check $isMilestone or type === 'milestone'
 * 3. Regular tasks: need dueDate
 *    - Tasks without dueDate may have a fallback bar (using createdAt), but should not show link
 */
function hasVisibleBar(task) {
  if (!task) return false;

  // Basic coordinate check ($x, $y can be 0, so use != null)
  if (
    task.$x == null ||
    task.$y == null ||
    task.$w == null ||
    task.$h == null
  ) {
    return false;
  }
  if (task.$w <= 0 || task.$h <= 0) {
    return false;
  }

  // Milestone special handling: dates exist on task.start/end
  const isMilestone = task.$isMilestone || task.type === 'milestone';
  if (isMilestone) {
    return true;
  }

  // Gantt summary type: if coordinates exist, it has a bar
  if (task.type === 'summary') {
    return true;
  }

  // Regular tasks: must have dueDate to have a real bar
  // Tasks without dueDate have a fallback bar (using createdAt), should not show link
  return !!task.dueDate;
}

/**
 * ====================================================================
 * Link Path Calculation
 * ====================================================================
 */

/**
 * 計算 link 路徑
 *
 * 改進 library 的行為：
 * 1. 使用動態水平偏移量（cellWidth / 2，最大 20px），在不同 zoom level 下更自然
 * 2. 「下往上」的 link 從目標下方繞過，而非上方（修正 library 的 ㄇ 字形問題）
 */
function calculateLinkPath(
  link,
  sourceTask,
  targetTask,
  cellHeight,
  cellWidth,
  baselines,
) {
  const { isFromStart, isToStart } = getLinkEndpoints(link.type);

  // 動態水平偏移量：cellWidth 的一半，但不超過上限
  const linkOffset = Math.min(cellWidth / 2, LIBRARY_LINK_OFFSET_MAX);

  // bar 中心的垂直偏移（與 library 一致）
  const barCenterOffset =
    Math.round(cellHeight / 2) - LIBRARY_BAR_CENTER_ADJUST;

  // baseline 啟用時，Y 座標需要減去偏移值
  const sourceY = baselines
    ? sourceTask.$y - LIBRARY_BASELINE_Y_OFFSET
    : sourceTask.$y;
  const targetY = baselines
    ? targetTask.$y - LIBRARY_BASELINE_Y_OFFSET
    : targetTask.$y;

  // 起點（源任務）
  const startX = getTaskConnectionX(sourceTask, isFromStart);
  const startY = sourceY + barCenterOffset;

  // 終點（目標任務）
  const endX = getTaskConnectionX(targetTask, isToStart);
  const endY = targetY + barCenterOffset;

  // 水平偏移後的轉折點 X 座標
  const turnX1 = startX + (isFromStart ? -linkOffset : linkOffset);
  const turnX2 = endX + (isToStart ? -linkOffset : linkOffset);

  // 判斷是否需要繞開（轉折點會交叉，表示路徑會穿過 bar）
  const needsDetour = turnX1 >= turnX2;

  let pathPoints;

  if (needsDetour) {
    // 需要繞開：決定從哪個 bar 的下方繞過
    const isTargetAbove = targetY < sourceY;
    const detourTask = isTargetAbove ? targetTask : sourceTask;
    const detourBaseY = isTargetAbove ? targetY : sourceY;
    const barHeight = detourTask.$h;
    const detourY = detourBaseY + barHeight + DETOUR_PADDING;

    pathPoints = generatePathPoints([
      [startX, startY],
      [turnX1, startY],
      [turnX1, detourY],
      [turnX2, detourY],
      [turnX2, endY],
      [endX, endY],
    ]);
  } else {
    // 不需要繞開：直接連接
    pathPoints = generatePathPoints([
      [startX, startY],
      [turnX1, startY],
      [turnX1, endY],
      [endX, endY],
    ]);
  }

  return `${pathPoints},${generateArrowPoints(endX, endY, isToStart)}`;
}

/**
 * ====================================================================
 * Component
 * ====================================================================
 */

export default function Links() {
  const api = useContext(storeContext);
  const links = useStore(api, '_links');
  const tasks = useStore(api, '_tasks');
  const cellHeight = useStore(api, 'cellHeight');
  const cellWidth = useStore(api, 'cellWidth');
  const baselines = useStore(api, 'baselines');

  // task ID -> task 物件的 Map（效能優化）
  const taskMap = useMemo(() => {
    const map = new Map();
    (tasks || []).forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  // 重新計算所有 link 路徑，使用動態水平偏移量
  // 只處理兩端任務都有可見 bar 的 link
  const processedLinks = useMemo(() => {
    return (links || [])
      .map((link) => {
        const sourceTask = taskMap.get(link.source);
        const targetTask = taskMap.get(link.target);

        // 只有當兩端任務都有可見的 bar 時才計算路徑
        if (hasVisibleBar(sourceTask) && hasVisibleBar(targetTask)) {
          return {
            ...link,
            $p: calculateLinkPath(
              link,
              sourceTask,
              targetTask,
              cellHeight,
              cellWidth,
              baselines,
            ),
          };
        }
        // 任一端沒有可見 bar，不顯示此 link
        return null;
      })
      .filter(Boolean);
  }, [links, taskMap, cellHeight, cellWidth, baselines]);

  return (
    <svg className="wx-dkx3NwEn wx-links">
      {processedLinks.map((link) => (
        <polyline
          className="wx-dkx3NwEn wx-line"
          points={link.$p}
          key={link.id}
        />
      ))}
    </svg>
  );
}
