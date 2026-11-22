# AppDockCompiler
GitHub Actions firmware compiler used by **AppDock > Nạp firmware** (not a separate user-facing application).

**Roles:** The AppDock administrator publishes vetted Arduino programs and specifies exactly which parameters are editable. End users select a board and adjust only allowed values such as GPIO, device name, network address, or timing. They cannot edit source files.

**Workflow:** AppDock API validates the published manifest and user settings, dispatches this repository's GitHub Actions workflow with project ID, board, and base64 JSON configuration; Actions generates a `generated_config.h`, compiles with Arduino CLI, and publishes a downloadable firmware artifact.

The AppDock API requires a server-side GitHub token with Actions read/write and Contents read/write permission for this repository. **Never put the token in frontend code.** Use the existing AppDock Google admin session to authorize publishing and rate-limit public builds. This repository is public: do not publish secrets inside Arduino sketches.

Firmware is available for Arduino Uno, Nano new/old bootloader, compatible RF-Nano, Mega, Leonardo, ESP32 DevKit, and ESP8266 NodeMCU. Browser uploading is limited to supported bootloaders and must be verified on real hardware.

Source control for frontend integration belongs in `web/` and `api/`; AppDock production remains `https://anh-app-hub.vercel.app/`.
