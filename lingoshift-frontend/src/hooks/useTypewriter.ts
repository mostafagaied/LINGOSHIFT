import { useEffect, useState, useRef } from "react";

function useTypewriter(fullText: string, speedMs: number = 40) {
  const [displayedText, setDisplayedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!fullText) {
      setDisplayedText("");
      setIsStreaming(false);
      return;
    }

    const words = fullText.split(" ");
    let index = 0;
    setDisplayedText("");
    setIsStreaming(true);

    const typeNext = () => {
      index++;
      setDisplayedText(words.slice(0, index).join(" "));

      if (index < words.length) {
        timeoutRef.current = setTimeout(typeNext, speedMs);
      } else {
        setIsStreaming(false);
      }
    };

    timeoutRef.current = setTimeout(typeNext, speedMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fullText, speedMs]);

  return { displayedText, isStreaming };
}

export default useTypewriter;