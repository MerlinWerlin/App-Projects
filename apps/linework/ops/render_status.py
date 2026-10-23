#!/usr/bin/env python3
"""Render the Linework build status page (index.html at repo root) from ops/backlog.json,
ops/status.json and the last entries of ops/RUNLOG.md. Run from anywhere:
    python3 ops/render_status.py
Every build run edits status.json and backlog.json, then re-runs this before publishing.
status.json keys: tests, typecheck, last_run, stage (build|trial|owner-tested|release-prep|testflight),
headline, next_for_owner, oversight_seen, trial_kit (true once trial-kit.zip is published)."""
import html, json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
backlog = json.loads((root / "ops/backlog.json").read_text())
status = json.loads((root / "ops/status.json").read_text())
runlog = [l[2:] for l in (root / "ops/RUNLOG.md").read_text().splitlines() if l.startswith("- ")][-6:][::-1]
tasks = backlog["tasks"]
done = sum(1 for t in tasks if t["status"] == "done")
trial_ids = backlog.get("milestones", {}).get("TRIAL", [])
trial_done = sum(1 for t in tasks if t["id"] in trial_ids and t["status"] == "done")
e = html.escape
_mk = root / "ops/market_summary.json"
market = json.loads(_mk.read_text()) if _mk.exists() else None

def market_block():
    if not market:
        return ""
    head = "".join(f"<td><b>{e(c)}</b></td>" for c in market["columns"])
    body = "".join("<tr>" + "".join(f"<td>{e(c)}</td>" for c in r) + "</tr>" for r in market["rows"])
    tk = "".join(f"<li>{e(x)}</li>" for x in market["takeaways"])
    return (f'<section><h2>Market research ({e(market["date"])})</h2><p class="small">{e(market["note"])}</p>'
            f'<div class="tbl" style="margin-top:10px"><table><tr>{head}</tr>{body}</table></div>'
            f'<h2 style="margin-top:14px">Top 10 takeaways</h2><ol class="log" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:14px">{tk}</ol>'
            f'<p style="margin-top:10px"><b>{e(market["price"])}</b></p></section>')

def release_block():
    """D77-2: docs/RELEASE_CHECKLIST.md 'Owner actions, in order' as one numbered list at the top of the page
    (sections 1-4 are the TestFlight path, so they come first, in checklist order)."""
    import re
    f = root / "docs/RELEASE_CHECKLIST.md"
    if not f.exists() or status.get("stage") not in ("release-prep", "testflight"):
        return ""
    text = f.read_text().split("## Owner actions, in order", 1)
    if len(text) < 2:
        return ""
    body = text[1].split("\n## ", 1)[0].split("\n---", 1)[0]
    clean = lambda x: re.sub(r"\*\*|`", "", x).strip()
    items, heading = [], None
    for line in body.splitlines():
        m = re.match(r"### \d+\.\s*(.+)", line)
        if m:
            heading = clean(m.group(1)); continue
        m = re.match(r"- \[[ xX]\]\s*(.+)", line)
        if m and heading:
            done_ = line.lstrip().startswith(("- [x]", "- [X]"))
            items.append((heading, clean(m.group(1)), done_))
    if not items:
        return ""
    li, last = [], None
    for h, t, d in items:
        sub = f'<span class="tag">{e(h)}</span> ' if h != last else ""
        last = h
        li.append(f'<li{" class=\"ticked\"" if d else ""}>{sub}{e(t)}</li>')
    return ('<section class="release"><h2>Release checklist — your steps, TestFlight path first</h2>'
            '<p class="small">From docs/RELEASE_CHECKLIST.md. Nothing here has run on a phone yet.</p>'
            f'<ol class="steps">{"".join(li)}</ol></section>')

def next_block():
    n = status["next_for_owner"]
    if isinstance(n, list):
        return '<ol class="steps">' + "".join(f"<li>{e(x)}</li>" for x in n) + "</ol>"
    return f"<p>{e(n)}</p>"

STAGES = [("build", "Build"), ("trial", "Try on iPhone"), ("owner-tested", "Your feedback fixed"),
          ("release-prep", "Release prep"), ("testflight", "TestFlight")]
cur = next((i for i, (k, _) in enumerate(STAGES) if k == status.get("stage", "build")), 0)

