"""Generates src/data/ptTables.ts and src/core/ptFixture.ts for Liquidline.

Source: CoolProp 8 (open-source, MIT licence, http://www.coolprop.org). Pure fluids use the reference
Helmholtz-energy equations of state (the same equations NIST REFPROP / the NIST Chemistry WebBook use).
R410A, R404A, R407C and R507A use Lemmon's (2003) pseudo-pure fluid equations. The other blends
(R454B, R448A, R449A, R452A, R513A) use CoolProp's multi-fluid mixture model (GERG-style Helmholtz mixing,
ASHRAE 34 nominal compositions). Bubble = saturated liquid (Q=0), dew = saturated vapour (Q=1), kPa absolute.

Run:  python tools/gen_pt.py   (pip install CoolProp==8.0.0)
"""
import json, math, pathlib
import CoolProp.CoolProp as CP

ROOT = pathlib.Path(__file__).resolve().parents[1]
FLUIDS = [
    # id, CoolProp name
    ("R32", "R32"), ("R410A", "R410A"), ("R454B", "HEOS::R454B.mix"), ("R290", "R290"),
    ("R134a", "R134a"), ("R404A", "R404A"), ("R407C", "R407C"), ("R22", "R22"),
    ("R600a", "R600a"), ("R1234yf", "R1234yf"), ("R1234ze(E)", "R1234ze(E)"), ("R448A", "HEOS::R448A.mix"),
    ("R449A", "HEOS::R449A.mix"), ("R513A", "HEOS::R513A.mix"),
    ("R507A", "R507A"), ("R744", "R744"), ("R717", "R717"),
]
SOURCE = {
    "R410A": "Lemmon (2003) pseudo-pure EOS via CoolProp 8",
    "R404A": "Lemmon (2003) pseudo-pure EOS via CoolProp 8",
    "R407C": "Lemmon (2003) pseudo-pure EOS via CoolProp 8",
    "R507A": "Lemmon (2003) pseudo-pure EOS via CoolProp 8",
}

# Manufacturer-published saturation points (kPa abs) used to calibrate CoolProp's mixture model, whose blend
# predictions can differ from the refrigerant makers' REFPROP-based tables by up to ~1 %. For each curve the
# correction is linear in T on ln(P), fitted exactly at 0 °C and 40 °C: ln P = ln P_coolprop + a + b*T.
#   R454B: Chemours Opteon XL41 thermodynamic properties (English units), psia converted to kPa.
#   R448A: Daikin Chemicals wet-vapour table R448A (REFPROP 10), MPa abs.
#   R449A: Chemours Opteon XP40 SI properties, kPa abs.
#   R513A: Chemours Opteon XP10 SI properties, kPa abs.
# Sources and URLs: docs/SOURCES.md.
CALIBRATE = {
    "R454B": {"bubble": (759.9, 2295.7), "dew": (729.4, 2225.2)},
    "R448A": {"bubble": (622.0, 1880.0), "dew": (516.0, 1672.0)},
    "R449A": {"bubble": (615.942, 1861.299), "dew": (512.986, 1659.303)},
    "R513A": {"bubble": (321.926, 1068.622), "dew": (321.680, 1068.536)},
}
CUR = {"fid": None}

def raw(name, t, q):
    # CoolProp's mixture solver fails at isolated temperatures (e.g. R454B bubble at 57 and 65 C) while working
    # either side. Retry a hair either side and take the log-mean, which is exact to well under 0.01 %.
    try:
        return CP.PropsSI("P", "T", t + 273.15, "Q", q, name) / 1000.0
    except Exception:
        for d in (0.01, 0.03, 0.1):
            try:
                lo = CP.PropsSI("P", "T", t - d + 273.15, "Q", q, name)
                hi = CP.PropsSI("P", "T", t + d + 273.15, "Q", q, name)
                return math.sqrt(lo * hi) / 1000.0
            except Exception:
                continue
        raise

def sat(name, t, q):
    p = raw(name, t, q)
    cal = CALIBRATE.get(CUR["fid"])
    if cal:
        ref0, ref40 = cal["bubble" if q == 0 else "dew"]
        d0 = math.log(ref0 / raw(name, 0, q)); d40 = math.log(ref40 / raw(name, 40, q))
        p *= math.exp(d0 + (d40 - d0) * t / 40.0)
    return p

def crit(name):
    try:
        return CP.PropsSI("Tcrit", name) - 273.15
    except Exception:
        return None

