/* global chrome, Popup */

// Fill i18n in HTML
window.onload = () => {
  Popup.fill(document.body, (m) => {
    return chrome.i18n.getMessage(m);
  });
};

const port = chrome.runtime.connect({
  name: "popup"
});

port.onMessage.addListener((m) => {
  const { clients, enabled, total, missingFeature } = m;
  const popup = new Popup(
    (...args) => chrome.i18n.getMessage(...args),
    (event) => port.postMessage({ enabled: event.target.checked }),
    () => port.postMessage({ retry: true })
  );

  if (missingFeature) {
    popup.missingFeature(missingFeature);
    return;
  }

  if (enabled) {
    popup.turnOn(clients, total);
  } else {
    popup.turnOff();
  }
});
