import { useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';
import sheets from './noise-sheets.json';

// Baked noise for the paper and ink styles. The static feTurbulence patterns are rendered once
// into public/noise/ (see tools/bake-noise.mjs) and read back with feImage or image, because
// recomputing feTurbulence for every filtered element on every frame made these styles several
// times slower to render. Each sheet is in the local coordinates of the element that carries
// the filter, so the baked noise lands where the live noise did.
export type SheetName = keyof typeof sheets;

export const sheet = (name: SheetName) => {
  const s = sheets[name];
  return { x: s.x, y: s.y, w: s.w, h: s.h, href: staticFile(`noise/${s.file}`) };
};

const held: HTMLImageElement[] = [];
const loaded = new Set<SheetName>();

const load = (name: SheetName) =>
  new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Keep the decoded image alive so later feImage and image elements hit the cache.
      held.push(img);
      loaded.add(name);
      resolve();
    };
    img.onerror = () => reject(new Error(`noise sheet ${name} failed to load`));
    img.src = sheet(name).href;
  });

// Holds the frame until the sheets are in the image cache, so no frame paints without its noise.
export const useNoise = (names: readonly SheetName[]) => {
  useState(() => {
    const todo = names.filter((n) => !loaded.has(n));
    if (todo.length === 0) return null;
    // The sheets are several MB each; give a busy or cold machine time before Remotion gives up.
    const handle = delayRender(`noise ${todo.join(', ')}`, { timeoutInMilliseconds: 180000 });
    Promise.all(todo.map(load)).then(
      () => continueRender(handle),
      (e) => {
        console.error(e);
        continueRender(handle);
      },
    );
    return handle;
  });
};

// Drop into an svg to hold the frame until the named sheets are loaded.
export const NoiseHold = ({ names }: { names: readonly SheetName[] }) => {
  useNoise(names);
  return null;
};
