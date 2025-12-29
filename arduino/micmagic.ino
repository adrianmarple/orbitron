
#include "arduinoFFT.h"

const uint16_t SAMPLE_SIZE = 512;
int count = 0;
double sum = 0;
double peak = 1e7;

void setup()
{
  Serial.begin(115200);
  Serial.println("Ready");
  analogReadResolution(12);
  pinMode(A0, INPUT_PULLDOWN);
}

void loop()
{
  double sample = analogRead(A10) - 1551.5;
  sum += sample*sample*sample*sample;
  count++;
  if(count < SAMPLE_SIZE) return;
  count = 0;

  if (sum > peak) {
    peak = sum * 0.8 + peak * 0.2;
  } else {
    peak *= 0.95;
  }

  peak = max(peak, 3e7);

  sum /= peak;
  if (sum > 1) {
    digitalWrite(D9, HIGH);
    delay(100);
  } else {
    digitalWrite(D9, LOW);
  }

  // sum = min(sum, 1);
  Serial.print("Wave:");
  Serial.print(sum);
  Serial.print(",");
  Serial.println("zero:0,max:1");

  sum = 0;
}