def stage_li(i, label):
    cls = "now" if i == cur else ("past" if i < cur else "")
    return f'<li class="{cls}"><span class="dot"></span>{e(label)}</li>'

def row(t):
    st = t["status"]
    commit = f'<span class="mono">{e(t.get("commit", "")[:7])}</span>' if t.get("commit") else ""
    title = t["title"].split(":")[0] if len(t["title"]) > 90 else t["title"]
    trial = '<span class="tag">trial</span>' if t["id"] in trial_ids else ""
    return (f'<tr><td class="mono">{e(t["id"])}</td><td>{e(title)} {trial}</td>'
            f'<td><span class="st {e(st)}">{e(st.replace("_", " "))}</span> {commit}</td></tr>')

pct = round(100 * done / len(tasks)) if tasks else 0
kit = bool(status.get("trial_kit"))
kit_block = ("""<button id="kit" class="btn" type="button">Download trial kit (.zip)</button>
<p class="small" id="kitmsg" aria-live="polite">Unzip it on your PC and double-click START_TRIAL.cmd. Once the App Factory overseer can reach your PC it also keeps a copy in Desktop\\Apps\\tracing\\code.</p>"""
             if kit else '<p class="small">The trial kit download appears here after the next build run publishes it.</p>')

# The artifact host does not serve .zip files, so the kit is published as base64 text
# (trial-kit.zip.b64.txt) and decoded back into the zip in the browser before saving.
KIT_SCRIPT = r"""<script>
(function(){
  var b=document.getElementById('kit'); if(!b) return; var m=document.getElementById('kitmsg');
  var FALLBACK=' Use the copy in Desktop\\Apps\\tracing\\code on your PC once the overseer has put it there.';
  b.addEventListener('click', async function(){
    b.disabled=true; m.textContent='Preparing the trial kit…';
    try {
      var dl = window.claude && await window.claude.use('downloads');
      if(!dl){ m.textContent='Downloads are not available in this view.'+FALLBACK; return; }
      var r = await fetch('trial-kit.zip.b64.txt'); if(!r.ok) throw new Error('kit file missing');
      var bin = atob((await r.text()).replace(/\s+/g,''));
      var bytes = new Uint8Array(bin.length);
      for (var i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
      await dl.save({filename:'linework-trial-kit.zip', data: bytes});
      m.textContent='Saved. Unzip it on your PC and double-click START_TRIAL.cmd.';
    } catch(err) {
      var c = err && err.code;
      if (c==='declined') m.textContent='Download cancelled. Tap the button again whenever you are ready.';
      else m.textContent='Could not download the kit ('+(c||err&&err.message||'error')+').'+FALLBACK;
    } finally { b.disabled=false; }
  });
})();
</script>"""

