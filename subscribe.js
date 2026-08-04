export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const sub = req.body || {};
  if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    res.status(400).json({ error: "Invalid subscription object" });
    return;
  }

  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error("Supabase subscribe error:", errText);
      res.status(502).json({ error: "Could not save subscription" });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("subscribe error:", err);
    res.status(500).json({ error: "Failed to subscribe" });
  }
}
