export interface Usage {
  in_tokens: number;
  out_tokens: number;
  cost_usd: number;
  latency_ms: number;
  model?: string | null;
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

export type RunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed';

export interface RunTotals {
  in_tokens?: number;
  out_tokens?: number;
  cost_usd?: number;
  duration_seconds?: number;
  steps?: number;
  retries?: number;
  tool_calls?: number;
  faults_injected?: number;
  average_critic_score?: number | null;
  critic_scores?: number[];
  failed_tasks?: { task_id: string; agent_id: string; reason: string }[];
  [key: string]: any;
}

export interface RunSummary {
  id: string;
  goal: string;
  status: RunStatus;
  created_at: number;
  totals: RunTotals;
}

export interface RunDetails extends RunSummary {
  config: Record<string, any>;
}

export interface AgentMetric {
  agent_id: string;
  agent_category: string;
  events: number;
  thoughts: number;
  tool_calls: number;
  in_tokens: number;
  out_tokens: number;
  cost_usd: number;
}

export interface RunMetrics {
  run_id: string;
  status: RunStatus;
  goal: string;
  computed: {
    in_tokens: number;
    out_tokens: number;
    total_tokens: number;
    cost_usd: number;
    llm_latency_ms: number;
    steps: number;
    events: number;
    tool_calls: number;
    retries: number;
    faults_injected: number;
    critic_scores: number[];
    average_critic_score: number | null;
    tasks_started: number;
    tasks_completed: number;
    tasks_failed: number;
    wall_clock_seconds: number;
    agents: AgentMetric[];
  };
  recorded: RunTotals;
  event_range: { first_id: number | null; last_id: number | null };
}

export interface AgentExecution {
  run_id: string;
  goal: string;
  task_id: string | null;
  status: string;
  started_at: number;
  finished_at: number | null;
  thoughts: number;
  tool_calls: number;
  events: number;
  critic_score: number | null;
}

export interface AgentHistoryResponse {
  agent_id: string;
  executions: AgentExecution[];
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
  target_tool: 'web_search' | 'python_sandbox' | '*';
  mode: 'empty' | 'garbage' | 'timeout' | 'wrong_answer';
}

export interface PublicConfig {
  app_name: string;
  version: string;
  environment: string;
  llm_mode: 'gemini' | 'offline_simulation' | 'disabled';
  llm_configured: boolean;
  default_model: string;
  allowed_models: string[];
  search_provider: string;
  sandbox_timeout_seconds: number;
  limits: {
    max_steps: number;
    max_tokens: number;
    max_seconds: number;
    max_retries: number;
    max_tasks_per_plan: number;
  };
  rate_limit: { requests: number; window_seconds: number };
  pricing_per_million_tokens: Record<
    string,
    { input_cost_per_million: number; output_cost_per_million: number }
  >;
}
