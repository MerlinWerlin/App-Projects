// QA only: prove this JS-only repair has the original binary's native identity.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const [root, output] = process.argv.slice(2);
const project = path.join(root, 'apps/cue');
const base = '49c8992756fd505ce14710c81c3e719ae5d99d0c';
const source = '1290bdf42acaf5f2bd216f5443b4a83e31001d5f';
const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git(['rev-parse', 'HEAD']) !== source) throw Error('Wrong repaired JS source');
cp.execFileSync('git', ['fetch', 'origin', base], { cwd: root, stdio: 'inherit' });
const changed = git(['diff', '--name-only', base, source, '--', 'apps/cue']).split('\n').filter(Boolean);
const permitted = ['apps/cue/src/plus/accessCode.ts', 'apps/cue/src/plus/accessCode.test.ts'];
if (changed.some(p => !permitted.includes(p) && !p.startsWith('apps/cue/docs/') && !p.startsWith('apps/cue/store/'))) throw Error('Native source or other runtime code changed');
const { createFingerprintAsync } = require(require.resolve('@expo/fingerprint', { paths: [project] }));
const file = path.join(project, 'src/plus/accessCode.ts');
const repaired = fs.readFileSync(file);
(async () => {
  const current = await createFingerprintAsync(project, { platforms: ['android'] });
  let previous;
  try {
    fs.writeFileSync(file, cp.execFileSync('git', ['show', base + ':apps/cue/src/plus/accessCode.ts'], { cwd: root }));
    previous = await createFingerprintAsync(project, { platforms: ['android'] });
  } finally { fs.writeFileSync(file, repaired); }
  fs.writeFileSync(path.join(output, 'native-fingerprint-base.json'), JSON.stringify(previous, null, 2));
  fs.writeFileSync(path.join(output, 'native-fingerprint-repaired.json'), JSON.stringify(current, null, 2));
  if (previous.hash !== current.hash) throw Error('Native fingerprints differ; a full native build is required');
  fs.writeFileSync(path.join(output, 'repack-source.json'), JSON.stringify({ status: 'matching_native_fingerprints_QA_only', nativeSource: base, javascriptSource: source, changed, fingerprint: current.hash }, null, 2));
  console.log('Native fingerprints match; only the access-code JS repair is repacked for QA.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
