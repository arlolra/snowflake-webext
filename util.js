/* exported Util, Params, DummyRateLimit */
/* global Config */

/*
A JavaScript WebRTC snowflake proxy

Contains helpers for parsing query strings and other utilities.
*/

class Util {

  static genSnowflakeID() {
    return Math.random().toString(36).substring(2);
  }

  static hasWebRTC() {
    return typeof RTCPeerConnection === 'function';
  }

  static hasCookies() {
    return navigator.cookieEnabled;
  }

  // returns a promise that fullfills to "restricted" if we
  // fail to make a test connection to a known restricted
  // NAT, "unrestricted" if the test connection fails, and
  // "unknown" if we fail to reach the probe test server
  static checkNATType(timeout) {
    return new Promise((fulfill, reject) => {
      let open = false;
      let pc = new RTCPeerConnection({iceServers: [
        {urls: 'stun:stun1.l.google.com:19302'}
      ]});
      let channel = pc.createDataChannel("NAT test");
      channel.onopen = function() {
        open = true;
        fulfill("unrestricted");
        channel.close();
        pc.close();
      };
      pc.onicecandidate = (evt) => {
        if (evt.candidate == null) {
          //ice gathering is finished
          Util.sendOffer(pc.localDescription)
          .then((answer) => {
            setTimeout(() => {if(!open) fulfill("restricted");}, timeout);
            pc.setRemoteDescription(JSON.parse(answer));
          }).catch((e) => {
            console.log(e);
            reject("Error receiving probetest answer");
          });
        }
      };
      pc.createOffer()
      .then((offer) =>  pc.setLocalDescription(offer))
      .catch((e) => {
        console.log(e);
        reject("Error creating offer for probetest");
      });
    });
  }

  // Assumes getClientOffer happened, and a WebRTC SDP answer has been generated.
  // Sends it back to the broker, which passes it back to the original client.
  static sendOffer(offer) {
    return new Promise((fulfill, reject) => {
      var xhr;
      xhr = new XMLHttpRequest();
      xhr.timeout = 30 * 1000;
      xhr.onreadystatechange = function() {
        if (xhr.DONE !== xhr.readyState) {
          return;
        }
        switch (xhr.status) {
          case 200:
            var response = JSON.parse(xhr.responseText);
            return fulfill(response.Answer); // Should contain offer.
          default:
            console.log('Probe ERROR: Unexpected ' + xhr.status + ' - ' + xhr.statusText);
            return reject('Failed to get answer from probe service');
        }
      };
      var data = {"Status": "client match", "Offer": JSON.stringify(offer)};
      try {
        xhr.open('POST', Config.PROBEURL);
      } catch (error) {
        console.log('Signaling Server: exception while connecting: ' + error.message);
        return reject('unable to connect to signaling server');
      }
      return xhr.send(JSON.stringify(data));
    });
  }
}


class Parse {

  // Parse a cookie data string (usually document.cookie). The return type is an
  // object mapping cookies names to values. Returns null on error.
  // http://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-8747038
  static cookie(cookies) {
    var i, j, len, name, result, string, strings, value;
    result = {};
    strings = [];
    if (cookies) {
      strings = cookies.split(';');
    }
    for (i = 0, len = strings.length; i < len; i++) {
      string = strings[i];
      j = string.indexOf('=');
      if (-1 === j) {
        return null;
      }
      name = decodeURIComponent(string.substr(0, j).trim());
      value = decodeURIComponent(string.substr(j + 1).trim());
      if (!(name in result)) {
        result[name] = value;
      }
    }
    return result;
  }

  // Parse an address in the form 'host:port'. Returns an Object with keys 'host'
  // (String) and 'port' (int). Returns null on error.
  static address(spec) {
    var host, m, port;
    m = null;
    if (!m) {
      // IPv6 syntax.
      m = spec.match(/^\[([\0-9a-fA-F:.]+)\]:([0-9]+)$/);
    }
    if (!m) {
      // IPv4 syntax.
      m = spec.match(/^([0-9.]+):([0-9]+)$/);
    }
    if (!m) {
      // TODO: Domain match
      return null;
    }
    host = m[1];
    port = parseInt(m[2], 10);
    if (isNaN(port) || port < 0 || port > 65535) {
      return null;
    }
    return {
      host: host,
      port: port
    };
  }

  // Parse a count of bytes. A suffix of 'k', 'm', or 'g' (or uppercase)
  // does what you would think. Returns null on error.
  static byteCount(spec) {
    let matches = spec.match(/^(\d+(?:\.\d*)?)(\w*)$/);
    if (matches === null) {
      return null;
    }
    let count = Number(matches[1]);
    if (isNaN(count)) {
      return null;
    }
    const UNITS = new Map([
      ['', 1],
      ['k', 1024],
      ['m', 1024*1024],
      ['g', 1024*1024*1024],
    ]);
    let unit = matches[2].toLowerCase();
    if (!UNITS.has(unit)) {
      return null;
    }
    let multiplier = UNITS.get(unit);
    return count * multiplier;
  }

