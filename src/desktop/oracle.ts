import { useStore } from './store';
import type { OracleApi } from '../core/oracle-api';

export function installOracle() {
  const api: OracleApi = {
    summary() {
      const { session, desktop } = useStore.getState();
      if (!session) throw new Error('session not initialised');
      return session.summary(desktop, Date.now());
    },
    state() {
      return useStore.getState().desktop;
    },
    beginAction(kind, detail) {
      useStore.getState().beginAction(kind, detail);
    },
    endAction() {
      const fx = useStore.getState().endAction();
      return {
        classification: fx?.record?.classification ?? null,
        progressBefore: fx?.record?.progressBefore ?? 0,
        progressAfter: fx?.record?.progressAfter ?? 0,
        taskAdvanced: fx?.taskAdvanced ?? false,
        sessionComplete: fx?.sessionComplete ?? false,
        modalShown: !!fx?.showModal,
      };
    },
    export() {
      const { session } = useStore.getState();
      if (!session) throw new Error('session not initialised');
      return session.export();
    },
  };
  window.__oracle = api;
}
