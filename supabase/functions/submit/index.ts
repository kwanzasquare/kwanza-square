// Kwanza Square — submit a finished match to the leaderboard.
//
// The one rule: nothing the client says about the outcome is believed. The
// request carries the whole game as a list of actions; this replays it with the
// same engine the game uses, and the result, the grade and the points are all
// worked out here. A forged or impossible game is refused and never stored.
//
// The anon key that ships inside the game cannot write to any table — that is
// enforced by RLS with no policies. This function holds the service role and is
// the only way in.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { KZ } from "./_engine.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HANDLE = /^[A-Za-z0-9_]{3,16}$/;

// Handles nobody should be able to claim.
const RESERVED = new Set([
  "admin", "administrator", "moderator", "mod", "root", "system", "support",
  "kwanza", "kwanzasquare", "official", "staff", "null", "undefined", "anonymous",
]);

const MAX_PER_HOUR = 40; // one device cannot flood the board

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "malformed request" }, 400);
  }

  const handle = String(body?.handle ?? "").trim();
  const deviceId = String(body?.deviceId ?? "").trim();

  if (!HANDLE.test(handle)) {
    return json({ error: "A name must be 3–16 letters, numbers or underscores." }, 400);
  }
  if (RESERVED.has(handle.toLowerCase())) {
    return json({ error: "That name is reserved. Please choose another." }, 400);
  }
  if (deviceId.length < 8 || deviceId.length > 64) {
    return json({ error: "bad device id" }, 400);
  }

  // ---- re-prove the game ------------------------------------------------
  const verdict = KZ.Verify.replay({
    level: body?.level,
    pawns: Number(body?.pawns),
    roundsToWin: Number(body?.roundsToWin),
    humanSide: body?.humanSide,
    actionLog: body?.actionLog,
  });

  if (!verdict.ok) {
    // Deliberately vague to the client, precise in the logs.
    console.warn("rejected submission:", verdict.reason, "handle:", handle);
    return json({ error: "That game could not be verified.", reason: verdict.reason }, 422);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ---- claim or confirm the handle --------------------------------------
  const { data: existing, error: lookupErr } = await db
    .from("players").select("id, device_id")
    .eq("handle_lower", handle.toLowerCase()).maybeSingle();

  if (lookupErr) {
    console.error("player lookup failed", lookupErr);
    return json({ error: "Could not reach the leaderboard. Try again shortly." }, 503);
  }

  let playerId: string;
  if (existing) {
    if (existing.device_id !== deviceId) {
      return json({ error: "That name is already taken. Please choose another." }, 409);
    }
    playerId = existing.id;
    await db.from("players").update({ seen_at: new Date().toISOString() }).eq("id", playerId);
  } else {
    const { data: created, error: insertErr } = await db
      .from("players").insert({ handle, device_id: deviceId }).select("id").single();
    if (insertErr) {
      // someone claimed it a moment ago
      if (insertErr.code === "23505") {
        return json({ error: "That name was just taken. Please choose another." }, 409);
      }
      console.error("player insert failed", insertErr);
      return json({ error: "Could not reach the leaderboard. Try again shortly." }, 503);
    }
    playerId = created.id;
  }

  // ---- rate limit per device --------------------------------------------
  const anHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db
    .from("matches").select("id", { count: "exact", head: true })
    .eq("player_id", playerId).gte("created_at", anHourAgo);
  if ((count ?? 0) >= MAX_PER_HOUR) {
    return json({ error: "That is a lot of games in an hour. Try again later." }, 429);
  }

  // ---- store it ----------------------------------------------------------
  const fingerprint = await sha256(
    [playerId, body.level, body.pawns, body.roundsToWin, (body.actionLog as string[]).join(",")].join("|"),
  );

  const { error: matchErr } = await db.from("matches").insert({
    player_id: playerId,
    level: body.level,
    pawns: Number(body.pawns),
    rounds_to_win: Number(body.roundsToWin),
    result: verdict.result,
    accuracy: verdict.accuracy,
    decisions: verdict.decisions,
    points: verdict.points,
    moves: body.actionLog,
    fingerprint,
  });

  if (matchErr && matchErr.code !== "23505") {
    console.error("match insert failed", matchErr);
    return json({ error: "Could not save that game. Try again shortly." }, 503);
  }
  const duplicate = matchErr?.code === "23505";

  // ---- where do they now stand? -----------------------------------------
  const { data: standing } = await db
    .rpc("my_standing", { p_handle: handle, p_level: body.level, p_period: "all" });

  return json({
    ok: true,
    duplicate,
    result: verdict.result,
    accuracy: verdict.accuracy,
    points: verdict.points,
    standing: standing?.[0] ?? null,
  });
});
