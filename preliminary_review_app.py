import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime

# ---------------- Config ----------------
DB_FILE = "fund_checklist.db"
TODAY_ISO = lambda: datetime.today().strftime("%Y-%m-%d")
FMT = lambda s: (pd.to_datetime(s, errors="coerce").strftime("%b-%d")
                 if pd.to_datetime(s, errors="coerce") is not pd.NaT else "—")

STEPS = [
    ("step2_info",  "Info Request"),
    ("step3_anlys", "Analyst"),
    ("step4_myrev", "My Review"),
    ("step5_partn", "Partner"),
    ("step6_email", "Email"),
    ("step7_rej",   "Rejected"),
]

st.set_page_config(page_title="Fund Review Tracker", layout="wide")

# ---------------- Style ----------------
st.markdown("""
<style>
:root{
  --bg:#f4f6fb; --card:#ffffff; --line:#e7e8ef;
  --blue:#1D4ED8; --red:#ef4444;
}
.block-container { padding-top: 28px; max-width: 1320px; }
.card { background: var(--card); border: 1px solid var(--line);
        border-radius: 16px; padding: 18px 20px; margin-bottom: 14px; }
.h1 { font-size: 1.6rem; font-weight: 800; margin: 0; }
.header-grid { display: grid; grid-template-columns: 3fr 1.4fr repeat(6, 1.05fr) 0.9fr;
               gap: 10px; align-items: center;
               background: #eef2ff; border: 1px solid var(--line);
               border-radius: 12px; padding: 10px 12px; font-weight: 700; }
.add-row-grid { display: grid; grid-template-columns: 2fr 1.3fr 0.9fr;
                gap: 10px; align-items: center; }
.add-btn > button { background: #111827; border: 1px solid #0b1220; color: #fff;
                    font-weight: 700; border-radius: 10px; padding: 8px 14px; }
.pill-btn { width: 100%; border-radius: 10px; padding: 8px; font-weight: 700;
            border: 2px solid var(--blue); background: var(--blue); color: #fff;
            cursor: pointer; }
.pill-btn.done { background: #fff; color: var(--blue); }
.pill-btn.rej.done { border-color: var(--red); color: var(--red); }
.trash > button { width: 100%; border-radius: 10px; border: 1px solid var(--red);
                  color: var(--red); background: #fff5f5; font-weight: 700; padding: 6px 0; }
</style>
""", unsafe_allow_html=True)

# ---------------- DB ----------------
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
        c.execute("INSERT INTO funds (fund_name, assigned_date) VALUES (?,?)",
                  (name.strip(), assigned))
        c.commit()
def load_df():
    with conn() as c:
        return pd.read_sql_query("SELECT * FROM funds", c)
def set_field(row_id, field, value):
    with conn() as c:
        c.execute(f"UPDATE funds SET {field}=? WHERE id=?", (value, row_id))
        c.commit()
def delete_row(row_id):
    with conn() as c:
        c.execute("DELETE FROM funds WHERE id=?", (row_id,))
        c.commit()
def toggle_step(row_id, colname):
    with conn() as c:
        done = c.execute(f"SELECT {colname} FROM funds WHERE id=?",
                         (row_id,)).fetchone()[0]
        date_col = colname + "_date"
        if done:
            c.execute(f"UPDATE funds SET {colname}=0, {date_col}=NULL WHERE id=?", (row_id,))
        else:
            c.execute(f"UPDATE funds SET {colname}=1, {date_col}=? WHERE id=?",
                      (TODAY_ISO(), row_id))
        c.commit()

# ---------------- App ----------------
init_db()
st.markdown('<div class="card"><div class="h1">FUND REVIEW TRACKER</div></div>', unsafe_allow_html=True)

# Add fund row
st.markdown('<div class="card add-row-grid">', unsafe_allow_html=True)
c1, c2, c3 = st.columns([2, 1.3, 0.9], gap="small")
name = c1.text_input("Fund Name", placeholder="e.g., Alpha Fund IV", label_visibility="collapsed")
assigned = c2.date_input("Assigned Date", value=pd.to_datetime("today"))
with c3:
    st.markdown('<div class="add-btn">', unsafe_allow_html=True)
    if st.button("Add", use_container_width=True, type="primary", disabled=not name.strip()):
        add_fund(name, assigned.strftime("%Y-%m-%d"))
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)

# Load data
df = load_df()
if df.empty:
    st.info("No funds yet. Add your first fund above."); st.stop()
df["assigned_date"] = pd.to_datetime(df["assigned_date"], errors="coerce").dt.date
df = df.sort_values(by="assigned_date", ascending=True)
for col, _ in STEPS:
    df[col] = df[col].astype(bool)

# Header
st.markdown(
    '<div class="header-grid"><div>Fund</div><div>Assigned</div>' +
    ''.join([f'<div>{label}</div>' for _, label in STEPS]) +
    '<div></div></div>',
    unsafe_allow_html=True
)

# Rows
for _, row in df.iterrows():
    rid = int(row["id"])
    grid = st.columns([3, 1.4] + [1.05]*len(STEPS) + [0.9], gap="small")

    # Fund name
    new_name = grid[0].text_input("fund", value=row["fund_name"],
                                  label_visibility="collapsed", key=f"name_{rid}")
    if new_name != row["fund_name"]:
        set_field(rid, "fund_name", new_name.strip())
        st.rerun()

    # Assigned date
    new_date = grid[1].date_input(" ", value=row["assigned_date"] or datetime.today().date(),
                                  label_visibility="collapsed", key=f"ass_picker_{rid}")
    if str(new_date) != str(row["assigned_date"]):
        set_field(rid, "assigned_date", str(new_date))
        st.rerun()

    # Step pills with hidden form
    for idx_s, (colname, label) in enumerate(STEPS):
        done = bool(row[colname])
        stored = row.get(colname + "_date")
        pill_text = FMT(stored) if (done and stored) else label
        pill_class = "pill-btn" + (" done" if done else "")
        if colname == "step7_rej":
            pill_class += " rej"

        with grid[2 + idx_s]:
            with st.form(f"form_{rid}_{colname}", clear_on_submit=True):
                # Visible HTML pill
                st.markdown(f'<button type="submit" class="{pill_class}">{pill_text}</button>',
                            unsafe_allow_html=True)
                if st.form_submit_button("", use_container_width=True):
                    toggle_step(rid, colname)

    # Delete button
    with grid[-1]:
        if row["step7_rej"]:
            if st.button("🗑️", key=f"del_{rid}", help="Delete this rejected fund", use_container_width=True):
                delete_row(rid)
                st.rerun()
