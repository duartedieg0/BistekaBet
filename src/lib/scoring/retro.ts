import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadRaioX } from "@/lib/scoring/raio-x";
import { COMPETITION } from "@/lib/bolao-config";
import {
  pickZebra,
  buildRetrospectiva,
  type ZebraCandidate,
  type Retrospectiva,
} from "./retro-core";

export type RetrospectivaView = Retrospectiva & {
  user: { displayName: string; avatarDataUrl: string | null };
};

async function toDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

type TeamEmbed = { code: string; name: string };

type ScoreRow = {
  points: number;
  tier: "exact" | "winner_or_draw" | "miss";
  matches:
    | { home_team: TeamEmbed | TeamEmbed[]; away_team: TeamEmbed | TeamEmbed[] }
    | Array<{ home_team: TeamEmbed | TeamEmbed[]; away_team: TeamEmbed | TeamEmbed[] }>;
};

// PostgREST may return embeds as a single object OR as an array of 1; normalize here.
const one = <X,>(v: X | X[]): X => (Array.isArray(v) ? v[0] : v);

export async function loadRetrospectiva(
  userId: string,
): Promise<RetrospectivaView> {
  const supabase = await createClient();

  const raioX = await loadRaioX(userId); // timeline + highlights + hasData

  const [profile, playersCount, predsCount, groupExactsCount, userScores] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", userId)
        .single(),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("predictions")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("prediction_scores")
        .select("prediction_id", { count: "exact", head: true })
        .eq("tier", "exact"),
      supabase
        .from("prediction_scores")
        .select(
          "points, tier, matches!inner(home_team:home_team_id(code,name), away_team:away_team_id(code,name))",
        )
        .eq("user_id", userId),
    ]);

  if (profile.error) throw profile.error;
  if (playersCount.error) throw playersCount.error;
  if (predsCount.error) throw predsCount.error;
  if (groupExactsCount.error) throw groupExactsCount.error;
  if (userScores.error) throw userScores.error;

  const rows = (userScores.data ?? []) as unknown as ScoreRow[];

  const predictionsScored = rows.length;
  const winnerOrDrawTotal = rows.filter((r) => r.tier !== "miss").length;
  // No current persona uses exactsKnockout as a trigger; pass 0.
  const exactsKnockout = 0;

  const zebraCandidates: ZebraCandidate[] = rows.map((r) => {
    const m = one(
      r.matches as
        | { home_team: TeamEmbed | TeamEmbed[]; away_team: TeamEmbed | TeamEmbed[] }
        | Array<{
            home_team: TeamEmbed | TeamEmbed[];
            away_team: TeamEmbed | TeamEmbed[];
          }>,
    );
    const home = one(m.home_team);
    const away = one(m.away_team);
    return {
      homeCode: home.code,
      awayCode: away.code,
      homeName: home.name,
      awayName: away.name,
      tier: r.tier,
      points: r.points,
    };
  });
  const zebra = pickZebra(zebraCandidates);

  const retro = buildRetrospectiva({
    highlights: raioX.highlights,
    timeline: raioX.timeline,
    exactsKnockout,
    winnerOrDrawTotal,
    predictionsScored,
    zebra,
    collective: {
      players: playersCount.count ?? 0,
      predictions: predsCount.count ?? 0,
      exacts: groupExactsCount.count ?? 0,
      matches: COMPETITION.totalMatches,
      days: raioX.timeline.length || 39,
    },
    hasData: raioX.hasData,
  });

  return {
    ...retro,
    user: {
      displayName: profile.data.display_name,
      avatarDataUrl: await toDataUrl(profile.data.avatar_url),
    },
  };
}
