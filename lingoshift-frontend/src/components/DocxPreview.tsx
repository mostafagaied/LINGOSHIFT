import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import "./DocxPreview.css";

interface DocxPreviewProps {
  file?: File;
  url?: string;
}

function DocxPreview({ file, url }: DocxPreviewProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!contentRef.current) return;
    let cancelled = false;

    const render = async () => {
      let buffer: ArrayBuffer;

      try {
        if (file) {
          buffer = await file.arrayBuffer();
        } else if (url) {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Failed to fetch DOCX file");
          buffer = await response.arrayBuffer();
        } else {
          return;
        }
      } catch (err) {
        console.error("DocxPreview: failed to load file", err);
        return;
      }

      if (cancelled || !contentRef.current) return;

      contentRef.current.innerHTML = "";
      contentRef.current.style.zoom = "1";

      try {
        await renderAsync(buffer, contentRef.current, undefined, {
          inWrapper: true,
        });
      } catch (err) {
        console.error("DocxPreview: renderAsync failed", err);
        return;
      }

      // Wait for layout to settle, then auto-fit width like the PDF viewer does
      requestAnimationFrame(() => {
        if (cancelled || !contentRef.current || !outerRef.current) return;

        const page = contentRef.current.querySelector("section") as HTMLElement | null;
        if (!page) return;

        const containerWidth = outerRef.current.clientWidth - 32; // account for padding
        const pageWidth = page.offsetWidth;

        if (pageWidth > 0) {
          const fitScale = Math.min(containerWidth / pageWidth, 1); // never zoom IN by default, only fit down
          setScale(fitScale);
        }
      });
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [file, url]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.zoom = String(scale);
    }
  }, [scale]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setScale((prev) => {
      const next = prev - e.deltaY * 0.001;
      return Math.min(Math.max(next, 0.3), 2.5);
    });
  };

  return (
    <div
      ref={outerRef}
      onWheel={handleWheel}
      className="w-full h-full overflow-auto bg-white rounded-lg p-4"
    >
      <div ref={contentRef} />
    </div>
  );
}

export default DocxPreview;