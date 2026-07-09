"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type Todo = { id: number; text: string; type: string; done: boolean; createdAt: string };

const TYPE_COLOR: Record<string, string> = {
  action: "var(--series-1)",
  research: "var(--series-5)",
  decision: "var(--series-8)",
  untagged: "var(--text-muted)",
};

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [type, setType] = useState("untagged");

  async function refresh() {
    setTodos(await fetch("/api/todos").then((r) => r.json()));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    if (!text.trim()) return;
    await fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, type }) });
    setText("");
    await refresh();
  }

  async function toggle(id: number, done: boolean) {
    await fetch(`/api/todos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !done }) });
    await refresh();
  }

  async function remove(id: number) {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <h1 className="text-xl font-bold">To-do</h1>
      <div className="card p-3 flex gap-2 items-center flex-wrap">
        <input
          placeholder="Add a to-do…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 text-sm rounded-md border px-2 py-1.5 bg-transparent min-w-[160px]"
          style={{ borderColor: "var(--border)" }}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm rounded-md border px-2 py-1.5 bg-transparent" style={{ borderColor: "var(--border)" }}>
          <option value="untagged">Untagged</option>
          <option value="action">Action</option>
          <option value="research">Research</option>
          <option value="decision">Decision</option>
        </select>
        <button onClick={add} className="text-sm font-medium px-3 py-1.5 rounded-md text-white" style={{ background: "var(--series-1)" }}>
          Add
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {todos.map((t) => (
          <div key={t.id} className="card p-3 flex items-center gap-3">
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id, t.done)} className="w-4 h-4" />
            <span
              className={clsx("flex-1 text-sm", t.done && "line-through")}
              style={{ color: t.done ? "var(--text-muted)" : "var(--foreground)" }}
            >
              {t.text}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: TYPE_COLOR[t.type] }}>
              {t.type}
            </span>
            <button onClick={() => remove(t.id)} className="text-xs" style={{ color: "var(--status-critical)" }}>
              Delete
            </button>
          </div>
        ))}
        {todos.length === 0 && <div className="text-sm" style={{ color: "var(--text-muted)" }}>No to-dos yet.</div>}
      </div>
    </div>
  );
}
