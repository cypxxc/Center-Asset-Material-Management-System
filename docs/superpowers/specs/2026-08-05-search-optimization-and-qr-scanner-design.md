# Search Optimization & Mobile QR/Barcode Scanner Design

## Overview
Enhance search performance with React 19 `useTransition` & debouncing, and add a mobile-friendly camera QR/Barcode scanner modal for item exploration and stock verification in CAMMS.

## Problem Statement
1. **Search Responsiveness**: Real-time typing in `SearchInput` currently triggers immediate parent state re-renders, causing input stutter on complex pages with large lists.
2. **Stock Audit Experience**: Field staff inspecting physical assets/materials must manually type serial numbers or asset tags into search boxes, which is slow and error-prone on mobile devices.

## Design Details

### 1. Search Input Optimization (`components/ui/search-input.tsx`)
- Enhance `SearchInput` with React 19 `useTransition` and a default `debounceMs={300}`.
- Keep `localValue` state updated synchronously on every keypress for instant typing feedback (0ms latency).
- Wrap external `onChange` trigger in `startTransition` so list filtering re-renders do not block typing.
- Display `Loader2` indicator when transition or debounce is pending.

### 2. Camera QR & Barcode Scanner (`components/ui/qr-scanner-modal.tsx`)
- Reusable modal component providing live camera streaming using HTML5 MediaDevices API (`facingMode: 'environment'`).
- Support automatic Barcode/QR Code detection using native `BarcodeDetector` API (with fallback frame scanning).
- Play synthesized audio beep (Web Audio API `AudioContext` 1000Hz tone) upon successful scan.
- Add camera permission error handling and fallback simulation controls for desktop testing.

### 3. Header & Explorer Toolbar Integration
- Add a "Scan QR / Barcode" button alongside `SearchInput` in `items-explorer-client.tsx` and header search controls.
- When scanned, populate search box with the detected text (Serial No / Asset No / UUID) and trigger filtered results instantly.

## Testing Plan
- Unit test `SearchInput` debounce and transition behavior.
- Unit test `QrScannerModal` rendering and open/close state transitions.
- Run full test suite (`npm test`) and typecheck (`npm run typecheck`).
