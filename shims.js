/* global module, require */

/*
WebRTC shims for multiple browsers.
*/

if (typeof module !== "undefined" && module !== null ? module.exports : void 0) {
  window = {};
  document = {
    getElementById: function() {
      return null;
    }
  };
  chrome = {};
  location = { search: '' };
  ({ URLSearchParams } = require('url'));
  if ((typeof TESTING === "undefined" || TESTING === null) || !TESTING) {
    webrtc = require('wrtc');
    RTCPeerConnection = webrtc.RTCPeerConnection;
    RTCSessionDescription = webrtc.RTCSessionDescription;
    WebSocket = require('ws');
    ({ XMLHttpRequest } = require('xmlhttprequest'));
  }
}
