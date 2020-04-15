/* exported Popup */

// Add or remove a class from elem.classList, depending on cond.
function setClass(elem, className, cond) {
  if (cond) {
    elem.classList.add(className);
  } else {
    elem.classList.remove(className);
  }
}

class Popup {
  constructor(getMsgFunc, changeFunc, retryFunc) {
    this.getMsgFunc = getMsgFunc;
    this.enabled = document.getElementById('enabled');
    this.enabled.addEventListener('change', changeFunc);
    this.retry = document.getElementById('retry');
    this.retry.addEventListener('click', () => {
      this.setStatusDesc(getMsgFunc('popupRetrying'));
      this.setRetry(false);
      setTimeout(retryFunc, 1000);  // Just some UI feedback
    });
    this.div = document.getElementById('active');
    this.statustext = document.getElementById('statustext');
    this.statusdesc = document.getElementById('statusdesc');
    this.img = document.getElementById('statusimg');
    this.button = document.querySelector('.button');
  }
  setEnabled(enabled) {
    setClass(this.img, 'on', enabled);
  }
  setActive(active) {
    setClass(this.img, 'running', active);
  }
  setStatusText(txt) {
    this.statustext.innerText = txt;
  }
  setStatusDesc(desc, error) {
    this.statusdesc.innerText = desc;
    setClass(this.statusdesc, 'error', error);
  }
  setButton(hide) {
    this.button.style.display = hide ? 'none' : 'block';
  }
  setRetry(display) {
    this.retry.style.display = display ? 'inline-block' : 'none';
  }
  setChecked(checked) {
    this.enabled.checked = checked;
  }
  static fill(n, func) {
    switch(n.nodeType) {
      case 3: {  // Node.TEXT_NODE
        const m = /^__MSG_([^_]*)__$/.exec(n.nodeValue);
        if (m) { n.nodeValue = func(m[1]); }
        break;
      }
      case 1:  // Node.ELEMENT_NODE
        n.childNodes.forEach(c => Popup.fill(c, func));
        break;
    }
  }
  turnOn(clients, total) {
    this.setChecked(true);
    if (clients > 0) {
      this.setStatusText(this.getMsgFunc('popupStatusOn', String(clients)));
    } else {
      this.setStatusText(this.getMsgFunc('popupStatusReady'));
    }
    this.setStatusDesc((total > 0) ? this.getMsgFunc('popupDescOn', String(total)) : '');
    this.setEnabled(true);
    this.setActive(this.active);
    this.setButton(false);
    this.setRetry(false);
  }
  turnOff(desc, error, retry) {
    this.setChecked(false);
    this.setStatusText(this.getMsgFunc('popupStatusOff'));
    this.setStatusDesc(desc ? this.getMsgFunc(desc) : '', error);
    this.setEnabled(false);
    this.setActive(false);
    this.setButton(error);
    this.setRetry(retry);
  }
  missingFeature(desc) {
    this.turnOff(desc, true, desc === 'popupBridgeUnreachable');
  }
}
