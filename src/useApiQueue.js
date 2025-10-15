import { useEffect, useRef, useState } from "react";

/**
 * Queue hook (event-scoped):
 * - fetchQueue(): GET /api/tickets?event=:eventId
 * - addTicket(name): POST /api/tickets { name, event_id }
 * - updateTicket(id, patch): PATCH /api/tickets/:id
 * - clearAll(): DELETE /api/tickets/clear?event=:eventId
 */
export function useApiQueue(eventId) {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mutating, setMutating] = useState(false);
    const [error, setError] = useState(null);
    const controllerRef = useRef(null);

    const parseData = (json) => {
        if (!json) return [];
        if (Array.isArray(json)) return json;
        if (Array.isArray(json.data)) return json.data;
        if (json.data && typeof json.data === "object") return [json.data];
        return [];
    };

    const fetchQueue = async () => {
        if (!eventId) {
            setQueue([]);
            return;
        }
        setError(null);
        controllerRef.current?.abort?.();
        const controller = new AbortController();
        controllerRef.current = controller;
        try {
            setLoading(true);
            const res = await fetch(`/api/tickets?event=${encodeURIComponent(eventId)}`, {
                signal: controller.signal,
                headers: { Accept: "application/json" },
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || `GET /api/tickets ${res.status}`);
            const data = parseData(json)
                .map((t) => ({
                    ...t,
                    createdAt: t.createdAt || t.created_at, // normalize for UI
                }))
                .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
            setQueue(data);
        } catch (e) {
            if (e.name !== "AbortError") {
                console.error(e);
                setError(e.message || "Failed to load queue");
            }
        } finally {
            setLoading(false);
        }
    };

    const addTicket = async (name) => {
        if (!eventId) return null;
        setError(null);
        setMutating(true);
        try {
            const res = await fetch(`/api/tickets`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ name, event_id: eventId }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || `POST /api/tickets ${res.status}`);
            const data = parseData(json);
            const created = data[0] ?? null;

            // Fallback to submitted name if API doesn't echo it
            if (created && !created.name) created.name = name;

            // Optimistic: append, then refetch
            if (created) {
                setQueue((prev) =>
                    [...prev, { ...created, createdAt: created.createdAt || created.created_at }].sort(
                        (a, b) => (a.number ?? 0) - (b.number ?? 0)
                    )
                );
            }
            // Keep source of truth in sync
            await fetchQueue();
            return created;
        } catch (e) {
            console.error(e);
            setError(e.message || "Failed to add ticket");
            return null;
        } finally {
            setMutating(false);
        }
    };

    const updateTicket = async (id, patch) => {
        if (!id) return;
        setError(null);
        setMutating(true);
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(patch),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || `PATCH /api/tickets/${id} ${res.status}`);
            // Simple approach: refetch
            await fetchQueue();
        } catch (e) {
            console.error(e);
            setError(e.message || "Failed to update ticket");
        } finally {
            setMutating(false);
        }
    };

    const clearAll = async () => {
        if (!eventId) return;
        if (!confirm("Clear ALL tickets for this event?")) return;
        setError(null);
        setMutating(true);
        try {
            const res = await fetch(`/api/tickets/clear?event=${encodeURIComponent(eventId)}`, {
                method: "DELETE",
                headers: { Accept: "application/json" },
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || `DELETE /api/tickets/clear ${res.status}`);
            await fetchQueue();
        } catch (e) {
            console.error(e);
            setError(e.message || "Failed to clear tickets");
        } finally {
            setMutating(false);
        }
    };

    const reload = () => fetchQueue();

    useEffect(() => {
        fetchQueue();
        // Optional: refetch when tab becomes active
        const onVis = () => document.visibilityState === "visible" && fetchQueue();
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId]);

    return {
        queue,
        loading,
        mutating,
        error,
        addTicket,
        updateTicket,
        clearAll,
        reload,
        // settings/admin are now event-agnostic in DB world; keep placeholders if UI needs them
        settings: { branchName: "Event", avgMinutesPerTicket: 3 },
        saveSettings: () => { },
        admin: { pinHash: null },
        setAdminPinHash: () => { },
    };
}
