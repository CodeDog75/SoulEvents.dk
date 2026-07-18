"use client";

import { createContext, type MouseEvent, type ReactNode, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionMenuContextValue = {
  closeMenu: () => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
};

const ActionMenuContext = createContext<ActionMenuContextValue | null>(null);

type MenuPlacement = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

function useActionMenuContext() {
  const context = useContext(ActionMenuContext);
  if (!context) {
    throw new Error("AdminActionMenu must be used inside AdminActionMenuProvider.");
  }
  return context;
}

function menuPlacement(button: HTMLButtonElement, menuWidth: number) {
  const buttonRect = button.getBoundingClientRect();
  const padding = 16;
  const offset = 8;
  const availableBelow = window.innerHeight - buttonRect.bottom - padding - offset;
  const availableAbove = buttonRect.top - padding - offset;
  const opensUp = availableBelow < 360 && availableAbove > availableBelow;
  const availableHeight = Math.max(opensUp ? availableAbove : availableBelow, 160);
  const maxHeight = Math.max(160, Math.min(availableHeight, window.innerHeight - padding * 2));
  const left = Math.min(Math.max(padding, buttonRect.right - menuWidth), window.innerWidth - menuWidth - padding);
  const preferredTop = opensUp ? buttonRect.top - maxHeight - offset : buttonRect.bottom + offset;
  const top = Math.min(Math.max(padding, preferredTop), window.innerHeight - maxHeight - padding);

  return {
    left,
    maxHeight,
    top,
    width: menuWidth,
  };
}

export function AdminActionMenuProvider({ children }: { children: ReactNode }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <ActionMenuContext.Provider value={{ closeMenu: () => setOpenMenuId(null), openMenuId, setOpenMenuId }}>
      {children}
    </ActionMenuContext.Provider>
  );
}

export function AdminActionMenuScope({
  children,
}: {
  children: ReactNode;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <ActionMenuContext.Provider value={{ closeMenu: () => setOpenMenuId(null), openMenuId, setOpenMenuId }}>
      {children}
    </ActionMenuContext.Provider>
  );
}

export function AdminActionMenu({
  children,
  id,
  label = "Flere",
}: {
  children: ReactNode;
  id: string;
  label?: string;
}) {
  const { closeMenu, openMenuId, setOpenMenuId } = useActionMenuContext();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const isOpen = openMenuId === id;
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePlacement = () => setPlacement(menuPlacement(buttonRef.current!, Math.min(340, window.innerWidth - 32)));
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu();
      buttonRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMenu, isOpen]);

  function toggleMenu() {
    if (isOpen) {
      closeMenuWithFocus();
      return;
    }

    setOpenMenuId(id);
  }

  function closeMenuWithFocus() {
    closeMenu();
    buttonRef.current?.focus();
  }

  function closeFromMenu() {
    window.requestAnimationFrame(() => {
      closeMenu();
      buttonRef.current?.focus();
    });
  }

  function handleMenuClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const action = target.closest("a, button");
    if (!action) return;

    if (action instanceof HTMLButtonElement && action.type === "button") {
      return;
    }

    closeFromMenu();
  }

  return (
    <>
      <button
        aria-controls={isOpen ? labelId : undefined}
        aria-expanded={isOpen}
        className="inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
        onClick={toggleMenu}
        ref={buttonRef}
        type="button"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
        {label}
      </button>

      {isOpen && placement
        ? createPortal(
            <div className="fixed inset-0 z-[80]" onClick={closeMenuWithFocus}>
              <div
                className={cn(
                  "fixed grid gap-4 overflow-y-auto rounded-[20px] border border-midnight/10 bg-white p-4 shadow-lift outline-none",
                  "overscroll-contain",
                )}
                id={labelId}
                onClick={(event) => event.stopPropagation()}
                ref={menuRef}
                role="menu"
                style={{
                  left: placement.left,
                  maxHeight: placement.maxHeight,
                  top: placement.top,
                  width: placement.width,
                }}
              >
                <div onClickCapture={handleMenuClick}>{children}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
