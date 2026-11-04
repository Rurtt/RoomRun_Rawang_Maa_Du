// Sensor side: MPU6050 motion + battery voltage. Separate from the link so a
// later radio change (ESP-NOW) does not touch this.
#pragma once

bool sensorsBegin();
// ag: m/s^2 including gravity (+9.81 on the axis pointing up at rest); r: deg/s
void readMotion(float ag[3], float r[3]);
float readVbat();
