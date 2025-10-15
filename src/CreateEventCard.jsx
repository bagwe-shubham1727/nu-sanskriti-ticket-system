import React, { useState } from "react";
import { useEvents } from "./useEvents";

export default function CreateEventCard({ onCreated }) {
  const { createEvent, events } = useEvents(); // ← note: added `events` here
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!name.trim()) return setErr("Event name is required");
    if (!pin.trim()) return setErr("Event PIN is required");
    if (pin.length < 4) return setErr("PIN must be at least 4 digits");
    if (pin !== confirmPin) return setErr("PINs do not match");

    try {
      setBusy(true);
      const ev = await createEvent(name.trim(), pin);
      setMsg(`Event “${ev.name}” created successfully`);
      setName("");
      setPin("");
      setConfirmPin("");
      onCreated?.(ev);
    } catch (e) {
      setErr(e.message || "Failed to create event");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold tracking-tight">Create Event</h2>
      </div>

      <form onSubmit={handleCreate} className="grid gap-3 max-w-sm">
        <input
          type="text"
          placeholder="Event name (e.g., Mehendi, Registration)"
          className="rounded-xl border border-gray-300 px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="Event PIN (min 4 digits)"
          className="rounded-xl border border-gray-300 px-3 py-2"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="Confirm PIN"
          className="rounded-xl border border-gray-300 px-3 py-2"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
        />

        {err && <div className="text-sm text-rose-600">{err}</div>}
        {msg && <div className="text-sm text-green-700">{msg}</div>}

        <button
          disabled={busy}
          className="rounded-xl px-4 py-2 bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 w-max"
        >
          {busy ? "Creating…" : "Create Event"}
        </button>
      </form>

      <p className="text-xs text-gray-500 mt-3">
        Each event will have its own admin PIN. Use this PIN on the Admin login
        screen after selecting the event.
      </p>

      {/* ✅ Add this block below the form */}
      <div className="mt-6">
        <div className="text-sm font-medium mb-2">Existing Events</div>
        {events.length === 0 ? (
          <div className="text-sm text-gray-500">No events yet.</div>
        ) : (
          <ul className="space-y-1">
            {events.map((e) => (
              <li key={e.id} className="text-sm text-gray-700">
                • {e.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
