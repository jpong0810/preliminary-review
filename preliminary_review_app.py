import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime

# ---------- Config ----------
DB_FILE = "fund_checklist.db"
TODAY_STR = lambda: datetime.today().strftime("%Y-%m-%d")   # stored in DB
FMT = lambda s: (pd.to_datetime(s).strftime("%b-%d") if pd.notna(pd.to_datetime(s, errors="coerce")) else "—")

# Steps (pill buttons; show label until first click, then show MMM-DD)
STEPS = [
    ("step2_info",  "Info Request"),
    ("step3_anlys", "Analyst"),
    ("step4_myrev", "My Review"),
    ("step5_partn", "Partner"),
    ("step6_email", "Email"),
    ("step7_rej",   "Rejected"),
]

# ---------- Streamlit setup ----------
st.set_page_config(page_title="Fund Review Tracker", layout="wide")

# Polished UI
st.markdown("""
<style>
:root{
  --bg:#f6f7fb; --card:#fff; --ink:#0f172a; --muted:#6b7280; --line:#e7e8ef;
  --primary:#3b82f6; --ok:#10b981; --warn:#f59e0b; --danger:#ef4444;
}
html, body { background: var(--bg) !important; }
.block-container { padding-top: 10px; max-width: 1280px; }
.card {
  background: var(--card); border:1px solid var(--line); border-radius:16px;
  padding: 18px 20px; box-shadow: 0 6px 18px rgba(15,23,42,.05);
}
.header-row, .data-row {
  display:grid; grid-template-columns: 3fr 1.2fr repeat(6, 1fr) .9fr; gap:10px; align-items:center;
}
.header-row { padding: 10px 12px; border-bottom:1px solid var(--line); background:#eef2ff; border-radius:12px; font-weight:700;}
.data-row { padding: 10px 12px; border-bottom:1px solid var(--line); }
.data-row:hover { background:#fbfbfe; border-radius:12px; }
.h1 { font-size: 1.55rem; font-weight: 800; letter-spacing:.2px; margin:0 0 6px 0; }

.badge {
  display:inline-block; padding:6px 12px; border-radius:999px;
  border:1px solid var(--line); background:#f3f4f6; color:var(--ink); font-weight:700;
}

.pill { width:100%; border-radius:10px; padding:8px 0; font-weight:700; border:1px solid var(--line); background:#ffffff; color:#111827; }
.pill-done { background:#ebf5ff; border-color:#cfe0ff; color:#1e40af; }  /* after stamped show date */
.pill-rej  { background:#fff1f2; border-color:#fecdd3; color:#881337; }

.trash > button { width:100%; border-radius:10px; border:1px solid var(--danger); color:var(--danger); background:#fff5f5; font-weight:700; padding:8px 0; }
.new-btn > button { background:#111827; border:1px solid #0b1220; color:#fff; font-weight:700; border-radius:10px; padding:8px 14px; }
.small { color: var(--muted); font-size:.9rem; }
</style>
""", unsafe_allow_html=True)

def rerun():
    if hasattr(st, "rerun"): st.rerun()
    else: st.experimental_rerun()

# ---------- DB ----------
def conn(): return sqlite3.connect(DB_FILE, check_same_thread=False)

def init_db():
    with conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS funds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fund_name TEXT NOT NULL,
                assigned_date TEXT NOT NULL,
                step2_info  INTEGER DEFAULT 0,
                step3_anlys INTEGER DEFAULT 0,
                step4_myrev INTEGER DEFAULT 0,
                step5_partn INTEGER DEFAULT 0,
                step6_email INTEGER DEFAULT 0,
                step7_rej   INTEGER DEFAULT 0,
                step2_info_date  TEXT,
                step3_anlys_date TEXT,
                step4_myrev_date TEXT,
                step5_partn_date TEXT,
                step6_email_date TEXT,
                step7_rej_date   TEXT
            )
        """); c.commit()

def add_fund(name:str, assigned:str):
    with conn() as c:
        c.execute("INSERT INTO funds (fund_name, assigned_date) VALUES (?,?)",
                  (name.strip(), assigned)); c.commit()

def load_df():
    with conn() as c:
        return pd.read_sql_query("SELECT * FROM funds ORDER BY id DESC", c)

def set_field(row_id:int, field:str, value):
    with conn() as c:
        c.execute(f"UPDATE funds SET {field}=? WHERE id=?", (value, row_id)); c.commit()

def delete_row(row_id:int):
    with conn() as c:
        c.execute("DELETE FROM funds WHERE id=?", (row_id,)); c.commit()

def stamp_first(old_flag:int, new_click:bool, old_date:str|None) -> tuple[int,str|None]:
    """If clicked and not previously done, mark done + store today's date. Otherwise keep as-is."""
    if new_click and not old_flag:
        return 1, TODAY_STR()
    return old_flag, old_date

