import { useRef, useEffect, useCallback } from 'react';

/**
 * useScrollSync - 解決 React 中 Store ↔ DOM 滾動同步的無限循環問題
 *
 * ============================================================================
 * ## 問題背景 (IMPORTANT - 請務必閱讀)
 * ============================================================================
 *
 * 當你需要在 React 中實現「雙向滾動同步」時（例如：store 的 scrollTop 要同步到 DOM，
 * 同時 DOM 的滾動事件也要更新 store），很容易產生無限循環：
 *
 * ```
 * Store 更新 scrollTop
 *       ↓
 * useEffect 監聽到變化，設定 el.scrollTop = value
 *       ↓
 * DOM 觸發 scroll 事件（瀏覽器行為，無法阻止）
 *       ↓
 * onScroll handler 呼叫 api.exec('scroll-chart') 更新 store
 *       ↓
 * Store 再次更新 → 回到步驟 1（無限循環！）
 * ```
 *
 * React 會報錯：
 * "Warning: Maximum update depth exceeded. This can happen when a component
 * calls setState inside useEffect..."
 *
 * ============================================================================
 * ## 解決方案
 * ============================================================================
 *
 * 使用 flag 來區分「程式化滾動」和「使用者滾動」：
 * - 程式化滾動 (store → DOM)：設定 flag，scroll handler 看到 flag 就跳過 store 更新
 * - 使用者滾動 (user → DOM)：flag 為 false，正常更新 store
 *
 * ============================================================================
 * ## 使用方式
 * ============================================================================
 *
 * ```javascript
 * import { useScrollSync } from '../hooks/useScrollSync';
 *
 * function MyScrollableComponent() {
 *   const elementRef = useRef(null);
 *   const storeScrollTop = useStore(api, 'scrollTop');
 *
 *   // 1. 取得 hook 提供的工具
 *   const { syncScrollToDOM, createScrollHandler } = useScrollSync();
 *
 *   // 2. 在 effect 中同步 store → DOM
 *   useEffect(() => {
 *     syncScrollToDOM(elementRef.current, { top: storeScrollTop });
 *   }, [storeScrollTop, syncScrollToDOM]);
 *
 *   // 3. 建立 scroll handler（用 useMemo 避免重複建立）
 *   const onScroll = useMemo(
 *     () => createScrollHandler({
 *       element: elementRef,
 *       onUserScroll: (scrollPos) => {
 *         // 只在「使用者滾動」時更新 store
 *         api.exec('scroll-chart', { top: scrollPos.top });
 *       },
 *       onAnyScroll: () => {
 *         // 不管是程式化還是使用者滾動都會執行（用於 virtual scrolling 等）
 *         updateVisibleRows();
 *       },
 *       throttle: true,  // 使用 requestAnimationFrame 節流
 *     }),
 *     [createScrollHandler, api]
 *   );
 *
 *   return <div ref={elementRef} onScroll={onScroll}>...</div>;
 * }
 * ```
 *
 * ============================================================================
 * ## 何時需要使用這個 Hook？
 * ============================================================================
 *
 * 當你的元件同時滿足以下兩個條件時，必須使用此 hook：
 * 1. 需要從外部 store/state 同步滾動位置到 DOM（effect 設定 el.scrollTop）
 * 2. 需要監聽 scroll 事件並更新 store/state（onScroll handler）
 *
 * 常見場景：
 * - Gantt chart 的水平/垂直滾動同步
 * - 多個 panel 的滾動聯動
 * - Virtual scrolling 配合外部狀態管理
 *
 * ============================================================================
 * ## 錯誤示範（會造成無限循環）
 * ============================================================================
 *
 * ```javascript
 * // ❌ 錯誤：這會造成無限循環！
 * useEffect(() => {
 *   element.scrollTop = storeScrollTop;
 * }, [storeScrollTop]);
 *
 * const onScroll = () => {
 *   setStoreScrollTop(element.scrollTop);  // 會觸發上面的 effect
 * };
 * ```
 *
 * @returns {Object} Hook 提供的工具函數
 * @returns {Function} return.syncScrollToDOM - 同步滾動位置到 DOM
 * @returns {Function} return.createScrollHandler - 建立滾動事件處理器
 */
