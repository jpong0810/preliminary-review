import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime

# ---------- Config ----------
DB_FILE = "fund_checklist.db"
TODAY = lambda: datetime.today().strftime("%Y-%m-%d")

# Step columns (header labels only; checkboxes have no labels)
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

# Polished, colorful styling (header, badges, compact cells, large checkboxes)
st.markdown("""
<style>
:root {
  --bg:#f6f7fb; --card:#ffffff; --ink:#222; --muted:#6b7280; --line:#e7e8ef;
  --primary:#2b6fff; --success:#22c55e; --warn:#f59e0b; --danger:#ef4444;
}
html, body { background: var(--bg) !important; }
.block-container { padding-top: 12px; max-width: 1280px; }

.card {
  background: var(--card); border:1px solid var(--line); border-radius:16px;
  padding: 18px 20px; box-shadow: 0 6px 18px rgba(15, 23, 42, .05);
}

/* Title bar */
.titlebar { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.titlebar h1 { margin:0; font-size: 1.55rem; letter-spacing:.2px; }

/* “New Fund” button style override */
div.stButton > button[kind="primary"] {
  background: #111827; border: 1px solid #0b1220; color: #fff; font-weight: 600;
  border-radius: 10px; padding: 8px 14px;
}

/* Table header row */
.header-row {
  display:grid; grid-template-columns: 3fr 1.3fr repeat(6, 1fr) .8fr; gap:10px;
  padding:10px 12px; margin-top:12px; border-bottom:1px solid var(--line);
  color:#111827; font-weight: 600; background: #eef2ff; border-radius: 12px;
}

/* Data row grid */
.grid {
  display:grid; grid-template-columns: 3fr 1.3fr repeat(6, 1fr) .8fr; gap:10px;
  align-items:center; padding:10px 12px; border-bottom:1px solid var(--line);
}
.grid:hover { background:#fbfbfe; border-radius:12px; }

/* Inputs tidy */
input, textarea { font-size: .95rem !important; }

/* Badge for Assigned */
.badge {
  display:inline-block; padding:6px 10px; border-radius:999px; font-weight:600;
  border:1px solid var(--line); background:#f3f4f6; color:#111827;
}

/* Make checkboxes larger & colorful */
input[type="checkbox"] {
  width: 20px; height: 20px; accent-color: var(--primary);
}

/* Trash button */
.trash > button {
  width:100%; border-radius:10px; border:1px solid var(--danger);
  color:var(--danger); background:#fff5f5; font-weight:600; padding:6px 0;
}
</style>
""", unsafe_allow_html=True)

# Rerun shim
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

def load_df() -> pd.DataFrame:
    with conn() as c:
        return pd.read_sql_query("SELECT * FROM funds ORDER BY id DESC", c)

def set_field(row_id:int, field:str, value):
    with conn() as c:
        c.execute(f"UPDATE funds SET {field}=? WHERE id=?", (value, row_id)); c.commit()

def delete_row(row_id:int):
    with conn() as c:
        c.execute("DELETE FROM funds WHERE id=?", (row_id,)); c.commit()

def stamp_if_new(old_val:int, new_val:bool, old_date:str|None):
    if (not old_val) and bool(new_val) and (not old_date): return TODAY()
    return old_date

# ---------- App ----------
init_db()

# Title bar + New Fund
st.markdown('<div class="card titlebar"><h1>FUND REVIEW TRACKER</h1></div>', unsafe_allow_html=True)
with st.expander("➕ New Fund", expanded=False):
    c1, c2, c3 = st.columns([3,1.2,0.8])
    fund_name = c1.text_input("Fund Name", placeholder="e.g., Alpha Fund IV")
    assigned  = c2.date_input("Assigned Date", value=pd.to_datetime("today")).strftime("%Y-%m-%d")
    if c3.button("Add", type="primary", disabled=(not fund_name.strip())):
        add_fund(fund_name, assigned)
        st.success("Fund added.")
        rerun()

df = load_df()
if df.empty:
    st.info("No funds yet. Add your first fund above.")
    st.stop()

# Types
df["assigned_date"] = pd.to_datetime(df["assigned_date"], errors="coerce").dt.date
for col, _ in STEPS: df[col] = df[col].astype(bool)

# Header row
st.markdown(
    f'<div class="card header-row">'
    f'<div>Fund</div><div>Assigned</div>'
    + ''.join([f'<div>{label}</div>' for _,label in STEPS])
    + '<div></div></div>',
    unsafe_allow_html=True
)

# Data rows
for _, row in df.iterrows():
    rid = int(row["id"])
    cols = st.columns([3,1.3] + [1]*len(STEPS) + [.8], gap="small")

    # Fund name (auto-save)
    new_name = cols[0].text_input("fund", value=row["fund_name"], label_visibility="collapsed", key=f"name_{rid}")
    if new_name != row["fund_name"]:
        set_field(rid, "fund_name", new_name.strip()); rerun()

    # Assigned badge + date editor
    with cols[1]:
        st.markdown(f'<span class="badge">Assigned</span>', unsafe_allow_html=True)
        new_assigned = st.date_input("assigned", value=row["assigned_date"], label_visibility="collapsed", key=f"ass_{rid}")
        if str(new_assigned) != str(row["assigned_date"]):
            set_field(rid, "assigned_date", str(new_assigned)); rerun()

    # Step checkboxes (no labels in cells; hover shows completion date)
    for i, (colname, label) in enumerate(STEPS):
        tip = f"Completed: {row.get(colname+'_date')}" if row.get(colname+"_date") else f"{label}: not completed"
        checked = cols[2+i].checkbox(label, value=bool(row[colname]), help=tip, label_visibility="collapsed", key=f"{colname}_{rid}")
        if checked != bool(row[colname]):
            stamp = stamp_if_new(int(row[colname]), checked, row.get(colname+"_date"))
            set_field(rid, colname, int(checked))
            set_field(rid, colname+"_date", stamp)
            rerun()

    # Delete if rejected
    with cols[-1]:
        if row["step7_rej"]:
            if st.button("🗑️", key=f"del_{rid}", help="Delete this rejected fund", use_container_width=True):
                delete_row(rid); rerun()
