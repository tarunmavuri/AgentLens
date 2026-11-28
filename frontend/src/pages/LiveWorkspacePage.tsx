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
import { StoryFeed } from '../components/workspace/StoryFeed';
import { CoderLive } from '../components/workspace/CoderLive';
import {
  Code2,
  AlertCircle,
  MessageSquareQuote,
  Loader2,
  ListOrdered,
  Lightbulb,
  Info,
  Terminal,
  PlayCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Event, TaskDefinition } from '../types';
import {
  agentPlain,
  eventPlain,
  runNarration,
  statusLabel,
} from '../lib/plain';

interface LiveWorkspacePageProps {
  onOpenNewRun?: () => void;
}

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

type BottomTab = 'timeline' | 'sandbox' | 'answer';

export const LiveWorkspacePage: React.FC<LiveWorkspacePageProps> = ({ onOpenNewRun }) => {
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

  const [bottomTab, setBottomTab] = useState<BottomTab>('timeline');
  const [isTechnicalLog, setIsTechnicalLog] = useState(false);
  const [isLowerExpanded, setIsLowerExpanded] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

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

  const tasks = useMemo(() => {
    const planEvent = events.find((event) => event.type === 'plan_created');
    return (planEvent?.payload?.tasks ?? []) as TaskDefinition[];
  }, [events]);

  const completedTaskCount = useMemo(() => {
    const doneIds = new Set(
      events
        .filter((e) => e.type === 'task_done' || e.type === 'task_completed')
        .map((e) => e.task_id)
        .filter(Boolean),
    );
    return doneIds.size;
  }, [events]);

  const narration = useMemo(
    () => runNarration(events, activeRun?.status),
    [events, activeRun?.status],
  );

  const { nodes, edges } = useMemo(() => {
    const planEvent = events.find((event) => event.type === 'plan_created');

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

    const depth = new Map<string, number>([['planner', 0]]);
    for (const task of tasks) {
      const dependencyDepths = (task.depends_on ?? [])
        .map((depId: string) => tasks.find((candidate) => candidate.id === depId))
        .filter(Boolean)
        .map((depTask: any) => depth.get(depTask.assigned_agent_id) ?? 1);
      const level = 1 + (dependencyDepths.length ? Math.max(...dependencyDepths) : 0);
      depth.set(task.assigned_agent_id, Math.max(depth.get(task.assigned_agent_id) ?? 0, level));
    }
    const deepest = Math.max(0, ...Array.from(depth.values()));
    depth.set('critic', deepest + 1);

    const columns = new Map<number, number>();
    const positions = new Map<string, { x: number; y: number }>();
    for (const agentId of agentIds) {
      const level = depth.get(agentId) ?? 1;
      const index = columns.get(level) ?? 0;
      columns.set(level, index + 1);
      positions.set(agentId, { x: 40 + level * 330, y: 40 + index * 200 });
    }

    const flowNodes: Node[] = agentIds.map((agentId) => {
      const definition = agents.find((agent) => agent.agent_id === agentId);
      const agentEvents: Event[] = events.filter((event) => event.agent_id === agentId);
      const last = agentEvents[agentEvents.length - 1];
      const finished = [...agentEvents].reverse().find((event) => event.type === 'agent_finished');
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
        (event) => event.type === 'retry' && event.payload?.agent_id === agentId,
      );

      return {
        id: agentId,
        type: 'customAgent',
        position: positions.get(agentId) ?? { x: 40, y: 40 },
        data: {
          agent_id: agentId,
          name: definition?.name || agentPlain(agentId).name,
          role: definition?.role || agentPlain(agentId).does,
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
    const pushEdge = (source: string, target: string, color: string) => {
      if (source === target) return;
      const key = `${source}->${target}`;
      if (edgeSeen.has(key)) return;
      if (!agentIds.includes(source) || !agentIds.includes(target)) return;
      edgeSeen.add(key);
      flowEdges.push({
        id: `edge-${key}`,
        source,
        target,
        animated: true,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      });
    };

    tasks.forEach((task) => {
      if (!task.depends_on || task.depends_on.length === 0) {
        pushEdge('planner', task.assigned_agent_id, '#FF513C');
      } else {
        task.depends_on.forEach((depId: string) => {
          const dependency = tasks.find((candidate) => candidate.id === depId);
          if (dependency) pushEdge(dependency.assigned_agent_id, task.assigned_agent_id, '#FF513C');
        });
      }
    });

    const terminalAgents = new Set<string>();
    tasks.forEach((task) => {
      const dependents = tasks.filter((candidate) => (candidate.depends_on ?? []).includes(task.id));
      if (dependents.length === 0) terminalAgents.add(task.assigned_agent_id);
    });
    terminalAgents.forEach((agentId) => pushEdge(agentId, 'critic', '#F47742'));

    if (tasks.length === 0 && agentIds.includes('planner')) {
      pushEdge('planner', 'critic', '#F47742');
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [events, agents, selectedAgentId, tasks]);

  const selectedAgentDef = agents.find((agent) => agent.agent_id === selectedAgentId) || null;
  const selectedAgentTask = tasks.find((task) => task.assigned_agent_id === selectedAgentId) || null;
  const isWorking = activeRun && ['queued', 'running'].includes(activeRun.status);

  return (
    <div className="min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] flex flex-col lg:overflow-hidden">
      {/* Top Controls + Progress + Guide */}
      <div className="px-4 sm:px-6 py-3 border-b border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface space-y-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
            Execution:
          </label>
          <select
            value={selectedRunId || ''}
            onChange={(event) => selectRun(event.target.value)}
            className="h-8 px-3 rounded-full border text-xs font-semibold bg-cream-bg dark:bg-charcoal-bg border-cream-border dark:border-charcoal-border max-w-xs sm:max-w-sm truncate"
          >
            {runs.length === 0 && <option value="">No executions yet</option>}
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id.includes('golden') ? `Demo · ${run.goal}` : run.goal}
              </option>
            ))}
          </select>

          {activeRun && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                activeRun.status === 'completed'
                  ? 'bg-statusSuccess/10 text-statusSuccess border-statusSuccess/25'
                  : activeRun.status === 'failed'
                    ? 'bg-statusError/10 text-statusError border-statusError/25'
                    : 'bg-coral/10 text-coral border-coral/30'
              }`}
            >
              {isWorking && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{statusLabel(activeRun.status)}</span>
            </span>
          )}

          {tasks.length > 0 && (
            <span className="text-xs font-mono text-cream-muted dark:text-charcoal-muted">
              Tasks: {completedTaskCount}/{tasks.length}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGuide((open) => !open)}
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold border border-cream-border dark:border-charcoal-border hover:border-coral transition-colors"
              aria-expanded={showGuide}
            >
              <Info className="w-3.5 h-3.5 text-coral" />
              <span>{showGuide ? 'Hide Guide' : 'How it works'}</span>
            </button>

            {onOpenNewRun && (
              <button
                type="button"
                onClick={onOpenNewRun}
                className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white transition-colors"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Execution</span>
              </button>
            )}
          </div>
        </div>

        {/* Clean inline narration stripe (no rounded box!) */}
        <div
          className={`flex items-center justify-between gap-3 pl-3.5 py-1 border-l-2 text-xs ${
            narration.tone === 'done'
              ? 'border-statusSuccess'
              : narration.tone === 'warn'
                ? 'border-amberAccent'
                : narration.tone === 'working'
                  ? 'border-coral'
                  : 'border-cream-border dark:border-charcoal-border'
          }`}
        >
          <div className="min-w-0">
            <span className="font-semibold">{narration.headline}</span>
            <span className="hidden sm:inline text-cream-muted dark:text-charcoal-muted">
              {' '}
              — {narration.detail}
            </span>
          </div>
          <span className="text-[11px] font-mono text-cream-muted dark:text-charcoal-muted flex-shrink-0">
            {events.length} events
          </span>
        </div>

        {showGuide && (
          <div className="grid gap-3 sm:grid-cols-3 text-xs text-cream-muted dark:text-charcoal-muted pt-2 border-t border-cream-border dark:border-charcoal-border">
            <p>
              <span className="font-semibold text-cream-text dark:text-charcoal-text">
                1. Agent Nodes:
              </span>{' '}
              Each node handles one delegated task in dependency order.
            </p>
            <p>
              <span className="font-semibold text-cream-text dark:text-charcoal-text">
                2. Collaboration Edges:
              </span>{' '}
              Coral paths show task handoffs; Amber paths lead into Critic evaluation.
            </p>
            <p>
              <span className="font-semibold text-cream-text dark:text-charcoal-text">
                3. Inspector & Timeline:
              </span>{' '}
              Click any node to inspect permissions and follow every step below.
            </p>
          </div>
        )}
      </div>

      {streamError && (
        <div className="px-5 py-2 bg-statusError/10 text-statusError text-xs flex items-center gap-2 border-b border-statusError/20">
          <AlertCircle className="w-4 h-4" />
          <span>{streamError}</span>
        </div>
      )}

      {/* Main Graph + Secondary Inspector */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 min-h-[340px] lg:min-h-0 relative bg-[#EFE8DF] dark:bg-[#110E13] border-b lg:border-b-0 lg:border-r border-cream-border dark:border-charcoal-border">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-2">
              <p className="text-sm font-semibold">No execution graph loaded</p>
              <p className="text-xs text-cream-muted dark:text-charcoal-muted max-w-sm">
                Pick an execution above or press{' '}
                <span className="font-semibold text-coral">New Execution</span> to watch the team
                collaborate.
              </p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedAgentId(node.id)}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 0.95 }}
              minZoom={0.35}
              colorMode={theme}
            >
              <Background color={theme === 'dark' ? '#2A222D' : '#DDD2C5'} gap={18} />
              <Controls
                className={
                  theme === 'dark'
                    ? '!bg-charcoal-surface !border-charcoal-border'
                    : '!bg-cream-surface !border-cream-border'
                }
              />
              <MiniMap
                nodeColor={theme === 'dark' ? '#8C7594' : '#B9AB9C'}
                nodeStrokeColor="#FF513C"
                maskColor={
                  theme === 'dark' ? 'rgba(21, 18, 23, 0.72)' : 'rgba(246, 241, 234, 0.75)'
                }
                pannable
                zoomable
                style={{ width: 140, height: 90 }}
                className="!border !border-cream-border dark:!border-charcoal-border rounded-xl overflow-hidden"
              />
            </ReactFlow>
          )}
        </div>

        <div className="lg:col-span-4 min-h-[240px] lg:min-h-0 bg-cream-surface dark:bg-charcoal-surface overflow-hidden">
          <AgentInspector
            agent={selectedAgentDef}
            assignedTask={selectedAgentTask}
            onClose={selectedAgentId ? () => setSelectedAgentId(null) : undefined}
          />
        </div>
      </div>

      {/* Lower Tabbed Panel */}
      <div
        className={`border-t border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface flex flex-col transition-all ${
          isLowerExpanded ? 'h-72 sm:h-80' : 'h-11'
        }`}
      >
        <div className="h-11 px-4 border-b border-cream-border dark:border-charcoal-border flex items-center justify-between gap-2 overflow-x-auto flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {(
              [
                { key: 'timeline', label: 'Event Timeline', icon: <ListOrdered className="w-3.5 h-3.5" /> },
                { key: 'sandbox', label: 'Code Sandbox', icon: <Code2 className="w-3.5 h-3.5" /> },
                { key: 'answer', label: 'Final Output', icon: <Lightbulb className="w-3.5 h-3.5" /> },
              ] as const
            ).map((tab) => {
              const active = bottomTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setBottomTab(tab.key);
                    setIsLowerExpanded(true);
                  }}
                  className={`h-7 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-coral text-white'
                      : 'text-cream-muted dark:text-charcoal-muted hover:bg-cream-subtle dark:hover:bg-charcoal-subtle'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {bottomTab === 'timeline' && isLowerExpanded && (
              <button
                type="button"
                onClick={() => setIsTechnicalLog((v) => !v)}
                className="h-7 px-3 rounded-full border border-cream-border dark:border-charcoal-border text-[11px] font-semibold inline-flex items-center gap-1.5 hover:border-coral transition-colors whitespace-nowrap"
              >
                <Terminal className="w-3 h-3 text-coral" />
                <span>{isTechnicalLog ? 'Plain Summary View' : 'Technical Event View'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsLowerExpanded((v) => !v)}
              aria-label={isLowerExpanded ? 'Collapse lower panel' : 'Expand lower panel'}
              className="p-1.5 rounded-full hover:bg-cream-subtle dark:hover:bg-charcoal-subtle text-cream-muted dark:text-charcoal-muted"
            >
              {isLowerExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {isLowerExpanded && (
          <div className="flex-1 min-h-0 overflow-hidden">
            {bottomTab === 'timeline' &&
              (isTechnicalLog ? (
                <ActivityTimeline events={events} />
              ) : (
                <StoryFeed events={events} />
              ))}

            {bottomTab === 'sandbox' && <CoderLive events={events} />}

            {bottomTab === 'answer' && (
              <div className="h-full overflow-y-auto p-5">
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 pb-2 border-b border-cream-border dark:border-charcoal-border">
                      <MessageSquareQuote className="w-4 h-4 text-coral" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Synthesized Final Output
                      </h3>
                    </div>
                    {finalAnswer ? (
                      <pre className="whitespace-pre-wrap text-xs sm:text-[13px] leading-relaxed font-sans">
                        {finalAnswer}
                      </pre>
                    ) : (
                      <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                        {isWorking
                          ? 'Execution in progress — synthesized output appears once tasks finish.'
                          : 'No final answer recorded for this execution.'}
                      </p>
                    )}
                  </div>

                  {failedTasks.length > 0 && (
                    <div className="pl-3.5 border-l-2 border-amberAccent space-y-1 text-xs">
                      <p className="font-bold text-amberAccent">
                        {failedTasks.length} task{failedTasks.length === 1 ? '' : 's'} failed
                      </p>
                      {failedTasks.map((task) => (
                        <p key={task.task_id} className="text-[11px]">
                          <span className="font-mono font-semibold text-coral">{task.task_id}</span>{' '}
                          · {agentPlain(task.agent_id).name}: {task.reason}
                        </p>
                      ))}
                    </div>
                  )}

                  {events.length > 0 && (
                    <p className="text-[11px] text-cream-muted dark:text-charcoal-muted">
                      Last event:{' '}
                      <span className="font-semibold text-cream-text dark:text-charcoal-text">
                        {eventPlain(events[events.length - 1]).title}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
