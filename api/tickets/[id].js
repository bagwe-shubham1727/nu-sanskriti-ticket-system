import { supabase } from "../config.js";

export default async function handler(req, res) {
    const { id } = req.query;
    if (req.method === "PATCH") {
        const { status } = JSON.parse(req.body);
        const { data, error } = await supabase.from("tickets").update({ status }).eq("id", id);
        return res.status(200).json({ data, error });
    }
    if (req.method === "DELETE") {
        const { error } = await supabase.from("tickets").delete().eq("id", id);
        return res.status(200).json({ success: !error });
    }
    res.status(405).end();
}
