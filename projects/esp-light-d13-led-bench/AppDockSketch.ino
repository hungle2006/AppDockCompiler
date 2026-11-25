// ESP32 LED-only bench demonstration. Disconnect relay wiring and isolate mains.
// No relay GPIO output, no Wi-Fi, no production Firestore writes.
#include <Arduino.h>
constexpr int SENSOR_DIGITAL=32, RESET_BUTTON=13, LED_RED=2, LED_GREEN=4;
constexpr uint32_t NORMAL_MS=2000, DEBOUNCE_MS=40;
bool simulatedAlarm=true, normalTracking=false, buttonRaw=false, buttonStable=false, armed=false;
uint32_t normalSince=0, buttonEdgeAt=0, lastPrint=0;
void showStatus(){
  Serial.printf("D32=%d D13=%d | SIMULATED=%s | RED=%d GREEN=%d | RELAY NOT CONTROLLED\n",
    digitalRead(SENSOR_DIGITAL),digitalRead(RESET_BUTTON),simulatedAlarm?"ALARM":"NORMAL",
    simulatedAlarm,!simulatedAlarm);
}
void setup(){
  Serial.begin(115200);
  pinMode(SENSOR_DIGITAL,INPUT_PULLUP);
  pinMode(RESET_BUTTON,INPUT_PULLUP);
  digitalWrite(LED_RED,LOW);digitalWrite(LED_GREEN,LOW);
  pinMode(LED_RED,OUTPUT);pinMode(LED_GREEN,OUTPUT);
  simulatedAlarm=digitalRead(SENSOR_DIGITAL)==LOW;
  buttonRaw=buttonStable=digitalRead(RESET_BUTTON)==LOW;
  buttonEdgeAt=millis();
  Serial.println("D13 LED BENCH 1.0.0 | LED SIMULATION ONLY | NO RELAY CONTROL");
  showStatus();
}
void loop(){
  const uint32_t now=millis();
  const bool normal=digitalRead(SENSOR_DIGITAL)==HIGH;
  if(!normal){
    normalTracking=false;
    if(!simulatedAlarm){simulatedAlarm=true;Serial.println("SIM: ALARM LATCHED");}
  }else if(!normalTracking){normalTracking=true;normalSince=now;}
  const bool pressed=digitalRead(RESET_BUTTON)==LOW;
  if(pressed!=buttonRaw){buttonRaw=pressed;buttonEdgeAt=now;}
  if(uint32_t(now-buttonEdgeAt)>=DEBOUNCE_MS){
    if(buttonStable!=buttonRaw){
      buttonStable=buttonRaw;
      if(!buttonStable){armed=true;Serial.println("D13 RELEASED");}
      else{
        Serial.println("D13 PRESSED");
        if(armed&&simulatedAlarm&&normalTracking&&uint32_t(now-normalSince)>=NORMAL_MS&&digitalRead(SENSOR_DIGITAL)==HIGH){
          simulatedAlarm=false;Serial.println("SIM: RESET ACCEPTED; GREEN LED ONLY");
        }else Serial.println("SIM: RESET NOT ACCEPTED OR NOT NEEDED");
        armed=false;
      }
    }else if(!buttonStable)armed=true;
  }
  if(digitalRead(SENSOR_DIGITAL)==LOW)simulatedAlarm=true;
  digitalWrite(LED_RED,simulatedAlarm?HIGH:LOW);
  digitalWrite(LED_GREEN,simulatedAlarm?LOW:HIGH);
  if(uint32_t(now-lastPrint)>=1000){lastPrint=now;showStatus();}
  delay(5);
}