def r(p):
    return round(p, 2) if p < 1000 else round(p, 1)

tables = {}
fixture = {}
for fid, name in FLUIDS:
    CUR["fid"] = fid
    tc = crit(name)
    hi = 70 if tc is None else min(70, math.floor(tc - 3))
    lo = -60
    try:
        lo = max(lo, math.ceil(CP.PropsSI('Ttriple', name) - 273.15 + 0.5))
    except Exception:
        pass
    # Solve every 1 °C point; a point the mixture solver can't converge on is filled by interpolating ln P linearly
    # in 1/T (Clausius-Clapeyron) between solved neighbours no more than 6 K apart. The table ends at the last point
    # that is solved or bridgeable, never extrapolated.
    temps = list(range(lo, hi + 1))
    raw_pts = {}
    for q in (0, 1):
        for t in temps:
            try:
                raw_pts[(t, q)] = sat(name, t, q)
            except Exception:
                raw_pts[(t, q)] = None
    filled = 0
    for q in (0, 1):
        solved = [t for t in temps if raw_pts[(t, q)] is not None]
        for t in temps:
            if raw_pts[(t, q)] is not None:
                continue
            below = max((x for x in solved if x < t), default=None)
            above = min((x for x in solved if x > t), default=None)
            if below is None or above is None or above - below > 6:
                continue
            ia, ib = 1 / (below + 273.15), 1 / (above + 273.15)
            f = (1 / (t + 273.15) - ia) / (ib - ia)
            la, lb = math.log(raw_pts[(below, q)]), math.log(raw_pts[(above, q)])
            raw_pts[(t, q)] = math.exp(la + (lb - la) * f)
            filled += 1
    ok = [t for t in temps if raw_pts[(t, 0)] is not None and raw_pts[(t, 1)] is not None]
    start = ok[0]
    end = start
    while end + 1 in ok:
        end += 1
    bub = [r(raw_pts[(t, 0)]) for t in range(start, end + 1)]
    dew = [r(raw_pts[(t, 1)]) for t in range(start, end + 1)]
    if filled:
        print(f"  {fid}: {filled} point(s) bridged by Clausius-Clapeyron interpolation")
    pure = all(abs(a - b) < 1e-9 for a, b in zip(bub, dew))
    tables[fid] = {"tMin": start, "tMax": end, "bubble": bub, "dew": None if pure else dew,
                   "tCrit": None if tc is None else round(tc, 2),
                   "source": SOURCE.get(fid, ("CoolProp 8 mixture model, calibrated to the manufacturer's published 0 °C and 40 °C points" if fid in CALIBRATE else "CoolProp 8 mixture model" if "mix" in name else "Reference EOS via CoolProp 8 (matches NIST REFPROP)"))}
    pts = []
    for tt in (start + 3.37, -17.3, 3.7, 27.45, end - 1.6):
        if start <= tt <= end:
            pts.append([round(tt, 2), round(sat(name, tt, 0), 3), round(sat(name, tt, 1), 3)])
    fixture[fid] = pts
    print(fid, start, end, "pure" if pure else "glide", bub[60 - (start + 60)] if start <= 0 else "")

ts = ["// GENERATED by tools/gen_pt.py from CoolProp 8 (open-source, MIT). Do not edit by hand.",
      "// Saturation pressures in kPa ABSOLUTE at 1 °C steps from tMin to tMax. bubble = saturated liquid,",
      "// dew = saturated vapour (null for pure fluids and azeotropes where they are equal).",
      "export type PtTable = { tMin: number; tMax: number; bubble: number[]; dew: number[] | null; tCrit: number | null; source: string };",
      "export const PT_TABLES: Record<string, PtTable> = " + json.dumps(tables, separators=(",", ":")) + ";", ""]
(ROOT / "src/data/ptTables.ts").write_text("\n".join(ts), encoding="utf-8")
fx = ["// GENERATED by tools/gen_pt.py: CoolProp 8 values computed directly at off-grid temperatures, used to check",
      "// that the app's interpolation of the 1 °C tables stays within tolerance. [tC, bubble kPa abs, dew kPa abs]",
      "export const PT_FIXTURE: Record<string, [number, number, number][]> = " + json.dumps(fixture) + ";", ""]
(ROOT / "src/core/ptFixture.ts").write_text("\n".join(fx), encoding="utf-8")
