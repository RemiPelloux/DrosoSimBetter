// =============================================================================
// Middleware d'historique (annuler / rétablir) pour zustand — repris de zundo 2.3.0
// (licence MIT, https://github.com/charkour/zundo), à l'identique, mais branché sur
// « zustand/vanilla » : le point d'entrée racine de zustand importe React, absent ici.
// =============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

export interface TemporalState<T> {
  pastStates: Partial<T>[];
  futureStates: Partial<T>[];
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
  clear: () => void;
  isTracking: boolean;
  pause: () => void;
  resume: () => void;
}
export interface TemporalOptions<T, P> {
  limit?: number;
  partialize?: (s: T) => P;
  equality?: (a: P, b: P) => boolean;
}
type WithTemporal<T> = StoreApi<T> & { temporal: StoreApi<TemporalState<T>> };

const temporalStateCreator = (userSet: any, userGet: any, options: any) => {
  const stateCreator = (set: any, get: any) => {
    return {
      pastStates: options?.pastStates || [],
      futureStates: options?.futureStates || [],
      undo: (steps = 1) => {
        if (get().pastStates.length) {
          const currentState = options?.partialize?.(userGet()) || userGet();
          const statesToApply = get().pastStates.splice(-steps, steps);
          const nextState = statesToApply.shift();
          userSet(nextState);
          set({
            pastStates: get().pastStates,
            futureStates: get().futureStates.concat(
              options?.diff?.(currentState, nextState) || currentState,
              statesToApply.reverse()
            )
          });
        }
      },
      redo: (steps = 1) => {
        if (get().futureStates.length) {
          const currentState = options?.partialize?.(userGet()) || userGet();
          const statesToApply = get().futureStates.splice(-steps, steps);
          const nextState = statesToApply.shift();
          userSet(nextState);
          set({
            pastStates: get().pastStates.concat(
              options?.diff?.(currentState, nextState) || currentState,
              statesToApply.reverse()
            ),
            futureStates: get().futureStates
          });
        }
      },
      clear: () => set({ pastStates: [], futureStates: [] }),
      isTracking: true,
      pause: () => set({ isTracking: false }),
      resume: () => set({ isTracking: true }),
      setOnSave: (_onSave: any) => set({ _onSave }),
      // Internal properties
      _onSave: options?.onSave,
      _handleSet: (pastState: any, _replace: any, currentState: any, deltaState: any) => {
        if (options?.limit && get().pastStates.length >= options?.limit) {
          get().pastStates.shift();
        }
        get()._onSave?.(pastState, currentState);
        set({
          pastStates: get().pastStates.concat(deltaState || pastState),
          futureStates: []
        });
      }
    };
  };
  return stateCreator;
};

export const temporal = <T, P = Partial<T>>(config: StateCreator<T, [], []>, options?: TemporalOptions<T, P> & Record<string, any>) => {
  const configWithTemporal = (set: any, get: any, store: any) => {
    store.temporal = createStore(
      options?.wrapTemporal?.(temporalStateCreator(set, get, options)) || temporalStateCreator(set, get, options)
    );
    const curriedHandleSet = options?.handleSet?.(
      store.temporal.getState()._handleSet
    ) || store.temporal.getState()._handleSet;
    const temporalHandleSet = (pastState: any) => {
      if (!store.temporal.getState().isTracking) return;
      const currentState = options?.partialize?.(get()) || get();
      const deltaState = options?.diff?.(pastState, currentState);
      if (
        // Don't call handleSet if state hasn't changed, as determined by diff fn or equality fn
        !// If the user has provided a diff function but nothing has been changed, deltaState will be null
        (deltaState === null || // If the user has provided an equality function, use it
        options?.equality?.(pastState, currentState))
      ) {
        curriedHandleSet(
          pastState,
          void 0,
          currentState,
          deltaState
        );
      }
    };
    const setState = store.setState;
    store.setState = (...args: any[]) => {
      const pastState = options?.partialize?.(get()) || get();
      setState(...args);
      temporalHandleSet(pastState);
    };
    return config(
      // Modify the set function to call the userlandSet function
      (...args: any[]) => {
        const pastState = options?.partialize?.(get()) || get();
        set(...args);
        temporalHandleSet(pastState);
      },
      get,
      store
    );
  };
  return configWithTemporal as unknown as StateCreator<T, [], []>;
};

export type { WithTemporal };
