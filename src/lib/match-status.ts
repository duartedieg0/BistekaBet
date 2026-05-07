import type { Match, MatchStatus } from "@/lib/types/match";

export function deriveMatchStatus(match: Pick<Match, "status" | "kickoff_at" | "home_score">): MatchStatus {
  if (match.status) return match.status;
  if (match.home_score !== null) return "finished";
  if (new Date(match.kickoff_at).getTime() > Date.now()) return "scheduled";
  return "live";
}
