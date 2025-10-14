import { supabase } from "../config.js";

export default async function handler(req, res) {
    if (req.method === "GET") {
        const { data, error } = await supabase
            .from("tickets")
            .select("id, number, name, status, created_at")
            .order("number", { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ data });
    }

    if (req.method === "POST") {
        try {
            const { name } = JSON.parse(req.body || "{}");
            if (!name || !name.trim()) {
                return res.status(400).json({ error: "Name is required" });
            }

            const { data, error } = await supabase
                .from("tickets")
                .insert([{ name: name.trim() }])
                .select("id, number, name, status, created_at");

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ data });
        } catch (e) {
            return res.status(400).json({ error: "Invalid JSON body" });
        }
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
}
