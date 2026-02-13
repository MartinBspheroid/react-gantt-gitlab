import type { FC } from 'react';
import type { ITask, IApi, TMethodsConfig } from '@svar-ui/gantt-store';

type RemoveHyphen<S extends string> = S extends `${infer Head}-${infer Tail}`
  ? `${Head}${RemoveHyphen<Tail>}`
  : S;

type EventName<K extends string> = `on${RemoveHyphen<K>}`;

type KanbanActions<TMethodsConfig extends Record<string, any>> = {
  [K in keyof TMethodsConfig as EventName<K & string>]?: (
    ev: TMethodsConfig[K],
  ) => void;
} & {
  [key: `on${string}`]: (ev?: any) => void;
};

export interface IKanbanCardData {
  id: string | number;
  text: string;
  [key: string]: any;
}

export interface IKanbanListData {
  id: string | number;
  label: string;
  items: IKanbanCardData[];
}

export declare const KanbanView: FC<{
  data?: IKanbanListData[];
  readonly?: boolean;
  onchange?: (ev: { action: string; data: any }) => void;
}>;

export declare const KanbanBoard: FC<{
  data?: IKanbanListData[];
  readonly?: boolean;
  children?: React.ReactNode;
}>;

export declare const KanbanBoardDnd: FC<{
  data?: IKanbanListData[];
  onDragEnd?: (result: any) => void;
  children?: React.ReactNode;
}>;

export declare const KanbanList: FC<{
  id: string | number;
  label: string;
  items: IKanbanCardData[];
  readonly?: boolean;
}>;

export declare const KanbanCard: FC<{
  id: string | number;
  text: string;
  data?: Record<string, any>;
  readonly?: boolean;
}>;
