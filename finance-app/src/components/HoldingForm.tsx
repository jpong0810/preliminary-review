"use client";

import { useState } from "react";

export type Account = { id: number; name: string; institution?: string | null };

export type HoldingFormValues = {
  ticker: string;
  name: string;
  category: string;
  sector: string;
  geography: string;
  accountId: number | string;
  tags: string;
  quantity: number | string;
  currency: string;
  price: number | string;
  fxRateToUsd: number | string;
  costBasis: number | string;
  notes: string;
};

const EMPTY: HoldingFormValues = {
  ticker: "",
  name: "",
  category: "Stock",
  sector: "Unclassified",
  geography: "US",
  accountId: "",
  tags: "",
  quantity: "",
  currency: "USD",
  price: "",
  fxRateToUsd: "1",
  costBasis: "",
  notes: "",
};

export function HoldingForm({
  accounts,
  initial,
  onSubmit,
  onCancel,
}: {
  accounts: Account[];
  initial?: Partial<HoldingFormValues>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<HoldingFormValues>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof HoldingFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ticker: values.ticker,
        name: values.name,
        category: values.category,
        sector: values.sector,
        geography: values.geography,
        accountId: Number(values.accountId),
        tags: values.tags.split(",").map((t) => t.trim()).filter(Boolean),
        quantity: Number(values.quantity),
        currency: values.currency,
        price: Number(values.price),
        fxRateToUsd: Number(values.fxRateToUsd || 1),
        costBasis: values.costBasis === "" ? null : Number(values.costBasis),
        notes: values.notes || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-md border px-2 py-1.5 text-sm bg-transparent";
  const inputStyle = { borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-3 card p-4">
      <Field label="Ticker">
        <input required className={inputClass} style={inputStyle} value={values.ticker} onChange={set("ticker")} />
      </Field>
      <Field label="Name">
        <input required className={inputClass} style={inputStyle} value={values.name} onChange={set("name")} />
      </Field>
      <Field label="Account">
        <select required className={inputClass} style={inputStyle} value={values.accountId} onChange={set("accountId")}>
          <option value="">Select…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Category">
        <input className={inputClass} style={inputStyle} value={values.category} onChange={set("category")} placeholder="ETF, Stock, Fund…" />
      </Field>
      <Field label="Sector">
        <input className={inputClass} style={inputStyle} value={values.sector} onChange={set("sector")} />
      </Field>
      <Field label="Geography">
        <input className={inputClass} style={inputStyle} value={values.geography} onChange={set("geography")} />
      </Field>
      <Field label="Tags (comma-separated)">
        <input className={inputClass} style={inputStyle} value={values.tags} onChange={set("tags")} />
      </Field>
      <Field label="Quantity">
        <input required type="number" step="any" className={inputClass} style={inputStyle} value={values.quantity} onChange={set("quantity")} />
      </Field>
      <Field label="Currency">
        <input className={inputClass} style={inputStyle} value={values.currency} onChange={set("currency")} />
      </Field>
      <Field label="Price (native currency)">
        <input required type="number" step="any" className={inputClass} style={inputStyle} value={values.price} onChange={set("price")} />
      </Field>
      <Field label="FX rate to USD">
        <input type="number" step="any" className={inputClass} style={inputStyle} value={values.fxRateToUsd} onChange={set("fxRateToUsd")} />
      </Field>
      <Field label="Cost basis (native, optional)">
        <input type="number" step="any" className={inputClass} style={inputStyle} value={values.costBasis} onChange={set("costBasis")} />
      </Field>
      <div className="col-span-full">
        <Field label="Notes">
          <textarea className={inputClass} style={inputStyle} rows={2} value={values.notes} onChange={set("notes")} />
        </Field>
      </div>
      {error && <div className="col-span-full text-sm" style={{ color: "var(--status-critical)" }}>{error}</div>}
      <div className="col-span-full flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="text-sm font-medium px-3 py-1.5 rounded-md text-white disabled:opacity-50"
          style={{ background: "var(--series-1)" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm font-medium px-3 py-1.5 rounded-md" style={{ color: "var(--text-secondary)" }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
