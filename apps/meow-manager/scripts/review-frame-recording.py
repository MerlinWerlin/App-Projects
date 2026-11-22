"""Measure actual silent browser recording motion, not perceived art quality."""
from pathlib import Path
import subprocess, json, re, hashlib
raw = Path('docs/frame-animation-proof/meow-2d-preview.webm')
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(raw)]))
video = next(s for s in probe['streams'] if s['codec_type']=='video')
assert not any(s['codec_type']=='audio' for s in probe['streams'])
sx, sy = video['width']/390, video['height']/844
assert abs(sx-sy)<.01
def motion(rect):
    x,y,w,h=rect
    roi=[round(v*s) for v,s in zip([w,h,x,y],[sx,sy,sx,sy])]
    result=subprocess.run(['ffmpeg','-i',str(raw),'-vf',f"crop={':'.join(map(str,roi))},tblend=all_mode=difference,signalstats,metadata=print",'-an','-f','null','-'],capture_output=True,text=True,check=True)
    values=[float(v) for v in re.findall(r'lavfi.signalstats.YAVG=([\d.]+)',result.stderr)]
    assert values
    return dict(samples=len(values),meanLumaDifference=sum(values)/len(values),maxFrameMeanDifference=max(values))
report=dict(source=raw.as_posix(),sha256=hashlib.sha256(raw.read_bytes()).hexdigest(),width=video['width'],height=video['height'],duration=float(probe['format']['duration']),audio=False,bodyROI=motion((60,460,270,130)),eyeROI=motion((100,260,190,90)),note='Decoded lossy recording measurements: fixed lower-body region versus changing facial region. This does not certify naturalness, final art or physical iPhone playback.')
Path('docs/frame-animation-proof/recording-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
