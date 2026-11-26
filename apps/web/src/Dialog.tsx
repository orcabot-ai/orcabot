import { useRef, type ReactNode } from "react";
import { Dialog as Primitive } from "@base-ui/react/dialog";

export function Dialog({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  return (
    <Primitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Primitive.Portal>
        <Primitive.Backdrop className="modal-scrim" />
        <Primitive.Viewport className="modal-backdrop">
          <Primitive.Popup
            ref={panel}
            className={`setup-panel ${className}`}
            aria-label={title}
            initialFocus={(type) =>
              type === "touch"
                ? panel.current
                : (panel.current?.querySelector<HTMLElement>(
                    'input:not([type="hidden"]), textarea, [role="combobox"]',
                  ) ?? true)
            }
          >
            {children}
          </Primitive.Popup>
        </Primitive.Viewport>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
