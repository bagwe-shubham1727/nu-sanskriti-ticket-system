import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useApiQueue } from "./useApiQueue";
import bannerImg from "./assets/nu-banner.png";

// React Router version: Separate Client (/) and Admin (/admin) routes
// LocalStorage-only data + Admin PIN auth (hashed when supported)
// Styling via Tailwind utility classes

const STORAGE_KEY = "ticket_queue_v1";
const SETTINGS_KEY = "ticket_queue_settings_v1";
const ADMIN_STORAGE_KEY = "ticket_queue_admin_v1"; // { pinHash: string }
const ADMIN_SESSION_KEY = "ticket_queue_admin_session_v1"; // "true" when authed for this tab

function Banner() {
  return (
    <div className="w-full bg-white flex justify-center border-b border-gray-200">
      <img
        src={bannerImg}
        alt="NU Sanskriti Banner"
        className="max-w-full h-auto"
      />
    </div>
  );
}

function Toast({ open, children }) {
  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full
                  bg-sky-600 text-white text-sm font-semibold shadow-lg
                  transition-all duration-300 ease-out
                  ${
                    open
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4 pointer-events-none"
                  }`}
    >
      {children}
    </div>
  );
}

function readAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { pinHash: null };
  } catch (e) {
    return { pinHash: null };
  }
}

function writeAdmin(a) {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(a));
}

function isAdminSessionAuthed() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function setAdminSessionAuthed(v) {
  if (v) sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  else sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

// --- Hashing PIN helpers ---
async function hashPin(pin) {
  if (window.crypto?.subtle) {
    const enc = new TextEncoder().encode(pin);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "plain:" + pin; // fallback (less secure)
}

async function verifyPin(pin, pinHash) {
  if (!pinHash) return false;
  const h = await hashPin(pin);
  return h === pinHash;
}

// --- Shared state hook ---
// function useLocalStorageQueue() {
//   const [queue, setQueue] = useState(() => readQueue());
//   const [settings, setSettings] = useState(() => readSettings());
//   const [admin, setAdmin] = useState(() => readAdmin());

//   useEffect(() => {
//     const onStorage = (e) => {
//       if (e.key === STORAGE_KEY) setQueue(readQueue());
//       if (e.key === SETTINGS_KEY) setSettings(readSettings());
//       if (e.key === ADMIN_STORAGE_KEY) setAdmin(readAdmin());
//     };
//     window.addEventListener("storage", onStorage);
//     return () => window.removeEventListener("storage", onStorage);
//   }, []);

//   const addTicket = (name) => {
//     const q = readQueue();
//     const ticket = {
//       id: crypto.randomUUID(),
//       number: nextQueueNumber(q),
//       name: name.trim(),
//       status: "waiting", // waiting | done | canceled
//       createdAt: Date.now(),
//     };
//     const next = [...q, ticket];
//     writeQueue(next);
//     setQueue(next);
//     return ticket;
//   };

//   const updateTicket = (id, patch) => {
//     const next = queue.map((t) => (t.id === id ? { ...t, ...patch } : t));
//     writeQueue(next);
//     setQueue(next);
//   };

//   const removeTicket = (id) => {
//     const next = queue.filter((t) => t.id !== id);
//     writeQueue(next);
//     setQueue(next);
//   };

//   const clearAll = () => {
//     writeQueue([]);
//     setQueue([]);
//   };

//   const saveSettings = (patch) => {
//     const next = { ...settings, ...patch };
//     writeSettings(next);
//     setSettings(next);
//   };

//   const setAdminPinHash = (pinHash) => {
//     const next = { ...admin, pinHash };
//     writeAdmin(next);
//     setAdmin(next);
//   };

//   return {
//     queue,
//     addTicket,
//     updateTicket,
//     removeTicket,
//     clearAll,
//     settings,
//     saveSettings,
//     admin,
//     setAdminPinHash,
//   };
// }

// --- UI atoms ---
function Section({ title, children, actions }) {
  return (
    <div className="bg-white/80 backdrop-blur border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50">
      {children}
    </span>
  );
}

function ETA({ position, avgMinutes }) {
  if (position <= 0) return <span>You're up next!</span>;
  const minutes = position * avgMinutes;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const text = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  return <span>Estimated wait: {text}</span>;
}

// --- Auth widgets ---
function AdminAuth({ hasPin, onAuthed, onSetPin }) {
  const [mode, setMode] = useState(hasPin ? "login" : "create");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const ok = await verifyPin(pin, readAdmin().pinHash);
      if (ok) {
        setAdminSessionAuthed(true);
        onAuthed();
      } else {
        setError("Incorrect PIN");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!pin || pin.length < 4) return setError("Use at least 4 digits");
    if (pin !== pin2) return setError("PINs do not match");
    setLoading(true);
    try {
      const h = await hashPin(pin);
      onSetPin(h);
      setAdminSessionAuthed(true);
      onAuthed();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title={mode === "login" ? "Admin Login" : "Create Admin PIN"}>
      {mode === "login" ? (
        <form onSubmit={handleLogin} className="grid gap-3 max-w-sm">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Enter PIN"
            className="rounded-xl border border-gray-300 px-3 py-2"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <button
            disabled={loading}
            className="rounded-xl px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Checking…" : "Login"}
          </button>
          <button
            type="button"
            className="text-xs text-gray-600 underline justify-self-start"
            onClick={() => setMode("create")}
          >
            First time here? Create PIN
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreate} className="grid gap-3 max-w-sm">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Choose PIN (min 4 digits)"
            className="rounded-xl border border-gray-300 px-3 py-2"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <input
            type="password"
            inputMode="numeric"
            placeholder="Confirm PIN"
            className="rounded-xl border border-gray-300 px-3 py-2"
            value={pin2}
            onChange={(e) => setPin2(e.target.value)}
          />
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <button
            disabled={loading}
            className="rounded-xl px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Create PIN"}
          </button>
          {hasPin && (
            <button
              type="button"
              className="text-xs text-gray-600 underline justify-self-start"
              onClick={() => setMode("login")}
            >
              Back to login
            </button>
          )}
        </form>
      )}
      <p className="text-xs text-gray-500 mt-3">
        PIN is stored locally in your browser (hashed with SHA-256 when
        supported). If you clear site data, you'll need to set it again.
      </p>
    </Section>
  );
}

// --- Pages ---
function Header({ branch }) {
  return (
    <header className="max-w-4xl mx-auto px-4 pt-8 pb-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {branch} — Ticket Queue
          </h1>
          <p className="text-sm text-gray-600 mt-1"></p>
        </div>
      </div>
    </header>
  );
}

function ClientPage({ queue, addTicket, settings }) {
  const [name, setName] = useState("");
  const [myTicket, setMyTicket] = useState(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (myTicket) {
      const timer = setTimeout(() => {
        setMyTicket(null);
        setShowToast(true); // show toast after hiding ticket
        // hide toast automatically after 5 seconds
        setTimeout(() => setShowToast(false), 3000);
      }, 5000); // hide after 10s
      return () => clearTimeout(timer);
    }
  }, [myTicket]);

  const waiting = useMemo(
    () => queue.filter((t) => t.status === "waiting"),
    [queue]
  );

  const handleTakeTicket = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const t = addTicket(name);
    setMyTicket(t);
    setName("");
  };

  const positionInLine = useMemo(() => {
    if (!myTicket) return null;
    const ahead = waiting
      .slice()
      .sort((a, b) => a.number - b.number)
      .filter((t) => t.number < myTicket.number).length;
    return ahead;
  }, [myTicket, waiting]);

  return (
    <main className="max-w-4xl mx-auto px-4 pb-12 space-y-6">
      <Section
        title="Get a Queue Number"
        actions={<Pill>{waiting.length} in queue</Pill>}
      >
        <form onSubmit={handleTakeTicket} className="grid md:grid-cols-5 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="md:col-span-3 col-span-5 w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="submit"
            className="md:col-span-2 col-span-5 rounded-xl px-4 py-2 bg-sky-600 text-white font-medium hover:bg-sky-700 active:scale-95 transition"
          >
            Take Ticket
          </button>
        </form>
        {myTicket && (
          <div
            className={`mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 transition-opacity duration-700 ${
              myTicket ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-sky-700 font-semibold">
                  Your Queue Number
                </div>
                <div className="text-3xl font-extrabold text-sky-900">
                  #{myTicket.number}
                </div>
              </div>
              <div className="text-sm text-sky-900">
                <ETA
                  position={positionInLine ?? 0}
                  avgMinutes={settings.avgMinutesPerTicket}
                />
              </div>
            </div>
            <div className="mt-2 text-sm text-sky-900/80">
              Name on ticket:{" "}
              <span className="font-medium">{myTicket.name}</span>
            </div>
          </div>
        )}
        <Toast open={showToast}>
          🎟️ Ticket saved! Check the waiting list below 👇
        </Toast>
      </Section>

      <Section title="Now Serving">
        {waiting.length === 0 ? (
          <p className="text-sm text-gray-600">No one is waiting right now.</p>
        ) : (
          <ol className="space-y-2">
            {waiting
              .slice()
              .sort((a, b) => a.number - b.number)
              .slice(0, 5)
              .map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tabular-nums">
                      #{t.number}
                    </span>
                    <span className="text-sm text-gray-700">{t.name}</span>
                  </div>
                  <Pill>waiting</Pill>
                </li>
              ))}
          </ol>
        )}
      </Section>
    </main>
  );
}

