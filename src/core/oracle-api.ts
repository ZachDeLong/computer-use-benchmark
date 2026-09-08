import type { SessionExport } from './session';
import type { DesktopState, SessionSummary } from './types';

/** Bridge exposed on window for the harness (agent mode). Shared between the page and Node. */
export interface OracleApi {
  summary(): SessionSummary;
  state(): DesktopState;
  beginAction(kind: string, detail?: string): void;
  endAction(): {
    classification: string | null;
    progressBefore: number;
    progressAfter: number;
    taskAdvanced: boolean;
    sessionComplete: boolean;
    modalShown: boolean;
  };
  export(): SessionExport;
}

declare global {
  interface Window {
    __oracle: OracleApi;
  }
}
