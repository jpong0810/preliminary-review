import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime

# --- Config ---
DB_FILE = "fund_checklist.db"
TODAY_ISO = lambda: datetime.today().strftime("%Y-%m-%d")
FMT = lambda s: pd.to_datetime(s, errors="coerce").strftime("%b-%d") if s else "—"

STEPS = [
    ("step2_info",  "Info Request"),
    ("step3_anlys", "Analyst"),
    ("step4_myrev", "My Review"),
    ("step5_partn", "Partner"),
    ("step6_email", "Email"),
    ("step7_rej",   "Rejected"),
]

st.set_page_config(page_title="Fund Review Tracker", layout="wide")

# --- Style ---
st.markdown("""
<style>
:root { --blue:#1D4ED8; --red:#ef4444; }
.block-container { padding-top: 28px; max-width: 1320px; }
h1.title { font-size: 1.8rem; font-weight: 800; margin-bottom: 20px; }
.pill {
    width: 100%;
    border-radius: 10px;
    padding: 8px;
    font-weight: 700;
    border: 2px solid var(--blue);
    background-color: var(--blue) !important;
    color: white !important;
    text-align: center;
    cursor: pointer;
}
.pill.done {
    background-color: white !important;
    color: var(--blue) !important;
}
.pill.rej.done {
    border-color: var(--red) !important;
    color: var(--red) !important;
}
</style>
""", unsafe_allow_html=True)

# --- DB functions ---
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

def add_fund(name, assigned):
    with conn() as c:
        c.execute("INSERT INTO funds (fund_name, assigned_date) VALUES (?,?)", (name, assigned))
        c.commit()

def load_df():
    with conn() as c:
        return pd.read_sql_query("SELECT * FROM funds", c)

def toggle_step(row_id, colname):
    with conn() as c:
        done = c.execute(f"SELECT {colname} FROM funds WHERE id=?", (row_id,)).fetchone()[0]
        date_col = colname + "_date"
        if done:
            c.execute(f"UPDATE funds SET {colname}=0, {date_col}=NULL WHERE id=?", (row_id,))
        else:
            c.execute(f"UPDATE funds SET {colname}=1, {date_col}=? WHERE id=?", (TODAY_ISO(), row_id))
        c.commit()

def delete_row(row_id):
    with conn() as c:
        c.execute("DELETE FROM funds WHERE id=?", (row_id,))
        c.commit()

# --- Init ---
init_db()

# --- Title ---
st.markdown("<h1 class='title'>Fund Review Tracker</h1>", unsafe_allow_html=True)

# --- UI: Add fund ---
name = st.text_input("Fund Name")
assigned = st.date_input("Assigned Date", value=datetime.today())
if st.button("Add Fund", disabled=not name.strip()):
    add_fund(name.strip(), assigned.strftime("%Y-%m-%d"))
    st.rerun()

# --- Data ---
df = load_df()
if df.empty:
    st.info("No funds yet."); st.stop()

df["assigned_date"] = pd.to_datetime(df["assigned_date"], errors="coerce").dt.date
df = df.sort_values(by="assigned_date")

# --- Table Header ---
cols = st.columns([3, 1.5] + [1]*len(STEPS) + [0.7])
cols[0].write("Fund")
cols[1].write("Assigned")
for i, (_, label) in enumerate(STEPS):
    cols[2+i].write(label)

# --- Table Rows ---
for _, row in df.iterrows():
    rid = int(row["id"])
    c = st.columns([3, 1.5] + [1]*len(STEPS) + [0.7])
    c[0].write(row["fund_name"])
    c[1].write(row["assigned_date"].strftime("%b-%d"))

    for idx_s, (colname, label) in enumerate(STEPS):
        done = bool(row[colname])
        date_val = row.get(colname + "_date")
        pill_text = FMT(date_val) if done and date_val else label
        pill_class = "pill" + (" done" if done else "")
        if colname == "step7_rej": pill_class += " rej"

        if c[2+idx_s].button(pill_text, key=f"{rid}_{colname}"):
            toggle_step(rid, colname)
            st.rerun()

    if row["step7_rej"]:
        if c[-1].button("🗑", key=f"del_{rid}"):
            delete_row(rid)
            st.rerun()
