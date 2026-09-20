# Third-party notices

This notice records the direct packages and model artifacts present in the checked-in dependency/manifest snapshot on 2026-09-20. It is not a substitute for the complete transitive-license inventory in `package-lock.json` and installed package manifests. Operators distributing a modified build should regenerate and review that inventory.

## Direct runtime dependencies

| Component | Version | Declared license |
| --- | ---: | --- |
| `@tanstack/react-query` | 5.103.1 | MIT |
| `hono` | 4.13.8 | MIT |
| `i18next` | 26.4.2 | MIT |
| `onnxruntime-web` | 1.30.0 | MIT |
| `react` | 19.3.0 | MIT |
| `react-dom` | 19.3.0 | MIT |
| `react-i18next` | 17.0.14 | MIT |
| `react-router-dom` | 7.18.4 | MIT |
| `zod` | 4.6.5 | MIT |

## Direct build and test dependencies

| Component | Version | Declared license |
| --- | ---: | --- |
| `@cloudflare/vite-plugin` | 1.56.0 | MIT |
| `@cloudflare/workers-types` | 5.20260920.1 | MIT OR Apache-2.0 |
| `@eslint/js` | 10.0.1 | MIT |
| `@types/node` | 24.10.0 | MIT |
| `@types/react` | 19.3.0 | MIT |
| `@types/react-dom` | 19.3.0 | MIT |
| `@vitejs/plugin-react` | 6.1.1 | MIT |
| `eslint` | 10.11.0 | MIT |
| `eslint-plugin-react-hooks` | 7.1.1 | MIT |
| `eslint-plugin-react-refresh` | 0.5.7 | MIT |
| `globals` | 17.12.0 | MIT |
| `jsdom` | 28.1.0 | MIT |
| `typescript` | 6.0.2 | Apache-2.0 |
| `typescript-eslint` | 8.70.0 | MIT |
| `vite` | 8.3.0 | MIT |
| `vitest` | 5.0.1 | MIT |
| `wrangler` | 4.135.0 | MIT OR Apache-2.0 |

## Model artifacts

The optional facial-search model manifest pins these upstream artifacts. They are not bundled by default; they are downloaded and verified before an operator-authorized upload.

| Model | Version | Declared license | Source |
| --- | --- | --- | --- |
| YuNet face detection | 2023mar | MIT | OpenCV Zoo URL in `scripts/models/manifest.json` |
| SFace recognition embedding | 2021dec | Apache-2.0 | OpenCV Zoo URL in `scripts/models/manifest.json` |

Respect the full license texts, notices, source terms, and any distribution obligations in each upstream package/artifact. This file does not grant additional rights or replace upstream notices.
