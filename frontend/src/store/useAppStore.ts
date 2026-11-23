import { create } from 'zustand';
import { Event, RunSummary, AgentDefinition, ConceptItem, FaultConfig } from '../types';
import * as api from '../api/client';

export type ViewType = 'landing' | 'dashboard' | 'workspace' | 'agents' | 'builder' | 'evals' | 'history' | 'settings';

interface AppState {
  // Theme: dark (charcoal/burgundy) or light (warm cream)
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // View navigation
  currentView: ViewType;
  setView: (view: ViewType) => void;

  // Active runs
  runs: RunSummary[];
  selectedRunId: string | null;
  activeRun: RunSummary | null;
  loadRuns: () => Promise<void>;
  selectRun: (runId: string) => void;

  // Live and replay events
  events: Event[];
  replayCursor: number; // 0 = start, events.length = current
  isReplaying: boolean;
  playbackSpeed: number; // 1x, 2x, 5x
  setReplayCursor: (cursor: number) => void;
  setIsReplaying: (replaying: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;

  // Real-time EventSource connection
  eventSource: EventSource | null;
  startLiveRunStream: (runId: string) => void;
  stopLiveRunStream: () => void;

  // Selected agent for inspector
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;

  // Selected concept for Why? panel
  selectedConcept: ConceptItem | null;
  concepts: ConceptItem[];
  loadConcepts: () => Promise<void>;
  selectConceptById: (conceptId: string) => void;

  // Agents registry list
  agents: AgentDefinition[];
  loadAgents: () => Promise<void>;
  editingAgent: AgentDefinition | null;
  setEditingAgent: (agent: AgentDefinition | null) => void;

  // Fault injection / Break-it
  faultConfig: FaultConfig;
  setFaultConfig: (config: FaultConfig) => void;
  resetFaultConfig: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: (localStorage.getItem('agentlens_theme') as 'dark' | 'light') || 'dark',
  setTheme: (theme) => {
    localStorage.setItem('agentlens_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  currentView: 'landing',
  setView: (currentView) => set({ currentView }),

  runs: [],
  selectedRunId: null,
  activeRun: null,
  loadRuns: async () => {
    try {
      const runs = await api.fetchRuns();
      set({ runs });
      if (!get().selectedRunId && runs.length > 0) {
        get().selectRun(runs[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  },
  selectRun: async (runId) => {
    get().stopLiveRunStream();
    set({ selectedRunId: runId, events: [], replayCursor: 0, isReplaying: false });
    const run = get().runs.find(r => r.id === runId) || null;
    set({ activeRun: run });
    get().startLiveRunStream(runId);
  },

  events: [],
  replayCursor: 0,
  isReplaying: false,
  playbackSpeed: 1,
  setReplayCursor: (replayCursor) => set({ replayCursor }),
  setIsReplaying: (isReplaying) => set({ isReplaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

  eventSource: null,
  startLiveRunStream: (runId) => {
    get().stopLiveRunStream();

    const es = new EventSource(`/runs/${runId}/events`);
    
    es.onmessage = (e) => {
      try {
        const ev: Event = JSON.parse(e.data);
        set((state) => {
          // Avoid duplicate events
          if (state.events.some(x => x.id === ev.id)) return state;
          const newEvents = [...state.events, ev].sort((a, b) => a.id - b.id);
          return {
            events: newEvents,
            replayCursor: newEvents.length
          };
        });
      } catch (err) {
        // ignore ping messages
      }
    };

    es.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };

    set({ eventSource: es });
  },
  stopLiveRunStream: () => {
    const es = get().eventSource;
    if (es) {
      es.close();
      set({ eventSource: null });
    }
  },

  selectedAgentId: null,
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),

  selectedConcept: null,
  concepts: [],
  loadConcepts: async () => {
    try {
      const concepts = await api.fetchConcepts();
      set({ concepts });
    } catch (err) {
      console.error(err);
    }
  },
  selectConceptById: (conceptId) => {
    const c = get().concepts.find(x => x.id === conceptId) || null;
    set({ selectedConcept: c });
  },

  agents: [],
  loadAgents: async () => {
    try {
      const agents = await api.fetchAgents();
      set({ agents });
    } catch (err) {
      console.error(err);
    }
  },
  editingAgent: null,
  setEditingAgent: (editingAgent) => set({ editingAgent }),

  faultConfig: {
    enabled: false,
    target_tool: 'web_search',
    mode: 'wrong_answer'
  },
  setFaultConfig: (faultConfig) => set({ faultConfig }),
  resetFaultConfig: () => set({
    faultConfig: {
      enabled: false,
      target_tool: 'web_search',
      mode: 'wrong_answer'
    }
  })
}));

