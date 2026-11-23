import React from 'react';
import { Event } from '../../types';
import { Terminal, Image, FileCode, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface CoderLiveProps {
  events: Event[];
}

export const CoderLive: React.FC<CoderLiveProps> = ({ events }) => {
  // Extract all coder events
  const coderEvents = events.filter(e => e.agent_id === 'coder');
  const toolCalls = coderEvents.filter(e => e.type === 'tool_call');
  const toolResults = coderEvents.filter(e => e.type === 'tool_result');
  const artifacts = events.filter(e => e.type === 'artifact' && e.payload?.type === 'image/png');

  // Most recent code execution
  const latestCall = toolCalls[toolCalls.length - 1];
  const latestResult = toolResults[toolResults.length - 1];
  const code = latestCall?.payload?.args?.code || '# No code execution logged yet in this run.';
  const stdout = latestResult?.payload?.stdout || '';
  const stderr = latestResult?.payload?.stderr || '';
  const success = latestResult?.payload?.success ?? true;

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x dark:divide-charcoal-border divide-cream-border">
      
      {/* Left Pane: Code View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-charcoal-border border-cream-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCode className="w-4 h-4 text-coral" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Python Sandbox Script
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-coral/10 text-coral">
            Isolated Subprocess
          </span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto bg-black/90 font-mono text-xs text-neutral-200">
          <pre className="whitespace-pre-wrap leading-relaxed">{code}</pre>
        </div>
      </div>

      {/* Right Pane: Execution Output & Generated Artifacts */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-charcoal-border border-cream-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Sandbox Standard Output & Artifacts
            </span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
          }`}>
            {success ? 'Exit Code: 0' : 'Error Detected'}
          </span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          
          {/* Stdout / Stderr Box */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Execution Terminal Log:
            </span>
            <div className="p-3 rounded-xl bg-black/95 font-mono text-xs text-neutral-300 max-h-56 overflow-y-auto">
              {stdout ? (
                <pre className="whitespace-pre-wrap text-emerald-400">{stdout}</pre>
              ) : (
                <span className="text-neutral-500 italic">No standard output logged.</span>
              )}
              {stderr && (
                <pre className="whitespace-pre-wrap text-red-400 mt-2">{stderr}</pre>
              )}
            </div>
          </div>

          {/* Matplotlib Artifacts Gallery */}
          {artifacts.length > 0 && (
            <div className="space-y-2 pt-2 border-t dark:border-charcoal-border border-cream-border">
              <div className="flex items-center space-x-2">
                <Image className="w-4 h-4 text-coral" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Generated Matplotlib Artifacts ({artifacts.length})
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {artifacts.map((art, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg text-center space-y-2"
                  >
                    <img
                      src={`data:${art.payload?.type};base64,${art.payload?.data}`}
                      alt={art.payload?.name || 'Sandbox Plot'}
                      className="rounded-lg max-h-72 mx-auto object-contain shadow-md"
                    />
                    <div className="text-[11px] font-mono dark:text-charcoal-muted text-cream-muted">
                      {art.payload?.name} · base64 PNG
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
};

