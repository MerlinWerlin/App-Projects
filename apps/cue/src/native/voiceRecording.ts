/** A metering recording owns its temporary file and must erase it on exit. */
export interface MeterRecorder {
  readonly uri: string | null;
  prepareToRecordAsync(): Promise<unknown>;
  record(): void;
  stop(): Promise<unknown>;
}

export function startVoiceRecording(
  recorder: MeterRecorder,
  permission: () => Promise<boolean>,
  audioMode: (enabled: boolean) => Promise<unknown>,
  erase: (uri: string) => void,
  status: (value: 'listening' | 'denied' | 'error') => void,
) {
  let cancelled = false;
  let prepared = false;
  let configured = false;
  let cleanup: Promise<void> | undefined;
  const dispose = () => cleanup ??= (async () => {
    try {
      if (prepared) {
        const uri = recorder.uri;
        try { await recorder.stop(); } catch { /* Still delete the partial file. */ }
        const finalUri = recorder.uri || uri;
        if (finalUri) erase(finalUri);
      }
    } finally {
      if (configured) await audioMode(false).catch(() => undefined);
    }
  })();
  const started = (async () => {
    try {
      const allowed = await permission();
      if (cancelled) return;
      if (!allowed) { status('denied'); return; }
      await audioMode(true);
      configured = true;
      if (cancelled) return;
      prepared = true;
      await recorder.prepareToRecordAsync();
      if (cancelled) return;
      recorder.record();
      status('listening');
    } catch {
      if (!cancelled) status('error');
      cancelled = true;
    } finally {
      if (cancelled) await dispose().catch(() => undefined);
    }
  })();
  return { started, stop: async () => { cancelled = true; await started; await dispose(); } };
}
