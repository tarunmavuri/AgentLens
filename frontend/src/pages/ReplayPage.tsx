import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Download,
  ChevronsRight,
  AlertCircle,
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
    setView,
  } = useAppStore();

  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    setIsReplaying(false);
    setReplayCursor(0);
  }, [selectedRunId]);

  useEffect(() => {
    if (!isReplaying) return;
    const timer = window.setInterval(() => {
      if (replayCursor < events.length) {
        setReplayCursor(replayCursor + 1);
      } else {
        setIsReplaying(false);
      }
    }, 1000 / playbackSpeed);
    return () => window.clearInterval(timer);
  }, [isReplaying, replayCursor, events.length, playbackSpeed]);

  const visibleEvents = events.slice(0, replayCursor);
  const atEnd = events.length > 0 && replayCursor >= events.length;

  const handleExportTrace = async () => {
    if (!selectedRunId) return;
    setExportError(null);
    try {
      const trace = await api.exportTrace(selectedRunId);
      const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agentlens-trace-${selectedRunId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export trace');
    }
  };

  return (
    <div className="p-5 sm:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-cream-border dark:border-charcoal-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Monitor · Execution History
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Historical Trace Replay
          </h1>
          <p className="text-xs sm:text-sm text-cream-muted dark:text-charcoal-muted mt-1">
            Scrub through persisted execution events step-by-step at zero model cost, or download
            the JSON trace.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportTrace}
            disabled={!selectedRunId}
            className="h-9 px-4 rounded-full text-xs font-semibold border border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface hover:border-coral transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Trace</span>
          </button>

          <button
            type="button"
            onClick={() => setView('workspace')}
            className="h-9 px-4 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white transition-colors"
          >
            Open Live Graph
          </button>
        </div>
      </div>

      {exportError && (
        <div className="pl-3.5 border-l-2 border-statusError text-statusError text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{exportError}</span>
        </div>
      )}

      <div className="py-4 border-b border-cream-border dark:border-charcoal-border space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-cream-muted dark:text-charcoal-muted">
              Execution:
            </span>
            <select
              value={selectedRunId || ''}
              onChange={(event) => selectRun(event.target.value)}
              className="h-9 px-3 rounded-full border text-xs font-semibold bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border max-w-xs sm:max-w-sm truncate"
            >
              {runs.length === 0 && <option value="">No executions yet</option>}
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.id.includes('golden') ? `Demo · ${run.goal}` : run.goal}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs font-mono text-cream-muted dark:text-charcoal-muted">
            {activeRun ? `${activeRun.status.replace(/_/g, ' ')} · ` : ''}
            Event {replayCursor} / {events.length}
          </div>
        </div>

        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={Math.max(events.length, 1)}
            value={replayCursor}
            onChange={(event) => {
              setIsReplaying(false);
              setReplayCursor(parseInt(event.target.value, 10));
            }}
            disabled={events.length === 0}
            className="w-full accent-coral h-2 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-cream-muted dark:text-charcoal-muted">
            <span>Start</span>
            <span>Event #{replayCursor}</span>
            <span>End (#{events.length})</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsReplaying(false);
                setReplayCursor(0);
              }}
              title="Reset to start"
              className="h-9 w-9 rounded-full border border-cream-border dark:border-charcoal-border flex items-center justify-center hover:border-coral hover:text-coral transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsReplaying(false);
                setReplayCursor(Math.max(0, replayCursor - 1));
              }}
              title="Step back"
              className="h-9 w-9 rounded-full border border-cream-border dark:border-charcoal-border flex items-center justify-center hover:border-coral hover:text-coral transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (atEnd) setReplayCursor(0);
                setIsReplaying(!isReplaying);
              }}
              disabled={events.length === 0}
              className="h-9 px-5 rounded-full bg-coral hover:bg-coral-hover text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {isReplaying ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isReplaying ? 'Pause' : 'Play Replay'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsReplaying(false);
                setReplayCursor(Math.min(events.length, replayCursor + 1));
              }}
              title="Step forward"
              className="h-9 w-9 rounded-full border border-cream-border dark:border-charcoal-border flex items-center justify-center hover:border-coral hover:text-coral transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsReplaying(false);
                setReplayCursor(events.length);
              }}
              title="Jump to end"
              className="h-9 w-9 rounded-full border border-cream-border dark:border-charcoal-border flex items-center justify-center hover:border-coral hover:text-coral transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-cream-muted dark:text-charcoal-muted mr-1">Speed:</span>
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-3 py-1 rounded-full font-mono font-semibold transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-coral text-white'
                    : 'border border-cream-border dark:border-charcoal-border'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-cream-border dark:border-charcoal-border overflow-hidden h-96">
        <ActivityTimeline events={visibleEvents} />
      </div>
    </div>
  );
};
