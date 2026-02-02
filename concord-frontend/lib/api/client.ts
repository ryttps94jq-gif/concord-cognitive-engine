import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

// Create axios instance with defaults
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API key
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const apiKey = localStorage.getItem('concord_api_key');
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
      }
      const sessionId = localStorage.getItem('concord_session_id');
      if (sessionId) {
        config.headers['X-Session-ID'] = sessionId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('concord_api_key');
        window.location.href = '/login';
      }
      if (status === 429) {
        console.warn('Rate limited. Please slow down requests.');
      }
      if (status >= 500) {
        console.error('Server error:', error.response.data);
      }
    } else if (error.request) {
      console.error('Network error - no response received');
    }
    return Promise.reject(error);
  }
);

// Typed API helper functions matching actual backend endpoints
export const apiHelpers = {
  // System status
  status: {
    get: () => api.get('/api/status'),
  },

  // Jobs management
  jobs: {
    status: () => api.get('/api/jobs/status'),
    toggle: (job: string, enabled: boolean) =>
      api.post('/api/jobs/toggle', { job, enabled }),
  },

  // DTU operations (note: endpoint is /api/dtus - plural)
  dtus: {
    list: () => api.get('/api/dtus'),

    create: (data: {
      title?: string;
      content: string;
      tags?: string[];
      source?: string;
      parents?: string[];
      isGlobal?: boolean;
      meta?: Record<string, unknown>;
      declaredSourceType?: string;
    }) => api.post('/api/dtus', data),

    update: (id: string, patch: Record<string, unknown>) =>
      api.patch(`/api/dtus/${id}`, patch),
  },

  // Ingest operations
  ingest: {
    manual: (data: {
      text: string;
      title?: string;
      tags?: string[];
      makeGlobal?: boolean;
      declaredSourceType?: string;
    }) => api.post('/api/ingest', data),

    queue: (data: {
      text: string;
      title?: string;
      tags?: string[];
      makeGlobal?: boolean;
      declaredSourceType?: string;
    }) => api.post('/api/ingest/queue', data),
  },

  // Autocrawl operations
  autocrawl: {
    manual: (data: {
      url: string;
      makeGlobal?: boolean;
      declaredSourceType?: string;
      tags?: string[];
    }) => api.post('/api/autocrawl', data),

    queue: (data: {
      url: string;
      makeGlobal?: boolean;
      declaredSourceType?: string;
      tags?: string[];
    }) => api.post('/api/autocrawl/queue', data),
  },

  // Chat operations
  chat: {
    send: (message: string, mode: string = 'overview') =>
      api.post('/api/chat', { message, mode }),

    ask: (message: string, mode: string = 'overview') =>
      api.post('/api/ask', { message, mode }),
  },

  // Forge (manual DTU creation)
  forge: {
    create: (data: { title?: string; content: string; tags?: string[]; source?: string }) =>
      api.post('/api/forge', data),
  },

  // Simulations
  simulations: {
    list: () => api.get('/api/simulations'),

    whatIf: (data: { title?: string; prompt?: string; assumptions?: string[] }) =>
      api.post('/api/simulations/whatif', data),
  },

  // Personas
  personas: {
    list: () => api.get('/api/personas'),

    speak: (personaId: string, text: string) =>
      api.post(`/api/personas/${personaId}/speak`, { text }),

    animate: (personaId: string, kind: string = 'talk') =>
      api.post(`/api/personas/${personaId}/animate`, { kind }),
  },

  // Council
  council: {
    debate: (data: {
      dtuA?: string | { id: string; content?: string };
      dtuB?: string | { id: string; content?: string };
      topic?: string;
    }) => api.post('/api/council/debate', data),
  },

  // Swarm
  swarm: {
    run: (prompt: string, count: number = 6) =>
      api.post('/api/swarm/run', { prompt, count }),
  },

  // Credits (wallet system)
  credits: {
    getWallet: (walletId: string) =>
      api.post('/api/credits/wallet', { walletId }),

    earn: (walletId: string, amount: number, reason: string = 'quest') =>
      api.post('/api/credits/earn', { walletId, amount, reason }),

    spend: (walletId: string, amount: number, reason: string = 'spend') =>
      api.post('/api/credits/spend', { walletId, amount, reason }),
  },

  // Marketplace
  marketplace: {
    listings: () => api.get('/api/marketplace/listings'),
  },

  // Global feed
  global: {
    feed: () => api.get('/api/global/feed'),
  },

  // Macros
  macros: {
    run: (recipeName: string, ctx?: Record<string, unknown>) =>
      api.post('/api/macros/run', { recipeName, ctx }),
  },

  // Events
  events: {
    list: () => api.get('/api/events'),
  },
};

export default api;
