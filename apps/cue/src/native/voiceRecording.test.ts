import { startVoiceRecording } from './voiceRecording';

function fixture(permission = async () => true) {
  const recorder = { uri: 'file:///cache/meter.m4a', prepareToRecordAsync: jest.fn(async () => {}), record: jest.fn(), stop: jest.fn(async () => {}) };
  const mode = jest.fn(async (_enabled: boolean) => {});
  const erase = jest.fn();
  const status = jest.fn();
  return { recorder, mode, erase, status, start: () => startVoiceRecording(recorder, permission, mode, erase, status) };
}

test('stops and erases exactly once, without deleting the recording before stop', async () => {
  const f = fixture();
  f.recorder.stop.mockImplementation(async () => { expect(f.erase).not.toHaveBeenCalled(); });
  const s = f.start();
  await s.started;
  await Promise.all([s.stop(), s.stop()]);
  expect(f.recorder.record).toHaveBeenCalledTimes(1);
  expect(f.recorder.stop).toHaveBeenCalledTimes(1);
  expect(f.erase).toHaveBeenCalledWith('file:///cache/meter.m4a');
  expect(f.erase).toHaveBeenCalledTimes(1);
  expect(f.mode.mock.calls).toEqual([[true], [false]]);
});

test('leaving while permission is pending never starts the microphone', async () => {
  let resolve!: (allowed: boolean) => void;
  const f = fixture(() => new Promise<boolean>(r => { resolve = r; }));
  const s = f.start();
  const stopped = s.stop();
  resolve(true);
  await stopped;
  expect(f.mode).not.toHaveBeenCalled();
  expect(f.recorder.prepareToRecordAsync).not.toHaveBeenCalled();
});

test('leaving during preparation deletes the partial file without starting recording', async () => {
  let resolve!: () => void;
  const f = fixture();
  f.recorder.prepareToRecordAsync.mockImplementation(() => new Promise<void>(r => { resolve = r; }));
  const s = f.start();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(resolve).toBeDefined();
  const stopped = s.stop();
  resolve();
  await stopped;
  expect(f.recorder.record).not.toHaveBeenCalled();
  expect(f.erase).toHaveBeenCalledTimes(1);
});

test('stop failure still erases the partial recording and resets audio mode', async () => {
  const f = fixture();
  f.recorder.stop.mockRejectedValue(new Error('interrupted'));
  const s = f.start(); await s.started; await s.stop();
  expect(f.erase).toHaveBeenCalledTimes(1);
  expect(f.mode).toHaveBeenLastCalledWith(false);
});

test('permission denial does not create or erase a recording', async () => {
  const f = fixture(async () => false);
  const s = f.start(); await s.started; await s.stop();
  expect(f.status).toHaveBeenCalledWith('denied');
  expect(f.recorder.prepareToRecordAsync).not.toHaveBeenCalled();
  expect(f.erase).not.toHaveBeenCalled();
});
