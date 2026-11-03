"""Qualify the CI speech input separately from the game's short-take acceptance."""
import json
from pathlib import Path
import sys
import os


def sustained(pcm):
    # Three seconds of looped speech is intentionally supplied by the harness.
    # A few isolated input transients can pass the product's legitimate short-take
    # limits; they cannot qualify this sustained speech recording experiment.
    return (pcm['duration_seconds'] >= 2 and pcm['active_span_seconds'] >= 1.5
            and pcm['active_windows'] >= 50
            and pcm['active_windows'] / max(1, pcm['total_windows']) >= .2)


if sys.argv[1:] == ['--self-test']:
    assert sustained(dict(duration_seconds=3, active_span_seconds=2.4, active_windows=90, total_windows=150))
    for pcm in [
        dict(duration_seconds=11.84, active_span_seconds=.24, active_windows=5, total_windows=593),
        dict(duration_seconds=4.435, active_span_seconds=0, active_windows=0, total_windows=222),
        dict(duration_seconds=12, active_span_seconds=10, active_windows=50, total_windows=600),
    ]:
        assert not sustained(pcm)
    print('Sustained speech qualification: complete input vs silent/fragmented/sparse captures PASS')
else:
    out=Path(sys.argv[1])
    source=out/'microphone-diagnostics/recording-analysis.json'
    data=json.loads(source.read_text())
    recordings=[f for f in data['files'] if '/cache/Audio/' in f['app_cache_path'] and f['file'].endswith('.m4a')]
    checks=[dict(file=f['file'],pcm=f['independent_pcm'],sustained=sustained(f['independent_pcm'])) for f in recordings]
    passed=data['status']=='CAPTURED' and len(checks)==2 and all(x['sustained'] for x in checks)
    mode=os.environ.get('BACKSPIN_MICROPHONE_SOURCE','host-speech')
    if mode=='hal-tone':
        passed=passed and all(abs(x['pcm'].get('positive_zero_crossings_hz',0)-300)<10 and x['pcm']['rms']>.1 for x in checks)
    result=dict(status='PASS' if passed else 'FAIL', scope='Sustained synthetic CI input, independently decoded AAC',
                input_mode=mode, host_speech_qualified=passed and mode=='host-speech',
                expected_recordings=2, recordings=checks,
                not_proven=['human voice quality','physical phone routes','actual Play purchase'])
    (out/'sustained-microphone-qualification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    raise SystemExit(0 if passed else 1)
