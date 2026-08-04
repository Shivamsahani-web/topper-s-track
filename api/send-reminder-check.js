import webpush from "web-push";

export default async function handler(req, res) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (req.query.key !== CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@toppers-track.app";

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    // Current time in Asia/Kolkata as HH:MM and today's date
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
    const currentHHMM = timeFormatter.format(now); // "06:00"
    const todayDate = dateFormatter.format(now); // "2026-08-04"

    // Fetch due, enabled reminders not already sent today
    const remindersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reminders?time=eq.${currentHHMM}&enabled=eq.true&or=(last_sent_date.is.null,last_sent_date.neq.${todayDate})`,
      {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }
    );
    const dueReminders = await remindersRes.json();

    if (!Array.isArray(dueReminders) || dueReminders.length === 0) {
      res.status(200).json({ sent: 0, checkedAt: currentHHMM });
      return;
    }

    // Fetch all subscriptions
    const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const subscriptions = await subsRes.json();

    let sentCount = 0;

    for (const reminder of dueReminders) {
      const payload = JSON.stringify({
        title: "Topper's Track ⏰",
        body: `${reminder.time} — ${reminder.task || "Reminder"}`,
        image: reminder.image_url || undefined,
        time: reminder.time,
        tag: `reminder-slot-${reminder.slot}`,
      });

      for (const sub of subscriptions) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        try {
          await webpush.sendNotification(pushSubscription, payload);
          sentCount++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Subscription expired/invalid — remove it
            await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
              method: "DELETE",
              headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
            });
          } else {
            console.error("Push send error:", err.message);
          }
        }
      }

      // Mark this reminder as sent today
      await fetch(`${SUPABASE_URL}/rest/v1/reminders?slot=eq.${reminder.slot}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ last_sent_date: todayDate }),
      });
    }

    res.status(200).json({ sent: sentCount, remindersMatched: dueReminders.length, checkedAt: currentHHMM });
  } catch (err) {
    console.error("send-reminder-check error:", err);
    res.status(500).json({ error: "Reminder check failed" });
  }
}