page = f"""<title>Linework Build</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@600;800&family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column — stage ladder up top (where the app is on its way to your iPhone), owner step + trial kit, backlog, runs */
:root{{--bg:#E9ECEF;--panel:#F7F8F9;--line:#CDD3D9;--ink:#191C20;--muted:#5A626B;--accent:#2346A8;--soft:#DDE4F6;--ok:#2C7A54;--warn:#9B6A12;
--display:"Schibsted Grotesk","Helvetica Neue",Arial,sans-serif;--text:"Atkinson Hyperlegible","Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#0F1114;--panel:#171A1E;--line:#2B3037;--ink:#E7EAEE;--muted:#9AA3AD;--accent:#8FA8FF;--soft:#1D2742;--ok:#6CC796;--warn:#E5B35A;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#0F1114;--panel:#171A1E;--line:#2B3037;--ink:#E7EAEE;--muted:#9AA3AD;--accent:#8FA8FF;--soft:#1D2742;--ok:#6CC796;--warn:#E5B35A;color-scheme:dark}}
*{{box-sizing:border-box}}
body{{background:var(--bg);color:var(--ink);font-family:var(--text);font-size:15px;line-height:1.5}}
.wrap{{max-width:760px;margin:0 auto;padding-inline:16px;padding-block:28px 56px;display:flex;flex-direction:column;gap:22px}}
.eyebrow{{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}}
h1{{font-family:var(--display);font-weight:800;font-size:clamp(26px,6vw,38px);margin:4px 0 10px;line-height:1.08;text-wrap:balance}}
h2{{font-family:var(--display);font-weight:600;font-size:18px;margin:0 0 10px}}
p{{margin:0;max-width:65ch}}
.small{{font-size:13.5px;color:var(--muted)}}
ol.stages{{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13.5px;color:var(--muted)}}
ol.stages li{{display:flex;align-items:center;gap:6px}}
.dot{{width:10px;height:10px;border-radius:50%;border:2px solid var(--line);display:inline-block}}
ol.stages li.past .dot{{background:var(--ok);border-color:var(--ok)}}
ol.stages li.now{{color:var(--ink);font-weight:700}}
ol.stages li.now .dot{{background:var(--accent);border-color:var(--accent);box-shadow:0 0 0 3px var(--soft)}}
.bar{{height:8px;border-radius:99px;background:var(--panel);overflow:hidden;border:1px solid var(--line);margin-top:14px}}
.bar i{{display:block;height:100%;background:var(--accent);width:{pct}%}}
.stats{{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13.5px;color:var(--muted);margin-top:8px}}
.stats b{{color:var(--ink);font-family:var(--mono);font-weight:500;font-variant-numeric:tabular-nums}}
.next{{background:var(--soft);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}}
.btn{{font:700 15px var(--text);background:var(--accent);color:var(--bg);border:0;border-radius:10px;padding:12px 16px;min-height:48px;cursor:pointer;align-self:flex-start}}
.btn:focus-visible{{outline:3px solid var(--ink);outline-offset:2px}}
.tbl{{overflow-x:auto;background:var(--panel);border-radius:14px}}
table{{border-collapse:collapse;width:100%;font-size:14px}}
td{{padding:9px 12px;border-top:1px solid var(--line);vertical-align:top}}
tr:first-child td{{border-top:0}}
.mono{{font-family:var(--mono);font-size:12.5px;color:var(--muted)}}
.tag{{font-family:var(--mono);font-size:11px;color:var(--accent);border:1px solid var(--line);border-radius:6px;padding:0 5px;margin-left:4px}}
.st{{font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap;background:var(--bg);color:var(--muted)}}
.st.done{{color:var(--ok)}} .st.in_progress{{color:var(--accent)}} .st.blocked{{color:var(--warn)}}
ul.log{{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:14px}}
a{{color:var(--accent)}}
ol.steps{{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:7px;font-size:14.5px}}
ol.steps li.ticked{{color:var(--muted);text-decoration:line-through}}
</style>
<div class="wrap">
<header><div class="eyebrow">App Factory · Linework · AR tracing</div>
<h1>{e(status["headline"])}</h1>
<ol class="stages" aria-label="Progress to your iPhone">{''.join(stage_li(i, l) for i, (_, l) in enumerate(STAGES))}</ol>
<div class="bar" role="img" aria-label="{done} of {len(tasks)} tasks done"><i></i></div>
<div class="stats"><span>Tasks <b>{done}/{len(tasks)}</b></span><span>Trial tasks <b>{trial_done}/{len(trial_ids)}</b></span><span>Tests <b>{e(str(status["tests"]))}</b></span><span>Typecheck <b>{e(str(status["typecheck"]))}</b></span><span>Last run <b>{e(status["last_run"])}</b></span></div></header>
{release_block()}
<section class="next"><h2>Decisions that block TestFlight</h2>{next_block()}{kit_block}</section>
{market_block()}
<section><h2>Feedback</h2><p>Comment on this page from any device. The next build run turns each comment into a task, replies, and resolves it when fixed. Claude and Codex review the app together every overseer cycle; their directives handled so far: <span class="mono">{e(str(status.get("oversight_seen") or "none yet"))}</span>.</p></section>
<section><h2>Backlog</h2><div class="tbl"><table>{''.join(row(t) for t in tasks)}</table></div></section>
<section><h2>Recent runs</h2><ul class="log">{''.join(f'<li>{e(l)}</li>' for l in runlog)}</ul></section>
<p class="mono">The repo bundle for the build runs is attached to this page.</p>
</div>
{KIT_SCRIPT}
"""
(root / "index.html").write_text(page)
print(f"rendered index.html: {done}/{len(tasks)} done, stage {STAGES[cur][0]}")
