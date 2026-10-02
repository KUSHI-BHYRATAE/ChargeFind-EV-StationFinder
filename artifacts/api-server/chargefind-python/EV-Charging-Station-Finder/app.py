import base64
import time
from pathlib import Path

import pandas as pd
import pydeck as pdk
import streamlit as st

from src.data_loader import load_stations
from src.kd_tree import KDTree

st.set_page_config(page_title="ChargeFind", page_icon="⚡", layout="wide",
                   initial_sidebar_state="expanded")

# ---------- images (put them in an assets/ folder next to app.py) ----------
ASSETS = Path(__file__).parent / "assets"


def img64(name):
    p = ASSETS / name
    if not p.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()


HERO_IMG = img64("hero_car.png")
THUMBS = [img64(f"station_{i}.png") for i in range(1, 6)]

# ---------- CSS ----------
st.markdown(f"""
<style>
.stApp{{background:radial-gradient(circle at 70% 0%,rgba(0,212,170,.10),transparent 35%),#04080f;color:#f4f7fb}}
.main .block-container{{max-width:1700px;padding:1rem 1.6rem 2rem}}
header[data-testid="stHeader"]{{background:transparent!important;height:0!important}}
[data-testid="stToolbar"],div[data-testid="stDecoration"],div[data-testid="stStatusWidget"]{{display:none!important}}
div[data-testid="stVerticalBlock"]{{gap:.7rem}}

/* sidebar */
section[data-testid="stSidebar"]{{background:#070d16!important;border-right:1px solid #14202c}}
section[data-testid="stSidebar"]>div{{padding:1.2rem 1rem}}
section[data-testid="stSidebar"] *{{color:#dbe4ee}}
.brand{{font-size:30px;font-weight:800;letter-spacing:-1px}} .brand .f{{color:#19e3c1}} .brand .i{{color:#ffb020}}
.brand-sub{{color:#8394a8;font-size:13px;margin:2px 0 14px}}
.sec{{border-top:1px solid #15222f;padding-top:14px;margin-top:12px}}
.sec-t{{font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:8px}}
.side-item{{line-height:2.2;color:#a8b6c7;font-size:14px}}
.big{{font-size:32px;font-weight:800;color:#19e3c1;border-left:2px solid #1b3a46;padding-left:12px}}
div[data-baseweb="input"]{{background:#0d1620!important;border:1px solid #20303f!important;border-radius:9px!important}}
div[data-baseweb="input"] input{{color:#f4f7fb!important}}
.stButton>button{{height:48px;border-radius:9px;border:0;font-weight:800;
 background:linear-gradient(90deg,#00e0c0,#18a8ff);color:#03121a!important}}
.stButton>button:hover{{filter:brightness(1.1)}}
div[data-baseweb="slider"] div[role="slider"]{{background:#ff4d4d!important}}

/* hero */
.hero{{position:relative;height:250px;border-radius:16px;border:1px solid #17313d;overflow:hidden;padding:26px 30px;
 background:linear-gradient(90deg,#08121b 45%,rgba(8,18,27,.35) 100%),
 url('{HERO_IMG}') right center/auto 100% no-repeat,#08121b}}
.hl{{color:#19e3c1;font-size:12px;font-weight:800;letter-spacing:2.5px}}
.ht{{font-size:66px;font-weight:850;letter-spacing:-3px;line-height:1.05;margin:6px 0 8px}} .ht span{{color:#19e3c1}}
.hd{{color:#a6b4c5;font-size:15.5px;line-height:1.55;max-width:470px}} .hd b{{color:#19e3c1;font-weight:500}}
.pill{{display:inline-block;margin:14px 8px 0 0;padding:6px 14px;border-radius:99px;border:1px solid #2a4a55;
 background:rgba(10,24,32,.85);font-size:11px;font-weight:700;letter-spacing:.8px}}

/* status cards */
.stat{{border:1px solid #1b2b3a;border-radius:12px;background:#0a121b;text-align:center;padding:14px 4px;height:112px}}
.stat .ic{{font-size:22px;color:#19e3c1}} .stat .lb{{color:#8b9bb0;font-size:11.5px;margin-top:6px}}
.stat .vl{{font-size:19px;font-weight:800;margin-top:4px}}

/* panels */
.panel{{border:1px solid #1a2a38;border-radius:14px;background:#09111a;padding:14px 16px}}
.pt{{font-size:12.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#d5dfea}}
.ps{{color:#8b9bb0;font-size:12.5px;margin:2px 0 8px}}
.chip{{float:right;border:1px solid #1d5a55;color:#19e3c1;border-radius:7px;padding:3px 10px;font-size:11px;font-weight:700}}
.legend{{position:relative;z-index:10;margin:-52px 0 14px 14px;display:inline-flex;gap:24px;padding:9px 16px;
 border-radius:10px;background:rgba(8,14,22,.88);border:1px solid #1a2a38;font-size:12.5px;color:#cbd6e2}}
.dot{{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:7px}}

/* result cards */
.res{{display:flex;align-items:center;gap:12px;padding:8px 12px 8px 8px;margin-bottom:8px;border-radius:11px;
 border:1px solid #1b2a38;background:#0b141e}}
.res.first{{border-left:3px solid #19e3c1}}
.res img{{width:62px;height:68px;border-radius:8px;object-fit:cover}}
.res-m{{flex:1;min-width:0}}
.tag{{font-size:10px;font-weight:800;letter-spacing:1.2px;color:#8b9bb0}}
.tag.top{{display:inline-block;background:#3a2a0e;color:#ffb020;border-radius:5px;padding:2px 7px}}
.rn{{font-size:15px;font-weight:750;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.rc{{color:#8394a8;font-size:12px;margin-top:3px}}
.rs{{text-align:right;font-size:12.5px;line-height:1.75}}
.badge{{display:inline-block;background:#3a2a0e;color:#ffb020;border-radius:6px;padding:1px 8px;font-weight:800;font-size:11px}}

/* bottom row */
.mini{{border:1px solid #1b2b3a;border-radius:10px;background:#0a121b;padding:10px 12px}}
.mini .lb{{color:#8b9bb0;font-size:11.5px}} .mini .vl{{font-size:26px;font-weight:800;margin-top:4px}}
.steps{{display:flex;gap:10px;align-items:flex-start}}
.step{{flex:1;display:flex;gap:9px;font-size:11.5px;color:#8b9bb0;line-height:1.45}}
.step b{{display:block;color:#f4f7fb;font-size:13.5px;margin-bottom:3px}}
.num{{min-width:26px;height:26px;border-radius:50%;border:1px solid #19e3c1;color:#19e3c1;display:flex;
 align-items:center;justify-content:center;font-size:11px;font-weight:800}}
.arrow{{color:#19e3c1;align-self:center}}
.cx{{flex:1;border:1px solid #1b2b3a;border-radius:10px;background:#0a121b;padding:10px 12px;font-size:11px;color:#8b9bb0}}
.cx .v{{font-size:24px;font-weight:800;color:#19e3c1;margin:2px 0}}
</style>
""", unsafe_allow_html=True)


