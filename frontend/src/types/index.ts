export interface Usage {
  in_tokens: number;
  out_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

export interface Event {
  id: number;
  run_id: string;
  ts: number;
  type: string;
  agent_id: string;
  agent_category: 'built_in' | 'custom' | 'system';
  task_id: string | null;
  payload: Record<string, any>;
  concept: string | null;
  usage: Usage | null;
}

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  assigned_agent_id: string;
  task_type: string;
  depends_on: string[];
  success_criteria: string;
  expected_output?: string;
}

export interface AgentDefinition {
  agent_id: string;
  name: string;
  description: string;
  role: string;
  instructions: string;
  llm_config: {
    model: string;
    temperature: number;
    [key: string]: any;
  };
  allowed_tools: string[];
  output_schema: Record<string, any>;
  execution_limits: {
    max_steps: number;
    timeout_seconds: number;
    [key: string]: any;
  };
  agent_type: 'built_in' | 'custom';
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface RunTotals {
  in_tokens?: number;
  out_tokens?: number;
  cost_usd?: number;
  duration_seconds?: number;
  steps?: number;
  retries?: number;
  average_critic_score?: number;
  critic_scores?: number[];
  [key: string]: any;
}

export interface RunSummary {
  id: string;
  goal: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: number;
  totals: RunTotals;
}

export interface RunDetails extends RunSummary {
  config: Record<string, any>;
}

export interface ConceptItem {
  id: string;
  title: string;
  explanation: string;
  learn_more_url: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  category: string;
}

export interface FaultConfig {
  enabled: boolean;
  target_tool: string;
  mode: 'empty' | 'garbage' | 'timeout' | 'wrong_answer';
}

