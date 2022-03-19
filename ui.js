/*
All of Snowflake's DOM manipulation and inputs.
*/

class UI {

  constructor() {
    this.initStats();
  }

  initStats() {
    this.stats = [0];
    setInterval((() => {
      this.stats.unshift(0);
      this.stats.splice(24);
      this.postActive();
    }), 60 * 60 * 1000);
  }

  setStatus() {}

  setActive(connected) {
    if (connected) {
      this.stats[0] += 1;
    }
    return this.active = connected;
  }

  log() {}

}

UI.prototype.active = false;
UI.prototype.stats = null;