def html(s):
    st.markdown("".join(l.strip() for l in s.splitlines()), unsafe_allow_html=True)


# ---------- data ----------
@st.cache_resource
def load_everything():
    s = load_stations("data/india_ev_stations.csv")
    return s, KDTree(s)


stations, tree = load_everything()


def gv(o, *names):
    for n in names:
        if isinstance(o, dict) and o.get(n) is not None:
            return o[n]
        if hasattr(o, n) and getattr(o, n) is not None:
            return getattr(o, n)


def xy(s):
    try:
        return float(gv(s, "latitude", "lat", "Latitude")), float(gv(s, "longitude", "lon", "lng", "Longitude"))
    except (TypeError, ValueError):
        return None, None


def meta(s):
    return (str(gv(s, "name", "station_name") or "Charging Station"),
            str(gv(s, "city", "address") or "Chennai, Tamil Nadu"), gv(s, "power_kw", "power", "charging_power"))


# ---------- sidebar ----------
with st.sidebar:
    html('<div class="brand"><span class="i">⚡</span> Charge<span class="f">Find</span></div>'
         '<div class="brand-sub">EV Spatial Intelligence Engine</div>'
         '<div class="sec"><div class="sec-t">📍 Search Location</div></div>')
    lat_in = st.number_input("Latitude", value=13.082700, format="%.6f")
    lon_in = st.number_input("Longitude", value=80.270700, format="%.6f")
    k = st.slider("Stations to find", 1, 10, 5)
    go = st.button("⚡  FIND NEAREST STATIONS", use_container_width=True)
    html('<div class="sec"><div class="sec-t">🧬 Search Engine</div><div class="side-item">'
         '🧠 &nbsp;2D KD-Tree<br>📍 &nbsp;Haversine Distance<br>🔎 &nbsp;Top-K Nearest Neighbor<br>'
         '⚡ &nbsp;Spatial Pruning</div></div>')
    html(f'<div class="sec"><div class="sec-t">🗄️ Dataset</div><div class="big">{len(stations):,}</div>'
         '<div style="color:#8394a8;font-size:12px;margin:4px 0 0 14px">charging stations indexed</div></div>')

