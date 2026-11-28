import React, { useState, useMemo } from 'react';
import { Event } from '../../types';
import { Terminal, Image, FileCode, CheckCircle2, AlertCircle, GitCompare, Eye } from 'lucide-react';

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

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff: DiffLine[] = [];

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
      const nextMatchInNew = newLines.slice(j, j + 5).indexOf(oldLines[i]);
      const nextMatchInOld = oldLines.slice(i, i + 5).indexOf(newLines[j]);

      if (nextMatchInNew !== -1 && (nextMatchInOld === -1 || nextMatchInNew <= nextMatchInOld)) {
        diff.push({ type: 'added', content: newLines[j], newLineNumber: newLineNum++ });
        j++;
      } else if (i < oldLines.length) {
        diff.push({ type: 'removed', content: oldLines[i], oldLineNumber: oldLineNum++ });
        i++;
      } else if (j < newLines.length) {
        diff.push({ type: 'added', content: newLines[j], newLineNumber: newLineNum++ });
        j++;
      }
    }
  }

  return diff;
}

export const CoderLive: React.FC<CoderLiveProps> = ({ events }) => {
  const attempts: AttemptData[] = useMemo(() => {
    const coderEvents = events.filter((event) => event.agent_id === 'coder');
    const built: AttemptData[] = [];
    let pendingCall: Event | null = null;

    for (const event of coderEvents) {
      if (event.type === 'tool_call' && event.payload?.tool === 'python_sandbox') {
        pendingCall = event;
        continue;
      }

      if (
        event.type === 'tool_result' &&
        pendingCall &&
        event.payload?.tool === 'python_sandbox'
      ) {
        const payload = event.payload ?? {};
        built.push({
          attemptNumber: pendingCall.payload?.args?.attempt || built.length + 1,
          code: pendingCall.payload?.args?.code || '',
          stdout: payload.stdout || '',
          stderr: payload.stderr || '',
          success: payload.success ?? !payload.stderr,
          durationMs: payload.duration_ms,
          artifacts: [],
        });
        pendingCall = null;
        continue;
      }

      if (event.type === 'artifact' && built.length > 0) {
        built[built.length - 1].artifacts.push(event);
      }
    }

    return built;
  }, [events]);

  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code');

  const activeAttempt = attempts[selectedAttemptIndex] || attempts[attempts.length - 1];
  const hasMultipleAttempts = attempts.length > 1;

  const previousAttempt = selectedAttemptIndex > 0 ? attempts[selectedAttemptIndex - 1] : attempts[0];
  const diffLines = useMemo(() => {
    if (!hasMultipleAttempts || !activeAttempt || !previousAttempt) return [];
    return computeLineDiff(previousAttempt.code, activeAttempt.code);
  }, [hasMultipleAttempts, activeAttempt, previousAttempt]);

  if (attempts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-cream-muted dark:text-charcoal-muted text-xs">
        <div className="space-y-1.5 max-w-sm">
          <FileCode className="w-7 h-7 mx-auto opacity-50" />
          <p className="font-semibold text-cream-text dark:text-charcoal-text">
            No sandbox code executions in this run
          </p>
          <p className="text-[11px]">
            When the Coder agent executes Python scripts, code, stdout, diffs, and Matplotlib plots
            appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-cream-muted dark:text-charcoal-muted">
            Attempts:
          </span>
          <div className="flex items-center gap-1">
            {attempts.map((att, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedAttemptIndex(idx)}
                className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                  selectedAttemptIndex === idx
                    ? 'bg-coral text-white'
                    : 'bg-cream-subtle dark:bg-charcoal-bg text-cream-muted dark:text-charcoal-muted'
                }`}
              >
                <span>#{att.attemptNumber}</span>
                {att.success ? (
                  <CheckCircle2 className="w-3 h-3 text-statusSuccess" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-statusError" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 bg-cream-subtle dark:bg-charcoal-bg p-0.5 rounded-full border border-cream-border dark:border-charcoal-border">
          <button
            type="button"
            onClick={() => setViewMode('code')}
            className={`px-3 py-1 rounded-full text-xs flex items-center gap-1.5 font-medium transition-colors ${
              viewMode === 'code'
                ? 'bg-cream-surface dark:bg-charcoal-surface text-coral font-semibold shadow-2xs'
                : 'text-cream-muted dark:text-charcoal-muted'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Code & Output</span>
          </button>

          {hasMultipleAttempts && (
            <button
              type="button"
              onClick={() => setViewMode('diff')}
              className={`px-3 py-1 rounded-full text-xs flex items-center gap-1.5 font-medium transition-colors ${
                viewMode === 'diff'
                  ? 'bg-cream-surface dark:bg-charcoal-surface text-coral font-semibold shadow-2xs'
                  : 'text-cream-muted dark:text-charcoal-muted'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Diff View</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'diff' ? (
        <div className="flex-1 flex flex-col overflow-hidden font-mono text-xs bg-[#110E13] text-stone-200">
          <div className="px-4 py-2 border-b border-charcoal-border bg-charcoal-surface flex items-center justify-between text-charcoal-muted">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-coral" />
              <span>
                Attempt #{previousAttempt.attemptNumber} → Attempt #{activeAttempt.attemptNumber}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-red-400">− Removed</span>
              <span className="text-emerald-400">+ Added</span>
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
                      : 'text-stone-300'
                }`}
              >
                <span className="w-10 select-none text-[10px] text-stone-500 text-right pr-3">
                  {line.type === 'added'
                    ? `+${line.newLineNumber}`
                    : line.type === 'removed'
                      ? `-${line.oldLineNumber}`
                      : line.newLineNumber}
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
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-cream-border dark:divide-charcoal-border">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-cream-border dark:border-charcoal-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-coral" />
                <span className="text-xs font-semibold">
                  Script (Attempt #{activeAttempt.attemptNumber})
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-coral/10 text-coral">
                Python Sandbox
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-[#110E13] font-mono text-xs text-stone-200">
              <pre className="whitespace-pre-wrap leading-relaxed">{activeAttempt.code}</pre>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-cream-border dark:border-charcoal-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amberAccent" />
                <span className="text-xs font-semibold">Output & Plots</span>
              </div>
              <div className="flex items-center gap-2">
                {activeAttempt.durationMs !== undefined && (
                  <span className="text-[10px] font-mono text-cream-muted dark:text-charcoal-muted">
                    {activeAttempt.durationMs.toFixed(1)}ms
                  </span>
                )}
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    activeAttempt.success
                      ? 'bg-statusSuccess/10 text-statusSuccess'
                      : 'bg-statusError/10 text-statusError'
                  }`}
                >
                  {activeAttempt.success ? 'Exit 0' : 'Error'}
                </span>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="p-3 rounded-lg bg-[#110E13] font-mono text-xs text-stone-200 max-h-48 overflow-y-auto">
                {activeAttempt.stdout ? (
                  <pre className="whitespace-pre-wrap text-emerald-400">{activeAttempt.stdout}</pre>
                ) : (
                  <span className="text-stone-500 italic">No standard output logged.</span>
                )}
                {activeAttempt.stderr && (
                  <div className="mt-2 pt-2 border-t border-red-900/40">
                    <span className="text-[10px] uppercase font-bold text-red-400 block mb-1">
                      Stderr:
                    </span>
                    <pre className="whitespace-pre-wrap text-red-400">{activeAttempt.stderr}</pre>
                  </div>
                )}
              </div>

              {activeAttempt.artifacts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-cream-border dark:border-charcoal-border">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-coral" />
                    <span className="text-xs font-semibold">
                      Plot Artifacts ({activeAttempt.artifacts.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {activeAttempt.artifacts.map((art, idx) => (
                      <div key={idx} className="text-center space-y-1.5">
                        <img
                          src={`data:${art.payload?.type};base64,${art.payload?.data}`}
                          alt={art.payload?.name || 'Sandbox Plot'}
                          className="rounded-lg max-h-64 mx-auto object-contain border border-cream-border dark:border-charcoal-border"
                        />
                        <div className="text-[11px] font-mono text-cream-muted dark:text-charcoal-muted">
                          {art.payload?.name || 'plot.png'}
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
