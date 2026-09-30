import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from '@testing-library/react';
import ItemDetailLoading from '../../app/(dashboard)/items/[id]/loading';
import ItemEditLoading from '../../app/(dashboard)/items/[id]/edit/loading';
import LocationsLoading from '../../app/(dashboard)/locations/loading';
import ProfileLoading from '../../app/(dashboard)/profile/loading';
import AuditLogsLoading from '../../app/(dashboard)/admin/audit-logs/loading';
import UsersLoading from '../../app/(dashboard)/admin/users/loading';
import DBPanelLoading from '../../app/(dashboard)/admin/db-panel/loading';

test('ItemDetailLoading renders skeleton with pulse animations', () => {
  const { container } = render(React.createElement(ItemDetailLoading));
  const pulseElements = container.querySelectorAll('.animate-pulse');
  assert.ok(pulseElements.length > 0, 'ItemDetailLoading should render elements with animate-pulse');
});

test('ItemEditLoading renders skeleton with pulse animations', () => {
  const { container } = render(React.createElement(ItemEditLoading));
  const pulseElements = container.querySelectorAll('.animate-pulse');
  assert.ok(pulseElements.length > 0, 'ItemEditLoading should render elements with animate-pulse');
});

test('LocationsLoading renders skeleton with pulse animations', () => {
  const { container } = render(React.createElement(LocationsLoading));
  const pulseElements = container.querySelectorAll('.animate-pulse');
  assert.ok(pulseElements.length > 0, 'LocationsLoading should render elements with animate-pulse');
});

test('ProfileLoading renders skeleton with pulse animations', () => {
  const { container } = render(React.createElement(ProfileLoading));
  const pulseElements = container.querySelectorAll('.animate-pulse');
  assert.ok(pulseElements.length > 0, 'ProfileLoading should render elements with animate-pulse');
});

test('AuditLogsLoading renders skeleton with pulse animations', () => {
  const { container } = render(React.createElement(AuditLogsLoading));
  const pulseElements = container.querySelectorAll('.animate-pulse');
  assert.ok(pulseElements.length > 0, 'AuditLogsLoading should render elements with animate-pulse');
});

test('UsersLoading renders skeleton with pulse animations', () => {
  const { container } = render(React.createElement(UsersLoading));
  const pulseElements = container.querySelectorAll('.animate-pulse');
  assert.ok(pulseElements.length > 0, 'UsersLoading should render elements with animate-pulse');
});

test('DBPanelLoading renders skeleton with pulse animations', () => {
  const { container } = render(React.createElement(DBPanelLoading));
  const pulseElements = container.querySelectorAll('.animate-pulse');
  assert.ok(pulseElements.length > 0, 'DBPanelLoading should render elements with animate-pulse');
});
