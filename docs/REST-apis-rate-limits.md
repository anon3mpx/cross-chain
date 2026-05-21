Outside `PartnerAPI`, the non-partner APIs are rate-limited in [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:173):

- There is a global limiter applied with `app.use(...)` at [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:227).
- Default global limit is `120` requests per `60s`, configurable via `VPS_RATE_LIMIT_WINDOW_MS` and `VPS_RATE_LIMIT_MAX` at [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:228).
- It keys by client IP / `x-forwarded-for` at [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:148).
- It returns `429` plus `RateLimit-*` and `Retry-After` headers at [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:186).

There is also a stricter quote-specific limiter:
- `quoteRateLimit` is defined at [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:233).
- Default is `20` requests per `60s`.
- It is attached to `/quote` and the LayerZero quote-discovery endpoints at [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:245), [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:304), and [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:313).

What is not specially quote-limited:
- `/quote/select` and the intent/refund/cancel/status routes only get the global limiter, not the stricter quote limiter, because they don’t attach `quoteRateLimit` directly. Example: [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:271).
- `/admin/*` should also inherit the global limiter, because the app-level middleware is installed before the admin router is mounted in [api.ts](/Users/ganadhish/code/work/ruflo/src/vps/app/api.ts:18).

The limiter store can be in-memory or Redis-backed:
- Selector is at [StatusAPI.ts](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:156).