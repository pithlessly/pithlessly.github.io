"use strict";

// This file defines functionality related to reading and storing settings information.

// Represents the game settings.
function Settings() {
    this.refresh();
}

// Update the settings based on the HTML.
Settings.prototype.refresh = function() {
    let settings = document.getElementsByClassName("setting");
    // Whether to flash and shake the screen on asteroid collision with bullets
    // or the player.
    this.doCollisionFlash = settings[0].checked;
    // Whether to allow mouse controls.
    this.doMouseControls = settings[1].checked;
    // Whether to allow cheats.
    this.allowCheats = settings[2].checked;
};