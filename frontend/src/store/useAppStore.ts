import { create } from 'zustand';
import { AgentDefinition, ConceptItem, Event, FaultConfig, RunSummary } from '../types';
import * as api from '../api/client';

export type ViewType =
  | 'landing'
  | 'learn'
  | 'auth'
  | 'dashboard'
  | 'workspace'
  | 'agents'
  | 'builder'
  | 'templates'
  | 'evals'
  | 'history'
  | 'settings';

export type SettingsTab = 'account' | 'preferences';

interface AppState {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  currentView: ViewType;
  setView: (view: ViewType) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;

  runs: RunSummary[];
  runsLoading: boolean;
  runsError: string | null;
  selectedRunId: string | null;
  activeRun: RunSummary | null;
  loadRuns: () => Promise<void>;
  selectRun: (runId: string) => Promise<void>;

  events: Event[];
  replayCursor: number;
  isReplaying: boolean;
  playbackSpeed: number;
  followLive: boolean;
  setReplayCursor: (cursor: number) => void;
  setIsReplaying: (replaying: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;

  eventSource: EventSource | null;
  streamError: string | null;
  startLiveRunStream: (runId: string) => void;
  stopLiveRunStream: () => void;
  clearUserData: () => void;

  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;

  selectedConcept: ConceptItem | null;
  concepts: ConceptItem[];
  loadConcepts: () => Promise<void>;
  selectConceptById: (conceptId: string) => void;

  agents: AgentDefinition[];
  agentsError: string | null;
  loadAgents: () => Promise<void>;
  editingAgent: AgentDefinition | null;
  setEditingAgent: (agent: AgentDefinition | null) => void;

  faultConfig: FaultConfig;
  setFaultConfig: (config: FaultConfig) => void;
  resetFaultConfig: () => void;
}

const TERMINAL_RUN_STATUSES = new Set(['completed', 'completed_with_errors', 'failed']);

function applyTheme(theme: 'dark' | 'light') {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
}

const storedTheme = (localStorage.getItem('agentlens_theme') as 'dark' | 'light') || 'dark';
applyTheme(storedTheme);

export const useAppStore = create<AppState>((set, get) => ({
  theme: storedTheme,
  setTheme: (theme) => {
    localStorage.setItem('agentlens_theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  currentView: 'landing',
  setView: (currentView) => set({ currentView }),
  settingsTab: 'preferences',
  setSettingsTab: (settingsTab) => set({ settingsTab }),

  runs: [],
  runsLoading: false,
  runsError: null,
  selectedRunId: null,
  activeRun: null,
  loadRuns: async () => {
    set({ runsLoading: true, runsError: null });
    try {
      const runs = await api.fetchRuns();
      set({ runs, runsLoading: false });
      const { selectedRunId } = get();
      if (!selectedRunId && runs.length > 0) {
        await get().selectRun(runs[0].id);
      } else if (selectedRunId) {
        const refreshed = runs.find((run) => run.id === selectedRunId);
        if (refreshed) set({ activeRun: refreshed });
      }
    } catch (error) {
      set({
        runsLoading: false,
        runsError: error instanceof Error ? error.message : 'Failed to load runs',
      });
    }
  },
  selectRun: async (runId) => {
    get().stopLiveRunStream();
    const cached = get().runs.find((run) => run.id === runId) || null;
    set({
      selectedRunId: runId,
      activeRun: cached,
      events: [],
      replayCursor: 0,
      isReplaying: false,
      streamError: null,
      followLive: !cached || !TERMINAL_RUN_STATUSES.has(cached.status),
    });

    if (!cached) {
      try {
        const run = await api.fetchRun(runId);
        set({ activeRun: run, followLive: !TERMINAL_RUN_STATUSES.has(run.status) });
      } catch (error) {
        set({
          streamError: error instanceof Error ? error.message : 'Failed to load run',
        });
      }
    }
    get().startLiveRunStream(runId);
  },

  events: [],
  replayCursor: 0,
  isReplaying: false,
  playbackSpeed: 1,
  followLive: true,
  setReplayCursor: (replayCursor) => set({ replayCursor }),
  setIsReplaying: (isReplaying) => set({ isReplaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

  eventSource: null,
  streamError: null,
  startLiveRunStream: (runId) => {
    get().stopLiveRunStream();

    const source = new EventSource(api.streamUrl(runId), { withCredentials: true });

    source.onmessage = (message) => {
      let event: Event;
      try {
        event = JSON.parse(message.data) as Event;
      } catch {
        return; // keep-alive frames and comments are ignored
      }

      let finished = false;
      set((state) => {
        if (state.events.some((existing) => existing.id === event.id)) return state;
        const events = [...state.events, event].sort((a, b) => a.id - b.id);
        finished = event.type === 'run_finished' || event.type === 'run_failed';

        let activeRun = state.activeRun;
        let runs = state.runs;
        if (finished) {
          const status = event.type === 'run_finished'
            ? (event.payload?.status ?? 'completed')
            : 'failed';
          const totals = event.payload?.totals ?? activeRun?.totals;
          if (activeRun && activeRun.id === runId) {
            activeRun = { ...activeRun, status: status as any, totals: totals ?? activeRun.totals };
          }
          runs = state.runs.map((run) =>
            run.id === runId
              ? { ...run, status: status as any, totals: totals ?? run.totals }
              : run,
          );
        }

        return {
          events,
          replayCursor: state.followLive ? events.length : state.replayCursor,
          activeRun,
          runs,
          streamError: null,
        };
      });

      if (finished) {
        // The server closes terminal streams; stop the client from reconnecting.
        source.close();
        set({ eventSource: null });
      }
    };

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        set({ eventSource: null, streamError: 'The live event stream closed unexpectedly.' });
      }
    };

    set({ eventSource: source });
  },
  stopLiveRunStream: () => {
    const source = get().eventSource;
    if (source) source.close();
    set({ eventSource: null });
  },
  clearUserData: () => {
    get().stopLiveRunStream();
    set({
      runs: [],
      runsLoading: false,
      runsError: null,
      selectedRunId: null,
      activeRun: null,
      events: [],
      replayCursor: 0,
      isReplaying: false,
      streamError: null,
      agents: [],
      agentsError: null,
      selectedAgentId: null,
      editingAgent: null,
    });
  },

  selectedAgentId: null,
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),

  selectedConcept: null,
  concepts: [],
  loadConcepts: async () => {
    try {
      set({ concepts: await api.fetchConcepts() });
    } catch (error) {
      console.error(error);
    }
  },
  selectConceptById: (conceptId) => {
    set({ selectedConcept: get().concepts.find((concept) => concept.id === conceptId) || null });
  },

  agents: [],
  agentsError: null,
  loadAgents: async () => {
    try {
      set({ agents: await api.fetchAgents(), agentsError: null });
    } catch (error) {
      set({
        agentsError: error instanceof Error ? error.message : 'Failed to load agents',
      });
    }
  },
  editingAgent: null,
  setEditingAgent: (editingAgent) => set({ editingAgent }),

  faultConfig: { enabled: false, target_tool: 'web_search', mode: 'wrong_answer' },
  setFaultConfig: (faultConfig) => set({ faultConfig }),
  resetFaultConfig: () =>
    set({ faultConfig: { enabled: false, target_tool: 'web_search', mode: 'wrong_answer' } }),
}));
