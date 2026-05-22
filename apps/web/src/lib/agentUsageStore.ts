import type { ProviderInstanceId } from "@t3tools/contracts";
import { create } from "zustand";

import type { AgentUsageSnapshot } from "./agentUsage";

const USAGE_REFRESH_STALE_MS = 30_000;

type UsageRequestState = {
  readonly inFlight: boolean;
  readonly lastStartedAt: number;
  readonly lastFinishedAt: number;
  readonly error: string | null;
};

type AgentUsageStore = {
  readonly usageByInstanceId: Readonly<Record<string, AgentUsageSnapshot | undefined>>;
  readonly requestByInstanceId: Readonly<Record<string, UsageRequestState | undefined>>;
  readonly shouldFetch: (instanceId: ProviderInstanceId, now?: number) => boolean;
  readonly markFetchStarted: (instanceId: ProviderInstanceId, now?: number) => void;
  readonly markFetchFinished: (
    instanceId: ProviderInstanceId,
    snapshot: AgentUsageSnapshot | null,
    error?: string | null,
    now?: number,
  ) => void;
  readonly updateUsage: (instanceId: ProviderInstanceId, snapshot: AgentUsageSnapshot) => void;
};

const emptyRequestState: UsageRequestState = {
  inFlight: false,
  lastStartedAt: 0,
  lastFinishedAt: 0,
  error: null,
};

export const useAgentUsageStore = create<AgentUsageStore>((set, get) => ({
  usageByInstanceId: {},
  requestByInstanceId: {},
  shouldFetch: (instanceId, now = Date.now()) => {
    const request = get().requestByInstanceId[instanceId] ?? emptyRequestState;
    if (request.inFlight) {
      return false;
    }
    return now - request.lastFinishedAt > USAGE_REFRESH_STALE_MS;
  },
  markFetchStarted: (instanceId, now = Date.now()) =>
    set((state) => ({
      requestByInstanceId: {
        ...state.requestByInstanceId,
        [instanceId]: {
          ...(state.requestByInstanceId[instanceId] ?? emptyRequestState),
          inFlight: true,
          lastStartedAt: now,
          error: null,
        },
      },
    })),
  markFetchFinished: (instanceId, snapshot, error = null, now = Date.now()) =>
    set((state) => ({
      usageByInstanceId: snapshot
        ? {
            ...state.usageByInstanceId,
            [instanceId]: snapshot,
          }
        : state.usageByInstanceId,
      requestByInstanceId: {
        ...state.requestByInstanceId,
        [instanceId]: {
          ...(state.requestByInstanceId[instanceId] ?? emptyRequestState),
          inFlight: false,
          lastFinishedAt: now,
          error,
        },
      },
    })),
  updateUsage: (instanceId, snapshot) =>
    set((state) => ({
      usageByInstanceId: {
        ...state.usageByInstanceId,
        [instanceId]: snapshot,
      },
    })),
}));
