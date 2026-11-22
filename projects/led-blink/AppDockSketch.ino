#include "generated_config.h"
void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println(DEVICE_NAME);
}
void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(BLINK_INTERVAL);
  digitalWrite(LED_PIN, LOW);
  delay(BLINK_INTERVAL);
}
