# Telestrator

A lightweight Tampermonkey userscript for drawing directly on top of the browser window. It was originally made for playcalling, coaching, and on-screen annotation.

## Features

- Toggle telestrator mode on and off
- Draw freehand lines over the game screen
- Erase a stroke, undo strokes, or clear all strokes.
- Change stroke color
- Adjust stroke width
- Draw straight lines
- Draw lines with arrows
- Draw perfect circles
- Optional fade-out effect.

## Installation

1. Install userscript manager Tampermonkey for your browser: https://www.tampermonkey.net/
2. Add this script to Tampermonkey and save.
3. Focus the window you want to draw on.
4. Enable telestrator mode and begin drawing.

## Controls

### Toggle telestrator mode on / off
- Backtick key: (\` or ~)

### Colors
- `1` - Yellow
- `2` - Green
- `3` - Magenta
- `4` - Red
- `5` - Blue

### Stroke controls
- `[` - Decrease stroke width
- `]` - Increase stroke width

### Drawing tools
- Left mouse click: Draw a stroke.
- Right mouse click: Erase a stroke.
- Middle mouse click / Scroll-wheel click: Clear all strokes.
- Hold `Shift` while drawing: Straight line
- Hold `Alt` while drawing: Draw arrow
- Hold `Ctrl` while drawing: Perfect circle

### Other actions
- `F`: Toggle fading for new strokes
- `Ctrl + Z`: Undo the last stroke

## Notes

- If you already had a page open when you enabled the script, make sure to refresh the page to have the script active on that page.
- If you want to restrict the script to specific sites, replace the `@match` header with a specific domain such as `@match *://youtube.com/*`
- The cursor indicator appears while the telestrator is active.
- The HUD can be expanded by hovering over the floating control panel.
This project does not currently specify a license.
