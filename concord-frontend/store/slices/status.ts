import type { StateCreator } from 'zustand';

export interface RequestError {
  id: string;
  at: string;
  path?: string;
  method?: string;
  status?: number;
  code?: string;
  requestId?: string;
  message: string;
  reason?: string;
}

export interface AuthPosture {
  mode: 'public' | 'apikey' | 'jwt' | 'hybrid' | 'unknown';
  usesJwt: boolean;
  usesApiKey: boolean;
}

export interface StatusSlice {
  requestErrors: RequestError[];
  authPosture: AuthPosture;
  userRole: 'sovereign' | 'user';

  addRequestError: (error: Omit<RequestError, 'id' | 'at'>) => void;
  clearRequestErrors: () => void;
  setAuthPosture: (authPosture: Partial<AuthPosture>) => void;
  setUserRole: (role: 'sovereign' | 'user') => void;
}

export const createStatusSlice: StateCreator<StatusSlice, [], [], StatusSlice> = (set) => ({
  requestErrors: [],
  authPosture: { mode: 'unknown', usesJwt: false, usesApiKey: false },
  userRole: 'sovereign',

  addRequestError: (error) =>
    set((state) => {
      const now = Date.now();
      const isDuplicate = state.requestErrors.some(
        (e) =>
          e.path === error.path &&
          e.status === error.status &&
          now - new Date(e.at).getTime() < 10_000,
      );
      if (isDuplicate) return state;

      return {
        requestErrors: [
          ...state.requestErrors.slice(-19),
          {
            ...error,
            id: `reqerr-${now}-${Math.random().toString(36).slice(2, 9)}`,
            at: new Date().toISOString(),
          },
        ],
      };
    }),

  clearRequestErrors: () => set({ requestErrors: [] }),

  setAuthPosture: (authPosture) =>
    set((state) => ({ authPosture: { ...state.authPosture, ...authPosture } })),

  setUserRole: (role) => set({ userRole: role }),
});
