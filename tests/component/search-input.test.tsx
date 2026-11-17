import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchInput } from '../../components/ui/search-input';

test('SearchInput renders and updates local value immediately, deferring onChange with default 300ms debounce', async () => {
  let value = 'initial';
  let callCount = 0;
  const onChange = (v: string) => {
    value = v;
    callCount++;
  };

  render(React.createElement(SearchInput, {
    value,
    onChange
  }));

  const input = screen.getByPlaceholderText('ค้นหารายการ') as HTMLInputElement;
  assert.equal(input.value, 'initial');

  // Fast typing: update local state immediately
  fireEvent.change(input, { target: { value: 'new query' } });
  
  // Instantaneous local feedback
  assert.equal(input.value, 'new query');
  // External callback should NOT have fired immediately due to 300ms debounce
  assert.equal(callCount, 0);

  // Wait for debounce timer to resolve
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });

  assert.equal(callCount, 1);
  assert.equal(value, 'new query');
});

test('SearchInput with debounceMs=0 calls onChange immediately', async () => {
  let value = 'test';
  const onChange = (v: string) => { value = v; };
  render(React.createElement(SearchInput, {
    value,
    onChange,
    debounceMs: 0
  }));

  const input = screen.getByPlaceholderText('ค้นหารายการ') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'fast query' } });

  assert.equal(input.value, 'fast query');
  assert.equal(value, 'fast query');
});

test('SearchInput displays loader indicator when isLoading is true', () => {
  render(React.createElement(SearchInput, {
    value: 'query',
    onChange: () => {},
    isLoading: true
  }));

  // Should not show clear button when loading
  assert.equal(screen.queryByRole('button'), null);
});

test('SearchInput triggers onClear and empties value when X button is clicked', () => {
  let value = 'query';
  let cleared = false;
  render(React.createElement(SearchInput, {
    value,
    onChange: (v) => { value = v; },
    onClear: () => { cleared = true; }
  }));

  const clearBtn = screen.getByRole('button');
  assert.ok(clearBtn);
  fireEvent.click(clearBtn);

  assert.equal(value, '');
  assert.equal(cleared, true);
});

test('SearchInput handles Escape key to clear value immediately', () => {
  let value = 'escapeme';
  render(React.createElement(SearchInput, {
    value,
    onChange: (v) => { value = v; }
  }));

  const input = screen.getByPlaceholderText('ค้นหารายการ');
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  assert.equal(value, '');
});

test('SearchInput handles Enter key to submit value immediately', async () => {
  let value = 'initial';
  let callCount = 0;
  const onChange = (v: string) => {
    value = v;
    callCount++;
  };

  render(React.createElement(SearchInput, {
    value,
    onChange,
    debounceMs: 500
  }));

  const input = screen.getByPlaceholderText('ค้นหารายการ') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'enter query' } });
  assert.equal(callCount, 0);

  // Press Enter to submit immediately
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
  assert.equal(value, 'enter query');
  assert.equal(callCount, 1);
});
