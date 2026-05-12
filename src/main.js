// Entry point: construct the App and start it.
// Keeping main.js tiny means every interesting decision lives inside a class
// you can point at during your presentation.

import { App } from './classes/App.js';

const app = new App();
app.init();
