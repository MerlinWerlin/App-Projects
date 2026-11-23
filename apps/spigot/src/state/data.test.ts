import { DEFAULT_PREFS, MAX_RECENTS, addRecent, deleteJob, parseFittings, parseJobs, parsePrefs, parseRecords, type CalcRecord } from './data';

const rec = (id: string, over: Partial<CalcRecord> = {}): CalcRecord => ({ id, tool: 'offset', createdAt: 1, summary: id, inputs: { offset: Number(id.replace(/\D/g, '')) || 1, angle: 45 }, jobId: null, ...over });

test('corrupt or missing data falls back safely', () => {
  expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
  expect(parsePrefs('{bad json')).toEqual(DEFAULT_PREFS);
  expect(parsePrefs(JSON.stringify({ unit: 'imperial', stock: -5, kerf: 999, appearance: 'neon' }))).toEqual({ ...DEFAULT_PREFS, unit: 'imperial' });
  expect(parseJobs('"x"')).toEqual([]);
  expect(parseJobs(JSON.stringify([{ id: 'a', createdAt: 5, name: '' }, { nope: 1 }]))).toEqual([{ id: 'a', name: 'Untitled job', notes: '', createdAt: 5, updatedAt: 5 }]);
  expect(parseRecords(JSON.stringify([rec('r1'), { id: 'x', tool: 'laser', createdAt: 1, inputs: {} }]))).toHaveLength(1);
  expect(parseFittings(JSON.stringify([{ id: 'f', name: 'Elbow', centreToEnd: 30, engagement: 12 }, { id: 'g', centreToEnd: 5, engagement: 10 }]))).toHaveLength(1);
});

test('recents keep the newest 30 and never drop saved results', () => {
  let rs: CalcRecord[] = [rec('saved', { jobId: 'job1' })];
  for (let i = 0; i < 40; i++) rs = addRecent(rs, rec(`r${i + 2}`, { createdAt: i }));
  expect(rs.filter(r => r.jobId === null)).toHaveLength(MAX_RECENTS);
  expect(rs.some(r => r.id === 'saved')).toBe(true);
  expect(rs[0]!.id).toBe('r41');
});

test('the same calculation twice in a row updates the recent instead of duplicating it', () => {
  const a = addRecent([], rec('r7', { createdAt: 1 }));
  const b = addRecent(a, rec('r7b', { createdAt: 9, inputs: { offset: 7, angle: 45 }, summary: 'again' }));
  expect(b).toHaveLength(1);
  expect(b[0]!.createdAt).toBe(9);
});

test('deleting a job removes its saved results only', () => {
  const jobs = [{ id: 'j1', name: 'A', notes: '', createdAt: 1, updatedAt: 1 }, { id: 'j2', name: 'B', notes: '', createdAt: 1, updatedAt: 1 }];
  const records = [rec('a', { jobId: 'j1' }), rec('b', { jobId: 'j2' }), rec('c')];
  const r = deleteJob(jobs, records, 'j1');
  expect(r.jobs.map(j => j.id)).toEqual(['j2']);
  expect(r.records.map(x => x.id)).toEqual(['b', 'c']);
});
