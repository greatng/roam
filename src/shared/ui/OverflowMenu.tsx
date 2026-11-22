import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { ActionIcon } from "../ActionIcon";

export type OverflowMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

/** Compact, keyboard-operable menu for record or itinerary actions. */
export function OverflowMenu({
  label,
  items,
  placement = "record",
  menuLabel,
}: {
  label: string;
  items: OverflowMenuItem[];
  placement?: "record" | "floating";
  menuLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const focusIndex = useRef(0);
  const close = (restore = false) => {
    setOpen(false);
    if (restore)
      root.current
        ?.querySelector<HTMLButtonElement>("[aria-haspopup='menu']")
        ?.focus();
  };
  // Focus before paint: a delayed opening effect could steal restored Escape focus.
  useLayoutEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    const menuItems =
      menu.current?.querySelectorAll<HTMLButtonElement>("button");
    menuItems?.[focusIndex.current]?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        focusIndex.current = event.key === "ArrowUp" ? items.length - 1 : 0;
        setOpen(true);
      }
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    const buttons = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      buttons[
        (index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) %
          buttons.length
      ]?.focus();
    }
    if (event.key === "Home") {
      event.preventDefault();
      buttons[0]?.focus();
    }
    if (event.key === "End") {
      event.preventDefault();
      buttons.at(-1)?.focus();
    }
  };
  const floating = placement === "floating";
  const panel = open && (
    <div
      class="overflow-panel"
      id={menuId}
      role="menu"
      aria-label={menuLabel ?? label}
      tabIndex={-1}
      ref={menu}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => (
        <Button
          type="button"
          appearance="tertiary"
          role="menuitem"
          class={`overflow-menu-item ${item.danger ? "danger" : ""}`}
          key={item.label}
          onClick={() => {
            close();
            item.onSelect();
          }}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
  return (
    <div
      class={floating ? "plan-organizer-actions" : "overflow-menu"}
      ref={root}
    >
      {floating && panel}
      <IconButton
        appearance={floating ? "primary" : "tertiary"}
        class={floating ? "itinerary-fab" : "overflow-trigger"}
        aria-label={label}
        title={floating ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onKeyDown={onKeyDown}
        onClick={() => {
          focusIndex.current = 0;
          setOpen(!open);
        }}
      >
        <ActionIcon kind={floating ? "edit" : "ellipsis"} />
      </IconButton>
      {!floating && panel}
    </div>
  );
}
