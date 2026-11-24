import React, { useState, useMemo } from 'react';
import { Event } from '../../types';
import { Terminal, Image, FileCode, CheckCircle2, AlertCircle, GitCompare, Eye, Layers } from 'lucide-react';

interface CoderLiveProps {
  events: Event[];
}

interface AttemptData {
  attemptNumber: number;
  code: string;
  stdout: string;
  stderr: string;
  success: boolean;
  durationMs?: number;
  artifacts: Event[];
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

// Lightweight, zero-dependency Myers-style line diff algorithm for clean visualization
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff: DiffLine[] = [];

  // Simple LCS / greedy diff implementation suitable for code corrections
  let i = 0;
  let j = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      diff.push({
        type: 'unchanged',
        content: oldLines[i],
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      });
      i++;
      j++;
    } else {
      // Lookahead to see if next lines match
      const nextMatchInNew = newLines.slice(j, j + 5).indexOf(oldLines[i]);
      const nextMatchInOld = oldLines.slice(i, i + 5).indexOf(newLines[j]);

      if (nextMatchInNew !== -1 && (nextMatchInOld === -1 || nextMatchInNew <= nextMatchInOld)) {
        // Line added in new
        diff.push({
          type: 'added',
          content: newLines[j],
          newLineNumber: newLineNum++,
        });
        j++;
      } else if (i < oldLines.length) {
        // Line removed from old
        diff.push({
          type: 'removed',
          content: oldLines[i],
          oldLineNumber: oldLineNum++,
        });
        i++;
      } else if (j < newLines.length) {
        // Line added in new
        diff.push({
          type: 'added',
          content: newLines[j],
          newLineNumber: newLineNum++,
        });
        j++;
      }
    }
  }

  return diff;
}

