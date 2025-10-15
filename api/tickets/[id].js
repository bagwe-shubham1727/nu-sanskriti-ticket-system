// /api/tickets/[id].js
import { supabase } from "../config.js";

// robust body parser (Vercel sometimes gives object, sometimes string)
function getBody(req) {
    try {
        if (!req.body) return {};
        if (typeof req.body === "string") return JSON.parse(req.body);
        if (typeof req.body === "object") return req.body;
        return {};
    } catch {
        return {};
    }
}

// get :id from both Node and edge styles (safety)
function getId(req) {
    if (req.query?.id) return req.query.id;
    try {
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const parts = url.pathname.split("/");
        return parts[parts.length - 1] || null;
    } catch {
        return null;
    }
}

export default async function handler(req, res) {
    // CORS / preflight (optional—helps during local testing or cross-origin)
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "PATCH,PUT,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(204).end();
    }
    res.setHeader("Access-Control-Allow-Origin", "*");

    const id = getId(req);
    if (!id) return res.status(400).json({ error: "Missing id" });

    if (req.method === "PATCH" || req.method === "PUT") {
        const patch = getBody(req);

        if (patch.status && !["waiting", "done", "canceled"].includes(patch.status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const { data, error } = await supabase
            .from("tickets")
            .update(patch)
            .eq("id", id)
            .select("id, number, name, status, created_at");

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ data });
    }

    if (req.method === "DELETE") {
        const { error } = await supabase.from("tickets").delete().eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", "PATCH, PUT, DELETE, OPTIONS");
    return res.status(405).end();
}
