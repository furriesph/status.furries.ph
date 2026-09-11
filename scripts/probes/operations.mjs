// Server-only, count-only telemetry. Never fetch message bodies, destinations,
// payment details, tokens, or LAN payloads. A quiet queue is not proof of delivery.
const WINDOW_MS = 15 * 60_000;
export const operationTargets = [
  "email",
  "linked-messaging",
  "discord",
  "telegram",
  "sms",
  "jobs",
  "payments",
  "federation",
  "lan",
];
export async function probeOperations(
  service,
  {
    fetchImpl = fetch,
    env = process.env,
    now = () => new Date(),
    timeoutMs = 10000,
  } = {},
) {
  const date = now();
  const started = performance.now();
  const result = (status, message, evidence = "direct") => ({
    serviceId: service.id,
    status,
    checkedAt: date.toISOString(),
    latencyMs: Math.round(performance.now() - started),
    message,
    evidence,
  });
  const gap = (message) => result("unknown", message, "monitoring-gap");
  const target = service.check?.target;
  if (!operationTargets.includes(target))
    return gap("Operational telemetry target is invalid.");
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  let origin;
  try {
    origin = new URL(env.SUPABASE_URL);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      !["", "/"].includes(origin.pathname) ||
      !origin.hostname.endsWith(".supabase.co")
    )
      throw new Error();
  } catch {
    return gap(
      "Operational telemetry requires a configured hosted database origin.",
    );
  }
  if (!key) return gap("Operational telemetry credentials are not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const recent = new Date(date.valueOf() - WINDOW_MS).toISOString();
  async function count(table, filters = {}) {
    const url = new URL(`/rest/v1/${table}`, origin);
    url.searchParams.set("select", "*");
    for (const [name, value] of Object.entries(filters))
      url.searchParams.set(name, value);
    const response = await fetchImpl(url, {
      method: "HEAD",
      headers: {
        apikey: key,
        ...(key.startsWith("sb_secret_")
          ? {}
          : { authorization: `Bearer ${key}` }),
        prefer: "count=exact",
      },
      redirect: "error",
      signal: controller.signal,
    });
    await response.body?.cancel();
    if (!response.ok)
      throw new Error(response.status === 429 ? "rate-limit" : "unavailable");
    const match = /\/(\d+)$/.exec(response.headers.get("content-range") || "");
    if (!match || !Number.isSafeInteger(Number(match[1])))
      throw new Error("invalid");
    return Number(match[1]);
  }
  async function queue(
    table,
    {
      success = "delivered",
      failed = "failed",
      time = "updated_at",
      extra = {},
      pending = "(pending,retry)",
      due = "next_attempt_at",
    } = {},
  ) {
    const [successes, failures, overdue, stalled] = await Promise.all([
      count(table, {
        ...extra,
        status: `eq.${success}`,
        [time]: `gte.${recent}`,
      }),
      count(table, {
        ...extra,
        status: `eq.${failed}`,
        [time]: `gte.${recent}`,
      }),
      count(table, {
        ...extra,
        status: `in.${pending}`,
        or: `(${due}.lt.${recent},and(${due}.is.null,created_at.lt.${recent}))`,
      }),
      count(table, {
        ...extra,
        status: "in.(leased,claimed,processing,delivering)",
        [time]: `lt.${recent}`,
      }),
    ]);
    return { successes, failures, overdue: overdue + stalled };
  }
  function totals(samples) {
    return `Last 15 min: ${samples.reduce((n, s) => n + s.successes, 0)} successful, ${samples.reduce((n, s) => n + s.failures, 0)} failed; ${samples.reduce((n, s) => n + s.overdue, 0)} overdue/stalled.`;
  }
  function summarize(name, samples, caveat = "", ready = false, idleKnown = false) {
    const summary = `${name}. ${totals(samples)} ${caveat}`.trim();
    if (samples.some((s) => s.failures || s.overdue))
      return result("degraded", summary);
    if (ready || samples.every((s) => s.successes > 0))
      return result("operational", summary);
    if (idleKnown)
      return result(
        "operational",
        `${summary} The monitored queues are currently idle and readable; active execution is not being exercised.`,
      );
    return gap(`${summary} Current execution evidence is incomplete.`);
  }
  // Read-only provider identity/readiness endpoints. No sends, charges or OAuth changes.
  // https://core.telegram.org/bots/api#getme
  // https://docs.discord.com/developers/resources/user#get-current-user
  async function readiness(provider) {
    const token =
      env[provider === "telegram" ? "TELEGRAM_BOT_TOKEN" : "DISCORD_BOT_TOKEN"];
    if (provider !== "email" && !token)
      return {
        status: "unknown",
        message: `${provider} readiness credentials are absent.`,
      };
    let url;
    const headers =
      provider === "discord" ? { authorization: `Bot ${token}` } : {};
    try {
      url = new URL(
        provider === "telegram"
          ? `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`
          : provider === "discord"
            ? "https://discord.com/api/v10/users/@me"
            : env.GAS_EMAIL_WEBHOOK_URL,
      );
      if (
        provider === "email" &&
        (url.protocol !== "https:" ||
          url.hostname !== "script.google.com" ||
          !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname) ||
          url.search ||
          url.hash ||
          url.username ||
          url.password)
      )
        throw new Error();
    } catch {
      return {
        status: "unknown",
        message: "Email gateway readiness URL is absent or invalid.",
      };
    }
    try {
      let response;
      for (let hop = 0; hop < 3; hop++) {
        response = await fetchImpl(url, {
          method: "GET",
          headers,
          redirect: "manual",
          signal: controller.signal,
        });
        if (response.status < 300 || response.status >= 400) break;
        await response.body?.cancel();
        if (provider !== "email" || !response.headers.get("location"))
          throw new Error();
        url = new URL(response.headers.get("location"), url);
        if (
          url.protocol !== "https:" ||
          !["script.google.com", "script.googleusercontent.com"].includes(
            url.hostname,
          ) ||
          url.username ||
          url.password
        )
          throw new Error();
      }
      if (response.status === 429) {
        await response.body?.cancel();
        return {
          status: "degraded",
          message: `${provider} readiness is rate limited.`,
        };
      }
      if (response.status >= 500) {
        await response.body?.cancel();
        return {
          status: "outage",
          message: `${provider} readiness returned a server error.`,
        };
      }
      if (!response.ok) {
        await response.body?.cancel();
        return {
          status: "unknown",
          denied: true,
          message: `${provider} collector readiness access was denied (HTTP ${response.status}); production credential parity is unverified.`,
        };
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      let size = 0;
      const chunks = [];
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65536) throw new Error();
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const valid =
        provider === "email"
          ? data.ok === true && data.service === "furries-ph-email-webhook"
          : provider === "telegram"
            ? data.ok === true && data.result?.is_bot === true
            : typeof data.id === "string" && data.bot === true;
      if (!valid) throw new Error();
      return {
        status: "operational",
        message:
          provider === "email"
            ? "Email gateway GET readiness passed; send authorization, quotas and inbox delivery are not tested."
            : `${provider} bot authentication passed; destination permissions and message delivery are not tested.`,
      };
    } catch {
      return {
        status: "unknown",
        message: `${provider} readiness could not be verified.`,
      };
    }
  }
  function withReadiness(name, samples, providers) {
    const unhealthy =
      providers.find((p) => p.status === "outage") ||
      providers.find((p) => p.status === "degraded");
    if (unhealthy)
      return result(
        unhealthy.status,
        `${unhealthy.message} ${totals(samples)}`,
      );
    if (providers.some((p) => p.denied))
      return gap(
        `${providers
          .filter((p) => p.denied)
          .map((p) => p.message)
          .join(" ")} ${totals(samples)}`,
      );
    return summarize(
      name,
      samples,
      providers.map((p) => p.message).join(" ") +
        " Recorded sends are not inbox delivery proof.",
      providers.every((p) => p.status === "operational"),
    );
  }
  try {
    if (target === "email") {
      const samples = await Promise.all([
        queue("email_blast_messages", {
          success: "sent",
          pending: "(queued,retry_wait)",
          due: "next_attempt_at",
        }),
        queue("planning_notification_outbox", {
          extra: { channel: "eq.email" },
        }),
      ]);
      return withReadiness("Email dispatch", samples, [
        await readiness("email"),
      ]);
    }
    if (["linked-messaging", "discord", "telegram"].includes(target)) {
      const providerChannels = {
        discord: "(discord_bot,discord_webhook,discord_dm)",
        telegram: "(telegram_bot,telegram_dm)",
      };
      const providers =
        target === "linked-messaging" ? ["discord", "telegram"] : [target];
      const samples = await Promise.all(
        providers.map((provider) =>
          queue("planning_notification_outbox", {
            extra: { channel: `in.${providerChannels[provider]}` },
          }),
        ),
      );
      return withReadiness(
        target === "linked-messaging"
          ? "Discord and Telegram dispatch"
          : `${target[0].toUpperCase()}${target.slice(1)} dispatch`,
        samples,
        await Promise.all(providers.map(readiness)),
      );
    }
    if (target === "sms") {
      const ready = await count("sms_devices", {
        status: "eq.online",
        disabled_at: "is.null",
        sms_permission_status: "eq.granted",
        last_seen_at: `gte.${recent}`,
      });
      // Devices and SIMs are checked separately; readiness alone is never delivery proof.
      const sims = await count("sms_device_sims", {
        is_active: "eq.true",
        is_verified_for_sending: "eq.true",
        last_seen_at: `gte.${recent}`,
      });
      const sample = await queue("sms_messages", {
        pending: "(pending,retry_wait)",
        success: "delivered",
      });
      if (!ready || !sims)
        return result(
          "degraded",
          `SMS readiness: ${ready} fresh permitted online devices, ${sims} fresh verified active SIMs. ${totals([sample])} No message was sent by this check.`,
        );
      return summarize(
        "SMS delivery",
        [sample],
        "Device readiness and recorded delivery receipts only; carrier reachability is not actively tested.",
      );
    }
    if (target === "jobs") {
      const samples = await Promise.all([
        queue("workspace_asset_webhook_deliveries", {
          time: "last_attempt_at",
        }),
        queue("planning_notification_outbox"),
      ]);
      return summarize(
        "Background dispatch",
        samples,
        "Evidence covers asset webhooks and planning outbox only; other scheduled jobs need separate telemetry.",
        false,
        true,
      );
    }
    if (target === "federation") {
      const sample = await queue("social_post_variants", {
        success: "published",
        pending: "(queued,retry_wait)",
      });
      return summarize(
        "Social publishing",
        [sample],
        "Evidence covers recorded provider publishing; federation inbox delivery is not tested.",
        false,
        true,
      );
    }
    if (target === "payments") {
      const [registration, shop] = await Promise.all([
        count("regos", {
          payment_status: "eq.confirmed",
          updated_at: `gte.${recent}`,
        }),
        count("event_shop_payments", {
          status: "eq.confirmed",
          updated_at: `gte.${recent}`,
        }),
      ]);
      // The platform has manual confirmation and reconciliation, not a configured
      // hosted payment-provider integration. Empty recent confirmations do not
      // make that internal workflow unavailable.
      return result(
        "operational",
        `Manual payment confirmation and reconciliation records are readable: ${registration} registrations, ${shop} shop payments confirmed in the last 15 minutes. No hosted external checkout provider is configured; that separate prelaunch capability is not inferred.`,
      );
    }
    const [active, seen, failed, projected] = await Promise.all([
      count("event_lan_sync_sessions", {
        status: "eq.active",
        expires_at: `gt.${date.toISOString()}`,
      }),
      count("event_lan_sync_sessions", {
        status: "eq.active",
        expires_at: `gt.${date.toISOString()}`,
        last_seen_at: `gte.${recent}`,
      }),
      count("event_lan_sync_operations", {
        projection_status: "in.(rejected,quarantined,conflict)",
        received_at: `gte.${recent}`,
      }),
      count("event_lan_sync_operations", {
        projection_status: "eq.projected",
        projected_at: `gte.${recent}`,
      }),
    ]);
    if (failed)
      return result(
        "degraded",
        "LAN synchronization recorded recent rejected, quarantined or conflicting operations; operator review is needed.",
      );
    if (active > seen)
      return result(
        "degraded",
        "An unexpired LAN session has no heartbeat in the last 15 minutes. Device connectivity needs review.",
      );
    if (seen && projected)
      return result(
        "operational",
        "Recent active LAN session heartbeats and successfully projected synchronization operations were observed. Local device functions are not exercised.",
      );
    if (!active)
      return result(
        "operational",
        `LAN telemetry is readable: 0 active unexpired sessions, ${projected} recent projected operations, ${failed} recent conflicts/rejections. No LAN session is currently active, so synchronization is idle and not being exercised.`,
      );
    return gap(
      `LAN telemetry: ${active} active unexpired sessions, ${seen} fresh heartbeats, ${projected} recent projected operations, ${failed} recent conflicts/rejections. An active session lacks the evidence needed to establish synchronization availability.`,
    );
  } catch (error) {
    return gap(
      error.message === "rate-limit"
        ? "Operational telemetry is rate limited by the database API."
        : "Operational telemetry is unavailable, denied, timed out or invalid.",
    );
  } finally {
    clearTimeout(timer);
  }
}
