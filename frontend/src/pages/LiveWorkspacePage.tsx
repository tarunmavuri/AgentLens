import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  Node, 
  Edge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomAgentNode } from '../components/graph/CustomAgentNode';
import { AgentInspector } from '../components/workspace/AgentInspector';
import { ActivityTimeline } from '../components/workspace/ActivityTimeline';
import { CoderLive } from '../components/workspace/CoderLive';
import { 
  Workflow, 
  Terminal, 
  Code2, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Sparkles, 
  ShieldAlert,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import * as api from '../api/client';

const nodeTypes = {
  customAgent: CustomAgentNode,
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
    theme
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'timeline' | 'coder'>('timeline');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);

  useEffect(() => {
    loadRuns();
    loadAgents();
  }, []);

  // Compute dynamic React Flow nodes & edges based on real events
  const { nodes, edges } = useMemo(() => {
    // Collect participating agent IDs from events
    const planEvent = events.find(e => e.type === 'plan_created');
    const tasks = planEvent?.payload?.tasks || [];

    const participatingAgentIds = new Set<string>(['planner', 'critic']);
    tasks.forEach((t: any) => {
      if (t.assigned_agent_id) participatingAgentIds.add(t.assigned_agent_id);
    });
    events.forEach(e => {
      if (e.agent_id && e.agent_id !== 'system') participatingAgentIds.add(e.agent_id);
    });

    const agentList = Array.from(participatingAgentIds);
    const flowNodes: Node[] = [];

    // Layout nodes horizontally or vertically
    agentList.forEach((agentId, index) => {
      const def = agents.find(a => a.agent_id === agentId);
      
      // Determine status from events
      let status: any = 'idle';
      const agentEvents = events.filter(e => e.agent_id === agentId);
      const isCurrentlyActive = events.length > 0 && events[events.length - 1].agent_id === agentId;

      if (isCurrentlyActive) {
        const lastEv = events[events.length - 1];
        if (lastEv.type === 'tool_call') status = 'using_tool';
        else if (lastEv.type === 'thought') status = 'planning';
        else if (lastEv.type === 'critique') status = 'reviewing';
        else if (lastEv.type === 'retry') status = 'retrying';
        else status = 'running';
      } else if (agentEvents.some(e => e.type === 'agent_finished' || e.type === 'task_done')) {
        status = 'completed';
      } else if (tasks.some((t: any) => t.assigned_agent_id === agentId)) {
        status = 'waiting';
      }

      const assignedTask = tasks.find((t: any) => t.assigned_agent_id === agentId);

      flowNodes.push({
        id: agentId,
        type: 'customAgent',
        position: { x: 80 + (index % 3) * 320, y: 60 + Math.floor(index / 3) * 220 },
        data: {
          agent_id: agentId,
          name: def?.name || agentId.toUpperCase(),
          role: def?.role || 'Specialized Agent',
          category: def?.agent_type || (agentId in ['planner', 'researcher', 'coder', 'critic'] ? 'built_in' : 'custom'),
          status: status,
          currentTaskTitle: assignedTask?.title,
          criticScore: agentId === 'critic' ? events.find(e => e.type === 'critique')?.payload?.score : undefined,
          isSelected: selectedAgentId === agentId
        }
      });
    });

    // Compute edges based on task dependencies & sequence
    const flowEdges: Edge[] = [];
    tasks.forEach((task: any, idx: number) => {
      // Connect Planner to first tasks
      if (!task.depends_on || task.depends_on.length === 0) {
        flowEdges.push({
          id: `edge-planner-${task.assigned_agent_id}-${idx}`,
          source: 'planner',
          target: task.assigned_agent_id,
          animated: true,
          style: { stroke: '#FF513C', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#FF513C' }
        });
      } else {
        // Connect dependency target agent to this task's assigned agent
        task.depends_on.forEach((depId: string) => {
          const depTask = tasks.find((t: any) => t.id === depId);
          if (depTask) {
            flowEdges.push({
              id: `edge-${depTask.assigned_agent_id}-${task.assigned_agent_id}-${idx}`,
              source: depTask.assigned_agent_id,
              target: task.assigned_agent_id,
              animated: true,
              style: { stroke: '#FF513C', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#FF513C' }
            });
          }
        });
      }

      // Connect last task to Critic
      if (idx === tasks.length - 1) {
        flowEdges.push({
          id: `edge-${task.assigned_agent_id}-critic`,
          source: task.assigned_agent_id,
          target: 'critic',
          animated: true,
          style: { stroke: '#A855F7', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#A855F7' }
        });
      }
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [events, agents, selectedAgentId]);

  const selectedAgentDef = agents.find(a => a.agent_id === selectedAgentId) || null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      
      {/* Workspace Top Toolbar */}
      <div className="px-5 py-3 border-b dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface flex items-center justify-between">
        
        {/* Run Selector & Goal */}
        <div className="flex items-center space-x-3 overflow-hidden">
          <select
            value={selectedRunId || ''}
            onChange={(e) => selectRun(e.target.value)}
            className="px-3 py-1.5 rounded-xl border text-xs font-semibold dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border max-w-xs truncate"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id.includes('golden') ? `⭐ ${r.goal}` : r.goal}
              </option>
            ))}
          </select>

          <span className="text-xs font-medium dark:text-charcoal-muted text-cream-muted hidden md:inline truncate">
            {activeRun?.goal}
          </span>
        </div>

        {/* Telemetry pill */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full dark:bg-charcoal-bg bg-cream-bg border dark:border-charcoal-border border-cream-border font-mono text-[11px]">
            <span>Events: {events.length}</span>
            <span>·</span>
            <span className="text-coral">Cost: ${(activeRun?.totals?.cost_usd || 0).toFixed(5)}</span>
          </div>

          <button
            onClick={() => setIsInspectorOpen(!isInspectorOpen)}
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

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: React Flow Live Graph Area */}
        <div className="flex-1 relative dark:bg-[#110E13] bg-[#EFE9E1] transition-colors">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedAgentId(node.id)}
            fitView
            colorMode={theme}
          >
            <Background color={theme === 'dark' ? '#27202A' : '#DED5C9'} gap={16} />
            <Controls className="!bg-charcoal-surface !border-charcoal-border" />
            <MiniMap 
              nodeColor={theme === 'dark' ? '#3E3443' : '#D5CBC0'}
              maskColor={theme === 'dark' ? 'rgba(21, 18, 23, 0.7)' : 'rgba(245, 240, 234, 0.7)'}
              className="!border dark:!border-charcoal-border !border-cream-border rounded-xl overflow-hidden" 
            />
          </ReactFlow>
        </div>

        {/* Right: Agent Inspector Sidebar */}
        {isInspectorOpen && (
          <div className="w-80 border-l dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface flex-shrink-0 transition-all">
            <AgentInspector 
              agent={selectedAgentDef} 
              onClose={() => setIsInspectorOpen(false)} 
            />
          </div>
        )}

      </div>

      {/* Bottom Panel: Activity Stream & Coder Live */}
      <div className={`border-t dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface transition-all duration-300 flex flex-col ${
        isBottomCollapsed ? 'h-10' : 'h-72'
      }`}>
        
        {/* Bottom Tab Bar */}
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
              Activity Feed & Thoughts
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
          </div>

          <button
            onClick={() => setIsBottomCollapsed(!isBottomCollapsed)}
            className="p-1 rounded-lg hover:dark:bg-charcoal-bg hover:bg-cream-bg transition-colors text-neutral-400"
          >
            {isBottomCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Tab Content */}
        {!isBottomCollapsed && (
          <div className="flex-1 overflow-hidden">
            {activeTab === 'timeline' ? (
              <ActivityTimeline events={events} />
            ) : (
              <CoderLive events={events} />
            )}
          </div>
        )}

      </div>

    </div>
  );
};

