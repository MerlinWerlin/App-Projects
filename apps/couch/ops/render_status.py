#!/usr/bin/env python3
"""Render the Couch build status page (index.html at repo root) from ops/backlog.json,
ops/status.json and the last entries of ops/RUNLOG.md. Run from the repo root:
    python3 ops/render_status.py
Every build run edits status.json (tests, typecheck, last_run, headline, next_for_owner)
and backlog.json, then re-runs this script before publishing."""
import html, json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
backlog = json.loads((root / "ops/backlog.json").read_text())
status = json.loads((root / "ops/status.json").read_text())
runlog = [l[2:] for l in (root / "ops/RUNLOG.md").read_text().splitlines() if l.startswith("- ")][-6:][::-1]
tasks = backlog["tasks"]
done = sum(1 for t in tasks if t["status"] == "done")
e = html.escape

def row(t):
    st = t["status"]
    commit = f'<span class="mono">{e(t.get("commit", "")[:7])}</span>' if t.get("commit") else ""
    title = t["title"].split(":")[0] if len(t["title"]) > 90 else t["title"]
    return (f'<tr><td class="mono">{e(t["id"])}</td><td>{e(title)}</td>'
            f'<td><span class="st {e(st)}">{e(st.replace("_", " "))}</span> {commit}</td></tr>')

stage = status.get("stage", "build")
STAGES = ["build", "trial", "owner-tested", "release-prep"]
stage_html = " → ".join(f'<b class="cur">{e(x)}</b>' if x == stage else e(x) for x in STAGES)
kit = ""
if status.get("trial_kit"):
    kit = ("""<section class="kit"><h2>Try it on your iPhone</h2><p>Open Couch from <b>TestFlight</b> on your iPhone. Expo Go (Recently opened) is only a fallback while the PC copy matches your Expo Go SDK 58. New builds reach TestFlight by themselves. Answer the yes/no questions from <span class="mono">docs/TRIAL.md</span> in a comment on this page. The kit below is only a spare copy of the code.</p>"""
           """<p style="margin-top:10px"><button id="dl" type="button">Download trial kit</button> <span id="dlmsg" class="mono"></span></p></section>"""
           """<script>(async()=>{const b=document.getElementById('dl'),m=document.getElementById('dlmsg');let d=null;try{d=await window.claude?.use?.('downloads')}catch(_){}"""
           """b.addEventListener('click',async()=>{m.textContent='Preparing…';try{const r=await fetch('trial-kit.zip.b64.txt');if(!r.ok)throw new Error('kit not found');const t=(await r.text()).trim();const bin=atob(t);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);"""
           """if(d){await d.save({filename:'couch-trial-kit.zip',data:u});m.textContent='Saved.'}else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([u],{type:'application/zip'}));a.download='couch-trial-kit.zip';a.click();m.textContent='Download started.'}}catch(err){m.textContent=(err&&err.code==='declined')?'Cancelled.':'Could not prepare the kit: '+((err&&err.message)||err)}});})();</script>""")

shots = ""
sc = status.get("screenshots")
if sc:
    base = sc.get("dir", "store/screenshots/publish")
    items = "".join(
        f'<li><a href="{e(base)}/{e(n)}.jpg"><img src="{e(base)}/{e(n)}.jpg" alt="{e(n)}" loading="lazy"></a>'
        f'<span>{e(sc.get("size", "1320x2868"))} JPEG</span></li>'
        for n in sc["names"])
    shots = (f'<section><h2>Store screenshots</h2><p>{e(sc.get("note", ""))} <a href="{e(base)}/index.html">Contact sheet</a>.</p>'
             f'<ul class="shots">{items}</ul></section>')

mk = ""
m = status.get("market")
if m:
    rows = "".join("<tr>" + "".join(f"<td>{e(c)}</td>" for c in r) + "</tr>" for r in m["table"])
    head = "<tr>" + "".join(f'<td class="mono">{e(c)}</td>' for c in m["header"]) + "</tr>"
    tk = "".join(f"<li>{e(t)}</li>" for t in m["takeaways"])
    mk = (f'<section><h2>Market research</h2><p>{e(m["intro"])}</p>'
          f'<div class="tbl" style="margin-top:10px"><table>{head}{rows}</table></div>'
          f'<h2 style="margin-top:16px">Top 10 takeaways</h2><ol class="log">{tk}</ol>'
          f'<p style="margin-top:10px">{e(m["logos"])}</p></section>')