export const CoderLive: React.FC<CoderLiveProps> = ({ events }) => {
  // Extract all coder attempts
  const attempts: AttemptData[] = useMemo(() => {
    const coderEvents = events.filter(e => e.agent_id === 'coder');
    const toolCalls = coderEvents.filter(e => e.type === 'tool_call' && e.payload?.tool === 'python_sandbox');
    const toolResults = coderEvents.filter(e => e.type === 'tool_result' && (e.payload?.tool === 'python_sandbox' || e.payload?.stdout !== undefined));
    const allArtifacts = events.filter(e => e.type === 'artifact' && e.payload?.type === 'image/png');

    if (toolCalls.length === 0) {
      // Check if there is raw code in thought or single tool_call
      return [];
    }

    return toolCalls.map((call, idx) => {
      const attemptNum = call.payload?.args?.attempt || (idx + 1);
      const code = call.payload?.args?.code || '';
      const result = toolResults[idx] || toolResults[toolResults.length - 1];
      const stdout = result?.payload?.stdout || (typeof result?.payload?.result === 'string' ? result?.payload?.result : '');
      const stderr = result?.payload?.stderr || '';
      const success = result?.payload?.success ?? (stderr.length === 0);
      const durationMs = result?.payload?.duration_ms;

      // Filter artifacts that appeared around this attempt
      const attemptArtifacts = idx === toolCalls.length - 1 ? allArtifacts : [];

      return {
        attemptNumber: attemptNum,
        code,
        stdout,
        stderr,
        success,
        durationMs,
        artifacts: attemptArtifacts,
      };
    });
  }, [events]);

  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code');

  // Fallback if no structured tool_calls found
  const activeAttempt = attempts[selectedAttemptIndex] || attempts[attempts.length - 1];
  const hasMultipleAttempts = attempts.length > 1;

  // Diff between selected attempt and previous attempt (or between attempt 1 and latest attempt)
  const previousAttempt = selectedAttemptIndex > 0 ? attempts[selectedAttemptIndex - 1] : attempts[0];
  const diffLines = useMemo(() => {
    if (!hasMultipleAttempts || !activeAttempt || !previousAttempt) return [];
    return computeLineDiff(previousAttempt.code, activeAttempt.code);
  }, [hasMultipleAttempts, activeAttempt, previousAttempt]);

  if (attempts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-neutral-500 font-mono text-xs">
        <div className="space-y-2">
          <FileCode className="w-8 h-8 mx-auto text-neutral-600 animate-pulse" />
          <p>No sandbox code executions recorded yet for this run.</p>
          <p className="text-[11px] text-neutral-600">The Coder Agent will stream live code, diffs, and plots here as tasks execute.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      
      {/* Top Bar: Attempt Switcher & Mode Toggles */}
      <div className="px-4 py-2 border-b dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-bold uppercase tracking-wider text-[11px] text-neutral-400">
            Attempts:
          </span>
          <div className="flex items-center space-x-1">
            {attempts.map((att, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedAttemptIndex(idx);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium flex items-center space-x-1.5 transition-colors ${
                  selectedAttemptIndex === idx
                    ? 'bg-coral text-white shadow-sm'
                    : 'dark:bg-charcoal-bg bg-cream-bg text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span>#{att.attemptNumber}</span>
                {att.success ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-red-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* View mode toggle (Code vs Diff) */}
        <div className="flex items-center space-x-1 dark:bg-charcoal-bg bg-cream-bg p-0.5 rounded-lg border dark:border-charcoal-border border-cream-border">
          <button
            onClick={() => setViewMode('code')}
            className={`px-2.5 py-1 rounded-md text-xs flex items-center space-x-1.5 font-medium transition-colors ${
              viewMode === 'code'
                ? 'dark:bg-charcoal-surface bg-cream-surface text-coral font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Code & Output</span>
          </button>

          {hasMultipleAttempts && (
            <button
              onClick={() => setViewMode('diff')}
              className={`px-2.5 py-1 rounded-md text-xs flex items-center space-x-1.5 font-medium transition-colors ${
                viewMode === 'diff'
                  ? 'dark:bg-charcoal-surface bg-cream-surface text-coral font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Diff View</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-coral/20 text-coral font-mono">
                Self-Correction
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'diff' ? (
        /* Diff View Mode */
        <div className="flex-1 flex flex-col overflow-hidden font-mono text-xs bg-black/95">
          <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900/60 flex items-center justify-between text-neutral-400">
            <div className="flex items-center space-x-2">
              <GitCompare className="w-4 h-4 text-coral" />
              <span>Comparing Attempt #{previousAttempt.attemptNumber} → Attempt #{activeAttempt.attemptNumber}</span>
            </div>
            <div className="flex items-center space-x-4 text-[11px]">
              <span className="flex items-center space-x-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                <span>Removed</span>
              </span>
              <span className="flex items-center space-x-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span>Added / Corrected</span>
              </span>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-0.5">
            {diffLines.map((line, idx) => (
              <div
                key={idx}
                className={`flex items-start px-2 py-0.5 rounded leading-relaxed ${
                  line.type === 'added'
                    ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
                    : line.type === 'removed'
                    ? 'bg-red-950/40 text-red-300 border-l-2 border-red-500 line-through opacity-75'
                    : 'text-neutral-300 hover:bg-neutral-900/40'
                }`}
              >
                <span className="w-10 select-none text-[10px] text-neutral-600 text-right pr-3 font-mono">
                  {line.type === 'added' ? `+${line.newLineNumber}` : line.type === 'removed' ? `-${line.oldLineNumber}` : line.newLineNumber}
                </span>
                <span className="w-4 select-none font-bold text-center">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                <span className="flex-1 whitespace-pre-wrap pl-2 break-all">{line.content}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Split Code & Output Mode */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x dark:divide-charcoal-border divide-cream-border">
          
          {/* Left Pane: Code View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b dark:border-charcoal-border border-cream-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-coral" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Script (Attempt #{activeAttempt.attemptNumber})
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-coral/10 text-coral">
                Python Sandbox Subprocess
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-black/90 font-mono text-xs text-neutral-200">
              <pre className="whitespace-pre-wrap leading-relaxed">{activeAttempt.code}</pre>
            </div>
          </div>

          {/* Right Pane: Execution Output & Artifacts */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b dark:border-charcoal-border border-cream-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Terminal Output & Plots
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {activeAttempt.durationMs !== undefined && (
                  <span className="text-[10px] font-mono text-neutral-400">
                    {activeAttempt.durationMs.toFixed(1)}ms
                  </span>
                )}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  activeAttempt.success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                }`}>
                  {activeAttempt.success ? 'Exit Code: 0' : 'Error Detected'}
                </span>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              
              {/* Stdout / Stderr Box */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
                  Standard Output:
                </span>
                <div className="p-3 rounded-xl bg-black/95 font-mono text-xs text-neutral-300 max-h-56 overflow-y-auto">
                  {activeAttempt.stdout ? (
                    <pre className="whitespace-pre-wrap text-emerald-400">{activeAttempt.stdout}</pre>
                  ) : (
                    <span className="text-neutral-500 italic">No standard output logged.</span>
                  )}
                  {activeAttempt.stderr && (
                    <div className="mt-2 pt-2 border-t border-red-900/40">
                      <span className="text-[10px] uppercase font-bold text-red-400 block mb-1">Standard Error:</span>
                      <pre className="whitespace-pre-wrap text-red-400">{activeAttempt.stderr}</pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Matplotlib Artifacts Gallery */}
              {activeAttempt.artifacts.length > 0 && (
                <div className="space-y-2 pt-2 border-t dark:border-charcoal-border border-cream-border">
                  <div className="flex items-center space-x-2">
                    <Image className="w-4 h-4 text-coral" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Generated Matplotlib Plot Artifact ({activeAttempt.artifacts.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {activeAttempt.artifacts.map((art, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg text-center space-y-2 shadow-sm"
                      >
                        <img
                          src={`data:${art.payload?.type};base64,${art.payload?.data}`}
                          alt={art.payload?.name || 'Sandbox Plot'}
                          className="rounded-lg max-h-72 mx-auto object-contain shadow-md"
                        />
                        <div className="text-[11px] font-mono dark:text-charcoal-muted text-cream-muted">
                          {art.payload?.name || 'plot.png'} · inline base64 artifact
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

    </div>
  );
};
