"""Compile the actual local sensor/call functions against a host GPIO/UART harness."""
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
PREFIX = '\n#include <cassert>\n#include <cstdint>\n#include <cstdio>\n#include <string>\n#include <vector>\n#define LOW 0\n#define HIGH 1\n#define SENSOR_DIGITAL 32\n#define SENSOR_ANALOG 34\n#define LED_ACTIVE 2\n#define LED_NORMAL 4\n#define RELAY_1 27\n#define RELAY_2 26\n#define CALL_DURATION_MS 25000\n#define SENSOR_FILTER_MS 50\n#define portENTER_CRITICAL(x) ((void)0)\n#define portEXIT_CRITICAL(x) ((void)0)\nint stateMux=0, inputPin=HIGH, pins[40]{};\nint digitalRead(int){return inputPin;}\nint analogRead(int){return 1234;}\nvoid digitalWrite(int p,int v){pins[p]=v;}\nstruct Console {\n std::string output;\n void println(const char* s){output+=s;output+="\\n";}\n void print(const char* s){output+=s;}\n void print(const std::string& s){output+=s;}\n template<typename...Args> void printf(const char*,Args...){}\n} Serial,Serial2;\nstruct {std::string phone="+84901234567";} config;\nstruct SharedState {bool activated=false,desiredOn=true,reportedOn=true;uint32_t revision=0;} state;\nSharedState snapshot(){return state;}\nbool validPhone(const std::string&){return true;}\nvoid readSIM(){}\nbool callTriggered=false,callInProgress=false,simReady=false,simRegistered=false,sensorWasLow=false;\nbool phoneErrorPrinted=false,simQueryPending=false;\nuint32_t sensorLowSince=0,callStartTime=0,lastSensorLog=0,lastSimCommand=0,lastRegistrationQuery=0;\nuint8_t simInitStep=6;\n'
CASES = 'int main(){\n serviceSensor(100); assert(pins[27]==HIGH && pins[26]==HIGH && pins[4]==HIGH);\n inputPin=LOW;serviceSensor(200);serviceSensor(249);assert(!state.activated);\n inputPin=HIGH;serviceSensor(250);assert(!state.activated);\n inputPin=LOW;serviceSensor(300);serviceSensor(350);\n assert(state.activated && pins[27]==LOW && pins[26]==LOW && pins[2]==HIGH && pins[4]==LOW);\n inputPin=HIGH;state.desiredOn=true;serviceSensor(500);\n assert(state.activated && !state.reportedOn && pins[27]==LOW);\n serviceSIM(1000);assert(!callTriggered);\n simReady=true;simRegistered=true;\n serviceSIM(2000);assert(callTriggered && callInProgress && Serial2.output=="ATD+84901234567;\\n");\n serviceSIM(26999);assert(callInProgress);\n serviceSIM(27000);assert(!callInProgress && Serial2.output=="ATD+84901234567;\\nATH\\n");\n serviceSIM(30000);assert(!callInProgress && Serial2.output=="ATD+84901234567;\\nATH\\n");\n callInProgress=true;callStartTime=UINT32_MAX-100;\n serviceSIM(uint32_t(callStartTime+25000));assert(!callInProgress);\n state={};sensorWasLow=false;inputPin=HIGH;state.desiredOn=false;serviceSensor(40000);\n assert(!state.activated && pins[27]==LOW && pins[4]==HIGH);\n puts("PASS: debounce, persistent latch, relay override, one dial, 25s hangup, clock rollover, cloud off.");\n}\n'

def main():
    source = (ROOT / "projects/esp-light-latch-sim800l/AppDockSketch.ino").read_text()
    sim = source[source.index("void serviceSIM("):source.index("void serviceSensor(")]
    sensor = source[source.index("void serviceSensor("):source.index("String idToken, refreshToken;")]
    with tempfile.TemporaryDirectory() as temp:
        temp = pathlib.Path(temp)
        cpp, binary = temp / "test.cpp", temp / "test"
        cpp.write_text(PREFIX + sim + sensor + CASES)
        subprocess.run(["g++", "-std=c++17", "-Wall", "-Wextra", str(cpp), "-o", str(binary)], check=True)
        subprocess.run([str(binary)], check=True)

if __name__ == "__main__":
    main()
