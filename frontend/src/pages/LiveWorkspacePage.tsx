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
import { motion, AnimatePresence } from 'framer-motion';
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
  Workflow,
  ListOrdered,
  Lightbulb,
  Info,
  X,
  Terminal,
} from 'lucide-react';
import { Event } from '../types';
import {
  agentPlain,
  eventPlain,
  runNarration,
  statusHint,
  statusLabel,
} from '../lib/plain';

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

type Mode = 'watch' | 'steps' | 'answer';

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

  const [mode, setMode] = useState<Mode>('watch');
  const [showGuide, setShowGuide] = useState(true);
  const [isTechnicalLog, setIsTechnicalLog] = useState(false);
  const [isCoderOpen, setIsCoderOpen] = useState(false);

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
    return (planEvent?.payload?.tasks ?? []) as any[];
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

    // Layered layout: depth = longest dependency chain to this agent.
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
      positions.set(agentId, { x: 60 + level * 330, y: 40 + index * 230 });
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
        position: positions.get(agentId) ?? { x: 60, y: 60 },
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

    // Every terminal worker hands to the Critic.
    const terminalAgents = new Set<string>();
    tasks.forEach((task) => {
      const dependents = tasks.filter((candidate) => (candidate.depends_on ?? []).includes(task.id));
      if (dependents.length === 0) terminalAgents.add(task.assigned_agent_id);
    });
    terminalAgents.forEach((agentId) => pushEdge(agentId, 'critic', '#A855F7'));

    if (tasks.length === 0 && agentIds.includes('planner')) {
      pushEdge('planner', 'critic', '#A855F7');
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [events, agents, selectedAgentId, tasks]);

  const selectedAgentDef = agents.find((agent) => agent.agent_id === selectedAgentId) || null;
  const isWorking = activeRun && ['queued', 'running'].includes(activeRun.status);

  const modes: { key: Mode; label: string; hint: string; icon: React.ReactNode }[] = [
    { key: 'watch', label: 'Watch the team', hint: 'Who is doing what', icon: <Workflow className="w-3.5 h-3.5" /> },
    { key: 'steps', label: 'Step by step', hint: 'The story, in order', icon: <ListOrdered className="w-3.5 h-3.5" /> },
    { key: 'answer', label: 'The answer', hint: 'What you asked for', icon: <Lightbulb className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">

      {/* ---------- Run picker + plain status ---------- */}
      <div className="px-5 py-3 border-b dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
            Which run?
          </label>
          <select
            value={selectedRunId || ''}
            onChange={(event) => selectRun(event.target.value)}
            className="px-3 py-1.5 rounded-xl border text-xs font-semibold dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border max-w-sm truncate"
          >
            {runs.length === 0 && <option value="">No runs yet</option>}
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id.includes('golden') ? `Demo · ${run.goal}` : run.goal}
              </option>
            ))}
          </select>

          {activeRun && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider dark:bg-charcoal-bg bg-cream-bg border dark:border-charcoal-border border-cream-border">
              {isWorking && <Loader2 className="w-3 h-3 mr-1 animate-spin text-coral" />}
              {statusLabel(activeRun.status)}
            </span>
          )}

          <span className="text-[11px] dark:text-charcoal-muted text-cream-muted">
            {statusHint(activeRun?.status)}
          </span>

          <button
            onClick={() => setShowGuide((open) => !open)}
            className="ml-auto inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border dark:border-charcoal-border border-cream-border hover:border-coral/50 transition-colors"
            aria-expanded={showGuide}
          >
            <Info className="w-3.5 h-3.5 text-coral" />
            <span>{showGuide ? 'Hide guide' : 'What am I looking at?'}</span>
          </button>
        </div>

        {/* Narration: one sentence that always answers "what is happening?" */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${narration.headline}-${events.length}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            className={`flex items-start space-x-3 px-3.5 py-2.5 rounded-xl border text-xs leading-relaxed ${
              narration.tone === 'done'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : narration.tone === 'warn'
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : narration.tone === 'working'
                    ? 'border-coral/30 bg-coral/5'
                    : 'dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg'
            }`}
          >
            <span className="text-base leading-none" aria-hidden="true">
              {narration.tone === 'done' ? '🎉' : narration.tone === 'warn' ? '⚠️' : narration.tone === 'working' ? '⏳' : '💤'}
            </span>
            <div>
              <p className="font-bold">{narration.headline}</p>
              <p className="dark:text-charcoal-muted text-cream-muted">{narration.detail}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        {showGuide && (
          <div className="grid gap-2 sm:grid-cols-3 text-[11px] dark:text-charcoal-muted text-cream-muted border-t dark:border-charcoal-border border-cream-border pt-2.5">
            <p><span className="font-bold dark:text-charcoal-text text-cream-text">Boxes</span> are agents — one job each.</p>
            <p><span className="font-bold dark:text-charcoal-text text-cream-text">Arrows</span> show who hands work to whom.</p>
            <p><span className="font-bold dark:text-charcoal-text text-cream-text">Click a box</span> to see that agent's setup.</p>
          </div>
        )}
      </div>

      {streamError && (
        <div className="px-5 py-2 bg-red-500/10 text-red-500 text-[11px] flex items-center space-x-2 border-b border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{streamError}</span>
        </div>
      )}

      {/* ---------- Mode switcher: one thing at a time ---------- */}
      <div className="px-5 py-2 border-b dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface flex items-center gap-2 overflow-x-auto">
        {modes.map((item) => {
          const active = mode === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setMode(item.key)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
                active
                  ? 'bg-coral text-white border-coral shadow-md shadow-coral/20'
                  : 'dark:border-charcoal-border border-cream-border dark:text-charcoal-muted text-cream-muted hover:border-coral/40'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              <span className={`hidden lg:inline text-[10px] font-medium ${active ? 'text-white/80' : 'opacity-60'}`}>
                · {item.hint}
              </span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center space-x-2">
          <button
            onClick={() => setIsCoderOpen(true)}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold dark:border-charcoal-border border-cream-border hover:border-coral/40 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5 text-coral" />
            <span>Code it ran</span>
          </button>
          <span className="text-[10px] font-mono dark:text-charcoal-muted text-cream-muted">
            {events.length} steps
          </span>
        </div>
      </div>

      {/* ---------- Panels ---------- */}
      <div className="flex-1 min-h-0 relative dark:bg-[#110E13] bg-[#EFE9E1]">

        {mode === 'watch' && (
          nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-2">
              <p className="text-sm font-semibold">No run selected yet</p>
              <p className="text-xs dark:text-charcoal-muted text-cream-muted max-w-sm">
                Pick a run above, or press “Ask AgentLens” to start one. Agent boxes appear as soon
                as the Planner splits up your goal.
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
                nodeStrokeColor="#FF513C"
                maskColor={
                  theme === 'dark' ? 'rgba(21, 18, 23, 0.7)' : 'rgba(245, 240, 234, 0.7)'
                }
                pannable
                zoomable
                style={{ width: 150, height: 96 }}
                className="!border dark:!border-charcoal-border !border-cream-border rounded-xl overflow-hidden"
              />
            </ReactFlow>
          )
        )}

        {mode === 'steps' && (
          <div className="absolute inset-0 flex flex-col dark:bg-charcoal-bg bg-cream-bg">
            <div className="px-5 py-2 flex items-center justify-end border-b dark:border-charcoal-border border-cream-border">
              <button
                onClick={() => setIsTechnicalLog((open) => !open)}
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold border dark:border-charcoal-border border-cream-border hover:border-coral/40 transition-colors"
              >
                <Terminal className="w-3 h-3 text-coral" />
                <span>{isTechnicalLog ? 'Read the story' : 'Technical log'}</span>
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {isTechnicalLog ? <ActivityTimeline events={events} /> : <StoryFeed events={events} />}
            </div>
          </div>
        )}

        {mode === 'answer' && (
          <div className="absolute inset-0 overflow-y-auto dark:bg-charcoal-bg bg-cream-bg">
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
                  Your question
                </span>
                <h2 className="text-lg font-bold leading-snug">
                  {activeRun?.goal ?? 'No run selected'}
                </h2>
              </div>

              <div className="rounded-2xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface p-6">
                <div className="flex items-center space-x-2 pb-3 mb-3 border-b dark:border-charcoal-border border-cream-border">
                  <MessageSquareQuote className="w-4 h-4 text-coral" />
                  <h3 className="text-sm font-bold">The answer</h3>
                </div>
                {finalAnswer ? (
                  <pre className="whitespace-pre-wrap text-[13px] leading-relaxed font-sans">
                    {finalAnswer}
                  </pre>
                ) : (
                  <p className="text-xs dark:text-charcoal-muted text-cream-muted">
                    {isWorking
                      ? 'Still working… the answer appears here the moment the team finishes.'
                      : 'This run has no stored answer. Try one of the demo runs in the list above.'}
                  </p>
                )}
              </div>

              {failedTasks.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amberAccent">
                    {failedTasks.length} job{failedTasks.length === 1 ? '' : 's'} could not finish
                  </p>
                  {failedTasks.map((task) => (
                    <p key={task.task_id} className="text-[11px] leading-relaxed">
                      <span className="font-mono font-bold text-coral">{task.task_id}</span> ·{' '}
                      {agentPlain(task.agent_id).name}: {task.reason}
                    </p>
                  ))}
                  <p className="text-[11px] dark:text-charcoal-muted text-cream-muted">
                    {tasks.length > 0 && failedTasks.length >= tasks.length
                      ? 'Every job ran into trouble, so there was no answer to build. “Step by step” shows exactly where it broke.'
                      : 'This is normal — the rest of the answer was still built from the jobs that worked.'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border">
                  <p className="text-[10px] uppercase font-bold dark:text-charcoal-muted text-cream-muted">Jobs</p>
                  <p className="text-lg font-extrabold">{tasks.length || '—'}</p>
                </div>
                <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border">
                  <p className="text-[10px] uppercase font-bold dark:text-charcoal-muted text-cream-muted">Steps</p>
                  <p className="text-lg font-extrabold">{events.length}</p>
                </div>
                <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border">
                  <p className="text-[10px] uppercase font-bold dark:text-charcoal-muted text-cream-muted">Critic score</p>
                  <p className="text-lg font-extrabold text-coral">
                    {activeRun?.totals?.average_critic_score != null
                      ? `${activeRun.totals.average_critic_score}/10`
                      : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border">
                  <p className="text-[10px] uppercase font-bold dark:text-charcoal-muted text-cream-muted">Cost</p>
                  <p className="text-lg font-extrabold">
                    ${(activeRun?.totals?.cost_usd || 0).toFixed(4)}
                  </p>
                </div>
              </div>

              {events.length > 0 && (
                <p className="text-[11px] dark:text-charcoal-muted text-cream-muted">
                  Last thing that happened:{' '}
                  <span className="font-semibold dark:text-charcoal-text text-cream-text">
                    {eventPlain(events[events.length - 1]).title}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Agent details slide-over (Watch mode) */}
        <AnimatePresence>
          {selectedAgentId && mode === 'watch' && (
            <motion.aside
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="absolute top-0 right-0 h-full w-80 border-l dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface shadow-2xl overflow-hidden"
            >
              <button
                onClick={() => setSelectedAgentId(null)}
                aria-label="Close agent details"
                className="absolute top-3 right-3 z-10 p-1 rounded-lg dark:hover:bg-charcoal-bg hover:bg-cream-bg"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
              <AgentInspector agent={selectedAgentDef} onClose={() => setSelectedAgentId(null)} />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Code panel slide-over */}
        <AnimatePresence>
          {isCoderOpen && (
            <motion.aside
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="absolute bottom-0 left-0 right-0 h-72 border-t dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface shadow-2xl flex flex-col"
            >
              <div className="h-10 px-4 flex items-center justify-between border-b dark:border-charcoal-border border-cream-border">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Code the Coder ran (in a safe sandbox)
                </span>
                <button onClick={() => setIsCoderOpen(false)} aria-label="Close code panel">
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <CoderLive events={events} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
