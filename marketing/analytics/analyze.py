"""Summarise the marketing analytics register (stdlib only).

python analyze.py [--json] [--stale DAYS]
"""
import csv, json, sys, pathlib, datetime as dt
from collections import defaultdict

HERE = pathlib.Path(__file__).resolve().parent


def read(name):
    with open(HERE / name, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def rate(m, key):
    base = m.get("impressions") or m.get("video_views")
    return round(m[key] / base, 4) if base and key in m else None


posts, snaps = read("posts.csv"), read("snapshots.csv")
args = sys.argv[1:]
stale_days = int(args[args.index("--stale") + 1]) if "--stale" in args else 7
today = dt.date.today()

errors = []
post_ids = {p["post_id"] for p in posts}
for s in snaps:
    if s["scope"] == "post" and s["post_id"] not in post_ids:
        errors.append(f"snapshot for unknown post_id {s['post_id']!r}")
    if num(s["value"]) is None:
        errors.append(f"non-numeric value {s['value']!r} ({s['metric']} {s['captured_at']})")

# Latest reading per (post, metric).
latest = {}
for s in sorted(snaps, key=lambda r: r["captured_at"]):
    if s["scope"] == "post" and num(s["value"]) is not None:
        latest[(s["post_id"], s["metric"])] = (num(s["value"]), s["captured_at"])

per_post = []
for p in posts:
    readings = {k[1]: v for k, v in latest.items() if k[0] == p["post_id"]}
    m = {k: v[0] for k, v in readings.items()}
    per_post.append({
        "post_id": p["post_id"], "channel": p["channel"], "app": p["app"], "line": p["line"],
        "posted_at": p["posted_at"], "title": p["title"][:60], "metrics": m,
        "last_reading": max((v[1] for v in readings.values()), default=""),
        "save_rate": rate(m, "saves"), "click_rate": rate(m, "outbound_clicks"),
    })

# Totals per channel and app.
groups = defaultdict(lambda: {"posts": 0, "metrics": defaultdict(float)})
for r in per_post:
    g = groups[(r["channel"], r["app"])]
    g["posts"] += 1
    for k, v in r["metrics"].items():
        g["metrics"][k] += v
by_group = []
for (ch, app), g in sorted(groups.items()):
    m = dict(g["metrics"])
    by_group.append({"channel": ch, "app": app, "posts": g["posts"], "metrics": m,
                     "save_rate": rate(m, "saves"), "click_rate": rate(m, "outbound_clicks")})

# Account / app / page trends: first vs latest reading of each series.
series = defaultdict(list)
for s in snaps:
    if s["scope"] != "post" and num(s["value"]) is not None:
        key = (s["scope"], s["channel"], s["account"], s["app"], s["post_id"], s["metric"], s["period"])
        series[key].append((s["captured_at"], num(s["value"])))
trends = []
for k, pts in sorted(series.items()):
    pts.sort()
    (d0, v0), (d1, v1) = pts[0], pts[-1]
    trends.append({"scope": k[0], "channel": k[1], "account": k[2], "app": k[3] or k[4], "metric": k[5],
                   "period": k[6], "first": [d0, v0], "latest": [d1, v1], "change": v1 - v0, "readings": len(pts)})

stale = [r["post_id"] for r in per_post
         if not r["last_reading"] or (today - dt.date.fromisoformat(r["last_reading"][:10])).days >= stale_days]

out = {"generated": today.isoformat(), "posts": len(posts), "snapshots": len(snaps),
       "by_channel_app": by_group, "per_post": per_post, "trends": trends,
       "needs_reading": stale, "errors": errors}

if "--json" in args:
    print(json.dumps(out, indent=2))
    sys.exit(0)


def table(rows, cols):
    w = [max([len(c)] + [len(str(r.get(c, ""))) for r in rows]) for c in cols]
    print("  ".join(c.ljust(x) for c, x in zip(cols, w)))
    for r in rows:
        print("  ".join(str("" if r.get(c) is None else r.get(c)).ljust(x) for c, x in zip(cols, w)))
    print()


def fmt(m):
    return ", ".join(f"{k}={v:g}" for k, v in sorted(m.items())) or "-"


print(f"Register: {len(posts)} posts, {len(snaps)} readings ({today})\n")
print("By channel and app")
table([{**g, "metrics": fmt(g["metrics"])} for g in by_group],
      ["channel", "app", "posts", "save_rate", "click_rate", "metrics"])
print("Per post")
table([{**r, "metrics": fmt(r["metrics"])} for r in per_post],
      ["posted_at", "channel", "app", "title", "save_rate", "click_rate", "last_reading", "metrics"])
print("Account / store / page trends")
table([{**t, "first": f"{t['first'][1]:g} ({t['first'][0][:10]})",
        "latest": f"{t['latest'][1]:g} ({t['latest'][0][:10]})", "change": f"{t['change']:+g}"} for t in trends],
      ["channel", "account", "app", "metric", "period", "first", "latest", "change", "readings"])
print(f"Need a fresh reading ({stale_days}+ days or never): {', '.join(stale) or 'none'}")
if errors:
    print("\nErrors:\n  " + "\n  ".join(errors))
