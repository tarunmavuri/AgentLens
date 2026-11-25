import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { HOW_IT_WORKS } from '../lib/plain';
import {
  ArrowRight,
  Play,
  Workflow,
  Bot,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Code2,
  Search,
  Terminal,
  BookOpen,
} from 'lucide-react';

const riseIn = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: 'easeOut' as const },
});

export const LandingPage: React.FC = () => {
  const { setView } = useAppStore();

  return (
    <div className="min-h-screen transition-colors duration-200
      dark:bg-charcoal-bg dark:text-charcoal-text
      bg-cream-bg text-cream-text">

      {/* ----------------- HERO ----------------- */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-16 md:pb-24 border-b dark:border-charcoal-border border-cream-border">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-coral/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            <div className="lg:col-span-7 space-y-6">
              <motion.div {...riseIn(0)} className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border dark:border-coral/40 border-coral/30 dark:bg-coral/5 bg-coral/5">
                <span className="w-1.5 h-1.5 rounded-full bg-coral animate-ping"></span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-coral">
                  Watch AI work · no jargon required
                </span>
              </motion.div>

              <motion.h1 {...riseIn(0.08)} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08]">
                A team of AI helpers{' '}
                <span className="font-editorial italic font-normal text-coral tracking-normal block sm:inline">
                  that shows its work.
                </span>
              </motion.h1>

              <motion.p {...riseIn(0.16)} className="text-base sm:text-lg dark:text-charcoal-muted text-cream-muted max-w-2xl leading-relaxed">
                Ask one question. AgentLens splits it into small jobs, hands them to specialist
                helpers, checks the answers, and lets you watch every step — in plain English.
              </motion.p>

              <motion.div {...riseIn(0.24)} className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => setView('dashboard')}
                  className="px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider
                    bg-coral hover:bg-coral-hover text-white shadow-lg shadow-coral/25 transition-all hover:scale-[1.02] flex items-center space-x-2"
                >
                  <span>Try it now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setView('learn')}
                  className="px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider
                    dark:bg-charcoal-surface dark:hover:bg-charcoal-border dark:text-charcoal-text border dark:border-charcoal-border
                    bg-cream-surface hover:bg-cream-border text-cream-text border-cream-border shadow-sm transition-all hover:scale-[1.02] flex items-center space-x-2"
                >
                  <BookOpen className="w-3.5 h-3.5 text-coral" />
                  <span>What is an agent?</span>
                </button>
              </motion.div>

              <motion.div {...riseIn(0.32)} className="pt-6 grid grid-cols-3 gap-4 border-t dark:border-charcoal-border border-cream-border text-xs">
                <div>
                  <div className="font-bold text-sm tracking-tight text-coral">Every step</div>
                  <div className="dark:text-charcoal-muted text-cream-muted font-medium">is visible</div>
                </div>
                <div>
                  <div className="font-bold text-sm tracking-tight text-coral">Checks itself</div>
                  <div className="dark:text-charcoal-muted text-cream-muted font-medium">before you see it</div>
                </div>
                <div>
                  <div className="font-bold text-sm tracking-tight text-coral">No code</div>
                  <div className="dark:text-charcoal-muted text-cream-muted font-medium">needed</div>
                </div>
              </motion.div>
            </div>

            {/* Preview card */}
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              className="lg:col-span-5"
            >
              <div className="rounded-2xl border p-5 shadow-2xl relative overflow-hidden transition-all duration-300
                dark:bg-charcoal-surface dark:border-charcoal-border dark:shadow-black/40
                bg-cream-surface border-cream-border shadow-neutral-200/60">

                <div className="flex items-center justify-between pb-4 border-b dark:border-charcoal-border border-cream-border">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-coral"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amberAccent"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-mono font-medium ml-2 dark:text-charcoal-muted text-cream-muted">
                      a run, in progress
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live</span>
                  </div>
                </div>

                <div className="py-4 space-y-3">
                  <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-base">🧭</div>
                      <div>
                        <div className="text-xs font-bold">The Planner</div>
                        <div className="text-[10px] dark:text-charcoal-muted text-cream-muted">Split the goal into 3 jobs</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">Done</span>
                  </div>

                  <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-base">🔍</div>
                      <div>
                        <div className="text-xs font-bold">The Researcher</div>
                        <div className="text-[10px] dark:text-charcoal-muted text-cream-muted">Found 5 sources and took notes</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">Done</span>
                  </div>

                  <div className="p-3 rounded-xl border border-coral/60 dark:bg-coral/5 bg-coral/5 flex items-center justify-between agent-active-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-coral text-white flex items-center justify-center text-base shadow-md shadow-coral/30">🧪</div>
                      <div>
                        <div className="text-xs font-bold text-coral">The Coder</div>
                        <div className="text-[10px] dark:text-charcoal-text text-cream-text">Running a small test in a safe sandbox</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-coral text-white animate-pulse">Working</span>
                  </div>

                  <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-base">🧐</div>
                      <div>
                        <div className="text-xs font-bold">The Critic</div>
                        <div className="text-[10px] dark:text-charcoal-muted text-cream-muted">Waiting to score the finished work</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded dark:bg-charcoal-surface bg-cream-surface dark:text-charcoal-muted text-cream-muted">Waiting</span>
                  </div>
                </div>

                <div className="pt-3 text-[10px] dark:text-charcoal-muted text-cream-muted">
                  Illustrative product preview — not live telemetry.
                </div>
                <div className="pt-3 border-t dark:border-charcoal-border border-cream-border flex items-center justify-between text-[11px] font-mono dark:text-charcoal-muted text-cream-muted">
                  <span>2 of 3 jobs done</span>
                  <span>Score so far: 8.5/10</span>
                  <span className="text-coral font-bold">2m 14s</span>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ----------------- HOW IT WORKS ----------------- */}
      <section className="py-16 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Five simple steps
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            What happens after you ask
          </h2>
          <p className="dark:text-charcoal-muted text-cream-muted text-sm sm:text-base leading-relaxed">
            No setup, no prompt engineering. You describe what you want, and the team works in the
            open.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: index * 0.07, ease: 'easeOut' }}
              className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border shadow-sm hover:-translate-y-1 transition-transform duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl" aria-hidden="true">{step.emoji}</span>
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-coral/10 text-coral">
                  {step.step}
                </span>
              </div>
              <h3 className="font-bold text-sm tracking-tight">{step.title}</h3>
              <p className="mt-1.5 text-xs dark:text-charcoal-muted text-cream-muted leading-relaxed">
                {step.plain}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => setView('learn')}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-coral hover:underline"
          >
            <span>Read the plain-English guide</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ----------------- THREE THINGS YOU CAN DO ----------------- */}
      <section className="pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Three things you can do today
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1
            dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:border-coral/40
            bg-cream-surface border-cream-border hover:border-coral/40 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-xl bg-coral/10 text-coral flex items-center justify-center">
              <Workflow className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg tracking-tight">Watch a run happen</h3>
            <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted leading-relaxed">
              Boxes are agents. Arrows show who hands work to whom. Click any box to see what that
              agent is allowed to do.
            </p>
            <button onClick={() => setView('workspace')} className="text-xs font-bold text-coral hover:underline inline-flex items-center space-x-1">
              <span>Open Watch Live</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1
            dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:border-coral/40
            bg-cream-surface border-cream-border hover:border-coral/40 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amberAccent/10 text-amberAccent flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg tracking-tight">Make your own helper</h3>
            <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted leading-relaxed">
              Give it a name, describe its job in a sentence, and choose which tools it may use. No
              Python required.
            </p>
            <button onClick={() => setView('builder')} className="text-xs font-bold text-coral hover:underline inline-flex items-center space-x-1">
              <span>Build an agent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1
            dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:border-coral/40
            bg-cream-surface border-cream-border hover:border-coral/40 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg tracking-tight">Break it on purpose</h3>
            <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted leading-relaxed">
              Turn on “Break-it mode” to fake a failure and watch the Critic catch it and send the
              work back. That is how you learn what good looks like.
            </p>
            <button onClick={() => setView('dashboard')} className="text-xs font-bold text-coral hover:underline inline-flex items-center space-x-1">
              <span>See your runs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ----------------- WHAT MAKES IT DIFFERENT ----------------- */}
      <section className="py-16 border-y dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface/50 bg-cream-surface/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-6 sm:grid-cols-3 text-xs sm:text-sm">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p>
              <span className="font-bold block">Nothing is hidden</span>
              <span className="dark:text-charcoal-muted text-cream-muted">
                Every step is saved as it happens, so you can replay a run like a video.
              </span>
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <Code2 className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
            <p>
              <span className="font-bold block">Code runs in a sandbox</span>
              <span className="dark:text-charcoal-muted text-cream-muted">
                The Coder works in a locked, throwaway folder with a time limit.
              </span>
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <Search className="w-5 h-5 text-amberAccent flex-shrink-0 mt-0.5" />
            <p>
              <span className="font-bold block">Honest about sources</span>
              <span className="dark:text-charcoal-muted text-cream-muted">
                If search is unavailable it says so instead of inventing links.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ----------------- FINAL CTA ----------------- */}
      <section className="py-16 text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Curious how an answer was made?
          </h2>
          <p className="dark:text-charcoal-muted text-cream-muted text-sm sm:text-base max-w-xl mx-auto">
            Open a demo run and follow it one step at a time. No account needed for the demo traces.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <button
              onClick={() => setView('dashboard')}
              className="px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider
                bg-coral hover:bg-coral-hover text-white shadow-xl shadow-coral/30 transition-all hover:scale-105"
            >
              See my runs
            </button>
            <button
              onClick={() => setView('learn')}
              className="px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider
                border dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface transition-all hover:scale-105 inline-flex items-center space-x-2"
            >
              <Terminal className="w-3.5 h-3.5 text-coral" />
              <span>Start with the basics</span>
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
