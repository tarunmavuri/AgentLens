import { RunSummary, RunDetails, AgentDefinition, ToolDefinition, ConceptItem, FaultConfig } from '../types';

const API_BASE = ''; // Proxy handles routing to http://127.0.0.1:8000

export async function fetchRuns(): Promise<RunSummary[]> {
  const res = await fetch(`${API_BASE}/runs`);
  if (!res.ok) throw new Error('Failed to fetch runs');
  return res.json();
}

export async function fetchRun(runId: string): Promise<RunDetails> {
  const res = await fetch(`${API_BASE}/runs/${runId}`);
  if (!res.ok) throw new Error('Failed to fetch run details');
  return res.json();
}

export async function createRun(goal: string, config?: Record<string, any>, faultInjection?: FaultConfig): Promise<{ run_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, config, fault_injection: faultInjection })
  });
  if (!res.ok) throw new Error('Failed to start run');
  return res.json();
}

export async function exportTrace(runId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/runs/${runId}/trace`);
  if (!res.ok) throw new Error('Failed to export trace');
  return res.json();
}

export async function fetchAgents(type?: string): Promise<AgentDefinition[]> {
  const url = type ? `${API_BASE}/agents?agent_type=${type}` : `${API_BASE}/agents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function createAgent(data: Partial<AgentDefinition>): Promise<AgentDefinition> {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create agent');
  return res.json();
}

export async function updateAgent(agentId: string, data: Partial<AgentDefinition>): Promise<AgentDefinition> {
  const res = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update agent');
  return res.json();
}

export async function deleteAgent(agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${agentId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete agent');
}

export async function toggleAgent(agentId: string): Promise<AgentDefinition> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/toggle`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to toggle agent');
  return res.json();
}

export async function duplicateAgent(agentId: string): Promise<AgentDefinition> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to duplicate agent');
  return res.json();
}

export async function testAgent(agentId: string, testPrompt: string): Promise<any> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test_prompt: testPrompt })
  });
  if (!res.ok) throw new Error('Failed to test agent');
  return res.json();
}

export async function fetchTools(): Promise<ToolDefinition[]> {
  const res = await fetch(`${API_BASE}/tools`);
  if (!res.ok) throw new Error('Failed to fetch tools');
  return res.json();
}

export async function fetchConcepts(): Promise<ConceptItem[]> {
  const res = await fetch(`${API_BASE}/concepts`);
  if (!res.ok) throw new Error('Failed to fetch concepts');
  return res.json();
}

