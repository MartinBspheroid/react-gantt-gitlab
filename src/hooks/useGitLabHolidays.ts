/**
 * React Hook for managing GitLab-stored holidays
 * Handles loading, saving, and permission checking for project holidays
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  loadGanttConfig,
  saveGanttConfig,
  parseConfigText,
  formatConfigText,
  type GanttConfig,
  type HolidayEntry,
} from '../providers/GitLabSnippetApi';
import type { GitLabProxyConfig } from '../providers/GitLabApiUtils';
import type { ColorRule } from '../types/colorRule';

export interface UseGitLabHolidaysResult {
  /** Holiday entries (date + optional name) */
  holidays: HolidayEntry[];
  /** Workday entries (date + optional name) */
  workdays: HolidayEntry[];
  /** Color rules for bar styling */
  colorRules: ColorRule[];
  /** Raw text for holidays textarea */
  holidaysText: string;
  /** Raw text for workdays textarea */
  workdaysText: string;
  /** Whether data is loading */
  loading: boolean;
  /** Whether data is saving */
  saving: boolean;
  /** Error message if any */
  error: string | null;
  /** Update holidays from textarea value */
  setHolidaysText: (text: string) => void;
  /** Update workdays from textarea value */
  setWorkdaysText: (text: string) => void;
  /** Update color rules */
  setColorRules: (rules: ColorRule[]) => void;
  /** Reload config from GitLab */
  reload: () => Promise<void>;
}

/**
 * Convert HolidayEntry array to textarea text
 */
function entriesToText(entries: HolidayEntry[]): string {
  return entries
    .map((e) => (e.name ? `${e.date} ${e.name}` : e.date))
    .join('\n');
}

/**
 * Convert textarea text to HolidayEntry array
 */
function textToEntries(text: string): HolidayEntry[] {
  const entries: HolidayEntry[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/[\s\t]+/);
    const dateStr = parts[0];
    const name = parts.slice(1).join(' ') || undefined;

    // Basic date format validation
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(dateStr)) {
      entries.push({ date: dateStr, name });
    }
  }

  return entries;
}

/**
 * Hook for managing GitLab-stored holidays
 */
export function useGitLabHolidays(
  projectPath: string | null,
  proxyConfig: GitLabProxyConfig | null,
  canEditProject: boolean,
): UseGitLabHolidaysResult {
  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [workdays, setWorkdays] = useState<HolidayEntry[]>([]);
  const [colorRules, setColorRulesState] = useState<ColorRule[]>([]);
  const [holidaysText, setHolidaysTextState] = useState('');
  const [workdaysText, setWorkdaysTextState] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store values in refs to avoid dependency issues and prevent re-renders
  const proxyConfigRef = useRef(proxyConfig);
  proxyConfigRef.current = proxyConfig;

  const holidaysRef = useRef(holidays);
  holidaysRef.current = holidays;

  const workdaysRef = useRef(workdays);
  workdaysRef.current = workdays;

  const colorRulesRef = useRef(colorRules);
  colorRulesRef.current = colorRules;

  // Load config from GitLab
  const loadConfig = useCallback(async () => {
    const currentProxyConfig = proxyConfigRef.current;
    if (!projectPath || !currentProxyConfig) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const config = await loadGanttConfig(projectPath, currentProxyConfig);

      if (config) {
        setHolidays(config.holidays);
        setWorkdays(config.workdays);
        setColorRulesState(config.colorRules || []);
        setHolidaysTextState(entriesToText(config.holidays));
        setWorkdaysTextState(entriesToText(config.workdays));
      } else {
        // No config exists yet
        setHolidays([]);
        setWorkdays([]);
        setColorRulesState([]);
        setHolidaysTextState('');
        setWorkdaysTextState('');
      }
    } catch (err) {
      console.error('[useGitLabHolidays] Failed to load config:', err);
      setError(err instanceof Error ? err.message : 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  // Save config to GitLab (debounced)
  const saveConfig = useCallback(
    async (config: GanttConfig) => {
      const currentProxyConfig = proxyConfigRef.current;
      if (!projectPath || !currentProxyConfig || !canEditProject) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        await saveGanttConfig(projectPath, config, currentProxyConfig);
        console.log('[useGitLabHolidays] Config saved to GitLab');
      } catch (err) {
        console.error('[useGitLabHolidays] Failed to save config:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to save holidays',
        );
      } finally {
        setSaving(false);
      }
    },
    [projectPath, canEditProject],
  );

  // Update holidays text and trigger save
  const setHolidaysText = useCallback(
    (text: string) => {
      setHolidaysTextState(text);
      const entries = textToEntries(text);
      setHolidays(entries);

      // Debounced save
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      if (canEditProject) {
        saveTimerRef.current = setTimeout(() => {
          saveConfig({
            holidays: entries,
            workdays: workdaysRef.current,
            colorRules: colorRulesRef.current,
          });
        }, 500);
      }
    },
    [canEditProject, saveConfig],
  );

  // Update workdays text and trigger save
  const setWorkdaysText = useCallback(
    (text: string) => {
      setWorkdaysTextState(text);
      const entries = textToEntries(text);
      setWorkdays(entries);

      // Debounced save
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      if (canEditProject) {
        saveTimerRef.current = setTimeout(() => {
          saveConfig({
            holidays: holidaysRef.current,
            workdays: entries,
            colorRules: colorRulesRef.current,
          });
        }, 500);
      }
    },
    [canEditProject, saveConfig],
  );

  // Update color rules and trigger save
  const setColorRules = useCallback(
    (rules: ColorRule[]) => {
      setColorRulesState(rules);

      // Debounced save
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      if (canEditProject) {
        saveTimerRef.current = setTimeout(() => {
          saveConfig({
            holidays: holidaysRef.current,
            workdays: workdaysRef.current,
            colorRules: rules,
          });
        }, 500);
      }
    },
    [canEditProject, saveConfig],
  );

  // Load config when project changes
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Memoize the return object to prevent unnecessary re-renders
  // Use stable keys based on content to avoid new object references
  const holidaysKey = useMemo(
    () => JSON.stringify(holidays.map((h) => h.date)),
    [holidays],
  );
  const workdaysKey = useMemo(
    () => JSON.stringify(workdays.map((w) => w.date)),
    [workdays],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableHolidays = useMemo(() => holidays, [holidaysKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableWorkdays = useMemo(() => workdays, [workdaysKey]);

  const colorRulesKey = useMemo(
    () =>
      JSON.stringify(
        colorRules.map((r) => ({
          id: r.id,
          enabled: r.enabled,
          color: r.color,
          opacity: r.opacity,
          pattern: r.pattern,
          matchType: r.matchType,
          priority: r.priority,
        })),
      ),
    [colorRules],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableColorRules = useMemo(() => colorRules, [colorRulesKey]);

  return {
    holidays: stableHolidays,
    workdays: stableWorkdays,
    colorRules: stableColorRules,
    holidaysText,
    workdaysText,
    loading,
    saving,
    error,
    setHolidaysText,
    setWorkdaysText,
    setColorRules,
    reload: loadConfig,
  };
}
