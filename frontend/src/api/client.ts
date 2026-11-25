import {
  AgentDefinition,
  AgentHistoryResponse,
  ConceptItem,
  PublicConfig,
  RunDetails,
  RunMetrics,
  RunSummary,
  ToolDefinition,
  FaultConfig,
} from '../types';

/**
 * In development Vite proxies `/runs`, `/agents`, ... to the FastAPI server.
 * In production (Vercel + Render) set VITE_API_URL to the backend origin.
 */
const API_BASE = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(
      `Cannot reach the AgentLens API at ${API_BASE || window.location.origin}. Is the backend running?`,
      0,
    );
  }
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') detail = body.detail;
      else if (body?.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* keep the status message */
    }
    throw new ApiError(detail, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function streamUrl(runId: string, lastEventId?: number): string {
  const suffix = lastEventId && lastEventId > 0 ? `?last_event_id=${lastEventId}` : '';
  return `${API_BASE}/runs/${runId}/events${suffix}`;
}

export const fetchRuns = () => request<RunSummary[]>('/runs');
export const fetchRun = (runId: string) => request<RunDetails>(`/runs/${runId}`);
export const fetchRunMetrics = (runId: string) => request<RunMetrics>(`/runs/${runId}/metrics`);
export const exportTrace = (runId: string) => request<unknown>(`/runs/${runId}/trace`);

export const createRun = (
  goal: string,
  config?: Record<string, unknown>,
  faultInjection?: FaultConfig,
) =>
  request<{ run_id: string; status: string }>(
    '/runs',
    jsonInit('POST', { goal, config, fault_injection: faultInjection }),
  );

export const fetchAgents = (type?: string) =>
  request<AgentDefinition[]>(type ? `/agents?agent_type=${type}` : '/agents');

export const createAgent = (data: Partial<AgentDefinition>) =>
  request<AgentDefinition>('/agents', jsonInit('POST', data));

export const updateAgent = (agentId: string, data: Partial<AgentDefinition>) =>
  request<AgentDefinition>(`/agents/${agentId}`, jsonInit('PUT', data));

export const deleteAgent = (agentId: string) =>
  request<{ success: boolean }>(`/agents/${agentId}`, { method: 'DELETE' });

export const toggleAgent = (agentId: string) =>
  request<AgentDefinition>(`/agents/${agentId}/toggle`, { method: 'POST' });

export const duplicateAgent = (agentId: string) =>
  request<AgentDefinition>(`/agents/${agentId}/duplicate`, { method: 'POST' });

export const testAgent = (agentId: string, testPrompt: string) =>
  request<any>(`/agents/${agentId}/test`, jsonInit('POST', { test_prompt: testPrompt }));

export const fetchAgentHistory = (agentId: string) =>
  request<AgentHistoryResponse>(`/agents/${agentId}/history`);

export const fetchTools = () => request<ToolDefinition[]>('/tools');
export const fetchConcepts = () => request<ConceptItem[]>('/concepts');
export const fetchConfig = () => request<PublicConfig>('/config');
