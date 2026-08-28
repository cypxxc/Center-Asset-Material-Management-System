import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../components/ui/toast';

let routerPushCalls = 0;
let historyReplaceCalls: string[] = [];
let currentPathname = '/items';
let currentSearchParams = new URLSearchParams();

const nextNavigationPath = require.resolve('next/navigation');
const nextNavigation = require.cache[nextNavigationPath]?.exports as {
  useRouter: () => { push: () => void; refresh: () => void };
  usePathname: () => string;
  useSearchParams: () => URLSearchParams;
};

nextNavigation.useRouter = () => ({
  push: () => { routerPushCalls += 1; },
  refresh: () => {},
});
nextNavigation.usePathname = () => currentPathname;
nextNavigation.useSearchParams = () => currentSearchParams;

let NewItemDialogProvider: typeof import('../../features/items/components/new-item-dialog-provider').NewItemDialogProvider;
let NewItemDialogTrigger: typeof import('../../features/items/components/new-item-dialog-provider').NewItemDialogTrigger;

function mockDialogMethods() {
  const htmlDialogProto = window.HTMLDialogElement?.prototype as HTMLDialogElement | undefined;
  if (htmlDialogProto) {
    htmlDialogProto.showModal = function showModal() { this.open = true; };
    htmlDialogProto.close = function close() { this.open = false; };
  }
}

function mockSearchParams(search: string) {
  currentSearchParams = new URLSearchParams(search);
}

function renderProvider(children: React.ReactNode, synchronizeRouter = false) {
  if (synchronizeRouter) {
    return render(
      <ToastProvider>
        <RouterSynchronizedProvider>{children}</RouterSynchronizedProvider>
      </ToastProvider>,
    );
  }

  return render(
    <ToastProvider>
      <NewItemDialogProvider categories={[]} locations={[]} units={[]}>
        {children}
      </NewItemDialogProvider>
    </ToastProvider>,
  );
}

function RouterSynchronizedProvider({ children }: { children: React.ReactNode }) {
  const [, rerender] = React.useState(0);
  React.useLayoutEffect(() => {
    const synchronize = () => rerender((version) => version + 1);
    window.addEventListener('next-search-params-synchronized', synchronize);

    return () => window.removeEventListener('next-search-params-synchronized', synchronize);
  }, []);

  return (
    <NewItemDialogProvider categories={[]} locations={[]} units={[]}>
      {children}
    </NewItemDialogProvider>
  );
}

test.beforeEach(() => {
  mockDialogMethods();
  routerPushCalls = 0;
  historyReplaceCalls = [];
  currentPathname = '/items';
  mockSearchParams('');
  window.history.replaceState = ((_state: unknown, _unused: string, url?: string | URL | null) => {
    historyReplaceCalls.push(String(url));
  }) as History['replaceState'];
});

test.before(async () => {
  ({ NewItemDialogProvider, NewItemDialogTrigger } = await import('../../features/items/components/new-item-dialog-provider'));
});

test('NewItemDialogTrigger opens the creation sheet without navigation', () => {
  renderProvider(<NewItemDialogTrigger>ขึ้นทะเบียนใหม่</NewItemDialogTrigger>);

  fireEvent.click(screen.getByRole('button', { name: 'ขึ้นทะเบียนใหม่' }));

  assert.ok(screen.getByRole('dialog'));
  assert.equal(routerPushCalls, 0);
});

test('provider opens after Next synchronizes search params from a compatibility URL', async () => {
  mockSearchParams('type=asset&new=true');
  window.history.replaceState = ((_state: unknown, _unused: string, url?: string | URL | null) => {
    historyReplaceCalls.push(String(url));
    mockSearchParams('type=asset');
    queueMicrotask(() => window.dispatchEvent(new window.Event('next-search-params-synchronized')));
  }) as History['replaceState'];

  renderProvider('Page', true);

  await waitFor(() => assert.ok(screen.getByRole('dialog')));
  assert.equal(historyReplaceCalls.at(-1), '/items?type=asset');
});
