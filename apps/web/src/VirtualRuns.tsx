import { useI18n } from "./i18n.js";
import { useRef, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Run } from "orcabot-contracts";
import { RunCard } from "./RunCard.js";

export function VirtualRuns({
  runs,
  scroll,
  onDone,
}: {
  runs: Run[];
  scroll: RefObject<HTMLDivElement | null>;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: runs.length,
    getScrollElement: () => scroll.current,
    getItemKey: (index) => runs[index].id,
    estimateSize: () => 500,
    overscan: 3,
    scrollMargin:
      container.current && scroll.current
        ? container.current.getBoundingClientRect().top -
          scroll.current.getBoundingClientRect().top +
          scroll.current.scrollTop
        : 0,
    enabled: runs.length > 8,
  });
  if (runs.length <= 8)
    return (
      <>
        {runs.map((run) => (
          <RunCard key={run.id} initial={run} onDone={onDone} />
        ))}
      </>
    );
  return (
    <div
      ref={container}
      style={{ height: virtual.getTotalSize(), position: "relative" }}
      aria-label={t("Conversation runs")}
    >
      {virtual.getVirtualItems().map((item) => (
        <div
          key={item.key}
          ref={virtual.measureElement}
          data-index={item.index}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${item.start - virtual.options.scrollMargin}px)`,
          }}
        >
          <RunCard initial={runs[item.index]} onDone={onDone} />
        </div>
      ))}
    </div>
  );
}