# ---------- App ----------
init_db()

st.markdown('<div class="card"><div class="h1">FUND REVIEW TRACKER</div><div class="small">Click a step bubble to stamp today’s date. After stamping, the bubble shows <b>MMM-DD</b>. “Rejected” reveals a delete button.</div></div>', unsafe_allow_html=True)

with st.expander("➕ New Fund", expanded=False):
    c1, c2, c3 = st.columns([3,1.2,0.8])
    name = c1.text_input("Fund Name", placeholder="e.g., Alpha Fund IV")
    assigned = c2.date_input("Assigned Date", value=pd.to_datetime("today")).strftime("%Y-%m-%d")
    with c3:
        st.markdown('<div class="new-btn">', unsafe_allow_html=True)
        if st.button("Add", use_container_width=True, type="primary", disabled=not name.strip()):
            add_fund(name, assigned); st.success("Fund added."); rerun()
        st.markdown('</div>', unsafe_allow_html=True)

df = load_df()
if df.empty:
    st.info("No funds yet. Add your first fund above."); st.stop()

# types
df["assigned_date"] = pd.to_datetime(df["assigned_date"], errors="coerce").dt.date
for col, _ in STEPS: df[col] = df[col].astype(bool)

# header
st.markdown(
    '<div class="card header-row"><div>Fund</div><div>Assigned</div>' +
    ''.join([f'<div>{label}</div>' for _,label in STEPS]) + '<div></div></div>',
    unsafe_allow_html=True
)

# rows
for _, row in df.iterrows():
    rid = int(row["id"])
    cols = st.columns([3,1.2] + [1]*len(STEPS) + [.9], gap="small")

    # Fund name (inline edit, autosave)
    new_name = cols[0].text_input("fund", value=row["fund_name"], label_visibility="collapsed", key=f"name_{rid}")
    if new_name != row["fund_name"]:
        set_field(rid, "fund_name", new_name.strip()); rerun()

    # Assigned pill + (optional) quick edit on click of date input below
    with cols[1]:
        st.markdown(f'<span class="badge">Assigned: {FMT(row["assigned_date"])}</span>', unsafe_allow_html=True)
        new_assigned = st.date_input("assigned", value=row["assigned_date"], label_visibility="collapsed", key=f"ass_{rid}")
        if str(new_assigned) != str(row["assigned_date"]):
            set_field(rid, "assigned_date", str(new_assigned)); rerun()

    # Step pills
    for i, (colname, label) in enumerate(STEPS):
        done = bool(row[colname])
        stored_date = row.get(colname + "_date")
        pill_text = FMT(stored_date) if done and stored_date else label  # show label until first stamp, then show MMM-DD
        pill_class = "pill-rej" if (colname=="step7_rej" and done) else ("pill-done" if done else "pill")
        help_tip = f"{label}: " + (f"completed {FMT(stored_date)}" if stored_date else "not completed")
        with cols[2+i]:
            # Render as a button that stamps once
            st.markdown(f'<div><button class="{pill_class}" disabled></button></div>', unsafe_allow_html=True)
            # Use a real Streamlit button for click handling (styled by global CSS)
            clicked = st.button(pill_text, key=f"{colname}_{rid}", use_container_width=True)
            if clicked:
                new_flag, new_date = stamp_first(int(done), True, stored_date)
                # Only write if we actually changed from not-done -> done
                if new_flag and not done:
                    set_field(rid, colname, 1)
                    set_field(rid, colname + "_date", new_date)
                    rerun()

    # Delete button appears only when Rejected is done
    with cols[-1]:
        if row["step7_rej"]:
            st.markdown('<div class="trash">', unsafe_allow_html=True)
            if st.button("🗑️", key=f"del_{rid}", help="Delete this rejected fund", use_container_width=True):
                delete_row(rid); rerun()
            st.markdown('</div>', unsafe_allow_html=True)
