import { useEffect, useRef, useState } from "react";

export function useApiQueue() {
    const [queue, setQueue] = useState([]);
    const [settings, setSettings] = useState({
        branchName: "NU Sanskriti",
        avgMinutesPerTicket: 3,
    });
    const [admin, setAdmin] = useState({ pinHash: null });

    const [loading, setLoading] = useState(true);
    const [mutating, setMutating] = useState(false);
    const [error, setError] = useState(null);

    // If you deploy API under the same domain, keep this empty string.
    // If your API is elsewhere, set BASE_URL = "https://your-api.example.com"
    const BASE_URL = "";

    const controllerRef = useRef(null);

    const parseData = (json) => {
        if (!json) return [];
        // handle { data: [...] } or { data: {...} } or raw array
        if (Array.isArray(json)) return json;
        if (Array.isArray(json.data)) return json.data;
        if (json.data && typeof json.data === "object") return [json.data];
        return [];
    };

    const fetchQueue = async () => {
        setError(null);
        controllerRef.current?.abort?.();
        const controller = new AbortController();
        controllerRef.current = controller;

        try {
            setLoading(true);
            const res = await fetch(`${BASE_URL}/api/tickets`, {
                signal: controller.signal,
                headers: { "Accept": "application/json" },
            });
            if (!res.ok) {
                throw new Error(`GET /api/tickets failed: ${res.status} ${res.statusText}`);
            }
            const json = await res.json().catch(() => ({}));
            const data = parseData(json);
            // Sort by number ascending if your API doesn't already
            data.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
            setQueue(data);
        } catch (err) {
            if (err.name !== "AbortError") {
                console.error(err);
                setError(err.message || "Failed to load queue");
            }
        } finally {
            setLoading(false);
        }
    };

    const addTicket = async (name) => {
        setError(null);
        setMutating(true);
        try {
            const res = await fetch(`${BASE_URL}/api/tickets`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) {
                throw new Error(`POST /api/tickets failed: ${res.status} ${res.statusText}`);
            }
            const json = await res.json().catch(() => ({}));
            const data = parseData(json);
            const created = data[0] ?? null;

            // Optimistic append (optional), then refetch to be consistent
            if (created) setQueue((prev) => [...prev, created]);
            await fetchQueue();
            return created;
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to add ticket");
            return null;
        } finally {
            setMutating(false);
        }
    };

    const updateTicket = async (id, patch) => {
        setError(null);
        setMutating(true);
        try {
            const res = await fetch(`${BASE_URL}/api/tickets/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!res.ok) {
                throw new Error(`PATCH /api/tickets/${id} failed: ${res.status} ${res.statusText}`);
            }
            // You can parse response and update locally, but a refetch keeps source of truth
            await fetchQueue();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to update ticket");
        } finally {
            setMutating(false);
        }
    };

    const removeTicket = async (id) => {
        setError(null);
        setMutating(true);
        try {
            const res = await fetch(`${BASE_URL}/api/tickets/${id}`, {
                method: "DELETE",
                headers: { "Accept": "application/json" },
            });
            if (!res.ok) {
                throw new Error(`DELETE /api/tickets/${id} failed: ${res.status} ${res.statusText}`);
            }
            await fetchQueue();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to remove ticket");
        } finally {
            setMutating(false);
        }
    };

    const clearAll = async () => {
        if (!confirm("Clear all tickets?")) return;
        setError(null);
        setMutating(true);
        try {
            const res = await fetch(`${BASE_URL}/api/tickets/clear`, {
                method: "DELETE",
                headers: { "Accept": "application/json" },
            });
            if (!res.ok) {
                throw new Error(`DELETE /api/tickets/clear failed: ${res.status} ${res.statusText}`);
            }
            await fetchQueue();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to clear tickets");
        } finally {
            setMutating(false);
        }
    };

    // Settings/Admin still local (or wire to API later if needed)
    const saveSettings = (patch) => setSettings((prev) => ({ ...prev, ...patch }));
    const setAdminPinHash = (pinHash) => setAdmin({ pinHash });

    const reload = () => fetchQueue();

    useEffect(() => {
        fetchQueue();

        // Optional: refetch when tab becomes active again
        const onVis = () => document.visibilityState === "visible" && fetchQueue();
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);

        // Optional: polling
        // const id = setInterval(fetchQueue, 5000);
        // return () => clearInterval(id);
    }, []);

    return {
        queue,
        loading,
        mutating,
        error,
        addTicket,
        updateTicket,
        removeTicket,
        clearAll,
        settings,
        saveSettings,
        admin,
        setAdminPinHash,
        reload,
    };
}
