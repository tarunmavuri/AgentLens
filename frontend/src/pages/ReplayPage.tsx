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

  // Entering a run starts a replay from the first stored event.
  useEffect(() => {
    setIsReplaying(false);
    setReplayCursor(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b dark:border-charcoal-border border-cream-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
            Replay
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            Watch a finished run again
          </h1>
          <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted mt-1">
            Move through a saved run one step at a time, like a video. Nothing is re-run, so this
            costs nothing.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportTrace}
            disabled={!selectedRunId}
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider 
              border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Trace JSON</span>
          </button>

          <button
            onClick={() => setView('workspace')}
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider 
              bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all hover:scale-[1.02]"
          >
            Open Live Graph
          </button>
        </div>
      </div>

      {exportError && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-500 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4" />
          <span>{exportError}</span>
        </div>
      )}

      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold uppercase tracking-wider text-coral">
              Select Run:
            </span>
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
          </div>

          <div className="text-xs font-mono dark:text-charcoal-muted text-cream-muted">
            {activeRun ? `${activeRun.status.replace(/_/g, ' ')} · ` : ''}
            Event {replayCursor} of {events.length}
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
          <div className="flex justify-between text-[10px] font-mono dark:text-charcoal-muted text-cream-muted">
            <span>Start</span>
            <span>Cursor: #{replayCursor}</span>
            <span>End (#{events.length})</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setIsReplaying(false);
                setReplayCursor(0);
              }}
              title="Reset to start"
              className="p-2 rounded-xl border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setIsReplaying(false);
                setReplayCursor(Math.max(0, replayCursor - 1));
              }}
              title="Step back"
              className="p-2 rounded-xl border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (atEnd) setReplayCursor(0);
                setIsReplaying(!isReplaying);
              }}
              disabled={events.length === 0}
              className="px-4 py-2 rounded-xl bg-coral hover:bg-coral-hover text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-coral/20 disabled:opacity-50"
            >
              {isReplaying ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isReplaying ? 'Pause' : 'Play Replay'}</span>
            </button>

            <button
              onClick={() => {
                setIsReplaying(false);
                setReplayCursor(Math.min(events.length, replayCursor + 1));
              }}
              title="Step forward"
              className="p-2 rounded-xl border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setIsReplaying(false);
                setReplayCursor(events.length);
              }}
              title="Jump to end"
              className="p-2 rounded-xl border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <span className="dark:text-charcoal-muted text-cream-muted mr-1">Speed:</span>
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-coral text-white'
                    : 'dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border border'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden h-96 dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border">
        <ActivityTimeline events={visibleEvents} />
      </div>
    </div>
  );
};
