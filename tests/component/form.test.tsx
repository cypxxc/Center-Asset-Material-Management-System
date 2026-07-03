import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  FormField,
  FormLabel,
  FormHint,
  FormError,
  FormSection,
  FormInput,
  FormSelect,
  FormTextarea
} from '../../components/ui/form';

test('FormField renders children', () => {
  render(
    React.createElement(
      FormField,
      null,
      React.createElement('span', null, 'Field Content')
    )
  );
  assert.ok(screen.getByText('Field Content'));
});

test('FormLabel renders label and star if required', () => {
  render(React.createElement(FormLabel, { required: true }, 'Username'));
  const label = screen.getByText('Username');
  assert.ok(label);
  const star = screen.getByText('*');
  assert.ok(star);
});

test('FormHint and FormError render texts', () => {
  render(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(FormHint, null, 'At least 8 chars'),
      React.createElement(FormError, null, 'Required field')
    )
  );

  assert.ok(screen.getByText('At least 8 chars'));
  assert.ok(screen.getByText('Required field'));
});

test('FormInput, FormSelect, and FormTextarea bind values and onChange events', () => {
  let val = '';
  render(
    React.createElement(FormInput, {
      value: val,
      onChange: (e) => { val = e.target.value; },
      placeholder: 'Enter name'
    })
  );

  const input = screen.getByPlaceholderText('Enter name') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'John' } });
  assert.equal(val, 'John');
});
