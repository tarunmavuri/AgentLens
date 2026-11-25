import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomAgentNode } from '../components/graph/CustomAgentNode';
import { AgentInspector } from '../components/workspace/AgentInspector';
import { ActivityTimeline } from '../components/workspace/ActivityTimeline';
import { CoderLive } from '../components/workspace/CoderLive';
import {
  Code2,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  MessageSquareQuote,
  Loader2,
} from 'lucide-react';
import { Event } from '../types';

const nodeTypes = { customAgent: CustomAgentNode };

const ACTION_STATUS: Record<string, string> = {
  thought: 'planning',
  tool_call: 'using_tool',
  tool_result: 'running',
  critique: 'reviewing',
  retry: 'retrying',
  agent_started: 'running',
  task_started: 'running',
};

export const LiveWorkspacePage: React.FC = () => {
  const {
    selectedRunId,
    activeRun,
    runs,
    loadRuns,
    selectRun,
    events,
    agents,
    loadAgents,
    selectedAgentId,
    setSelectedAgentId,
    theme,
    streamError,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'timeline' | 'coder' | 'answer'>('timeline');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);

  useEffect(() => {
    loadRuns();
    loadAgents();
  }, []);

  const finalAnswer = useMemo(() => {
    const finished = [...events].reverse().find((event) => event.type === 'run_finished');
    if (finished?.payload?.final_answer) return String(finished.payload.final_answer);
    const answer = [...events].reverse().find((event) => event.type === 'final_answer');
    return answer?.payload?.answer ? String(answer.payload.answer) : null;
  }, [events]);

  const failedTasks = useMemo(() => {
    const finished = [...events].reverse().find((event) => event.type === 'run_finished');
    const failed = finished?.payload?.totals?.failed_tasks;
    if (Array.isArray(failed)) return failed as { task_id: string; agent_id: string; reason: string }[];
    return activeRun?.totals?.failed_tasks ?? [];
  }, [events, activeRun]);

  const { nodes, edges } = useMemo(() => {
    const planEvent = events.find((event) => event.type === 'plan_created');
    const tasks: any[] = planEvent?.payload?.tasks ?? [];

    const agentIds: string[] = [];
    const add = (id?: string) => {
      if (id && id !== 'system' && !agentIds.includes(id)) agentIds.push(id);
    };
    add('planner');
    tasks.forEach((task) => add(task.assigned_agent_id));
    events.forEach((event) => {
      if (event.agent_category !== 'system') add(event.agent_id);
    });
    add('critic');

    // Layered layout: depth = longest dependency chain to this agent.
    const depth = new Map<string, number>([['planner', 0]]);
    for (const task of tasks) {
      const dependencyDepths = (task.depends_on ?? [])
        .map((depId: string) => tasks.find((candidate) => candidate.id === depId))
        .filter(Boolean)
        .map((depTask: any) => depth.get(depTask.assigned_agent_id) ?? 1);
      const level = 1 + (dependencyDepths.length ? Math.max(...dependencyDepths) : 0);
      depth.set(
        task.assigned_agent_id,
        Math.max(depth.get(task.assigned_agent_id) ?? 0, level),
      );
    }
    const deepest = Math.max(0, ...Array.from(depth.values()));
    depth.set('critic', deepest + 1);

    const columns = new Map<number, number>();
    const positions = new Map<string, { x: number; y: number }>();
    for (const agentId of agentIds) {
      const level = depth.get(agentId) ?? 1;
      const index = columns.get(level) ?? 0;
      columns.set(level, index + 1);
      positions.set(agentId, { x: 60 + level * 330, y: 40 + index * 230 });
    }

    const flowNodes: Node[] = agentIds.map((agentId) => {
      const definition = agents.find((agent) => agent.agent_id === agentId);
      const agentEvents: Event[] = events.filter((event) => event.agent_id === agentId);
      const last = agentEvents[agentEvents.length - 1];
      const finished = [...agentEvents]
        .reverse()
        .find((event) => event.type === 'agent_finished');
      const assignedTask = tasks.find((task) => task.assigned_agent_id === agentId);

      let status = 'idle';
      if (finished) {
        status = finished.payload?.status === 'failed' ? 'failed' : 'completed';
      } else if (last && ACTION_STATUS[last.type]) {
        status = ACTION_STATUS[last.type];
      } else if (assignedTask) {
        status = 'waiting';
      } else if (agentId === 'planner' && planEvent) {
        status = 'completed';
      } else if (agentId === 'critic' && tasks.length) {
        status = 'waiting';
      }

      const critiques = agentEvents.filter((event) => event.type === 'critique');
      const retries = agentEvents.filter(
        (event) =>
          event.type === 'retry' && event.payload?.agent_id === agentId,
      );

      return {
        id: agentId,
        type: 'customAgent',
        position: positions.get(agentId) ?? { x: 60, y: 60 },
        data: {
          agent_id: agentId,
          name: definition?.name || agentId.replace(/_/g, ' '),
          role: definition?.role || 'Specialised agent',
          category:
            definition?.agent_type ??
            (['planner', 'researcher', 'coder', 'critic'].includes(agentId)
              ? 'built_in'
              : 'custom'),
          status,
          currentTaskTitle: assignedTask?.title,
          criticScore: critiques.length
            ? critiques[critiques.length - 1].payload?.score
            : undefined,
          retryCount: retries.length,
          isSelected: selectedAgentId === agentId,
        },
      };
    });

    const flowEdges: Edge[] = [];
    const edgeSeen = new Set<string>();
    const pushEdge = (source: string, target: string, color: string, label?: string) => {
      if (source === target) return;
      const key = `${source}->${target}`;
      if (edgeSeen.has(key)) return;
      if (!agentIds.includes(source) || !agentIds.includes(target)) return;
      edgeSeen.add(key);
      flowEdges.push({
        id: `edge-${key}`,
        source,
        target,
        label,
        animated: true,
        style: { stroke: color, strokeWidth: 2 },
        labelStyle: { fill: color, fontSize: 9 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      });
    };

    tasks.forEach((task) => {
      if (!task.depends_on || task.depends_on.length === 0) {
        pushEdge('planner', task.assigned_agent_id, '#FF513C');
      } else {
        task.depends_on.forEach((depId: string) => {
          const dependency = tasks.find((candidate) => candidate.id === depId);
          if (dependency) {
            pushEdge(dependency.assigned_agent_id, task.assigned_agent_id, '#FF513C');
          }
        });
      }
    });

    // Every terminal worker hands to the Critic.
    const terminalAgents = new Set<string>();
    tasks.forEach((task) => {
      const dependents = tasks.filter((candidate) =>
        (candidate.depends_on ?? []).includes(task.id),
      );
      if (dependents.length === 0) terminalAgents.add(task.assigned_agent_id);
    });
    terminalAgents.forEach((agentId) => pushEdge(agentId, 'critic', '#A855F7'));

    if (tasks.length === 0 && agentIds.includes('planner')) {
      pushEdge('planner', 'critic', '#A855F7');
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [events, agents, selectedAgentId]);

  const selectedAgentDef = agents.find((agent) => agent.agent_id === selectedAgentId) || null;
  const isWorking = activeRun && ['queued', 'running'].includes(activeRun.status);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <div className="px-5 py-3 border-b dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-hidden">
          <select
            value={selectedRunId || ''}
            onChange={(event) => selectRun(event.target.value)}
            className="px-3 py-1.5 rounded-xl border text-xs font-semibold dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border max-w-xs truncate"
          >
            {runs.length === 0 && <option value="">No runs yet</option>}
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id.includes('golden') ? `Demo · ${run.goal}` : run.goal}
              </option>
            ))}
          </select>

          {activeRun && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider dark:bg-charcoal-bg bg-cream-bg border dark:border-charcoal-border border-cream-border">
              {isWorking && <Loader2 className="w-3 h-3 mr-1 animate-spin text-coral" />}
              {activeRun.status.replace(/_/g, ' ')}
            </span>
          )}

          <span className="text-xs font-medium dark:text-charcoal-muted text-cream-muted hidden md:inline truncate">
            {activeRun?.goal}
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full dark:bg-charcoal-bg bg-cream-bg border dark:border-charcoal-border border-cream-border font-mono text-[11px]">
            <span>{events.length} events</span>
            <span>·</span>
            <span className="text-coral">
              ${(activeRun?.totals?.cost_usd || 0).toFixed(5)}
            </span>
          </div>

          <button
            onClick={() => setIsInspectorOpen((open) => !open)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-colors ${
              isInspectorOpen
                ? 'bg-coral text-white border-coral'
                : 'dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-bg hover:bg-cream-bg'
            }`}
          >
            Inspector
          </button>
        </div>
      </div>

      {streamError && (
        <div className="px-5 py-2 bg-red-500/10 text-red-500 text-[11px] flex items-center space-x-2 border-b border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{streamError}</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative dark:bg-[#110E13] bg-[#EFE9E1] transition-colors">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-2">
              <p className="text-sm font-semibold">No execution loaded</p>
              <p className="text-xs dark:text-charcoal-muted text-cream-muted max-w-sm">
                Select a run, or launch a new goal. Agent nodes appear as soon as the
                Planner publishes its plan event.
              </p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedAgentId(node.id)}
              fitView
              fitViewOptions={{ padding: 0.18, maxZoom: 0.9 }}
              minZoom={0.35}
              colorMode={theme}
            >
              <Background color={theme === 'dark' ? '#27202A' : '#DED5C9'} gap={16} />
              <Controls
                className={
                  theme === 'dark'
                    ? '!bg-charcoal-surface !border-charcoal-border'
                    : '!bg-cream-surface !border-cream-border'
                }
              />
              <MiniMap
                nodeColor={theme === 'dark' ? '#8C7594' : '#B9AB9C'}
                nodeStrokeColor={theme === 'dark' ? '#FF513C' : '#FF513C'}
                maskColor={
                  theme === 'dark'
                    ? 'rgba(21, 18, 23, 0.7)'
                    : 'rgba(245, 240, 234, 0.7)'
                }
                pannable
                zoomable
                style={{ width: 150, height: 96 }}
                className="!border dark:!border-charcoal-border !border-cream-border rounded-xl overflow-hidden"
              />
            </ReactFlow>
          )}
        </div>

        {isInspectorOpen && (
          <div className="w-80 border-l dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface flex-shrink-0 transition-all overflow-hidden">
            <AgentInspector
              agent={selectedAgentDef}
              onClose={() => setIsInspectorOpen(false)}
            />
          </div>
        )}
      </div>

      {failedTasks.length > 0 && (
        <div className="px-4 py-2 border-t dark:border-amber-500/30 border-amber-500/30 bg-amber-500/10 text-[11px] text-amberAccent">
          <span className="font-bold uppercase tracking-wider">
            {failedTasks.length} task(s) failed:
          </span>{' '}
          {failedTasks.map((task) => `${task.task_id} (${task.agent_id})`).join(', ')}
        </div>
      )}

      <div
        className={`border-t dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface transition-all duration-300 flex flex-col ${
          isBottomCollapsed ? 'h-10' : 'h-72'
        }`}
      >
        <div className="h-10 px-4 border-b dark:border-charcoal-border border-cream-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setActiveTab('timeline');
                setIsBottomCollapsed(false);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'timeline' && !isBottomCollapsed
                  ? 'bg-coral text-white'
                  : 'dark:text-charcoal-muted text-cream-muted hover:text-coral'
              }`}
            >
              Activity Feed
            </button>

            <button
              onClick={() => {
                setActiveTab('coder');
                setIsBottomCollapsed(false);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5 ${
                activeTab === 'coder' && !isBottomCollapsed
                  ? 'bg-coral text-white'
                  : 'dark:text-charcoal-muted text-cream-muted hover:text-coral'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Coder Live</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('answer');
                setIsBottomCollapsed(false);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5 ${
                activeTab === 'answer' && !isBottomCollapsed
                  ? 'bg-coral text-white'
                  : 'dark:text-charcoal-muted text-cream-muted hover:text-coral'
              }`}
            >
              <MessageSquareQuote className="w-3.5 h-3.5" />
              <span>Final Answer</span>
            </button>
          </div>

          <button
            onClick={() => setIsBottomCollapsed((collapsed) => !collapsed)}
            className="p-1 rounded-lg hover:dark:bg-charcoal-bg hover:bg-cream-bg transition-colors text-neutral-400"
            aria-label={isBottomCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isBottomCollapsed ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {!isBottomCollapsed && (
          <div className="flex-1 overflow-hidden">
            {activeTab === 'timeline' && <ActivityTimeline events={events} />}
            {activeTab === 'coder' && <CoderLive events={events} />}
            {activeTab === 'answer' && (
              <div className="h-full overflow-y-auto p-5 space-y-3">
                {finalAnswer ? (
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans">
                    {finalAnswer}
                  </pre>
                ) : (
                  <p className="text-xs dark:text-charcoal-muted text-cream-muted">
                    The final answer is composed from stored task results when the run
                    finishes. Nothing to show yet.
                  </p>
                )}
                {failedTasks.length > 0 && (
                  <div className="pt-3 border-t dark:border-charcoal-border border-cream-border space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amberAccent">
                      Recorded failures
                    </p>
                    {failedTasks.map((task) => (
                      <p key={task.task_id} className="text-[11px]">
                        <span className="font-mono text-coral">{task.task_id}</span>{' '}
                        ({task.agent_id}): {task.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
