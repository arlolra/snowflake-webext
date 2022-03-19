/* global Util, Params, Config, UI, Broker, Snowflake, Popup, Parse, availableLangs, WS */

/*
UI
*/

class Messages {
  constructor(json) {
    this.json = json;
  }
  getMessage(m, ...rest) {
    let message = this.json[m].message;
    return message.replace(/\$(\d+)/g, (...args) => {
      return rest[Number(args[1]) - 1];
    });
  }
}

let messages = null;

class BadgeUI extends UI {

  constructor() {
    super();
    this.popup = new Popup(
      (...args) => messages.getMessage(...args),
      (event) => {
        if (event.target.checked) {
          setSnowflakeCookie('1', COOKIE_LIFETIME);
        } else {
          setSnowflakeCookie('', COOKIE_EXPIRE);
        }
        update();
      },
      () => {
        tryProbe();
      }
    );
  }

  checkNAT() {
    Util.checkNATType(config.datachannelTimeout).then((type) => {
      console.log("Setting NAT type: " + type);
      this.natType = type;
    }).catch((e) => {
      console.log(e);
    });
  }

  initNATType() {
    this.natType = "unknown";
    this.checkNAT();
    return setInterval(() => {this.checkNAT();}, config.natCheckInterval);
  }

  setStatus() {}

  missingFeature(missing) {
    this.setIcon('off');
    this.popup.missingFeature(missing);
  }

  turnOn() {
    this.enabled = true;
    if (this.clients > 0) {
      this.setIcon('running');
    } else {
      this.setIcon('on');
    }
    const total = this.stats.reduce((function(t, c) {
      return t + c;
    }), 0);
    this.popup.turnOn(this.clients, total);
  }

  turnOff() {
    this.enabled = false;
    this.setIcon('off');
    this.popup.turnOff();
  }

  postActive() {
    if(this.enabled) {
      this.turnOn();
    }
  }

  setIcon(status) {
    document.getElementById('icon').href = `assets/toolbar-${status}.ico`;
  }

}

BadgeUI.prototype.popup = null;


/*
Entry point.
*/

// Defaults to opt-in.
var COOKIE_NAME = "snowflake-allow";
var COOKIE_LIFETIME = "Thu, 01 Jan 2038 00:00:00 GMT";
var COOKIE_EXPIRE = "Thu, 01 Jan 1970 00:00:01 GMT";

function setSnowflakeCookie(val, expires) {
  document.cookie = `${COOKIE_NAME}=${val}; path=/; expires=${expires}; secure=true; samesite=none;`;
}

const defaultLang = 'en_US';

// Resolve as in,
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization#Localized_string_selection
function getLang() {
  let lang = navigator.language || defaultLang;
  lang = lang.replace(/-/g, '_');
  if (availableLangs.has(lang)) {
    return lang;
  }
  lang = lang.split('_')[0];
  if (availableLangs.has(lang)) {
    return lang;
  }
  return defaultLang;
}

var debug, snowflake, config, broker, ui, log, dbg, init, update, silenceNotifications, query, tryProbe;

(function() {

  snowflake = null;

  query = new URLSearchParams(location.search);

  debug = Params.getBool(query, 'debug', false);

  silenceNotifications = Params.getBool(query, 'silent', false);

  // Log to both console and UI if applicable.
  // Requires that the snowflake and UI objects are hooked up in order to
  // log to console.
  log = function(msg) {
    console.log('Snowflake: ' + msg);
    return snowflake != null ? snowflake.ui.log(msg) : void 0;
  };

  dbg = function(msg) {
    if (debug) { log(msg); }
  };

  tryProbe = function() {
    WS.probeWebsocket(config.relayAddr)
    .then(
      () => {
        ui.turnOn();
        dbg('Contacting Broker at ' + broker.url);
        log('Starting snowflake');
        snowflake.setRelayAddr(config.relayAddr);
        snowflake.beginWebRTC();
      },
      () => {
        ui.missingFeature('popupBridgeUnreachable');
        snowflake.disable();
        log('Could not connect to bridge.');
      }
    );
  };

  update = function() {
    const cookies = Parse.cookie(document.cookie);
    if (cookies[COOKIE_NAME] !== '1') {
      ui.turnOff();
      snowflake.disable();
      log('Currently not active.');
      return;
    }

    if (!Util.hasWebRTC()) {
      ui.missingFeature('popupWebRTCOff');
      snowflake.disable();
      return;
    }

    tryProbe();
  };

  init = function() {
    ui = new BadgeUI();

    if (!Util.hasCookies()) {
      ui.missingFeature('badgeCookiesOff');
      return;
    }

    config = new Config("badge");
    if ('off' !== query.get('ratelimit')) {
      config.rateLimitBytes = Params.getByteCount(query, 'ratelimit', config.rateLimitBytes);
    }
    broker = new Broker(config);
    snowflake = new Snowflake(config, ui, broker);
    log('== snowflake proxy ==');
    update();

    ui.initNATType();
  };

  // Notification of closing tab with active proxy.
  window.onbeforeunload = function() {
    if (
      !silenceNotifications &&
      snowflake !== null &&
      ui.active
    ) {
      return Snowflake.MESSAGE.CONFIRMATION;
    }
    return null;
  };

  window.onunload = function() {
    if (snowflake !== null) { snowflake.disable(); }
    return null;
  };

  window.onload = function() {
    fetch(`./_locales/${getLang()}/messages.json`)
    .then((res) => {
      if (!res.ok) { return; }
      return res.json();
    })
    .then((json) => {
      messages = new Messages(json);
      Popup.fill(document.body, (m) => {
        return messages.getMessage(m);
      });
      init();
    });
  };

}());
