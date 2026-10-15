import { useState } from 'react';
import type { FreshApi } from '../fresh/api';

/** Queries the complete stored index, never the sampled markers on a history page. */
export function PromptNavigation({ api, recordingId, total, currentStep, onSelect }: { api: FreshApi; recordingId: string; total: number; currentStep?: number; onSelect: (step: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const move = async (direction: -1 | 1) => {
    setBusy(true); setNotice('');
    try {
      const result = await api.request<{ step?: number }>(`recordings/${encodeURIComponent(recordingId)}/history-marker`, { step: currentStep ?? (direction === -1 ? total + 1 : 0), direction, types: ['turn'] });
      if (result.step === undefined) setNotice(direction === -1 ? 'No earlier prompt' : 'No later prompt');
      else { onSelect(result.step); }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not locate prompt'); }
    finally { setBusy(false); }
  };
  return <div className="md-prompt-navigation" aria-label="Navigate captured prompts"><button disabled={busy} aria-label="Previous captured prompt" title="Previous prompt in the complete recording" onClick={() => void move(-1)}>←</button><span>Prompts</span><button disabled={busy} aria-label="Next captured prompt" title="Next prompt in the complete recording" onClick={() => void move(1)}>→</button>{notice && <small role="status">{notice}</small>}</div>;
}
