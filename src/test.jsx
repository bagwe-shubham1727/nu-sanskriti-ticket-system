import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";
import bannerImg from "./assets/nu-banner.png"; // Added banner image import

// React Router version: Separate Client (/) and Admin (/admin) routes
// LocalStorage-only data + Admin PIN auth (hashed when supported)
// Styling via Tailwind utility classes

const STORAGE_KEY = "ticket_queue_v1";
const SETTINGS_KEY = "ticket_queue_settings_v1";
const ADMIN_STORAGE_KEY = "ticket_queue_admin_v1";
const ADMIN_SESSION_KEY = "ticket_queue_admin_session_v1";

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

function writeQueue(q) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw
      ? JSON.parse(raw)
      : { avgMinutesPerTicket: 3, branchName: "Main Desk" };
  } catch (e) {
    return { avgMinutesPerTicket: 3, branchName: "Main Desk" };
  }
}

function writeSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
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

function nextQueueNumber(queue) {
  if (!queue.length) return 1;
  return Math.max(...queue.map((t) => t.number)) + 1;
}

async function hashPin(pin) {
  if (window.crypto?.subtle) {
    const enc = new TextEncoder().encode(pin);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "plain:" + pin;
}

async function verifyPin(pin, pinHash) {
  if (!pinHash) return false;
  const h = await hashPin(pin);
  return h === pinHash;
}

function useLocalStorageQueue() {
  const [queue, setQueue] = useState(() => readQueue());
  const [settings, setSettings] = useState(() => readSettings());
  const [admin, setAdmin] = useState(() => readAdmin());

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setQueue(readQueue());
      if (e.key === SETTINGS_KEY) setSettings(readSettings());
      if (e.key === ADMIN_STORAGE_KEY) setAdmin(readAdmin());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addTicket = (name) => {
    const q = readQueue();
    const ticket = {
      id: crypto.randomUUID(),
      number: nextQueueNumber(q),
      name: name.trim(),
      status: "waiting",
      createdAt: Date.now(),
    };
    const next = [...q, ticket];
    writeQueue(next);
    setQueue(next);
    return ticket;
  };

  const updateTicket = (id, patch) => {
    const next = queue.map((t) => (t.id === id ? { ...t, ...patch } : t));
    writeQueue(next);
    setQueue(next);
  };

  const clearAll = () => {
    writeQueue([]);
    setQueue([]);
  };

  const saveSettings = (patch) => {
    const next = { ...settings, ...patch };
    writeSettings(next);
    setSettings(next);
  };

  const setAdminPinHash = (pinHash) => {
    const next = { ...admin, pinHash };
    writeAdmin(next);
    setAdmin(next);
  };

  return {
    queue,
    addTicket,
    updateTicket,
    clearAll,
    settings,
    saveSettings,
    admin,
    setAdminPinHash,
  };
}

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

function Header({ branch }) {
  return (
    <header className="max-w-4xl mx-auto px-4 pt-8 pb-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {branch} — Ticket Queue
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Local-only queue (Client & Admin)
          </p>
        </div>
        <nav className="flex gap-2">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-xl border text-sm bg-white border-gray-200 hover:bg-gray-50"
          >
            Client
          </Link>
          <Link
            to="/admin"
            className="px-3 py-1.5 rounded-xl border text-sm bg-gray-900 text-white border-gray-900"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}

function AppShell({ children }) {
  const { settings } = useLocalStorageQueue();
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-gray-900">
      <Banner />
      <Header branch={settings.branchName} />
      {children}
      <footer className="max-w-4xl mx-auto px-4 pb-10 text-center text-xs text-gray-500">
        Built with React + Tailwind. Data and admin PIN are stored locally (PIN
        hashed when supported).
      </footer>
    </div>
  );
}

// (ClientPage, AdminPage, AdminAuth, ChangePinForm remain same as previous code)

export default function Test() {
  const state = useLocalStorageQueue();
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<div>Client Page here</div>} />
          <Route path="/admin" element={<div>Admin Page here</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
