// Shared board catalog for AppDock UI, curated against Arduino CLI platform cores.
export const BOARDS=[
  {
    "id": "uno",
    "label": "Arduino Uno R3",
    "family": "Arduino AVR",
    "upload": "avr"
  },
  {
    "id": "nano",
    "label": "Arduino Nano (mới)",
    "family": "Arduino AVR",
    "upload": "avr"
  },
  {
    "id": "nano_old",
    "label": "Arduino Nano (bootloader cũ)",
    "family": "Arduino AVR",
    "upload": "avr"
  },
  {
    "id": "rf_nano",
    "label": "RF-Nano (mới)",
    "family": "Arduino AVR",
    "upload": "avr"
  },
  {
    "id": "rf_nano_old",
    "label": "RF-Nano (bootloader cũ)",
    "family": "Arduino AVR",
    "upload": "avr"
  },
  {
    "id": "mega",
    "label": "Arduino Mega 2560",
    "family": "Arduino AVR",
    "upload": "stk500v2"
  },
  {
    "id": "leonardo",
    "label": "Arduino Leonardo",
    "family": "Arduino AVR",
    "upload": "download"
  },
  {
    "id": "micro",
    "label": "Arduino Micro",
    "family": "Arduino AVR",
    "upload": "download"
  },
  {
    "id": "pro_mini",
    "label": "Arduino Pro Mini 5V / 16 MHz",
    "family": "Arduino AVR",
    "upload": "download"
  },
  {
    "id": "nano_every",
    "label": "Arduino Nano Every",
    "family": "Arduino megaAVR",
    "upload": "download"
  },
  {
    "id": "uno_wifi_rev2",
    "label": "Arduino Uno WiFi Rev2",
    "family": "Arduino megaAVR",
    "upload": "download"
  },
  {
    "id": "uno_r4_minima",
    "label": "Arduino UNO R4 Minima",
    "family": "Arduino Renesas",
    "upload": "download"
  },
  {
    "id": "uno_r4_wifi",
    "label": "Arduino UNO R4 WiFi",
    "family": "Arduino Renesas",
    "upload": "download"
  },
  {
    "id": "nano_33_iot",
    "label": "Arduino Nano 33 IoT",
    "family": "Arduino SAMD",
    "upload": "download"
  },
  {
    "id": "mkr_wifi_1010",
    "label": "Arduino MKR WiFi 1010",
    "family": "Arduino SAMD",
    "upload": "download"
  },
  {
    "id": "nano_33_ble",
    "label": "Arduino Nano 33 BLE",
    "family": "Arduino Mbed",
    "upload": "download"
  },
  {
    "id": "nano_rp2040",
    "label": "Arduino Nano RP2040 Connect",
    "family": "Arduino Mbed",
    "upload": "download"
  },
  {
    "id": "esp32",
    "label": "ESP32 DevKit / WROOM",
    "family": "Espressif ESP32",
    "upload": "esptool"
  },
  {
    "id": "esp32_s2",
    "label": "ESP32-S2 DevKit",
    "family": "Espressif ESP32",
    "upload": "esptool"
  },
  {
    "id": "esp32_s3",
    "label": "ESP32-S3 DevKit",
    "family": "Espressif ESP32",
    "upload": "esptool"
  },
  {
    "id": "esp32_c3",
    "label": "ESP32-C3 SuperMini / DevKit",
    "family": "Espressif ESP32",
    "upload": "esptool"
  },
  {
    "id": "esp32_c6",
    "label": "ESP32-C6 DevKit",
    "family": "Espressif ESP32",
    "upload": "esptool"
  },
  {
    "id": "esp8266",
    "label": "ESP8266 NodeMCU",
    "family": "Espressif ESP8266",
    "upload": "esptool"
  },
  {
    "id": "d1_mini",
    "label": "LOLIN D1 mini / ESP8266",
    "family": "Espressif ESP8266",
    "upload": "esptool"
  },
  {
    "id": "pico",
    "label": "Raspberry Pi Pico",
    "family": "Raspberry Pi RP2040",
    "upload": "download"
  },
  {
    "id": "pico_w",
    "label": "Raspberry Pi Pico W",
    "family": "Raspberry Pi RP2040",
    "upload": "download"
  }
];
export const boardNames=Object.fromEntries(BOARDS.map(x=>[x.id,x.label]));
export const bootloader={uno:115200,nano:115200,nano_old:57600,rf_nano:115200,rf_nano_old:57600};
