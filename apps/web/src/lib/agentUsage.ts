import type {
  OrchestrationThreadActivity,
  ProviderDriverKind,
  ProviderInstanceId,
} from "@t3tools/contracts";

type UsageWindow = {
  readonly label: string;
  readonly usedPercent: number;
  readonly resetAt: string | null;
  readonly durationMins: number | null;
};

export type AgentUsageSnapshot = {
  readonly provider: ProviderDriverKind;
  readonly providerInstanceId: ProviderInstanceId | null;
  readonly label: string;
  readonly primary: UsageWindow | null;
  readonly secondary: UsageWindow | null;
  readonly planType: string | null;
  readonly limitName: string | null;
  readonly reachedType: string | null;
  readonly updatedAt: string;
  readonly source: "rate-limits" | "pending";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeResetAt(value: unknown): string | null {
  const numeric = asFiniteNumber(value);
  if (numeric === null || numeric <= 0) {
    return null;
  }
  const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeWindow(
  label: string,
  value: unknown,
  fallbackDurationMins: number | null = null,
): UsageWindow | null {
  const record = asRecord(value);
  const usedPercent = asFiniteNumber(record?.usedPercent);
  if (usedPercent === null) {
    return null;
  }
  return {
    label,
    usedPercent: Math.max(0, Math.min(100, usedPercent)),
    resetAt: normalizeResetAt(record?.resetsAt),
    durationMins: asFiniteNumber(record?.windowDurationMins) ?? fallbackDurationMins,
  };
}

function pickCodexSnapshot(rateLimits: unknown): Record<string, unknown> | null {
  const root = asRecord(rateLimits);
  const byLimitId = asRecord(root?.rateLimitsByLimitId);
  const codexById = asRecord(byLimitId?.codex);
  if (codexById) {
    return codexById;
  }

  const direct = asRecord(root?.rateLimits);
  if (direct && (direct.primary !== undefined || direct.secondary !== undefined)) {
    return direct;
  }

  if (root && (root.primary !== undefined || root.secondary !== undefined)) {
    return root;
  }
  return null;
}

export function deriveLatestAgentUsageSnapshot(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
  provider: ProviderDriverKind,
): AgentUsageSnapshot | null {
  if (provider !== "codex") {
    return null;
  }

  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const activity = activities[index];
    if (!activity || activity.kind !== "agent-usage.updated") {
      continue;
    }

    const payload = asRecord(activity.payload);
    if (payload?.provider !== provider) {
      continue;
    }

    const rateLimitSnapshot = pickCodexSnapshot(payload.rateLimits);
    if (!rateLimitSnapshot) {
      continue;
    }

    return deriveAgentUsageSnapshotFromRateLimits({
      provider,
      updatedAt: activity.createdAt,
      providerInstanceId: asString(payload.providerInstanceId) as ProviderInstanceId | null,
      rateLimits: rateLimitSnapshot,
    });
  }

  return null;
}

export function deriveAgentUsageSnapshotFromRateLimits(input: {
  readonly provider: ProviderDriverKind;
  readonly providerInstanceId?: ProviderInstanceId | null;
  readonly rateLimits: unknown;
  readonly updatedAt: string;
}): AgentUsageSnapshot | null {
  if (input.provider !== "codex") {
    return null;
  }

  const rateLimitSnapshot = pickCodexSnapshot(input.rateLimits);
  if (!rateLimitSnapshot) {
    return null;
  }

  return {
    provider: input.provider,
    providerInstanceId: input.providerInstanceId ?? null,
    label: "Codex",
    primary: normalizeWindow("Session", rateLimitSnapshot.primary),
    secondary: normalizeWindow("Weekly", rateLimitSnapshot.secondary),
    planType: asString(rateLimitSnapshot.planType),
    limitName: asString(rateLimitSnapshot.limitName),
    reachedType: asString(rateLimitSnapshot.rateLimitReachedType),
    updatedAt: input.updatedAt,
    source: "rate-limits",
  };
}

export function makePendingAgentUsageSnapshot(
  provider: ProviderDriverKind,
  providerInstanceId: ProviderInstanceId | null,
): AgentUsageSnapshot | null {
  if (provider !== "codex") {
    return null;
  }

  return {
    provider,
    providerInstanceId,
    label: "Codex",
    primary: null,
    secondary: null,
    planType: null,
    limitName: null,
    reachedType: null,
    updatedAt: new Date(0).toISOString(),
    source: "pending",
  };
}

export function formatUsagePercent(value: number): string {
  return value < 10 ? `${value.toFixed(1).replace(/\.0$/, "")}%` : `${Math.round(value)}%`;
}
