import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from '../../components/ui/search-input';

test('SearchInput renders and updates local value', () => {
  let value = 'test';
  const onChange = (v: string) => { value = v; };
  render(React.createElement(SearchInput, {
    value,
    onChange
  }));

  const input = screen.getByPlaceholderText('ค้นหารายการ') as HTMLInputElement;
  assert.equal(input.value, 'test');

  fireEvent.change(input, { target: { value: 'new query' } });
  assert.equal(input.value, 'new query');
  assert.equal(value, 'new query');
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

test('SearchInput handles Escape key to clear value', () => {
  let value = 'escapeme';
  render(React.createElement(SearchInput, {
    value,
    onChange: (v) => { value = v; }
  }));

  const input = screen.getByPlaceholderText('ค้นหารายการ');
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  assert.equal(value, '');
});
