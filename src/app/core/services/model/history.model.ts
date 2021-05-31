import {Moment} from "moment";

export declare interface SynchronizationHistory {
  name: string;
  filter?: any;
  execDate: string;
  execDurationMs: number;
  lastUpdateDate?: string;
  children?: SynchronizationHistory[];
}

export interface HistoryPageReference {
  title: string;
  subtitle?: string;
  path: string;
  time?: Moment | string;
  icon?: string;
  matIcon?: string;

  children?: HistoryPageReference[];

  // Manage visibility and data access
  offline?: boolean;
  onlinePeer?: string;
}
