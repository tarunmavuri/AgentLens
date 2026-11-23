import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  ArrowRight, 
  Play, 
  Workflow, 
  Bot, 
  Cpu, 
  Sparkles, 
  ShieldAlert, 
  RotateCcw, 
  CheckCircle2, 
  Code2, 
  Search, 
  Layers, 
  Terminal,
  Activity
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { setView, theme } = useAppStore();

  return (
    <div className="min-h-screen transition-colors duration-200 
      dark:bg-charcoal-bg dark:text-charcoal-text 
      bg-cream-bg text-cream-text">
      
      {/* ----------------- HERO SECTION ----------------- */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-16 md:pb-28 border-b dark:border-charcoal-border border-cream-border">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-coral/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Editorial Headline & Copy */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Outlined Pill Badge matching reference screenshot */}
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border dark:border-coral/40 border-coral/30 dark:bg-coral/5 bg-coral/5">
                <span className="w-1.5 h-1.5 rounded-full bg-coral animate-ping"></span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-coral">
                  THE GLASS-BOX MULTI-AGENT PLATFORM · v1.0
                </span>
              </div>

              {/* Bold Sans Headline with Italic Serif Accent Highlights */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08]">
                Your AI Agents.{' '}
                <span className="font-editorial italic font-normal text-coral tracking-normal block sm:inline">
                  Working Together.
                </span>{' '}
                Nothing Hidden.
              </h1>

              {/* Body Text */}
              <p className="text-base sm:text-lg dark:text-charcoal-muted text-cream-muted max-w-2xl leading-relaxed font-normal">
                Build intelligent agent teams, orchestrate complex workflows and observe every execution. 
                From autonomous research and coding to custom agent collaboration, understand exactly how your AI systems work.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => setView('dashboard')}
                  className="px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider 
                    bg-coral hover:bg-coral-hover text-white shadow-lg shadow-coral/25 transition-all hover:scale-[1.02] flex items-center space-x-2"
                >
                  <span>Explore AgentLens</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setView('workspace')}
                  className="px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider 
                    dark:bg-charcoal-surface dark:hover:bg-charcoal-border dark:text-charcoal-text border dark:border-charcoal-border
                    bg-cream-surface hover:bg-cream-border text-cream-text border-cream-border shadow-sm transition-all hover:scale-[1.02] flex items-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-coral" />
                  <span>Watch Live Graph</span>
                </button>
              </div>

              {/* Trust bar / Talking points */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t dark:border-charcoal-border border-cream-border text-xs">
                <div>
                  <div className="font-bold text-sm tracking-tight text-coral">100%</div>
                  <div className="dark:text-charcoal-muted text-cream-muted font-medium">Event-Sourced</div>
                </div>
                <div>
                  <div className="font-bold text-sm tracking-tight text-coral">Zero</div>
                  <div className="dark:text-charcoal-muted text-cream-muted font-medium">LangGraph Bloat</div>
                </div>
                <div>
                  <div className="font-bold text-sm tracking-tight text-coral">Custom</div>
                  <div className="dark:text-charcoal-muted text-cream-muted font-medium">No-Code Agents</div>
                </div>
              </div>

            </div>

            {/* Right Column: Sleek Interactive Multi-Agent Preview Container */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border p-5 shadow-2xl relative overflow-hidden transition-all duration-300
                dark:bg-charcoal-surface dark:border-charcoal-border dark:shadow-black/40
                bg-cream-surface border-cream-border shadow-neutral-200/60">
                
                {/* Visual Window Header */}
                <div className="flex items-center justify-between pb-4 border-b dark:border-charcoal-border border-cream-border">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-coral"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amberAccent"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-mono font-medium ml-2 dark:text-charcoal-muted text-cream-muted">
                      live_orchestrator.state
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Streaming</span>
                  </div>
                </div>

                {/* Animated Agent Flow Nodes */}
                <div className="py-4 space-y-3">
                  
                  {/* Planner Node */}
                  <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                        PL
                      </div>
                      <div>
                        <div className="text-xs font-bold">Planner Agent</div>
                        <div className="text-[10px] dark:text-charcoal-muted text-cream-muted">Decomposed goal into 3 dependent tasks</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                      Planned
                    </span>
                  </div>

                  {/* Researcher Node */}
                  <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                        RE
                      </div>
                      <div>
                        <div className="text-xs font-bold">Researcher Agent</div>
                        <div className="text-[10px] dark:text-charcoal-muted text-cream-muted">Searched 5 papers · Extracted latency SLAs</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                      Completed
                    </span>
                  </div>

                  {/* Coder Node (Active with pulse) */}
                  <div className="p-3 rounded-xl border border-coral/60 dark:bg-coral/5 bg-coral/5 flex items-center justify-between agent-active-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-coral text-white flex items-center justify-center font-bold text-xs shadow-md shadow-coral/30">
                        CO
                      </div>
                      <div>
                        <div className="text-xs font-bold text-coral">Coder Agent (Active)</div>
                        <div className="text-[10px] dark:text-charcoal-text text-cream-text">Running sandbox benchmark · Generating plot</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-coral text-white animate-pulse">
                      Sandbox
                    </span>
                  </div>

                  {/* Custom Security Agent Node */}
                  <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                        CR
                      </div>
                      <div>
                        <div className="text-xs font-bold">Security Reviewer (Custom)</div>
                        <div className="text-[10px] dark:text-charcoal-muted text-cream-muted">Waiting on code artifacts for sandbox audit</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded dark:bg-charcoal-surface bg-cream-surface dark:text-charcoal-muted text-cream-muted">
                      Waiting
                    </span>
                  </div>

                  {/* Critic Node */}
                  <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs">
                        CR
                      </div>
                      <div>
                        <div className="text-xs font-bold">Critic Agent</div>
                        <div className="text-[10px] dark:text-charcoal-muted text-cream-muted">Evaluation score: 9.4/10 · Verdict: Accept</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-500">
                      Evaluated
                    </span>
                  </div>

                </div>

                {/* Footer Live Telemetry Bar */}
                <div className="pt-3 border-t dark:border-charcoal-border border-cream-border flex items-center justify-between text-[11px] font-mono dark:text-charcoal-muted text-cream-muted">
                  <span>Tokens: 14,280</span>
                  <span>Cost: $0.0024</span>
                  <span className="text-coral font-bold">Latency: 284ms</span>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ----------------- CORE CAPABILITIES ----------------- */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Architectural Highlights
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Engineered for Observability, Control and Evaluation.
          </h2>
          <p className="dark:text-charcoal-muted text-cream-muted text-sm sm:text-base leading-relaxed">
            Every step is recorded as a validated Pydantic event. No magic, no hidden prompt mutations, and no opaque state graphs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1 */}
          <div className="p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1 
            dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:border-coral/40
            bg-cream-surface border-cream-border hover:border-coral/40 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-xl bg-coral/10 text-coral flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg tracking-tight">Custom Agent Builder</h3>
            <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted leading-relaxed">
              Create specialized AI agents without writing Python code. Configure instructions, assign tool permissions, choose models, and integrate them dynamically into multi-agent runs.
            </p>
            <div className="pt-2">
              <button 
                onClick={() => setView('builder')}
                className="text-xs font-bold text-coral hover:underline inline-flex items-center space-x-1"
              >
                <span>Build an agent</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1 
            dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:border-coral/40
            bg-cream-surface border-cream-border hover:border-coral/40 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amberAccent/10 text-amberAccent flex items-center justify-center">
              <Workflow className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg tracking-tight">Live React Flow Graph</h3>
            <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted leading-relaxed">
              Watch agents pass artifacts in real-time. Dynamic node statuses (Planning, Using Tool, Reviewing, Retrying) and animated edges bring agent collaboration alive.
            </p>
            <div className="pt-2">
              <button 
                onClick={() => setView('workspace')}
                className="text-xs font-bold text-coral hover:underline inline-flex items-center space-x-1"
              >
                <span>Open Live Graph</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1 
            dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:border-coral/40
            bg-cream-surface border-cream-border hover:border-coral/40 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg tracking-tight">Break-it Fault Injection</h3>
            <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted leading-relaxed">
              Inject empty search responses, malformed payloads, or timeouts on demand. Observe how the Critic detects errors and triggers self-corrective retries.
            </p>
            <div className="pt-2">
              <button 
                onClick={() => setView('dashboard')}
                className="text-xs font-bold text-coral hover:underline inline-flex items-center space-x-1"
              >
                <span>Test resilience</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

      </section>

      {/* ----------------- FINAL CTA ----------------- */}
      <section className="py-16 border-t dark:border-charcoal-border border-cream-border text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to understand how your agents really think?
          </h2>
          <p className="dark:text-charcoal-muted text-cream-muted text-sm sm:text-base max-w-xl mx-auto">
            Run a goal in the live workspace, build a custom security auditor, or inspect pre-seeded golden traces with zero setup.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setView('dashboard')}
              className="px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider 
                bg-coral hover:bg-coral-hover text-white shadow-xl shadow-coral/30 transition-all hover:scale-105"
            >
              Get Started with AgentLens
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

