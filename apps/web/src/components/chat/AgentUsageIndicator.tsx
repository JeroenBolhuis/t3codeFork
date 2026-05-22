import { ChevronDownIcon, GaugeIcon } from "lucide-react";
import type { AgentUsageSnapshot } from "~/lib/agentUsage";
import { formatUsagePercent } from "~/lib/agentUsage";
import { Button } from "../ui/button";
import { Menu, MenuGroup, MenuPopup, MenuSeparator as MenuDivider, MenuTrigger } from "../ui/menu";

function formatResetTime(value: string | null): string {
  if (!value) {
    return "Reset unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatWindowLine(window: NonNullable<AgentUsageSnapshot["primary"]>) {
  const duration =
    window.durationMins !== null
      ? window.durationMins >= 60 * 24
        ? `${Math.round(window.durationMins / (60 * 24))}d window`
        : `${Math.round(window.durationMins / 60)}h window`
      : "Window";
  return `${formatUsagePercent(window.usedPercent)} used - ${duration}`;
}

export function AgentUsageIndicator(props: { usage: AgentUsageSnapshot }) {
  const { usage } = props;
  const windows = [usage.primary, usage.secondary].filter(
    (window): window is NonNullable<typeof window> => window !== null,
  );
  const compactLabel =
    windows.length > 0
      ? windows.map((window) => formatUsagePercent(window.usedPercent)).join(" / ")
      : "-- / --";

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80 sm:px-3 [&_svg]:mx-0"
            aria-label={`${usage.label} usage ${compactLabel}`}
          />
        }
      >
        <GaugeIcon className="size-4" aria-hidden="true" />
        <span>{compactLabel}</span>
        <ChevronDownIcon aria-hidden="true" className="size-3 opacity-60" />
      </MenuTrigger>
      <MenuPopup align="start" className="w-72">
        <MenuGroup>
          <div className="px-2 pt-1.5 pb-1 font-medium text-muted-foreground text-xs">
            {usage.label} usage
          </div>
          {usage.source === "pending" ? (
            <div className="px-2 pb-2 text-muted-foreground/80 text-xs">
              Waiting for Codex rate limit data. It appears after a Codex session is ready.
            </div>
          ) : null}
        </MenuGroup>
        {windows.length > 0 ? <MenuDivider /> : null}
        {windows.map((window, index) => (
          <MenuGroup key={window.label}>
            {index > 0 ? <MenuDivider /> : null}
            <div className="px-2 py-1.5">
              <div className="flex min-h-7 items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{window.label}</span>
                <span className="text-muted-foreground">{formatWindowLine(window)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-muted-foreground transition-[width] duration-500"
                  style={{ width: `${window.usedPercent}%` }}
                />
              </div>
              <div className="pt-1 text-muted-foreground text-xs">
                Resets {formatResetTime(window.resetAt)}
              </div>
            </div>
          </MenuGroup>
        ))}
        {usage.limitName || usage.planType || usage.reachedType ? (
          <>
            <MenuDivider />
            <div className="px-2 py-1.5 text-muted-foreground text-xs">
              {[usage.limitName, usage.planType, usage.reachedType].filter(Boolean).join(" - ")}
            </div>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}
