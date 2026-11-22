# Board compatibility — AppDockCompiler v4.3

AppDock is **one** app at https://anh-app-hub.vercel.app/firmware.
The administrator uploads sketch code, selects board profiles and publishes editable variables. Users modify **only approved variables**. Compiling runs remotely using GitHub Actions + Arduino CLI; browser uploads run only when a safe compatible protocol implementation exists.

## Compiling versus flashing

- **Compiled:** source can be built into a board-specific firmware artifact by Arduino CLI. Compilation does not prove a bootloader can accept uploads.
- **Browser upload:** USB/COM transport implemented in AppDock (AVR STK500v1, Mega STK500v2, supported ESP via esptool-js). Firmware is **never flashed without user confirmation**.
- **Download and external flashing:** Used for board families requiring other protocols. The app returns a verified artifact with `flash-manifest.json`. Do not use an unrelated board's binary.

## Non-ESP upload families

| Board family | Firmware | Upload method outside AppDock browser |
| --- | --- | --- |
| Leonardo, Micro | `.hex` | AVR109 / Caterina, serial port may change after 1200-baud reset |
| Nano Every, UNO WiFi Rev2 | `.hex` | JTAG2UPDI, via Arduino megaAVR upload tools |
| UNO R4 Minima/WiFi | `.bin` or `.hex` (core dependent) | DFU / Arduino core uploader; use appropriate bootloader mode |
| Nano 33 IoT, MKR WiFi 1010 | `.bin` | BOSSA/BOSSAC with SAMD bootloader |
| Nano 33 BLE | `.bin` / `.hex` (core dependent) | Arduino Mbed uploader, bootloader support varies |
| Nano RP2040 Connect | `.uf2` / `.bin` | Arduino Mbed uploader or compatible UF2 mode |
| Arduino Due (Programming/Native) | `.bin` | SAM-BA/BOSSAC, correct USB port and reset sequence |
| Raspberry Pi Pico/Pico W | `.uf2` | BOOTSEL then copy to RPI-RP2 USB drive |
| Raspberry Pi Pico 2/Pico 2 W | `.uf2` | BOOTSEL then copy to RP2350/RPI-RP2 USB drive |
| Arduino Nano ESP32 | `.bin` set inside ZIP | Arduino ESP32 core uploader; offset-specific, **not** automatically sent over Web Serial in AppDock |

For Pico boards, AppDock now provides a **direct UF2 download**. On unsupported browser-upload protocols, AppDock disables the USB Upload button and displays the appropriate procedure rather than attempting STK500.

## Actual smoke builds

GitHub Actions run [45040184143](https://github.com/hungle2006/AppDockCompiler/actions/runs/45040184143) completed successfully and uploaded artifacts for Leonardo, Nano Every, UNO R4 Minima, Pico 2 and Arduino Due (Programming Port). Other added boards have validated FQBN profiles but have **not** all had separate compiler or real-hardware tests.

## Implementation & safety

- Board targets and FQBNs are allowlisted in `boards/boards.json`.
- The packager checks expected binary types per family, creates `flash-manifest.json`, and rejects missing mandatory outputs.
- API verifies the requested board against the job and artifact metadata before serving direct UF2, HEX, or BIN.
- GitHub's Actions token stays in Vercel Production environment, never in the browser.
- Added board targets are **not automatically published** to every firmware application. The admin needs to select and publish the compatibility list for each program.
- Public repository source is visible to others; avoid embedding private keys, Wi-Fi passwords or commercial secrets in sketches.

## References

- Arduino CLI board/FQBN documentation: https://docs.arduino.cc/arduino-cli/commands-reference/arduino-cli_board_details
- Arduino Renesas core: https://github.com/arduino/ArduinoCore-renesas
- Arduino SAMD core: https://github.com/arduino/ArduinoCore-samd
- Arduino SAM/Due core: https://github.com/arduino/ArduinoCore-sam
- Pico / RP2350 Arduino core: https://github.com/earlephilhower/arduino-pico

