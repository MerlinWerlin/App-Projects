import { loadSpeech } from './speech';

type Event = { results?: { transcript: string }[]; isFinal?: boolean; error?: string; message?: string };
const mockListeners = new Map<string, (event?: Event) => void>();
const mockModule = {
  requestPermissionsAsync: jest.fn(),
  getSupportedLocales: jest.fn(),
  supportsOnDeviceRecognition: jest.fn(),
  isRecognitionAvailable: () => true,
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  addListener: jest.fn((name: string, callback: (event?: Event) => void) => {
    mockListeners.set(name, callback);
    return { remove: () => mockListeners.delete(name) };
  }),
};
jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: mockModule }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockListeners.clear();
  mockModule.start.mockReset();
  mockModule.requestPermissionsAsync.mockResolvedValue({ granted: true });
  mockModule.getSupportedLocales.mockResolvedValue({ locales: ['en-US', 'en-AU'], installedLocales: ['en-AU'] });
  mockModule.supportsOnDeviceRecognition.mockReturnValue(true);
  const options = new Intl.DateTimeFormat().resolvedOptions();
  jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ ...options, locale: 'en-AU' });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('starts the Australian recognizer and reports listening only after its start event', async () => {
  const ready = jest.fn();
  const session = await loadSpeech()!.start('system', jest.fn(), jest.fn(), ['teleprompter'], ready);
  expect(mockModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'en-AU', requiresOnDeviceRecognition: true, contextualStrings: ['teleprompter'] }));
  expect(ready).not.toHaveBeenCalled();
  mockListeners.get('start')!();
  expect(ready).toHaveBeenCalledTimes(1);
  session.stop();
  expect(mockListeners.size).toBe(0);
});

it('reproduces and prevents the emailed en locale error at the native boundary', async () => {
  mockModule.start.mockImplementation((opts) => {
    if (opts.lang === 'en') throw new Error('Locale en is not supported by the speech recognizer.');
  });
  const session = await loadSpeech()!.start('en', jest.fn(), jest.fn());
  expect(mockModule.start.mock.calls[0][0].lang).toBe('en-AU');
  session.stop();
});

it('fails once and never restarts after a terminal native language error', async () => {
  const error = jest.fn();
  const session = await loadSpeech()!.start('system', jest.fn(), error);
  const end = mockListeners.get('end')!;
  const fail = mockListeners.get('error')!;
  fail({ error: 'language-not-supported', message: 'Locale en is not supported. Available locales: very long list' });
  fail({ error: 'language-not-supported' });
  end();
  jest.runOnlyPendingTimers();
  expect(error).toHaveBeenCalledTimes(1);
  expect(error.mock.calls[0][0]).not.toContain('Available locales');
  expect(mockModule.start).toHaveBeenCalledTimes(1);
  expect(mockListeners.size).toBe(0);
  session.stop();
  expect(mockModule.abort).toHaveBeenCalledTimes(1);
});

it('continues through ordinary silence and preserves words across session restarts', async () => {
  const transcript = jest.fn();
  const error = jest.fn();
  const session = await loadSpeech()!.start('en', transcript, error);
  mockListeners.get('result')!({ results: [{ transcript: 'hello there' }] });
  mockListeners.get('error')!({ error: 'no-speech' });
  mockListeners.get('end')!();
  jest.advanceTimersByTime(250);
  expect(mockModule.start).toHaveBeenCalledTimes(2);
  mockListeners.get('result')!({ results: [{ transcript: 'next line' }] });
  expect(transcript).toHaveBeenLastCalledWith('hello there next line');
  expect(error).not.toHaveBeenCalled();
  session.stop();
});

it('cancels a queued restart when the reader stops', async () => {
  const session = await loadSpeech()!.start('system', jest.fn(), jest.fn());
  mockListeners.get('end')!();
  session.stop();
  jest.runOnlyPendingTimers();
  expect(mockModule.start).toHaveBeenCalledTimes(1);
});

it('cleans up listeners when native start throws', async () => {
  mockModule.start.mockImplementation(() => { throw new Error('audio unavailable'); });
  await expect(loadSpeech()!.start('system', jest.fn(), jest.fn())).rejects.toThrow('audio unavailable');
  expect(mockListeners.size).toBe(0);
  expect(mockModule.abort).toHaveBeenCalledTimes(1);
});

it('reports a thrown restart failure instead of staying stuck on Listening', async () => {
  const error = jest.fn();
  await loadSpeech()!.start('system', jest.fn(), error);
  mockModule.start.mockImplementation(() => { throw new Error('microphone interrupted'); });
  mockListeners.get('end')!();
  jest.advanceTimersByTime(250);
  expect(error).toHaveBeenCalledWith('microphone interrupted');
  expect(mockListeners.size).toBe(0);
});

it('does not open the microphone after navigation cancels a pending permission prompt', async () => {
  let grant!: (value: { granted: boolean }) => void;
  mockModule.requestPermissionsAsync.mockReturnValue(new Promise((resolve) => { grant = resolve; }));
  const controller = new AbortController();
  const start = loadSpeech()!.start('system', jest.fn(), jest.fn(), [], undefined, controller.signal);
  controller.abort();
  grant({ granted: true });
  await expect(start).rejects.toThrow('cancelled');
  expect(mockModule.start).not.toHaveBeenCalled();
  expect(mockListeners.size).toBe(0);
});

it('rejects unavailable languages before starting recognition', async () => {
  await expect(loadSpeech()!.start('de-DE', jest.fn(), jest.fn())).rejects.toThrow('unavailable');
  expect(mockModule.start).not.toHaveBeenCalled();
});

it('does not start when microphone permission is denied', async () => {
  mockModule.requestPermissionsAsync.mockResolvedValue({ granted: false });
  await expect(loadSpeech()!.start('system', jest.fn(), jest.fn())).rejects.toThrow('permission is off');
  expect(mockModule.start).not.toHaveBeenCalled();
});