function AdminPage({
  queue,
  updateTicket,
  clearAll,
  settings,
  saveSettings,
  admin,
  setAdminPinHash,
}) {
  const [isAuthed, setIsAuthed] = useState(isAdminSessionAuthed());
  const waiting = useMemo(
    () => queue.filter((t) => t.status === "waiting"),
    [queue]
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdminSessionAuthed()) setIsAuthed(false);
  }, []);

  const logout = () => {
    setAdminSessionAuthed(false);
    setIsAuthed(false);
    navigate("/");
  };

  return (
    <main className="max-w-4xl mx-auto px-4 pb-12 space-y-6">
      {!isAuthed ? (
        <AdminAuth
          hasPin={!!admin.pinHash}
          onAuthed={() => setIsAuthed(true)}
          onSetPin={(h) => setAdminPinHash(h)}
        />
      ) : (
        <>
          <Section
            title="Queue Dashboard"
            actions={
              <div className="flex items-center gap-2">
                <Pill>{waiting.length} waiting</Pill>
                <Pill>
                  next #
                  {waiting.slice().sort((a, b) => a.number - b.number)[0]
                    ?.number ?? "—"}
                </Pill>
                <button
                  onClick={logout}
                  className="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white border bg-gray-900 hover:bg-gray-800 transition"
                >
                  Logout
                </button>
              </div>
            }
          >
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border p-3 bg-white">
                <div className="text-xs text-gray-500">Branch</div>
                <div className="font-medium">{settings.branchName}</div>
              </div>
              <div className="rounded-xl border p-3 bg-white">
                <div className="text-xs text-gray-500">Avg mins per ticket</div>
                <div className="font-medium">
                  {settings.avgMinutesPerTicket}
                </div>
              </div>
              <div className="rounded-xl border p-3 bg-white">
                <div className="text-xs text-gray-500">Total tickets today</div>
                <div className="font-medium">{queue.length}</div>
              </div>
            </div>

            {waiting.length === 0 ? (
              <p className="text-sm text-gray-600">No active tickets.</p>
            ) : (
              <ul className="space-y-2">
                {waiting
                  .slice()
                  .sort((a, b) => a.number - b.number)
                  .map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-extrabold tabular-nums">
                          #{t.number}
                        </span>
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-gray-500">
                            Created {new Date(t.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateTicket(t.id, { status: "done" })}
                          className="px-3 py-1.5 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() =>
                            updateTicket(t.id, { status: "canceled" })
                          }
                          className="px-3 py-1.5 rounded-lg text-sm bg-rose-600 text-white hover:bg-rose-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Section>

          <Section title="History / Controls">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                onClick={() => {
                  if (confirm("Clear ALL tickets? This cannot be undone."))
                    clearAll();
                }}
                className="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white border bg-gray-900 hover:bg-gray-800 transition"
              >
                Clear All
              </button>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Branch</label>
                <input
                  type="text"
                  className="rounded-lg border px-2 py-1 text-sm"
                  value={settings.branchName}
                  onChange={(e) => saveSettings({ branchName: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Avg mins/ticket</label>
                <input
                  type="number"
                  min={1}
                  className="w-20 rounded-lg border px-2 py-1 text-sm"
                  value={settings.avgMinutesPerTicket}
                  onChange={(e) =>
                    saveSettings({
                      avgMinutesPerTicket: Number(e.target.value || 1),
                    })
                  }
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 mb-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {queue
                    .slice()
                    .sort((a, b) => a.number - b.number)
                    .map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="p-2 font-medium tabular-nums">
                          #{t.number}
                        </td>
                        <td className="p-2">{t.name}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs border ${
                              t.status === "waiting"
                                ? "bg-yellow-50 border-yellow-200"
                                : t.status === "done"
                                ? "bg-green-50 border-green-200"
                                : "bg-rose-50 border-rose-200"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="p-2 text-gray-600">
                          {new Date(t.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="max-w-md">
              <div className="text-sm font-medium mb-2">Change Admin PIN</div>
              <ChangePinForm />
            </div>
          </Section>
        </>
      )}
    </main>
  );
}

function ChangePinForm() {
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const doChange = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!pin || pin.length < 4)
      return setErr("New PIN must be at least 4 digits");
    if (pin !== pin2) return setErr("New PINs do not match");
    setBusy(true);
    try {
      const stored = readAdmin();
      const ok = await verifyPin(current, stored.pinHash);
      if (!ok) return setErr("Current PIN is incorrect");
      const h = await hashPin(pin);
      writeAdmin({ pinHash: h });
      setMsg("PIN updated successfully");
      setCurrent("");
      setPin("");
      setPin2("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={doChange} className="grid gap-2">
      <input
        type="password"
        inputMode="numeric"
        placeholder="Current PIN"
        className="rounded-xl border border-gray-300 px-3 py-2"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <input
        type="password"
        inputMode="numeric"
        placeholder="New PIN (min 4 digits)"
        className="rounded-xl border border-gray-300 px-3 py-2"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
      />
      <input
        type="password"
        inputMode="numeric"
        placeholder="Confirm new PIN"
        className="rounded-xl border border-gray-300 px-3 py-2"
        value={pin2}
        onChange={(e) => setPin2(e.target.value)}
      />
      {err && <div className="text-sm text-rose-600">{err}</div>}
      {msg && <div className="text-sm text-green-700">{msg}</div>}
      <button
        disabled={busy}
        className="mt-1 rounded-xl px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 w-max"
      >
        {busy ? "Saving…" : "Update PIN"}
      </button>
    </form>
  );
}

// --- App shell ---
function AppShell({ children }) {
  const { settings } = useApiQueue();
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-gray-900">
      <Banner />
      <Header branch={settings.branchName} />
      {children}
      <footer className="max-w-4xl mx-auto px-4 pb-10 text-center text-xs text-gray-500">
        © NU Sanskriti. All Rights Reserved
      </footer>
    </div>
  );
}

export default function Ticket() {
  // const state = useLocalStorageQueue();
  const state = useApiQueue();
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route
            path="/"
            element={
              <ClientPage
                queue={state.queue}
                addTicket={state.addTicket}
                settings={state.settings}
              />
            }
          />
          <Route
            path="/admin"
            element={
              <AdminPage
                queue={state.queue}
                updateTicket={state.updateTicket}
                clearAll={state.clearAll}
                settings={state.settings}
                saveSettings={state.saveSettings}
                admin={state.admin}
                setAdminPinHash={state.setAdminPinHash}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
