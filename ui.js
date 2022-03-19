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

  get active() {
    return this.clients > 0;
  }

  postActive() {}

  increaseClients() {
    this.clients += 1;
    this.postActive();
    return this.clients;
  }

  decreaseClients() {
    this.clients -= 1;
    if(this.clients < 0) {
      this.clients = 0;
    }
    this.postActive();
    return this.clients;
  }

  log() {}

}

UI.prototype.clients = 0;
UI.prototype.stats = null;
