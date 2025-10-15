import { useEffect, useState } from "react";

/**
 * Events hook:
 * - fetchEvents(): GET /api/events
 * - createEvent(name, pin): POST /api/events
 * - verifyEventPin(eventId, pin): POST /api/events/:id/verify -> { ok: boolean }
 */
export function useEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEvents = async () => {
        try {
            setError(null);
            setLoading(true);
            const res = await fetch("/api/events", { headers: { Accept: "application/json" } });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || `GET /api/events ${res.status}`);
            setEvents(json.data ?? []);
        } catch (e) {
            console.error(e);
            setError(e.message || "Failed to load events");
        } finally {
            setLoading(false);
        }
    };

    const createEvent = async (name, pin) => {
        const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ name, pin }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Failed to create event");
        setEvents((prev) => [json.data, ...prev]);
        return json.data;
    };

    const verifyEventPin = async (eventId, pin) => {
        const res = await fetch(`/api/events/${eventId}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ pin }),
        });
        const json = await res.json().catch(() => ({}));
        return res.ok && !!json.ok;
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    return { events, loading, error, fetchEvents, createEvent, verifyEventPin };
}
