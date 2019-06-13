States main_menu() {
	// lcd.clear();
	// lcd.print("Hello!");
    if (digitalRead(enterPin)){
    	lcd.clear();
    	lcd.print("Enter");
    } else {
    	lcd.clear();
    	lcd.print("Not Enter");
    }
    delay(250);
    // else if(digitalRead(downPin)) { lcd.print("Down"); } 
    // else if(digitalRead(upPin)) { lcd.print("Up"); }
    return MAIN_MENU;
}

// States main_menu() {
//     if (digitalRead(enterPin)){ return stateOptionArray[ui.enter()]; } 
//     else if(digitalRead(downPin)) { ui.down();} 
//     else if(digitalRead(upPin)) { ui.up(); }
//     return MAIN_MENU;
// }
