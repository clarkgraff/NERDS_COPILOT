NERDS ROUTE SWARM — diagnostic harness prototype (15 October 2026)

PURPOSE
This script runs isolated headless route calculations against NERDS source and its installed geographic masks. It does not alter project files or settings. It catches route exceptions, subprocess crashes, timeouts, failure to account for legs, nondeterministic outcomes and direction asymmetry.

INSTALL INTO THE LOCAL SOURCE REPOSITORY
1. The script is stored at tools/route-swarm.cjs on this branch.
2. Run PowerShell in the repository's complete local development source (including the geographic masks).
3. Run: node tools/route-swarm.cjs --samples 2 --timeout 30000
4. See timestamped JSON results in test-results/route-swarm/.

CAUTIONS
- Requires a locally installed compatible Node version and complete assets/land-mask.bin and europe-mask.bin.
- Built against the reviewed v0.3.0 state/plan API. Adapt if v0.3.1 changes the API.
- The NERDS_COPILOT implementation may expose different interfaces; adapt the worker before running if needed.
- Unresolved routes remain unresolved, not passes. A calculated route is not proof of physical navigability.
- Geography is representative fixture coordinates and should be augmented with exact GeoNames records, access overrides and acceptance cases.
- Each test uses a separate process.
- No UI interactions are included. Add Playwright/Electron tests for UI, state persistence, and upgrade flows separately.
- Large grid searches can consume RAM and CPU. Use --samples 1 / --timeout 15000 for shorter trials.
- Copying this file does not execute it. Run it explicitly.
- Prototype status: Not yet run against v0.3.1 or NERDS_COPILOT; no test results are implied.

BRANCH POLICY
This prototype is published on route-swarm-prototype in both clarkgraff/NERDS_CODEX and clarkgraff/NERDS_COPILOT. Neither main branch is modified. Codex's ongoing Stage 1 work is unaffected.
