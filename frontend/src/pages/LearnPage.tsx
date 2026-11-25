import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { agentPlain, GLOSSARY, HOW_IT_WORKS } from '../lib/plain';
import { ArrowRight, BookOpen, Sparkles, Users } from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45, ease: 'easeOut' as const },
};

export const LearnPage: React.FC = () => {
  const { setView, agents } = useAppStore();
  const team = ['planner', 'researcher', 'coder', 'critic'];

  return (
    <div className="max-w-5xl mx-auto px-5 py-10 space-y-14">
      {/* Header */}
      <motion.header {...fadeUp} className="space-y-4 text-center">
        <span className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-coral/30 bg-coral/5 text-[11px] font-bold uppercase tracking-[0.18em] text-coral">
          <BookOpen className="w-3 h-3" />
          <span>Start here · 3 minute read</span>
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          How AgentLens works,{' '}
          <span className="font-editorial italic font-normal text-coral">in plain words</span>
        </h1>
        <p className="text-sm sm:text-base dark:text-charcoal-muted text-cream-muted max-w-2xl mx-auto leading-relaxed">
          You ask one question. A small team of AI helpers divides the work, checks each other's
          answers, and shows you every step. That's it — no jargon required.
        </p>
      </motion.header>

      {/* Journey */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold tracking-tight flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-coral" />
          <span>What happens when you press “Ask”</span>
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
              className="relative p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border shadow-sm hover:-translate-y-1 transition-transform duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl" aria-hidden="true">{step.emoji}</span>
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-coral/10 text-coral">
                  Step {step.step}
                </span>
              </div>
              <h3 className="font-bold text-sm tracking-tight">{step.title}</h3>
              <p className="mt-1.5 text-xs dark:text-charcoal-muted text-cream-muted leading-relaxed">
                {step.plain}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Meet the team */}
      <section className="space-y-6">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-coral" />
          <h2 className="text-lg font-bold tracking-tight">Meet the built-in team</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {team.map((id, index) => {
            const definition = agents.find((agent) => agent.agent_id === id);
            const plain = agentPlain(id, definition?.role);
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: index % 2 === 0 ? -16 : 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex items-start space-x-3 p-4 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border"
              >
                <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-coral/10 flex items-center justify-center text-lg">
                  <span aria-hidden="true">{plain.emoji}</span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm">{plain.name}</h3>
                  <p className="text-xs dark:text-charcoal-muted text-cream-muted leading-relaxed">
                    {plain.does}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs dark:text-charcoal-muted text-cream-muted">
          You can also add your own agent on the{' '}
          <button onClick={() => setView('builder')} className="text-coral font-semibold hover:underline">
            Build an Agent
          </button>{' '}
          page — pick a name, describe its job in a sentence, and choose which tools it may use.
        </p>
      </section>

      {/* Glossary */}
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Words you'll see around here</h2>
          <p className="text-xs dark:text-charcoal-muted text-cream-muted mt-1">
            You never need these to use AgentLens — but this is what they mean.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {GLOSSARY.map((item, index) => (
            <motion.details
              key={item.term}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: (index % 4) * 0.05 }}
              className="group rounded-2xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface px-4 py-3 open:shadow-md transition-shadow"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="flex items-center space-x-2 text-sm font-bold">
                  <span aria-hidden="true">{item.emoji}</span>
                  <span>{item.term}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-coral opacity-0 group-open:opacity-100 transition-opacity" aria-hidden="true">
                  +/−
                </span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed dark:text-charcoal-muted text-cream-muted">
                {item.plain}
              </p>
              <p className="mt-1.5 text-[11px] italic text-coral/90">{item.example}</p>
            </motion.details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <motion.section
        {...fadeUp}
        className="rounded-2xl border border-coral/30 bg-coral/5 px-6 py-8 text-center space-y-4"
      >
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Ready to watch it happen?
        </h2>
        <p className="text-sm dark:text-charcoal-muted text-cream-muted max-w-lg mx-auto">
          Open one of the demo runs and follow along step by step. Nothing to install, nothing to
          configure.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setView('dashboard')}
            className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider bg-coral hover:bg-coral-hover text-white shadow-lg shadow-coral/25 transition-transform hover:scale-[1.03] flex items-center space-x-2"
          >
            <span>See my runs</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('workspace')}
            className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider border dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface transition-transform hover:scale-[1.03]"
          >
            Watch a live run
          </button>
        </div>
      </motion.section>
    </div>
  );
};
