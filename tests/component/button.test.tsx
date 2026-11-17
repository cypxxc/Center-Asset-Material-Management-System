import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from '../../components/ui/button';

test('Button renders children correctly', () => {
  render(React.createElement(Button, null, 'Click Me'));
  const btn = screen.getByRole('button');
  assert.equal(btn.textContent, 'Click Me');
});

test('Button supports disabled state', () => {
  render(React.createElement(Button, { disabled: true }, 'Disabled'));
  const btn = screen.getByRole('button');
  assert.equal(btn.hasAttribute('disabled'), true);
});

test('Button handles onClick callback', () => {
  let clicked = 0;
  render(React.createElement(Button, { onClick: () => { clicked++; } }, 'Click'));
  const btn = screen.getByRole('button');
  btn.click();
  assert.equal(clicked, 1);
});
