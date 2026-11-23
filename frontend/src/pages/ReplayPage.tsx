import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipBack, 
  SkipForward, 
  Download, 
  Clock, 
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import { ActivityTimeline } from '../components/workspace/ActivityTimeline';
import * as api from '../api/client';

export const ReplayPage: React.FC = () => {
  const { 
    runs, 
    activeRun, 
    selectedRunId, 
    selectRun, 
    loadRuns, 
    events, 
    replayCursor, 
    setReplayCursor,
    isReplaying,
    setIsReplaying,
    playbackSpeed,
    setPlaybackSpeed,
    setView
  } = useAppStore();

  useEffect(() => {
    loadRuns();
  }, []);

  // Handle Playback interval
  useEffect(() => {
    let timer: any = null;
    if (isReplaying) {
      timer = setInterval(() => {
        if (replayCursor < events.length) {
          setReplayCursor(replayCursor + 1);
        } else {
          setIsReplaying(false);
        }
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isReplaying, replayCursor, events.length, playbackSpeed]);

  const visibleEvents = events.slice(0, replayCursor);

  const handleExportTrace = async () => {
    if (!selectedRunId) return;
    try {
      const trace = await api.exportTrace(selectedRunId);
      const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentlens-trace-${selectedRunId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export trace');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b dark:border-charcoal-border border-cream-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
            Event-Sourced Replay Engine
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            Historical Replay & Trace Inspection
          </h1>
          <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted mt-1">
            Scrub through past agent executions step-by-step using persisted event logs with zero LLM re-invocation.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportTrace}
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider 
              border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Trace JSON</span>
          </button>

          <button
            onClick={() => setView('workspace')}
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider 
              bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all hover:scale-[1.02]"
          >
            Open in Live Graph
          </button>
        </div>
      </div>

      {/* Scrub Bar & Player Controls */}
      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-5 shadow-sm">
        
        {/* Run Selector & Goal info */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold uppercase tracking-wider text-coral">Select Run:</span>
            <select
              value={selectedRunId || ''}
              onChange={(e) => selectRun(e.target.value)}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border max-w-sm truncate"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id.includes('golden') ? `⭐ ${r.goal}` : r.goal}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs font-mono dark:text-charcoal-muted text-cream-muted">
            Step {replayCursor} of {events.length} events
          </div>
        </div>

        {/* Scrub Slider */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={events.length}
            value={replayCursor}
            onChange={(e) => setReplayCursor(parseInt(e.target.value))}
            className="w-full accent-coral h-2 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono dark:text-charcoal-muted text-cream-muted">
            <span>Start (#0)</span>
            <span>Current: #{replayCursor}</span>
            <span>End (#{events.length})</span>
          </div>
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setReplayCursor(0)}
              title="Reset to beginning"
              className="p-2 rounded-xl border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setReplayCursor(Math.max(0, replayCursor - 1))}
              title="Step back 1 event"
              className="p-2 rounded-xl border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsReplaying(!isReplaying)}
              className="px-4 py-2 rounded-xl bg-coral hover:bg-coral-hover text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-coral/20"
            >
              {isReplaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isReplaying ? 'Pause' : 'Play Replay'}</span>
            </button>

            <button
              onClick={() => setReplayCursor(Math.min(events.length, replayCursor + 1))}
              title="Step forward 1 event"
              className="p-2 rounded-xl border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="dark:text-charcoal-muted text-cream-muted mr-1">Speed:</span>
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-coral text-white'
                    : 'dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border border'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Scrubbed Event Stream View */}
      <div className="rounded-2xl border overflow-hidden h-96 dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border">
        <ActivityTimeline events={visibleEvents} />
      </div>

    </div>
  );
};

