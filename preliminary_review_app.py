import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime, date

# ---------- Config ----------
DB_FILE = "fund_checklist.db"
TODAY = lambda: datetime.today().strftime("%Y-%m-%d")

# Steps (checkbox only; we store first-completed date behind the scenes)
STEPS = [
    ("step2_info",  "Info Request"),
    ("step3_anlys", "Analyst"),
    ("step4_myrev", "My Review"),
    ("step5_partn", "Partner"),
    ("step6_email", "Email"),
    ("step7_rej",   "Rejected"),
]

# ---------- Streamlit setup ----------
st.set_page_config(page_title="Fund Checklist", layout="wide")

# Clean, readable styling
st.markdown("""
<style>
:root { --border:#e8e8ef; --card:#fff; --muted:#6b6b7a; }
.block-container { padding-top: 8px; max-width: 1320px; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin: 10px 0; }
.header { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.header h2 { margin: 0; font-size: 1.2rem; }
.small { color: var(--muted); font-size: .9rem; }
.row:hover { background: #fafafb; border-radius: 10px; }
.lbl { font-size: .92rem; }
</style>
""", unsafe_allow_html=True)

# Streamlit rerun shim
def rerun():
    if hasattr(st, "rerun"): st.rerun()
    else: st.experimental_rerun()

# ---------- DB helpers ----------
def get_conn():
    return sqlite3.connect(DB_FILE, check_same_thread=False)

def init_db():
    with get_conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS funds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ord INTEGER DEFAULT 1000,
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
        """)
        c.commit()

def add_fund(name: str, assigned: str):
    with get_conn() as c:
        max_ord = c.execute("SELECT COALESCE(MAX(ord),0) FROM funds").fetchone()[0] or 0
        c.execute("INSERT INTO funds (ord, fund_name, assigned_date) VALUES (?,?,?)",
                  (max_ord + 10, name.strip(), assigned))
        c.commit()

def load_df() -> pd.DataFrame:
    with get_conn() as c:
        return pd.read_sql_query("SELECT * FROM funds ORDER BY ord, id", c)

def update_field(row_id: int, field: str, value):
    with get_conn() as c:
        c.execute(f"UPDATE funds SET {field}=? WHERE id=?", (value, row_id))
        c.commit()

def delete_row(row_id: int):
    with get_conn() as c:
        c.execute("DELETE FROM funds WHERE id=?", (row_id,))
        c.commit()

def stamp_if_new(old_val: int, new_val: bool, old_date: str | None) -> str | None:
    # stamp today's date only when going 0 -> True and no date yet
    if (not old_val) and bool(new_val) and (not old_date):
        return TODAY()
    return old_date

# ---------- App ----------
init_db()

st.markdown(
    "<div class='card header'><h2>✅ Fund Review Checklist</h2>"
    "<div class='small'>Add a fund (name + date). Tick steps in the row; it auto-saves and stores the first-completed date (hover tooltip). "
    "Rejected rows show a delete icon.</div></div>",
    unsafe_allow_html=True
)

# Add fund
with st.form("add_fund", clear_on_submit=True):
    c1, c2, c3 = st.columns([3,1.6,0.9])
    fund_name = c1.text_input("Fund Name", placeholder="e.g., Aurora Capital Fund IV")
    assigned  = c2.date_input("Assigned Date", value=pd.to_datetime("today")).strftime("%Y-%m-%d")
    add_btn   = c3.form_submit_button("Add")
    if add_btn and fund_name.strip():
        add_fund(fund_name, assigned)
        st.success("Added fund.")
        rerun()

df = load_df()
if df.empty:
    st.info("No funds yet. Add your first fund above.")
    st.stop()

# dtypes
df["assigned_date"] = pd.to_datetime(df["assigned_date"], errors="coerce").dt.date
for col, _ in STEPS: df[col] = df[col].astype(bool)

# Headers
header = st.columns([0.7, 3, 1.2] + [1]*len(STEPS) + [0.6])
header[0].markdown("**Order**")
header[1].markdown("**Fund**")
header[2].markdown("**Assigned**")
for i, (_, label) in enumerate(STEPS): header[3+i].markdown(f"**{label}**")
header[-1].markdown(" ")

# Rows
for _, row in df.iterrows():
    cols = st.columns([0.7, 3, 1.2] + [1]*len(STEPS) + [0.6])
    rid = int(row["id"])

    new_ord = cols[0].number_input("", value=int(row["ord"]), step=1, label_visibility="collapsed", key=f"ord_{rid}")
    if new_ord != row["ord"]:
        update_field(rid, "ord", int(new_ord)); rerun()

    new_name = cols[1].text_input("", value=row["fund_name"], label_visibility="collapsed", key=f"name_{rid}")
    if new_name != row["fund_name"]:
        update_field(rid, "fund_name", new_name.strip()); rerun()

    new_assigned = cols[2].date_input("", value=row["assigned_date"], label_visibility="collapsed", key=f"ass_{rid}")
    if str(new_assigned) != str(row["assigned_date"]):
        update_field(rid, "assigned_date", str(new_assigned)); rerun()

    # Steps (tooltip shows first-completed date)
    for i, (colname, label) in enumerate(STEPS):
        stored_date = row.get(colname + "_date")
        tip = f"Completed: {stored_date}" if stored_date else "Not completed yet"
        checked = cols[3 + i].checkbox(label, value=bool(row[colname]), key=f"{colname}_{rid}", help=tip)
        if checked != bool(row[colname]):
            new_date = stamp_if_new(int(row[colname]), checked, stored_date)
            update_field(rid, colname, int(checked))
            update_field(rid, colname + "_date", new_date)
            rerun()

    # Delete button appears only when Rejected is checked
    if row["step7_rej"]:
        if cols[-1].button("🗑️", key=f"del_{rid}", help="Delete this rejected fund"):
            delete_row(rid); rerun()