export function useScrollSync() {
  // 用於標記「這次滾動是程式化觸發的」
  const isProgrammaticScroll = useRef(false);
  // 用於 RAF 節流
  const rafRef = useRef(null);

  // 元件卸載時清理 RAF
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  /**
   * 同步滾動位置從 store/state 到 DOM 元素
   *
   * 這個函數會：
   * 1. 檢查是否真的需要更新（避免不必要的 DOM 操作）
   * 2. 設定 isProgrammaticScroll flag
   * 3. 更新 DOM 的 scrollTop/scrollLeft
   *
   * @param {HTMLElement|null} element - 可滾動的 DOM 元素
   * @param {Object} position - 要設定的滾動位置
   * @param {number} [position.top] - 垂直滾動位置
   * @param {number} [position.left] - 水平滾動位置
   *
   * @example
   * useEffect(() => {
   *   syncScrollToDOM(ref.current, { top: scrollTop, left: scrollLeft });
   * }, [scrollTop, scrollLeft, syncScrollToDOM]);
   */
  const syncScrollToDOM = useCallback((element, position) => {
    if (!element) return;

    const { top, left } = position;

    // 檢查是否真的需要更新，避免不必要的 DOM 操作
    const needsUpdate =
      (typeof top === 'number' && element.scrollTop !== top) ||
      (typeof left === 'number' && element.scrollLeft !== left);

    if (needsUpdate) {
      // 設定 flag，讓 scroll handler 知道這是程式化觸發的
      isProgrammaticScroll.current = true;

      // 更新 DOM
      if (typeof top === 'number') element.scrollTop = top;
      if (typeof left === 'number') element.scrollLeft = left;
    }
  }, []);

  /**
   * 建立滾動事件處理器
   *
   * 這個函數會返回一個 scroll handler，它能區分：
   * - 程式化滾動（由 syncScrollToDOM 觸發）→ 只執行 onAnyScroll
   * - 使用者滾動（使用者操作）→ 執行 onUserScroll 和 onAnyScroll
   *
   * @param {Object} options - 設定選項
   * @param {React.RefObject} options.element - 可滾動元素的 ref
   * @param {Function} [options.onUserScroll] - 只在使用者滾動時呼叫
   * @param {Function} [options.onAnyScroll] - 所有滾動都會呼叫（包含程式化）
   * @param {boolean} [options.throttle=true] - 是否使用 RAF 節流
   * @returns {Function} 可以綁定到 onScroll 的事件處理器
   *
   * @example
   * const onScroll = useMemo(
   *   () => createScrollHandler({
   *     element: ref,
   *     onUserScroll: (pos) => api.exec('scroll-chart', pos),
   *     onAnyScroll: () => dataRequest(),
   *     throttle: true,
   *   }),
   *   [createScrollHandler, api, dataRequest]
   * );
   */
  const createScrollHandler = useCallback((options) => {
    const { element, onUserScroll, onAnyScroll, throttle = true } = options;

    return () => {
      // 檢查並重設 flag
      // 注意：要在一開始就讀取，因為後面可能會被異步執行覆蓋
      const wasProgrammatic = isProgrammaticScroll.current;
      if (wasProgrammatic) {
        isProgrammaticScroll.current = false;
      }

      // 如果啟用節流且已經有排程的 RAF，跳過這次
      if (throttle && rafRef.current) return;

      const executeHandler = () => {
        if (throttle) {
          rafRef.current = null;
        }

        const el = element.current;
        if (!el) return;

        const scrollPos = {
          top: el.scrollTop,
          left: el.scrollLeft,
        };

        // 只有使用者滾動才執行 onUserScroll（更新 store）
        if (!wasProgrammatic && onUserScroll) {
          onUserScroll(scrollPos);
        }

        // onAnyScroll 總是執行（用於 virtual scrolling 等場景）
        if (onAnyScroll) {
          onAnyScroll(scrollPos);
        }
      };

      if (throttle) {
        rafRef.current = window.requestAnimationFrame(executeHandler);
      } else {
        executeHandler();
      }
    };
  }, []);

  return {
    syncScrollToDOM,
    createScrollHandler,
    // 進階用途：直接存取內部 ref
    isProgrammaticScroll,
    rafRef,
  };
}

export default useScrollSync;
