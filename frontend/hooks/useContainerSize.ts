'use client';

import { useEffect, useRef, useState } from 'react';

export type ContainerSize = { width: number; height: number };

export function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (width: number, height: number) => {
      if (width > 0 && height > 0) setSize({ width, height });
    };

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      update(width, height);
    });
    ro.observe(el);
    update(el.clientWidth, el.clientHeight);

    return () => ro.disconnect();
  }, []);

  return { ref, size, ready: size.width > 0 && size.height > 0 };
}
