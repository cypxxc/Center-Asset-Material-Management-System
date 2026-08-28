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

function renderProvider(children: React.ReactNode) {
  return render(
    <ToastProvider>
      <NewItemDialogProvider categories={[]} locations={[]} units={[]}>
        {children}
      </NewItemDialogProvider>
    </ToastProvider>,
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

test('provider removes only new=true from a compatibility URL', async () => {
  mockSearchParams('type=asset&new=true');

  renderProvider('Page');

  await waitFor(() => assert.ok(screen.getByRole('dialog')));
  assert.equal(historyReplaceCalls.at(-1), '/items?type=asset');
});
