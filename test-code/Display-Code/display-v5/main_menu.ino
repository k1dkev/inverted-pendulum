States main_menu() {
	recvWithEndMarker();
    if (newData) {
        newData = false;
        if (strcmp(receivedChars, "E") == 0){
            return stateOptionArray[ui.enter()];
        } else if(strcmp(receivedChars, "R") == 0) {
            ui.down();
        } else if(strcmp(receivedChars, "L") == 0) {
            ui.up();
        }
        newData = false;
    }
    return MAIN_MENU;
}