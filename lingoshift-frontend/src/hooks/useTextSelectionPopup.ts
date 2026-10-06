import { useEffect, useState, useRef } from "react";

interface SelectionPopupState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}

function useTextSelectionPopup(containerRef: React.RefObject<HTMLElement>) {
  const [popup, setPopup] = useState<SelectionPopupState>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (!text || !selection || selection.rangeCount === 0) {
        setPopup((p) => ({ ...p, visible: false }));
        return;
      }

      // Only show the popup if the selection is inside our container
      const range = selection.getRangeAt(0);
      if (containerRef.current && !containerRef.current.contains(range.commonAncestorContainer)) {
        setPopup((p) => ({ ...p, visible: false }));
        return;
      }

      const rect = range.getBoundingClientRect();
      setPopup({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top,
        text,
      });
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [containerRef]);

  const closePopup = () => setPopup((p) => ({ ...p, visible: false }));

  return { popup, closePopup };
}

export default useTextSelectionPopup;