import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime

# ---------------- Config ----------------
DB_FILE = "fund_checklist.db"
TODAY_ISO = lambda: datetime.today().strftime("%Y-%m-%d")
FMT = lambda s: (pd.to_datetime(s, errors="coerce").strftime("%b-%d") if pd.to_datetime(s, errors="coerce") is not pd.NaT else "—")

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
  --bg:#f4f6fb; --card:#ffffff; --ink:#0f172a; --muted:#6b7280; --line:#e7e8ef;
  --pri:#2563eb; --pri-soft:#ecf2ff; --danger:#ef4444;
}
html, body { background: var(--bg) !important; }
.block-container { padding-top: 26px; max-width: 1320px; }

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 6px 18px rgba(15,23,42,.05);
  margin-bottom: 14px;
}

.h1 { font-size: 1.6rem; font-weight: 800; margin: 0; }
.subtle { color: var(--muted); font-size: .92rem; }

.header-grid, .row-grid {
  display: grid;
  grid-template-columns: 3fr 1.4fr repeat(6, 1.05fr) 0.9fr;
  gap: 10px;
  align-items: center;
}
.header-grid {
  background: #eef2ff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
  font-weight: 700;
}
.row-grid {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
}
.row-grid + .row-grid { margin-top: 8px; }

.trash > button {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--danger);
  color: var(--danger);
  background: #fff5f5;
  font-weight: 700;
  padding: 6px 0;
}

.add-row-grid {
  display: grid;
  grid-template-columns: 2fr 1.3fr 0.9fr;
  gap: 10px;
  align-items: center;
}
.add-btn > button {
  background: #111827;
  border: 1px solid #0b1220;
  color: #fff;
  font-weight: 700;
  border-radius: 10px;
  padding: 8px 14px;
}
</style>
""", unsafe_allow_html=True)

# ---------------- Utils ----------------
def rerun():
    if hasattr(st, "rerun"): st.rerun()
    else: st.experimental_rerun()

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

def add_fund(name:str, assigned:str):
    with conn() as c:
        c.execute("INSERT INTO funds (fund_name, assigned_date) VALUES (?,?)", (name.strip(), assigned))
        c.commit()

def load_df():
    with conn() as c:
        return pd.read_sql_query("SELECT * FROM funds", c)

def set_field(row_id:int, field:str, value):
    with conn() as c:
        c.execute(f"UPDATE funds SET {field}=? WHERE id=?", (value, row_id)); c.commit()

def delete_row(row_id:int):
    with conn() as c:
        c.execute("DELETE FROM funds WHERE id=?", (row_id,)); c.commit()

# Toggle helper
def toggle_step(row, colname):
    done = int(row[colname])
    date_col = colname + "_date"
    if done:
        set_field(row["id"], colname, 0)
        set_field(row["id"], date_col, None)
    else:
        set_field(row["id"], colname, 1)
        set_field(row["id"], date_col, TODAY_ISO())
    rerun()

# ---------------- App ----------------
init_db()

# Title
st.markdown(
    '<div class="card"><div class="h1">FUND REVIEW TRACKER</div>'
    '<div class="subtle">Blue = to-do, White = done. Sorted by Assigned Date (oldest first).</div></div>',
    unsafe_allow_html=True
)

# Add row
st.markdown('<div class="card add-row-grid">', unsafe_allow_html=True)
c1, c2, c3 = st.columns([2, 1.3, 0.9], gap="small")
name = c1.text_input("Fund Name", placeholder="e.g., Alpha Fund IV", label_visibility="collapsed")
assigned = c2.date_input("Assigned Date", value=pd.to_datetime("today"))
with c3:
    st.markdown('<div class="add-btn">', unsafe_allow_html=True)
    if st.button("Add", use_container_width=True, type="primary", disabled=not name.strip()):
        add_fund(name, assigned.strftime("%Y-%m-%d")); st.success("Fund added."); rerun()
    st.markdown('</div>', unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)

# Load & sort oldest first
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
    new_name = grid[0].text_input("fund", value=row["fund_name"], label_visibility="collapsed", key=f"name_{rid}")
    if new_name != row["fund_name"]:
        set_field(rid, "fund_name", new_name.strip()); rerun()

    # Assigned date — editable in place
    new_date = grid[1].date_input(
        label=" ",
        value=row["assigned_date"] if row["assigned_date"] else datetime.today().date(),
        label_visibility="collapsed",
        key=f"ass_picker_{rid}"
    )
    if str(new_date) != str(row["assigned_date"]):
        set_field(rid, "assigned_date", str(new_date))
        rerun()

    # Step pills (blue → white toggle)
    for idx_s, (colname, label) in enumerate(STEPS):
        done = bool(row[colname])
        stored = row.get(colname + "_date")
        text = FMT(stored) if (done and stored) else label

        if done:
            bg_color = "#ffffff"
            border_color = "#2563eb"
            text_color = "#2563eb"
        else:
            bg_color = "#2563eb"
            border_color = "#2563eb"
            text_color = "#ffffff"

        if colname == "step7_rej" and done:
            bg_color = "#ffffff"
            border_color = "#ef4444"
            text_color = "#ef4444"

        pill_html = f"""
            <button style="
                width:100%;
                border-radius:10px;
                border: 2px solid {border_color};
                padding:6px;
                font-weight:700;
                background:{bg_color};
                color:{text_color};
            ">
                {text}
            </button>
        """
        with grid[2 + idx_s]:
            if st.button(text, key=f"{colname}_{rid}", use_container_width=True):
                toggle_step({"id": rid, colname: int(done)}, colname)

    # Delete (only when rejected)
    with grid[-1]:
        if row["step7_rej"]:
            st.markdown('<div class="trash">', unsafe_allow_html=True)
            if st.button("🗑️", key=f"del_{rid}", help="Delete this rejected fund", use_container_width=True):
                delete_row(rid); rerun()
            st.markdown('</div>', unsafe_allow_html=True)