pct = round(100 * done / len(tasks)) if tasks else 0
page = f"""<title>Couch Build</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Manrope:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column; headline + progress, owner next step, task table, run log */
:root{{--bg:#E4E8EC;--panel:#F6F7F9;--line:#CDD3DA;--ink:#1C232B;--muted:#5D6873;--accent:#2F5BD3;--soft:#E3EAFB;--ok:#2C7A54;--warn:#9B6A12;
--display:"Sora","Avenir Next","Segoe UI",sans-serif;--text:"Manrope","Helvetica Neue",Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#0E1115;--panel:#171B21;--line:#2A313A;--ink:#E6EAEF;--muted:#98A3AF;--accent:#86A6FF;--soft:#1E2A47;--ok:#6CC796;--warn:#E5B35A;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#0E1115;--panel:#171B21;--line:#2A313A;--ink:#E6EAEF;--muted:#98A3AF;--accent:#86A6FF;--soft:#1E2A47;--ok:#6CC796;--warn:#E5B35A;color-scheme:dark}}
*{{box-sizing:border-box}}
body{{background:var(--bg);color:var(--ink);font-family:var(--text);font-size:15px;line-height:1.5}}
.wrap{{max-width:760px;margin:0 auto;padding-inline:16px;padding-block:28px 56px;display:flex;flex-direction:column;gap:22px}}
.eyebrow{{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}}
h1{{font-family:var(--display);font-size:clamp(26px,6vw,36px);margin:4px 0 6px;line-height:1.1;text-wrap:balance}}
h2{{font-family:var(--display);font-size:18px;margin:0 0 10px}}
p{{margin:0;max-width:65ch}}
.bar{{height:10px;border-radius:99px;background:var(--panel);overflow:hidden;border:1px solid var(--line)}}
.bar i{{display:block;height:100%;background:var(--accent);width:{pct}%}}
.stats{{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13.5px;color:var(--muted)}}
.stats b{{color:var(--ink);font-family:var(--mono);font-weight:500;font-variant-numeric:tabular-nums}}
.stage{{font-size:13px;color:var(--muted)}} .stage .cur{{color:var(--accent)}}
.kit{{background:var(--panel);border:1.5px solid var(--accent);border-radius:14px;padding:14px 16px}}
.kit button{{font:600 15px var(--text);min-height:44px;padding:8px 16px;border-radius:12px;border:0;background:var(--accent);color:var(--bg);cursor:pointer}}
.next{{background:var(--soft);border-radius:14px;padding:14px 16px}}
.tbl{{overflow-x:auto;background:var(--panel);border-radius:14px}}
table{{border-collapse:collapse;width:100%;font-size:14px}}
td{{padding:9px 12px;border-top:1px solid var(--line);vertical-align:top}}
tr:first-child td{{border-top:0}}
.mono{{font-family:var(--mono);font-size:12.5px;color:var(--muted)}}
.st{{font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap;background:var(--bg);color:var(--muted)}}
.st.done{{color:var(--ok)}} .st.in_progress{{color:var(--accent)}} .st.blocked{{color:var(--warn)}}
ul.log{{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:14px}}
a{{color:var(--accent)}}
ul.shots{{list-style:none;margin:10px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px}}
ul.shots li{{display:flex;flex-direction:column;gap:4px;font-size:11.5px}} ul.shots img{{width:100%;height:auto;border-radius:10px;display:block;background:var(--panel)}}
</style>
<div class="wrap">
<header><div class="eyebrow">App Factory · Couch · universal TV remote</div>
<h1>{e(status["headline"])}</h1>
<div class="stage">Stage: {stage_html}</div>
<div class="bar" role="img" aria-label="{done} of {len(tasks)} tasks done"><i></i></div>
<div class="stats" style="margin-top:8px"><span>Tasks <b>{done}/{len(tasks)}</b></span><span>Tests <b>{e(str(status["tests"]))}</b></span><span>Typecheck <b>{e(str(status["typecheck"]))}</b></span><span>Last run <b>{e(status["last_run"])}</b></span></div></header>
{kit}
<section class="next"><h2>Your next step</h2><p>{e(status["next_for_owner"])}</p></section>
{shots}
{mk}
<section><h2>Backlog</h2><div class="tbl"><table>{''.join(row(t) for t in tasks)}</table></div></section>
<section><h2>Recent runs</h2><ul class="log">{''.join(f'<li>{e(l)}</li>' for l in runlog)}</ul></section>
<p class="mono">Prototype: <a href="https://claude.ai/artifact/QctmQMa62nNmapYgjgegP3">Couch Remote</a>. The repo bundle for the build runs is attached to this page.</p>
</div>
"""
(root / "index.html").write_text(page)
print(f"rendered index.html: {done}/{len(tasks)} done")