  //Parse a remote connection-address out of the "c=" Connection Data field
  // or the "a=" attribute fields of the session description.
  // Return undefined if none is found.
  // https://tools.ietf.org/html/rfc4566#section-5.7
  // https://tools.ietf.org/html/rfc5245#section-15
  static ipFromSDP(sdp) {
    var i, len, m, pattern, ref;
    console.log(sdp);
    ref = [
      /^a=candidate:[a-zA-Z0-9+/]+ \d+ udp \d+ ([\d.]+) /mg,
      /^a=candidate:[a-zA-Z0-9+/]+ \d+ udp \d+ ([0-9A-Fa-f:.]+) /mg,
      /^c=IN IP4 ([\d.]+)(?:(?:\/\d+)?\/\d+)?(:? |$)/mg,
      /^c=IN IP6 ([0-9A-Fa-f:.]+)(?:\/\d+)?(:? |$)/mg
    ];
    for (i = 0, len = ref.length; i < len; i++) {
      pattern = ref[i];
      m = pattern.exec(sdp);
      while (m != null) {
        if(Parse.isRemoteIP(m[1])) return m[1];
        m = pattern.exec(sdp);
      }
    }
  }

  // Parse the mapped port out of an ice candidate returned from the
  // onicecandidate callback
  static portFromCandidate(c) {
    var m, pattern;
    pattern = /(?:[\d.]+|[0-9A-Fa-f:.]+) (\d+) typ srflx/m;
    m = pattern.exec(c);
    if (m != null) {
      return m[1];
    }
    return null;
  }

  // Determine whether an IP address is a local, unspecified, or loopback address
  static isRemoteIP(ip) {
    if (ip.includes(":")) {
      var ip6 = ip.split(':');
      // Loopback address
      var loopback = /^(?:0*:)*?:?0*1$/m;
      // Unspecified address
      var unspecified = /^(?:0*:)*?:?0*$/m;
      // Local IPv6 addresses are defined in https://tools.ietf.org/html/rfc4193
      return !((loopback.exec(ip) != null) || (unspecified.exec(ip) != null) ||
        (parseInt(ip6[0],16)&0xfe00) == 0xfc00);
    }

    // Local IPv4 addresses are defined in https://tools.ietf.org/html/rfc1918
    var ip4 = ip.split('.');
    return !(ip4[0] == 10 || ip4[0] == 127 || ip == "0.0.0.0" ||
      (ip4[0] == 172 && (ip4[1]&0xf0) == 16) ||
      (ip4[0] == 192 && ip4[1] == 168) ||
      // Carrier-Grade NAT as per https://tools.ietf.org/htm/rfc6598
      (ip4[0] == 100 && (ip4[1]&0xc0) == 64) ||
      // Dynamic Configuration as per https://tools.ietf.org/htm/rfc3927
      (ip4[0] == 169 && ip4[1] == 254));
  }

}


class Params {

  static getBool(query, param, defaultValue) {
    if (!query.has(param)) {
      return defaultValue;
    }
    var val;
    val = query.get(param);
    if ('true' === val || '1' === val || '' === val) {
      return true;
    }
    if ('false' === val || '0' === val) {
      return false;
    }
    return null;
  }

  // Get an object value and parse it as a byte count. Example byte counts are
  // '100' and '1.3m'. Returns |defaultValue| if param is not a key. Return null
  // on a parsing error.
  static getByteCount(query, param, defaultValue) {
    if (!query.has(param)) {
      return defaultValue;
    }
    return Parse.byteCount(query.get(param));
  }

}


class BucketRateLimit {

  constructor(capacity, time) {
    this.capacity = capacity;
    this.time = time;
  }

  age() {
    var delta, now;
    now = new Date();
    delta = (now - this.lastUpdate) / 1000.0;
    this.lastUpdate = now;
    this.amount -= delta * this.capacity / this.time;
    if (this.amount < 0.0) {
      return this.amount = 0.0;
    }
  }

  update(n) {
    this.age();
    this.amount += n;
    return this.amount <= this.capacity;
  }

  // How many seconds in the future will the limit expire?
  when() {
    this.age();
    return (this.amount - this.capacity) / (this.capacity / this.time);
  }

  isLimited() {
    this.age();
    return this.amount > this.capacity;
  }

}

BucketRateLimit.prototype.amount = 0.0;

BucketRateLimit.prototype.lastUpdate = new Date();


// A rate limiter that never limits.
class DummyRateLimit {

  constructor(capacity, time) {
    this.capacity = capacity;
    this.time = time;
  }

  update() {
    return true;
  }

  when() {
    return 0.0;
  }

  isLimited() {
    return false;
  }

}
