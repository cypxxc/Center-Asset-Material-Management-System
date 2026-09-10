# Performance investigation and results

## Evidence and scope
The previously inspected Vercel production seven-day desktop view showed RES 55 with 42 events. Dashboard (12 events) and items (4) scored 55, login scored 98 and DB panel 100. Detailed LCP/INP/CLS/TTFB were unavailable on the current plan. This is not a before/after field experiment and does not isolate the current deployment. The authenticated production dashboard was accessible during review.

## Changes
- The global creation provider no longer loads or mounts the item form at initial render. A user click or the existing `new=true` URL loads it, with loading status and retryable error feedback. The loaded sheet remains mounted, retaining existing close and draft semantics.
- Removed the global Google Material Symbols CSS import; replaced the only settings error icon with existing Lucide SVG.

## Comparable build measurements
Same workspace/toolchain, baseline existing production build versus new production build, using scripts/check-bundle-budget.ts:

| Bundle | Before KB | After KB |
| --- | ---: | ---: |
| Dashboard route raw | 132.18 | 88.54 |
| Dashboard route gzip | 42.67 | 29.66 |
| Shared runtime raw | 436.21 | 436.23 |
| Shared runtime gzip | 128.12 | 128.14 |

Route-specific raw JS decreased 33.0%; gzip decreased 30.5%. These are build asset measures, not total page bytes or a predicted RES improvement. Shared runtime is effectively unchanged.

## Review of all approved areas
- JavaScript/interaction: confirmed eager form import and mount removed; optional asset tag UI already uses dynamic loading. Main-thread timing still requires a browser trace.
- CSS/fonts: removed confirmed external CSS import. No new font dependency added.
- Server wait/cache: layout authenticates before awaiting sidebar/reference data. Those requests run concurrently and use existing caches; item data/count queries also run concurrently. Parent-layout wait remains a potential cold-cache cost, not a measured root cause. Authorization was preserved.
- Images: table thumbnails use 48x48 attributes; grid thumbnails occupy fixed 64x64 boxes. Lazy loading and async decode are present. Signed URLs are not transformed by the public-image helper, so original image transfer sizes remain a measurement target. No unsigned URL substitution or storage changes.
- Layout stability: dashboard uses Suspense skeletons and a dynamically loaded chart; fallback geometry differs from final content in places. No CLS trace was available to establish impact, so no arbitrary heights were imposed.
- Field/device/deployment: inspect fresh deployment traffic separately at desktop/mobile P75. Targets: LCP <=2.5s, INP <=200ms, CLS <=0.1. Do not infer these values from the aggregate score.

## Verification and limits
Provider regression covers no initial dialog, asynchronous open, close/reopen and query parameter synchronization. Production build, lint and typecheck pass. Local production browser smoke on isolated port 3005 passes its unauthenticated redirect test; authenticated staging smoke is skipped because its explicit credentials are not configured. An initial attempt on occupied port 3000 was invalid and replaced by the isolated-server run.

Full test suite passed: 113 files, 464 tests, zero failures (exit 0).

No database operations were performed. A production browser session does not automatically supply credentials to the isolated local test runner. Authenticated local E2E and post-deployment real-user metric comparison remain unverified; no claim that RES 55 is resolved.

Sources: https://vercel.com/docs/speed-insights/metrics ; https://nextjs.org/docs/app/guides/lazy-loading ; https://vercel.com/docs/conformance/rules/NO_EXTERNAL_CSS_AT_IMPORTS
