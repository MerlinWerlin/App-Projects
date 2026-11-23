import { addEntry, createJob, DEFAULT_PREFS, isFreeTool, jobText, parseJobs, parsePrefs, parseRoof, regionGuess, removeEntry, removeJob, roofReady, updateJob, withCountry } from './model';

describe('prefs', () => {
  test('parse defaults, junk and a stored value', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{nope')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(JSON.stringify({ v: 2 }))).toEqual(DEFAULT_PREFS);
    const p = parsePrefs(JSON.stringify({ v: 1, country: 'nz', sys: 'imperial', pitchStyle: 'x12', theme: 'sun', haptics: false, safetySeen: true }));
    expect(p).toEqual({ v: 1, country: 'NZ', sys: 'imperial', pitchStyle: 'x12', theme: 'sun', haptics: false, safetySeen: true });
    expect(parsePrefs(JSON.stringify({ v: 1, country: 'ZZ', theme: 'neon' })).country).toBeNull();
  });
  test('choosing a country sets its units', () => {
    expect(withCountry(DEFAULT_PREFS, 'US')).toMatchObject({ country: 'US', sys: 'imperial', pitchStyle: 'x12' });
    expect(withCountry({ ...DEFAULT_PREFS, sys: 'imperial' }, 'AU')).toMatchObject({ country: 'AU', sys: 'metric', pitchStyle: 'deg' });
    expect(withCountry(DEFAULT_PREFS, 'BR')).toMatchObject({ country: 'BR', sys: 'metric' });
  });
  test('region guess', () => {
    expect(regionGuess('AU')).toBe('AU');
    expect(regionGuess('uk')).toBe('GB');
    expect(regionGuess('ZZ')).toBeNull();
    expect(regionGuess(undefined)).toBeNull();
  });
});

describe('roof', () => {
  test('parse and readiness', () => {
    expect(roofReady(parseRoof(null))).toBe(false);
    const r = parseRoof(JSON.stringify({ type: 'hip', lengthMm: 12000, widthMm: 8000, pitchDeg: 25 }));
    expect(r.type).toBe('hip');
    expect(roofReady(r)).toBe(true);
    expect(parseRoof(JSON.stringify({ type: 'dome', lengthMm: -5, widthMm: 'x', pitchDeg: NaN }))).toEqual({ type: 'gable', lengthMm: 0, widthMm: 0, pitchDeg: 0 });
  });
});

describe('jobs', () => {
  test('create, add entries, edit, remove and share', () => {
    let { jobs, job } = createJob([], '  12 Smith St  ', 'AU', { type: 'gable', lengthMm: 10000, widthMm: 8000, pitchDeg: 22.5 }, 1000);
    expect(job.name).toBe('12 Smith St');
    expect(job.roof?.pitchDeg).toBe(22.5);
    jobs = addEntry(jobs, job.id, { tool: 'sheets', title: 'Sheets', lines: ['28 × 4380 mm'] }, 2000);
    jobs = addEntry(jobs, job.id, { tool: 'fall', title: 'Gutter fall', lines: ['20 mm over 10 m'] }, 3000);
    expect(jobs[0]!.entries.map(e => e.title)).toEqual(['Gutter fall', 'Sheets']);
    expect(jobs[0]!.updatedAt).toBe(3000);
    const text = jobText(jobs[0]!);
    expect(text.indexOf('SHEETS')).toBeLessThan(text.indexOf('GUTTER FALL'));
    expect(text).toContain('• 28 × 4380 mm');
    jobs = updateJob(jobs, job.id, { name: '', notes: 'Ladder on the left' }, 4000);
    expect(jobs[0]!.name).toBe('12 Smith St');
    expect(jobs[0]!.notes).toBe('Ladder on the left');
    jobs = removeEntry(jobs, job.id, jobs[0]!.entries[0]!.id, 5000);
    expect(jobs[0]!.entries).toHaveLength(1);
    expect(parseJobs(JSON.stringify(jobs))).toEqual(jobs);
    expect(removeJob(jobs, job.id)).toEqual([]);
    expect(createJob(jobs, '', 'AU', null, 1).job.name).toBe('Job 2');
  });
  test('long saved results are capped with a note', () => {
    const { jobs, job } = createJob([], 'Big shed', 'AU', null, 1);
    const lines = Array.from({ length: 2500 }, (_, i) => `line ${i}`);
    const out = addEntry(jobs, job.id, { tool: 'sheets', title: 'Sheets', lines }, 2)[0]!.entries[0]!.lines;
    expect(out).toHaveLength(2000);
    expect(out[1999]).toBe('…and 501 more');
  });
  test('corrupt storage gives an empty list', () => {
    expect(parseJobs('oops')).toEqual([]);
    expect(parseJobs(JSON.stringify({}))).toEqual([]);
    expect(parseJobs(JSON.stringify([{ id: 1 }, { id: 'a', name: 'ok' }]))).toHaveLength(1);
  });
  test('free tools', () => {
    expect(isFreeTool('pitch')).toBe(true);
    expect(isFreeTool('level')).toBe(true);
    expect(isFreeTool('fall')).toBe(true);
    expect(isFreeTool('sheets')).toBe(false);
  });
});
