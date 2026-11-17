import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ZoomableImage } from '../../components/ui/zoomable-image';
import { ItemForm } from '../../features/items/components/item-form';

const mockPublicUrl = '/api/files/items/test.jpg';

test('ZoomableImage initially renders image URL', () => {
  render(React.createElement(ZoomableImage, { src: mockPublicUrl, alt: 'Test Item' }));
  const img = screen.getByAltText('Test Item') as HTMLImageElement;
  assert.equal(img.src, 'http://localhost/api/files/items/test.jpg');
});

test('ZoomableImage falls back to placeholder UI on error', () => {
  render(React.createElement(ZoomableImage, { src: mockPublicUrl, alt: 'Test Item' }));
  const img = screen.getByAltText('Test Item') as HTMLImageElement;

  fireEvent.error(img);

  assert.equal(screen.queryByAltText('Test Item'), null);
  assert.ok(screen.getByText('ไม่สามารถโหลดรูปภาพได้'));
});

test('ZoomableImage overlay image handles fallback on error', () => {
  render(React.createElement(ZoomableImage, { src: mockPublicUrl, alt: 'Test Item' }));
  const btn = screen.getByRole('button');
  fireEvent.click(btn);

  const imgs = screen.getAllByAltText('Test Item') as HTMLImageElement[];
  assert.equal(imgs.length, 2);
  const zoomImg = imgs[1];
  assert.equal(zoomImg.src, 'http://localhost/api/files/items/test.jpg');

  fireEvent.error(zoomImg);
  assert.ok(screen.getByText('ไม่สามารถโหลดรูปภาพได้'));
});

test('ItemForm image preview falls back to placeholder UI on error', () => {
  render(
    React.createElement(ItemForm, {
      action: async () => ({ success: true }),
      categories: [],
      locations: [],
      units: [],
      item: {
        id: '1',
        item_name: 'Test Item',
        item_type: 'asset',
        quantity: 1,
        unit_price: null,
        asset_no: null,
        serial_no: null,
        responsible_person: null,
        status: 'active',
        category: null,
        unit: null,
        location: null,
        brand: null,
        model: null,
        note: null,
        image_url: mockPublicUrl,
        created_at: '',
        updated_at: '',
      },
    })
  );

  const previewImg = screen.getByAltText('Item preview') as HTMLImageElement;
  assert.equal(previewImg.src, 'http://localhost/api/files/items/test.jpg');

  fireEvent.error(previewImg);
  assert.equal(screen.queryByAltText('Item preview'), null);
  assert.ok(screen.getByText('ไม่สามารถโหลดรูปภาพได้'));
});
