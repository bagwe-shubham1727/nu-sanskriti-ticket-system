import { supabase } from "../config.js";

export default async function handler(req, res) {
    if (req.method !== "DELETE") {
        res.setHeader("Allow", "DELETE");
        return res.status(405).end();
    }
    const { error } = await supabase.from("tickets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
}
