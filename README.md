# AppDockCompiler — Firmware Center & Admin Arduino IDE

[AppDock firmware task](https://anh-app-hub.vercel.app/firmware) · [GitHub Actions](https://github.com/hungle2006/AppDockCompiler/actions)

This is **not a separate user-facing app**. It powers the existing **Nạp firmware** task within AppDock.

## Admin vs public users

- **Admin (Google owner session)**: create/edit Arduino `.ino` sketches, syntax-highlighting editor, indent, Ctrl+S local draft, Ctrl+Enter Verify, board manager with 26 targets, Library Manager, build console, artifact download, STK500v1 upload for supported AVR boards, and Serial Monitor over Web Serial. Publishing code and selecting user-editable fields is admin-only.
- **User**: select one of the admin-published programs, select an authorized board, edit only fields explicitly allowed by its manifest, compile using GitHub Actions and download/upload firmware where the bootloader is supported. Public UI never accepts arbitrary C++ code.

### Board targets

All **26** targets are in [`boards/boards.json`](boards/boards.json), shared with Python preparation and the browser board manager. Families: Arduino AVR, megaAVR, Renesas UNO R4, SAMD, Mbed, ESP32, ESP8266, RP2040 Pico/Pico W. Each target includes the selected Arduino CLI FQBN and core index URL where required.

**Compile ≠ Browser USB flashing.** Web Serial flashing currently implements only STK500v1 for Uno / Nano / compatible RF-Nano. Mega, Leonardo, Arduino UNO R4, ESP32/8266, RP2040 and other targets have compile + downloadable artifacts, but require appropriate programming protocols/tools before direct browser upload can be claimed. Upload confirmation is always required.

### Admin Verify workflow

The **Verify** button does not publish a sketch. The Vercel API authenticates the AppDock admin session, commits a draft only on the isolated GitHub branch `appdock-preview`, dispatches Arduino CLI using that revision, and links the resulting 7-day firmware artifact to the administrator's browser session. Public `compile` always uses published source from `main`; it cannot select the preview branch or submit code.

Admin libraries are specified by exact Arduino Library Manager names (max 16). They are installed inside the selected GitHub runner before compilation; do not include secrets in sketches or library names.

### Environment variables

Set in **the main AppDock Vercel project** (`anh-app-hub`):

- `GITHUB_ACTIONS_TOKEN` — fine-grained GitHub access token, scoped to `hungle2006/AppDockCompiler` with Actions and Contents Read/Write permissions. **Required** for publishing, verifying and requesting builds; do not put token in browser JavaScript or ChatGPT.
- `DATABASE_URL` — the existing AppDock Neon database; used to associate build records to browser sessions and rate-limit builds.
- `SESSION_SECRET` — existing AppDock session secret.
- Optional `COMPILER_REPO` — defaults to `hungle2006/AppDockCompiler`.

The original AppDock authentication and database APIs are kept intact. The service asks the AppDock admin session endpoint to enforce the owner role. Token contents must never be logged or committed to Git.

### Paths in this repository

- [`boards/boards.json`](boards/boards.json): board IDs, labels, packages, FQBNs and core URLs.
- [`.github/workflows/compile.yml`](.github/workflows/compile.yml): Arduino CLI worker; Ubuntu runner.
- [`scripts/prepare.py`](scripts/prepare.py): config validation and generated C++ header.
- [`api/firmware.js`](api/firmware.js): Vercel API (admin authorize, publish, verify, build, poll, download).
- [`web/firmware.html`](web/firmware.html), [`web/firmware.js`](web/firmware.js), [`web/firmware-ide.js`](web/firmware-ide.js): UI components.

### Testing & limitations

Local static tests cover 26 board mappings, admin controls, Verify request payloads, guest isolation, and responsive width 320–1440px. GitHub Actions must complete smoke compilation after changes are pushed. End-to-end web compilation depends on a valid `GITHUB_ACTIONS_TOKEN`; real USB flashing depends on a compatible Chrome/Edge desktop browser, USB permission and physical bootloader.
