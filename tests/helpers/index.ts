import React from 'react';
import { render as rtlRender, type RenderOptions as TestingLibraryRenderOptions } from '@testing-library/react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { mockSupabaseRegistry } from '../mocks/supabase';

export interface RenderOptions {
  route?: string;
  pathname?: string;
  query?: Record<string, string>;
  router?: Partial<AppRouterInstance>;
}

export function mockRouter(overrides: Partial<AppRouterInstance> = {}): AppRouterInstance {
  return {
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    ...overrides,
  };
}

export function mockSupabase() {
  mockSupabaseRegistry.clear();
  return mockSupabaseRegistry;
}

export function renderWithProviders(ui: React.ReactElement, options: RenderOptions = {}) {
  const routerVal = mockRouter(options.router);

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(
      AppRouterContext.Provider,
      { value: routerVal },
      children
    );
  };

  return {
    ...rtlRender(ui, { wrapper, ...options } as TestingLibraryRenderOptions),
    router: routerVal,
  };
}