# ---------- search ----------
if go or "nearest" not in st.session_state:
    t0 = time.perf_counter()
    st.session_state.nearest = tree.nearest_neighbors(lat_in, lon_in, k=k)
    st.session_state.ms = (time.perf_counter() - t0) * 1000
    st.session_state.origin = (lat_in, lon_in)
nearest, ms = st.session_state.nearest, st.session_state.ms
o_lat, o_lon = st.session_state.origin

# ---------- main grid: left (hero + map) | right (status + results) ----------
left, right = st.columns([1.6, 1], gap="medium")

with left:
    html("""<div class="hero"><div class="hl">⚡ EV SPATIAL INTELLIGENCE PLATFORM</div>
      <div class="ht">Charge<span>Find</span></div>
      <div class="hd">Intelligent electric-vehicle charging station discovery powered by a
      <b>custom 2D KD-Tree</b>, geographic Haversine distance and Top-K nearest-neighbor search.</div>
      <span class="pill">2D KD-TREE</span><span class="pill">HAVERSINE</span>
      <span class="pill">NEAREST NEIGHBOR</span><span class="pill">TOP-K SEARCH</span></div>""")

    html('<div class="pt">🗺️ Charging Station Network</div>'
         '<div class="ps">All charging stations across the city with your search location and nearest stations highlighted.</div>')

    rows = []
    for s in stations:
        la, lo = xy(s)
        if la is not None:
            n, c, p = meta(s)
            rows.append(dict(lat=la, lon=lo, name=n, city=c, power=p if p is not None else "N/A"))
    near = []
    for d, s in nearest:
        la, lo = xy(s)
        n, c, p = meta(s)
        near.append(dict(lat=la, lon=lo, name=n, city=c, power=p if p is not None else "N/A"))
    you = [dict(lat=o_lat, lon=o_lon, name="Your search location", city="", power="-")]

    def layer(data, fill, r, line):
        return pdk.Layer("ScatterplotLayer", data=pd.DataFrame(data), get_position="[lon, lat]", get_radius=r,
                         get_fill_color=fill, get_line_color=line, line_width_min_pixels=1,
                         stroked=True, filled=True, pickable=True)

    st.pydeck_chart(pdk.Deck(
        layers=[layer(rows, [25, 227, 193, 200], 280, [0, 255, 210, 255]),
                layer(near, [255, 176, 32, 245], 600, [255, 255, 255, 255]),
                layer(you, [255, 70, 70, 245], 750, [255, 255, 255, 255])],
        initial_view_state=pdk.ViewState(latitude=o_lat, longitude=o_lon, zoom=10.8),
        map_style="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        tooltip={"html": "<b>{name}</b><br/>{city}<br/>⚡ {power} kW",
                 "style": {"backgroundColor": "#08111b", "color": "white"}}),
        use_container_width=True, height=400)
    html("""<div class="legend"><span><span class="dot" style="background:#19e3c1"></span>Charging Station</span>
      <span><span class="dot" style="background:#ffb020"></span>Nearest Station (Top-K)</span>
      <span><span class="dot" style="background:#ff4646"></span>Your Search Location</span></div>""")

