// The outside watcher: checks the Circle server from Cloudflare every 2 minutes and tells the Summoner
// through the Circle bot when it goes dark, when it is back, and when the server restarted itself.
// State (one small JSON) lives in Workers KV. Secrets: BOT_TOKEN (the Circle bot), CHAT_ID (the Summoner).

const FAILS_BEFORE_ALERT = 2; // two checks in a row (about 4 minutes) before saying anything

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(check(env));
  },
};

async function check(env) {
  let ok = false, booted = null, detail = "";
  try {
    const r = await fetch(env.HEALTH_URL, { signal: AbortSignal.timeout(15000), cf: { cacheTtl: 0 } });
    ok = r.ok;
    if (ok) booted = (await r.json()).booted ?? null;
    else detail = `HTTP ${r.status}`;
  } catch (e) {
    detail = String(e).slice(0, 120);
  }

  const prev = JSON.parse((await env.STATE.get("state")) || "{}");
  const now = Date.now();
  const next = { ...prev };

  if (!prev.started && (await say(env,
      "👁️ The outside watcher is on. Every 2 minutes it checks the Circle server from Cloudflare, outside the server, " +
      "and tells you here if it goes dark, when it is back, and if it restarted by itself."))) {
    next.started = now;
  }

  if (ok) {
    if (prev.alerted) {
      const minutes = Math.max(1, Math.round((now - prev.down_since) / 60000));
      await say(env, `✅ The Circle server answers again (dark for about ${minutes} min). Waiting messages are being answered.`);
    }
    if (prev.booted && booted && booted !== prev.booted) {
      await say(env, `🔁 The Circle server restarted at ${bali(booted)} (Bali) and every familiar came back by itself. ` +
                     "Nobody on the server asked for it: it came from Contabo's side.");
    }
    Object.assign(next, { fails: 0, down_since: null, alerted: false });
    if (booted) next.booted = booted;
  } else {
    next.fails = (prev.fails || 0) + 1;
    next.down_since = prev.down_since || now;
    if (next.fails >= FAILS_BEFORE_ALERT && !prev.alerted) {
      next.alerted = await say(env,
        `🚨 The Circle server does not answer from outside (${detail}). Familiars cannot reply until it is back; ` +
        "messages wait on Telegram for 24 hours. I'll tell you when it answers again.");
    }
  }
  await env.STATE.put("state", JSON.stringify(next));
}

function bali(epochSeconds) {
  return new Date(epochSeconds * 1000).toLocaleString("en-GB", {
    timeZone: "Asia/Makassar", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

async function say(env, text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
