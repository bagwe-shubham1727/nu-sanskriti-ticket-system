import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useApiQueue } from "./useApiQueue"; // must accept (eventId)
import { useEvents } from "./useEvents"; // events list + create + verify
import CreateEventCard from "./CreateEventCard";
import bannerImg from "./assets/nu-banner.png";

/* ---------- Small UI atoms ---------- */

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

/* ---------- Shared: Event selector ---------- */

function EventSelect({ events, value, onChange, disabled = false }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg border px-2 py-1 text-sm"
      disabled={disabled}
    >
      <option value="">Select event…</option>
      {events.map((ev) => (
        <option key={ev.id} value={ev.id}>
          {ev.name}
        </option>
      ))}
    </select>
  );
}

/* ---------- Header ---------- */

function Header({ branch }) {
  return (
    <header className="max-w-4xl mx-auto px-4 pt-8 pb-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {branch} — Ticket Queue
          </h1>
        </div>
      </div>
    </header>
  );
}

/* ---------- Client Page (event-aware) ---------- */

function ClientPage({
  eventId,
  setEventId,
  queue,
  addTicket,
  settings,
  events,
  eventsLoading,
}) {
  const [name, setName] = useState("");
  const [myTicket, setMyTicket] = useState(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (myTicket) {
      const timer = setTimeout(() => {
        setMyTicket(null);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [myTicket]);

  const waiting = useMemo(
    () => queue.filter((t) => t.status === "waiting"),
    [queue]
  );

  const handleTakeTicket = async (e) => {
    e.preventDefault();
    if (!eventId) return;
    if (!name.trim()) return;
    const created = await addTicket(name);
    if (created) {
      if (!created.name) created.name = name; // fallback
      setMyTicket(created);
    }
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
        title="Select Event"
        actions={
          <Pill>{eventsLoading ? "Loading…" : `${events.length} events`}</Pill>
        }
      >
        <div className="flex items-center gap-3">
          <EventSelect
            events={events}
            value={eventId}
            onChange={setEventId}
            disabled={eventsLoading}
          />
          {!eventId && (
            <span className="text-xs text-gray-500">
              Pick an event to continue
            </span>
          )}
        </div>
      </Section>

      <Section
        title="Get a Queue Number"
        actions={<Pill>{waiting.length} in queue</Pill>}
      >
        <form onSubmit={handleTakeTicket} className="grid md:grid-cols-5 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={eventId ? "Your name" : "Select an event first"}
            disabled={!eventId}
            className="md:col-span-3 col-span-5 w-full rounded-xl border border-gray-300 px-3 py-2 disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="submit"
            disabled={!eventId}
            className="md:col-span-2 col-span-5 rounded-xl px-4 py-2 bg-sky-600 text-white font-medium hover:bg-sky-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Take Ticket
          </button>
        </form>

        {myTicket && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 transition-opacity duration-700">
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

/* ---------- Admin Login (event + pin) ---------- */

/* ---------- Admin Login (event + pin) ---------- */

function AdminLoginEvent({ selectedEventId, onSelectEvent, onAuthed }) {
  const { events, loading, error, verifyEventPin } = useEvents();
  const [eventId, setEventId] = useState(selectedEventId || "");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  // keep internal eventId in sync when parent updates selection
  useEffect(() => {
    if (selectedEventId) setEventId(selectedEventId);
  }, [selectedEventId]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!eventId) return setErr("Select an event");
    if (!pin.trim()) return setErr("Enter PIN");

    const ok = await verifyEventPin(eventId, pin);
    if (ok) onAuthed(eventId);
    else setErr("Incorrect PIN");
  };

  return (
    <Section title="Admin Login">
      <form onSubmit={submit} className="grid gap-3 max-w-sm">
        <label className="text-sm text-gray-700">Event</label>
        <EventSelect
          events={events}
          value={eventId}
          onChange={(id) => {
            setEventId(id);
            onSelectEvent?.(id);
          }}
          disabled={loading}
        />

        <input
          id="admin-login-pin" // <- used to focus after create
          type="password"
          inputMode="numeric"
          placeholder="Event PIN"
          className="rounded-xl border border-gray-300 px-3 py-2"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />

        {error && <div className="text-sm text-rose-600">{String(error)}</div>}
        {err && <div className="text-sm text-rose-600">{err}</div>}
        <button className="rounded-xl px-4 py-2 bg-gray-900 text-white hover:bg-gray-800">
          Login
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-3">
        Choose an event and enter that event’s PIN.
      </p>
    </Section>
  );
}

/* ---------- Admin Page (event-aware) ---------- */

function AdminPage({
  eventId,
  eventName,
  queue,
  updateTicket,
  clearAll,
  settings,
}) {
  const waiting = useMemo(
    () => queue.filter((t) => t.status === "waiting"),
    [queue]
  );
  const navigate = useNavigate();

  const logout = () => {
    sessionStorage.removeItem(`admin_${eventId}`);
    navigate("/");
  };

  return (
    <main className="max-w-4xl mx-auto px-4 pb-12 space-y-6">
      <Section
        title="Queue Dashboard"
        /* ... */
      >
        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border p-3 bg-white">
            <div className="text-xs text-gray-500">Event</div>
            <div className="font-medium">{eventName || "—"}</div> {/* ← here */}
          </div>
          <div className="rounded-xl border p-3 bg-white">
            <div className="text-xs text-gray-500">Avg mins per ticket</div>
            <div className="font-medium">{settings.avgMinutesPerTicket}</div>
          </div>
          <div className="rounded-xl border p-3 bg-white">
            <div className="text-xs text-gray-500">Total tickets</div>
            <div className="font-medium">{queue.length}</div>
          </div>
        </div>
        {/* ...rest unchanged... */}
      </Section>
    </main>
  );
}

/* ---------- App shell (reads settings just for labels) ---------- */

function AppShell({ children, title = "NU Sanskriti" }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-gray-900">
      <Banner />
      <Header branch={title} />
      {children}
      <footer className="max-w-4xl mx-auto px-4 pb-10 text-center text-xs text-gray-500">
        © NU Sanskriti. All Rights Reserved
      </footer>
    </div>
  );
}

/* ---------- Root: wire events + queues ---------- */

export default function Ticket() {
  const { events, loading: eventsLoading } = useEvents();

  // Selected event for Client route
  const [clientEventId, setClientEventId] = useState(null);
  // Admin login-side selected event (shared between login + create)
  const [loginSelectedEventId, setLoginSelectedEventId] = useState("");

  const client = useApiQueue(clientEventId); // <- your hook must accept eventId

  // Admin auth state per-event
  const [adminEventId, setAdminEventId] = useState(() => {
    // restore last authed event (optional)
    const keys = Object.keys(sessionStorage).filter(
      (k) => k.startsWith("admin_") && sessionStorage.getItem(k) === "true"
    );
    return keys.length ? keys[0].replace("admin_", "") : null;
  });
  const adminQueue = useApiQueue(adminEventId);

  const adminEvent = events.find((e) => e.id === adminEventId);

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route
            path="/"
            element={
              <ClientPage
                eventId={clientEventId}
                setEventId={setClientEventId}
                queue={client.queue}
                addTicket={client.addTicket}
                settings={{ branchName: "Event", avgMinutesPerTicket: 3 }}
                events={events}
                eventsLoading={eventsLoading}
              />
            }
          />

          <Route
            path="/admin"
            element={
              adminEventId &&
              sessionStorage.getItem(`admin_${adminEventId}`) === "true" ? (
                <AdminPage
                  eventId={adminEventId}
                  eventName={adminEvent?.name || "—"}
                  queue={adminQueue.queue}
                  updateTicket={adminQueue.updateTicket}
                  clearAll={adminQueue.clearAll}
                  settings={{ branchName: "Event", avgMinutesPerTicket: 3 }}
                />
              ) : (
                // render both: Login + Create Event
                <div className="max-w-4xl mx-auto px-4 pb-12">
                  <div className="grid md:grid-cols-2 gap-6">
                    <AdminLoginEvent
                      selectedEventId={loginSelectedEventId}
                      onSelectEvent={setLoginSelectedEventId}
                      onAuthed={(eid) => {
                        sessionStorage.setItem(`admin_${eid}`, "true");
                        setAdminEventId(eid);
                      }}
                    />
                    <CreateEventCard
                      onCreated={(ev) => {
                        // ✅ auto-select the new event in the login form
                        setLoginSelectedEventId(ev.id);
                        // ✅ focus the PIN field for quick typing
                        setTimeout(() => {
                          const pinInput =
                            document.getElementById("admin-login-pin");
                          if (pinInput) pinInput.focus();
                        }, 250);
                      }}
                    />
                  </div>
                </div>
              )
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
