import { JSDOM } from 'jsdom';
import { afterEach } from 'node:test';

// 1. Manually configure JSDOM primitives first
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});

// Directly assign to global for window and document
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
});

// Use defineProperty with enumerable: true for navigator to avoid read-only collisions
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
  enumerable: true,
});

// HTML Elements
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLButtonElement = dom.window.HTMLButtonElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.HTMLFormElement = dom.window.HTMLFormElement;
global.SVGElement = dom.window.SVGElement;

// Mock Observers
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
} as unknown as typeof IntersectionObserver;

// Mock matchMedia
global.window.matchMedia = global.window.matchMedia || function() {
  return {
    matches: false,
    media: '',
    onchange: null,
    addListener: function() {},
    removeListener: function() {},
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return false; },
  };
};

// Mock requestAnimationFrame / cancelAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Mock Focus APIs
if (!global.window.HTMLElement.prototype.focus) {
  global.window.HTMLElement.prototype.focus = function() {};
}
if (!global.window.HTMLElement.prototype.blur) {
  global.window.HTMLElement.prototype.blur = function() {};
}

// Mock Selection APIs
global.document.getSelection = () => dom.window.getSelection();

// 2. Intercept and mock `server-only`
try {
  const serverOnlyPath = require.resolve('server-only');
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as unknown as NodeJS.Module;
} catch {
  // Ignored
}

// 3. Intercept and mock `next/cache`
try {
  const nextCachePath = require.resolve('next/cache');
  require.cache[nextCachePath] = {
    id: nextCachePath,
    filename: nextCachePath,
    loaded: true,
    exports: {
      unstable_cache: <T>(fn: T) => fn,
      revalidateTag: () => {},
      revalidatePath: () => {},
    },
  } as unknown as NodeJS.Module;
} catch {
  // Ignored
}

// 4. Intercept and mock `next/navigation` redirect throwing behavior
try {
  const nextNavPath = require.resolve('next/navigation');
  const mockRedirect = (url: string) => {
    const error = new Error('NEXT_REDIRECT') as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  };
  
  // Save custom router functions for JSDOM use
  require.cache[nextNavPath] = {
    id: nextNavPath,
    filename: nextNavPath,
    loaded: true,
    exports: {
      redirect: mockRedirect,
      useRouter: () => ({
        push: () => {},
        replace: () => {},
        prefetch: () => {},
        back: () => {},
        forward: () => {},
        refresh: () => {},
      }),
      usePathname: () => '/',
      useSearchParams: () => new URLSearchParams(),
    },
  } as unknown as NodeJS.Module;
} catch {
  // Ignored
}

// 5. Safely defer cleanup hook to avoid importing React Testing Library early
try {
  afterEach(async () => {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  });
} catch {
  // Ignored if executed outside of a test runner lifecycle
}
