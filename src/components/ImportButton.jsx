import { useRef, useCallback } from 'react';
import type { ITask, ILink } from '@svar-ui/gantt-store';

interface ImportButtonProps {
  onImport: (tasks: ITask[], links: ILink[]) => void;
  onError?: (error: Error) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
}

export function ImportButton({
  onImport,
  onError,
  accept = '.xml,.json,.csv',
  disabled = false,
  className = '',
}: ImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const content = await readFileAsText(file);
        const format = detectFormat(file.name, content);
        const { tasks, links } = parseImport(content, format);
        onImport(tasks, links);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onImport, onError],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className={className}
        title="Import from file"
      >
        <i className="fas fa-file-import" />
      </button>
    </>
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function detectFormat(filename: string, content: string): 'json' | 'csv' | 'ms-xml' {
  if (filename.endsWith('.csv')) return 'csv';
  if (filename.endsWith('.xml')) return 'ms-xml';
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<')) return 'ms-xml';
  return 'csv';
}

function parseImport(
  content: string,
  format: 'json' | 'csv' | 'ms-xml',
): { tasks: ITask[]; links: ILink[] } {
  const { importData } = require('../pro-features/DataIO');
  return importData(content, { format });
}
