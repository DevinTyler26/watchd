"use client";

import { ReactNode, useEffect, useState } from "react";

type ModalShellProps = {
  onClose: () => void;
  children: (requestClose: () => void) => ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
};

export function ModalShell({
  onClose,
  children,
  overlayClassName = "bg-black/60",
  panelClassName = "",
}: ModalShellProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const requestClose = () => {
    setIsVisible(false);
    window.setTimeout(() => onClose(), 220);
  };

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center px-6 py-8 transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      } ${overlayClassName}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        className={`transition-transform duration-200 ${
          isVisible ? "translate-y-0" : "translate-y-3"
        } ${panelClassName}`}
      >
        {children(requestClose)}
      </div>
    </div>
  );
}
