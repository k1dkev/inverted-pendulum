#include <LiquidCrystal.h>
#include <KeyboardController.h>

// Initialize LCD
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

// Initialize USB Controller
USBHost usb;

// Attach Keyboard controller to USB
KeyboardController keyboard(usb);

enum States {CALIBRATE, SWINGUP, BALANCE};
States state = CALIBRATE;

void setup() {
	Serial.begin(9600);
	lcd.begin(16,2);
}

void loop() {
    switch (state) {
        case CALIBRATE: state = calibrate();    break;
        case BALANCE:   state = balance();      break;
        case SWINGUP:   state = swingup();      break;
        default: break;
    }
    usb.Task();
}

void keyPressed() {
  Serial.print("Pressed:  ");
  Serial.print(keyboard.getKey());
  Serial.println();
}