with right:
    cards = [("🗄️", "Stations Indexed", f"{len(stations):,}"), ("🕸️", "Spatial Index", "2D KD-Tree"),
             ("🌐", "Distance Model", "Haversine"), ("⚡", "Search Mode", "Top-K")]
    for col, (ic, lb, vl) in zip(st.columns(4, gap="small"), cards):
        with col:
            html(f'<div class="stat"><div class="ic">{ic}</div><div class="lb">{lb}</div><div class="vl">{vl}</div></div>')

    out = ('<div class="pt">📍 Nearest Charging Stations<span class="chip">🗺 View on Map</span></div>'
           '<div style="height:10px"></div>')
    for i, (d, s) in enumerate(nearest, 1):
        n, c, p = meta(s)
        th = THUMBS[(i - 1) % 5]
        pic = f'<img src="{th}">' if th else '<div style="width:62px;height:68px;border-radius:8px;background:#12384a"></div>'
        tag = '<span class="tag top">⚡ CLOSEST STATION</span>' if i == 1 else f'<span class="tag">RESULT #{i}</span>'
        pw = f"{p} kW" if p is not None else "N/A"
        out += (f'<div class="res {"first" if i == 1 else ""}">{pic}<div class="res-m">{tag}'
                f'<div class="rn">{n}</div><div class="rc">📍 {c}</div></div>'
                f'<div class="rs"><span class="badge">#{i}</span><br>🧍 {float(d):.2f} km<br>⚡ {pw}</div></div>')
    html(out)

# ---------- bottom row ----------
b1, b2, b3 = st.columns([1.05, 1.5, 1.05], gap="medium")

with b1:
    html('<div class="pt">KD-Tree Search Analytics</div>')
    vals = [("Nodes Visited", getattr(tree, "nodes_visited", "—")),
            ("Branches Pruned", getattr(tree, "nodes_pruned", "—")), ("Search Time", f"{ms:.0f} ms")]
    for c, (lb, vl) in zip(st.columns(3, gap="small"), vals):
        with c:
            html(f'<div class="mini"><div class="lb">{lb}</div><div class="vl">{vl}</div></div>')

with b2:
    html("""<div class="pt">How ChargeFind Works</div><div style="height:8px"></div><div class="steps">
      <div class="step"><div class="num">01</div><div><b>Build</b>Charging stations are organized into a 2D KD-Tree using latitude and longitude.</div></div>
      <div class="arrow">→</div>
      <div class="step"><div class="num">02</div><div><b>Search</b>The KD-Tree recursively searches spatial regions closest to the requested location.</div></div>
      <div class="arrow">→</div>
      <div class="step"><div class="num">03</div><div><b>Prune</b>Branches that cannot contain a closer station are eliminated from the search.</div></div></div>""")

with b3:
    html("""<div class="pt">Algorithm Complexity</div><div style="height:8px"></div><div class="steps">
      <div class="cx"><b style="color:#f4f7fb">KD-Tree Search</b><div class="v">O(√n)</div>Average Case<br>O(n) Worst Case</div>
      <div class="cx"><b style="color:#f4f7fb">Haversine Distance</b><div class="v">O(1)</div>Constant time<br>Per station calculation</div></div>""")
