import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ZoomableImage } from '../../components/ui/zoomable-image';
import { ItemForm } from '../../features/items/components/item-form';
import { getTransformedImageUrl } from '../../lib/supabase/image';

const mockPublicUrl = 'http://localhost/storage/v1/object/public/item-images/test.jpg';
const mockTransformedUrl = getTransformedImageUrl(mockPublicUrl);
const mockZoomTransformedUrl = getTransformedImageUrl(mockPublicUrl, { width: 1200 });

test('ZoomableImage initially renders transformed image URL', () => {
  render(React.createElement(ZoomableImage, { src: mockPublicUrl, alt: 'Test Item' }));
  const img = screen.getByAltText('Test Item') as HTMLImageElement;
  assert.equal(img.src, mockTransformedUrl);
});

test('ZoomableImage falls back to raw original src on Error 1', () => {
  render(React.createElement(ZoomableImage, { src: mockPublicUrl, alt: 'Test Item' }));
  const img = screen.getByAltText('Test Item') as HTMLImageElement;

  // Trigger error on transformed URL
  fireEvent.error(img);

  assert.equal(img.src, mockPublicUrl);
});

test('ZoomableImage falls back to placeholder UI on Error 2', () => {
  render(React.createElement(ZoomableImage, { src: mockPublicUrl, alt: 'Test Item' }));
  const img = screen.getByAltText('Test Item') as HTMLImageElement;

  // Trigger error 1: transformed -> raw
  fireEvent.error(img);
  assert.equal(img.src, mockPublicUrl);

  // Trigger error 2: raw -> failed UI
  fireEvent.error(img);

  // Image tag should no longer be present, placeholder UI shown
  assert.equal(screen.queryByAltText('Test Item'), null);
  assert.ok(screen.getByText('ไม่สามารถโหลดรูปภาพได้'));
});

test('ZoomableImage overlay image handles fallback on error', () => {
  render(React.createElement(ZoomableImage, { src: mockPublicUrl, alt: 'Test Item' }));
  const btn = screen.getByRole('button');
  fireEvent.click(btn);

  // Modal is open, there are two images with alt 'Test Item'
  const imgs = screen.getAllByAltText('Test Item') as HTMLImageElement[];
  assert.equal(imgs.length, 2);
  const zoomImg = imgs[1];
  assert.equal(zoomImg.src, mockZoomTransformedUrl);

  // Trigger error 1 on zoom image
  fireEvent.error(zoomImg);
  assert.equal(zoomImg.src, mockPublicUrl);

  // Trigger error 2 on zoom image
  fireEvent.error(zoomImg);
  assert.ok(screen.getByText('ไม่สามารถโหลดรูปภาพได้'));
});

test('ItemForm image preview falls back from transformed URL to original URL on error', () => {
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
  assert.equal(previewImg.src, mockTransformedUrl);

  // Trigger error 1: falls back to raw public URL
  fireEvent.error(previewImg);
  assert.equal(previewImg.src, mockPublicUrl);

  // Trigger error 2: falls back to placeholder UI
  fireEvent.error(previewImg);
  assert.equal(screen.queryByAltText('Item preview'), null);
  assert.ok(screen.getByText('ไม่สามารถโหลดรูปภาพได้'));
});
