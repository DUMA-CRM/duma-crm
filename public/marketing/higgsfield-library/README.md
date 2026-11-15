# DUMA Higgsfield marketing library

Status: incomplete — 18 of 153 planned assets saved (4 videos and 14 photos). No generations are currently running. Repeated HTTP 429 rate-limit responses prevented bulk submission; the remainder is recorded in manifest.json, not queued remotely.

Scope: 51 main marketing pages and features; one video and two photos per page. Individual blog articles, glossary definitions, API endpoint reference pages and legal pages excluded.

## Contents

- `pages/`: home, overview, pricing and other general pages
- `solutions/`: audience pages
- `features/`: each of the 25 features
- `compare/`: comparison pages
- `tools/`: calculator and rota tools
- `developers/`: API, MCP and webhooks

Each folder has `brief.json`. Completed media uses `hero.png`, `detail.png`, `scene.mp4` and `promo.mp4`. Empty media sets are planned, not complete.

## Brand treatment

Videos preserve the full generated scene and append a three-second animated end card using the actual DUMA logo and Archivo fonts. No logo or text overlays on footage. `scene.mp4` is the original; `promo.mp4` is the branded version. The 720p source is not artificially upscaled. Photos are generated at the model’s 2K setting with no generated branding or interface.

## References

Briefs use local marketing source and the feature registry. Public site fetches were blocked; remote CMS feature content could not be retrieved. Feature coverage therefore follows all 25 registered features, not verified CMS publication status.

## Completed files

- [pages/home/promo.mp4](pages/home/promo.mp4)
- [pages/home/hero.png](pages/home/hero.png)
- [pages/home/detail.png](pages/home/detail.png)
- [pages/features/promo.mp4](pages/features/promo.mp4)
- [pages/features/hero.png](pages/features/hero.png)
- [pages/features/detail.png](pages/features/detail.png)
- [pages/pricing/hero.png](pages/pricing/hero.png)
- [pages/pricing/detail.png](pages/pricing/detail.png)
- [solutions/cafes/hero.png](solutions/cafes/hero.png)
- [features/pos/promo.mp4](features/pos/promo.mp4)
- [features/pos/hero.png](features/pos/hero.png)
- [features/pos/detail.png](features/pos/detail.png)
- [features/orders/promo.mp4](features/orders/promo.mp4)
- [features/orders/hero.png](features/orders/hero.png)
- [features/orders/detail.png](features/orders/detail.png)
- [features/qr-ordering/hero.png](features/qr-ordering/hero.png)
- [features/qr-ordering/detail.png](features/qr-ordering/detail.png)
- [features/kitchen-display/hero.png](features/kitchen-display/hero.png)

## Resume safely

Read manifest.json first. Never resubmit a job with a job_id without checking its state. Every submitted job in this batch completed and was downloaded. Keep use_unlim=true; no credit-funded fallback is authorised. Use sequential submissions, since concurrent requests returned rate_limit_reached. Existing folders and briefs cover the remaining 135 assets.
