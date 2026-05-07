// src/app/(authenticated)/_components/avatar-fallback.tsx
export function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
