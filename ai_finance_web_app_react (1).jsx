import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

// Default export: single-file React component web app
// Tailwind is used for styling. This component aims to be dropped into a CRA/Vite app
// Requirements: react, react-dom, recharts, framer-motion, tailwindcss

export default function AIFinanceApp() {
  // --- Sample categories & keyword-based auto-categorizer ---
  const CATEGORY_KEYWORDS = {
    "Groceries": ["grocery", "supermarket", "trader", "mart", "aldi", "bigbasket", "dairy"],
    "Dining": ["restaurant", "cafe", "dinner", "lunch", "uber eats", "zomato"],
    "Transport": ["uber", "ola", "taxi", "bus", "train", "metro", "flight"],
    "Utilities": ["electric", "water", "internet", "mobile", "phone", "utility"],
    "Shopping": ["amazon", "flipkart", "myntra", "purchase", "shop", "store"],
    "Health": ["pharm", "clinic", "hospital", "doctor", "medicine"],
    "Entertainment": ["movie", "netflix", "prime", "spotify", "concert"],
    "Income": ["salary", "payroll", "deposit", "credit"],
    "Other": [],
  };

  // --- Mock historical transactions (past 6 months) ---
  const SAMPLE_TRANSACTIONS = [
    // date in ISO, amount positive for expense (neg income), merchant/description
    { id: 1, date: "2025-08-10", amount: 32.5, description: "Cafe Latte - Bluebird cafe" },
    { id: 2, date: "2025-08-02", amount: 4500, description: "Salary - August" },
    { id: 3, date: "2025-07-25", amount: 1200, description: "BigBasket - groceries" },
    { id: 4, date: "2025-07-22", amount: 220, description: "Uber ride" },
    { id: 5, date: "2025-06-30", amount: 999, description: "Amazon purchase - headphones" },
    { id: 6, date: "2025-06-10", amount: 580, description: "Electricity bill" },
    { id: 7, date: "2025-05-18", amount: 250, description: "Movie ticket - PVR" },
    { id: 8, date: "2025-05-05", amount: 1300, description: "Grocery - local mart" },
    { id: 9, date: "2025-04-15", amount: 60, description: "Spotify subscription" },
    { id: 10, date: "2025-04-01", amount: 4300, description: "Salary - April" },
    { id: 11, date: "2025-03-11", amount: 700, description: "Clinic - medicines" },
  ];

  // --- State management ---
  const [transactions, setTransactions] = useState(() => {
    // load from localStorage if exists
    const saved = localStorage.getItem("af_transactions");
    if (saved) return JSON.parse(saved);
    // else annotate sample transactions with category via autoCategorize
    return SAMPLE_TRANSACTIONS.map((t) => ({ ...t, category: autoCategorize(t.description) }));
  });

  const [budgets, setBudgets] = useState(() => {
    const saved = localStorage.getItem("af_budgets");
    if (saved) return JSON.parse(saved);
    return {
      Groceries: 5000,
      Dining: 2000,
      Transport: 1500,
      Shopping: 3000,
      Utilities: 2000,
      Health: 1000,
      Entertainment: 800,
      Other: 1000,
    };
  });
  const [goals, setGoals] = useState(() => {
    const saved = localStorage.getItem("af_goals");
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, name: "Emergency Fund", target: 50000, saved: 8000 },
      { id: 2, name: "Vacation", target: 20000, saved: 4000 },
    ];
  });

  // form state
  const [form, setForm] = useState({ date: "", description: "", amount: "", category: "" });

  // persist to localStorage
  useEffect(() => {
    localStorage.setItem("af_transactions", JSON.stringify(transactions));
  }, [transactions]);
  useEffect(() => {
    localStorage.setItem("af_budgets", JSON.stringify(budgets));
  }, [budgets]);
  useEffect(() => {
    localStorage.setItem("af_goals", JSON.stringify(goals));
  }, [goals]);

  // --- Utility: basic keyword-based categorizer ---
  function autoCategorize(description) {
    if (!description) return "Other";
    const desc = description.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const kw of keywords) if (desc.includes(kw)) return cat;
    }
    // heuristic: amounts > 3000 and description contains 'salary' -> Income
    if (desc.includes("salary")) return "Income";
    return "Other";
  }

  // --- Add expense ---
  function addTransaction(e) {
    e.preventDefault();
    if (!form.date || !form.description || !form.amount) return alert("Please fill all fields");
    const newTx = {
      id: Date.now(),
      date: form.date,
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category || autoCategorize(form.description),
    };
    setTransactions((s) => [newTx, ...s]);
    setForm({ date: "", description: "", amount: "", category: "" });
  }

  // --- Derived aggregates ---
  const monthlyTotals = useMemo(() => {
    // group by YYYY-MM
    const map = {};
    for (const t of transactions) {
      const month = t.date.slice(0, 7);
      map[month] = (map[month] || 0) + t.amount;
    }
    // produce sorted array of last 6 months
    const months = Object.keys(map).sort();
    return months.map((m) => ({ month: m, total: parseFloat(map[m].toFixed(2)) }));
  }, [transactions]);

  const categoryTotalsCurrentMonth = useMemo(() => {
    const nowMonth = new Date().toISOString().slice(0, 7);
    const map = {};
    for (const t of transactions) {
      const month = t.date.slice(0, 7);
      if (month !== nowMonth) continue;
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return Object.entries(map).map(([category, amount]) => ({ category, amount }));
  }, [transactions]);

  // --- Simple predictive model: linear regression per category over months ---
  // returns predicted next-month totals per category and overall
  function predictNextMonth() {
    // build per-category time series by month index
    const byMonth = {}; // { month: {cat: amount}}
    // get unique months sorted
    const months = Array.from(new Set(transactions.map((t) => t.date.slice(0, 7)))).sort();
    if (months.length < 2) return { perCategory: {}, overall: null };
    months.forEach((m) => (byMonth[m] = {}));
    transactions.forEach((t) => {
      const m = t.date.slice(0, 7);
      byMonth[m][t.category] = (byMonth[m][t.category] || 0) + t.amount;
    });
    const monthIndex = months.reduce((acc, m, i) => ((acc[m] = i), acc), {});

    const perCategory = {};
    const categories = Array.from(new Set(transactions.map((t) => t.category)));
    for (const cat of categories) {
      const xs = [];
      const ys = [];
      for (const m of months) {
        xs.push(monthIndex[m]);
        ys.push(byMonth[m][cat] || 0);
      }
      // compute simple linear regression slope & intercept
      const n = xs.length;
      const xmean = xs.reduce((a, b) => a + b, 0) / n;
      const ymean = ys.reduce((a, b) => a + b, 0) / n;
      let num = 0,
        den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - xmean) * (ys[i] - ymean);
        den += (xs[i] - xmean) * (xs[i] - xmean);
      }
      const slope = den === 0 ? 0 : num / den;
      const intercept = ymean - slope * xmean;
      const nextX = n; // next month index
      const pred = Math.max(0, intercept + slope * nextX);
      perCategory[cat] = Number(pred.toFixed(2));
    }
    // overall: sum of predicted categories
    const overall = Object.values(perCategory).reduce((a, b) => a + b, 0);
    return { perCategory, overall: Number(overall.toFixed(2)) };
  }

  const prediction = useMemo(() => predictNextMonth(), [transactions]);

  // --- Budget alerts ---
  const budgetAlerts = useMemo(() => {
    const nowMonth = new Date().toISOString().slice(0, 7);
    const totals = {};
    for (const t of transactions) {
      if (t.date.slice(0, 7) !== nowMonth) continue;
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }
    const alerts = [];
    for (const [cat, cap] of Object.entries(budgets)) {
      const spent = totals[cat] || 0;
      const pct = (spent / cap) * 100;
      if (pct >= 100) alerts.push({ category: cat, status: "Exceeded", spent, cap, pct: Math.round(pct) });
      else if (pct >= 80) alerts.push({ category: cat, status: "Near limit (>=80%)", spent, cap, pct: Math.round(pct) });
    }
    return alerts;
  }, [transactions, budgets]);

  // --- Goal progress ---
  function updateGoalSaved(goalId, delta) {
    setGoals((g) => g.map((x) => (x.id === goalId ? { ...x, saved: Math.max(0, x.saved + delta) } : x)));
  }

  // --- Remove transaction ---
  function removeTransaction(id) {
    setTransactions((s) => s.filter((t) => t.id !== id));
  }

  // --- UI small helpers ---
  function currency(v) {
    return v.toLocaleString(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  }

  // --- Render ---
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold">AI Finance — Predictive Budgeting</h1>
            <p className="text-sm text-slate-500">Automated categorization · Predictive spending · Goal tracking · Alerts</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600">Local: {new Date().toLocaleString()}</div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Transactions & Add form */}
          <section className="lg:col-span-1 bg-white p-4 rounded-2xl shadow-sm">
            <motion.h2 initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-lg font-semibold mb-2">
              Add Transaction
            </motion.h2>
            <form onSubmit={addTransaction} className="space-y-2">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Description (merchant)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full p-2 border rounded"
              />
              <input
                type="number"
                placeholder="Amount"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full p-2 border rounded"
              />
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full p-2 border rounded">
                <option value="">(auto categorize)</option>
                {Object.keys(CATEGORY_KEYWORDS).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded">Add</button>
                <button
                  type="button"
                  onClick={() => {
                    // quick sample import: create few transactions to demo
                    const demo = [
                      { id: Date.now() + 1, date: new Date().toISOString().slice(0, 10), description: "Grocery - local", amount: 400, category: "Groceries" },
                      { id: Date.now() + 2, date: new Date().toISOString().slice(0, 10), description: "Uber ride", amount: 180, category: "Transport" },
                    ];
                    setTransactions((s) => [...demo, ...s]);
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Quick demo
                </button>
              </div>
            </form>

            <div className="mt-4">
              <h3 className="text-sm font-medium">Recent Transactions</h3>
              <div className="space-y-2 mt-2 max-h-64 overflow-auto">
                {transactions.slice(0, 20).map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
                    <div>
                      <div className="text-sm font-medium">{t.description}</div>
                      <div className="text-xs text-slate-500">{t.date} • {t.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{currency(t.amount)}</div>
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setTransactions((s) => s.map((x) => (x.id === t.id ? { ...x, category: prompt("Category for this transaction:", x.category) || x.category } : x)))} className="text-xs underline">Edit cat</button>
                        <button onClick={() => removeTransaction(t.id)} className="text-xs text-red-500">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Middle column: Dashboards */}
          <section className="lg:col-span-2 bg-white p-4 rounded-2xl shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border rounded">
                <h3 className="text-sm font-medium mb-2">Spending — last months</h3>
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={monthlyTotals}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-3 border rounded">
                <h3 className="text-sm font-medium mb-2">Category share (current month)</h3>
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={categoryTotalsCurrentMonth} dataKey="amount" nameKey="category" outerRadius={60} label>
                        {categoryTotalsCurrentMonth.map((entry, index) => (
                          <Cell key={`cell-${index}`} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-3 border rounded md:col-span-2">
                <h3 className="text-sm font-medium mb-2">Predictive next-month spending</h3>
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-2xl font-bold">{currency(prediction.overall || 0)}</div>
                    <div className="text-sm text-slate-500">Predicted total spend next month (sum of category predictions)</div>
                  </div>
                  <div className="flex-1">
                    <div className="max-h-36 overflow-auto">
                      {Object.entries(prediction.perCategory || {}).map(([cat, amt]) => (
                        <div key={cat} className="flex justify-between border-b py-1">
                          <div className="text-sm">{cat}</div>
                          <div className="text-sm font-semibold">{currency(amt)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border rounded md:col-span-2">
                <h3 className="text-sm font-medium mb-2">Budget Alerts</h3>
                <div className="space-y-2">
                  {budgetAlerts.length === 0 ? (
                    <div className="text-sm text-slate-500">No alerts — you are within budget ranges.</div>
                  ) : (
                    budgetAlerts.map((a) => (
                      <div key={a.category} className="p-2 rounded bg-amber-50 border">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium">{a.category}</div>
                            <div className="text-xs text-slate-600">{a.status} — {a.pct}% of {currency(a.cap)}</div>
                          </div>
                          <div className="text-sm font-semibold">{currency(a.spent)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Right column: Goals & Budget controls */}
          <section className="lg:col-span-3 bg-white p-4 rounded-2xl shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded md:col-span-1">
                <h3 className="text-sm font-medium mb-2">Goals</h3>
                <div className="space-y-3">
                  {goals.map((g) => (
                    <div key={g.id} className="p-2 border rounded">
                      <div className="font-medium">{g.name}</div>
                      <div className="text-xs text-slate-500">{currency(g.saved)} / {currency(g.target)}</div>
                      <div className="w-full bg-slate-100 rounded h-2 mt-2">
                        <div className="h-2 rounded bg-indigo-600" style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => updateGoalSaved(g.id, 500)} className="text-xs px-2 py-1 border rounded">Add ₹500</button>
                        <button onClick={() => updateGoalSaved(g.id, -500)} className="text-xs px-2 py-1 border rounded">Remove ₹500</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 border rounded col-span-2">
                <h3 className="text-sm font-medium mb-2">Budgets</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(budgets).map(([cat, cap]) => (
                    <div key={cat} className="p-2 border rounded flex items-center justify-between">
                      <div>
                        <div className="font-medium">{cat}</div>
                        <div className="text-xs text-slate-500">Set monthly cap</div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input type="number" value={cap} onChange={(e) => setBudgets((b) => ({ ...b, [cat]: Number(e.target.value) }))} className="w-28 p-1 border rounded text-right" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-500">Tip: You can edit the auto-categorizer keywords in code to tune classification. The predictor uses a simple linear regression on historical monthly sums per category.</div>
          </section>
        </main>

        <footer className="text-center text-xs text-slate-400 mt-6">Built with ❤️ — AI Finance (demo). Replace auto-categorizer with an ML model or server backend for production.</footer>
      </div>
    </div>
  );
}
