import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormattedNumberInput } from '../../components/ui/formatted-number-input';

test('FormattedNumberInput initializes with formatted defaultValue', () => {
  render(
    React.createElement(FormattedNumberInput, {
      id: 'qty',
      name: 'quantity',
      defaultValue: 10000,
      allowDecimals: false,
    })
  );

  const input = screen.getByRole('textbox') as HTMLInputElement;
  assert.equal(input.value, '10,000');

  const container = input.parentElement || document.body;
  const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
  assert.ok(hiddenInput);
  assert.equal(hiddenInput.name, 'quantity');
  assert.equal(hiddenInput.value, '10000');
});

test('FormattedNumberInput formats integer input in real-time', () => {
  render(
    React.createElement(FormattedNumberInput, {
      id: 'qty',
      name: 'quantity',
      allowDecimals: false,
    })
  );

  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '1234567' } });

  assert.equal(input.value, '1,234,567');

  const container = input.parentElement || document.body;
  const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
  assert.equal(hiddenInput.value, '1234567');
});

test('FormattedNumberInput formats decimal input when allowDecimals is true', () => {
  render(
    React.createElement(FormattedNumberInput, {
      id: 'price',
      name: 'unit_price',
      allowDecimals: true,
      defaultValue: '12500.5',
    })
  );

  const input = screen.getByRole('textbox') as HTMLInputElement;
  assert.equal(input.value, '12,500.5');

  fireEvent.change(input, { target: { value: '12500.50' } });
  assert.equal(input.value, '12,500.50');

  const container = input.parentElement || document.body;
  const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
  assert.equal(hiddenInput.value, '12500.50');
});

test('FormattedNumberInput filters out invalid characters', () => {
  render(
    React.createElement(FormattedNumberInput, {
      id: 'qty',
      name: 'quantity',
      allowDecimals: false,
    })
  );

  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '1,000abc' } });

  assert.equal(input.value, '1,000');
});
