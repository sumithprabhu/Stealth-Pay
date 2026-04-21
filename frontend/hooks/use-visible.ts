import { useState, useEffect, useRef } from "react";

export function useVisible<T extends HTMLElement = HTMLElement>(threshold = 0.1) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If already in (or near) the viewport on mount — e.g. on back-navigation — show immediately.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 80) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}
