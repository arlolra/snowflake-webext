# Snowflake

This is the browser proxy component of Snowflake.

### Embedding

See https://snowflake.torproject.org/ for more info:
```
<iframe src="https://snowflake.torproject.org/embed.html" width="88" height="16" frameborder="0" scrolling="no"></iframe>
```

### Building the badge / snowflake.torproject.org

```
npm install
npm run build
```

which outputs to the `build/` directory.

### Building the webextension

```
npm install
npm run webext
```

and then load the `webext/` directory as an unpacked extension.
 * https://developer.mozilla.org/en-US/docs/Tools/about:debugging#Loading_a_temporary_extension
 * https://developer.chrome.com/extensions/getstarted#manifest

### Testing

Unit testing with Jasmine are available with:
```
npm install
npm test
```

To run locally, first build it with:

``` 
npm run build 
```
Then start an HTTP server in `build/` and navigate to `/embed.html`.

### Preparing to deploy

Background information:
 * https://gitlab.torproject.org/tpo/anti-censorship/pluggable-transports/snowflake/-/issues/23947#note_2591838
 * https://help.torproject.org/tsa/doc/static-sites/
 * https://help.torproject.org/tsa/doc/ssh-jump-host/

You need to be in LDAP group "snowflake" and have set up an SSH key with your LDAP account.
In your ~/.ssh/config file, you should have something like:

```
Host staticiforme
HostName staticiforme.torproject.org
User <your user name>
ProxyJump people.torproject.org
IdentityFile ~/.ssh/tor
```

### Deploying

```
npm install
npm run build
```

Do a "dry run" rsync with `-n` to check that only expected files are being changed. If you don't understand why a file would be updated, you can add the `-i` option to see the reason.

```
rsync -n --chown=:snowflake --chmod ug=rw,D+x --perms --delete -crv build/ staticiforme:/srv/snowflake.torproject.org/htdocs/
```

If it looks good, then repeat the rsync without `-n`.

```
rsync --chown=:snowflake --chmod ug=rw,D+x --perms --delete -crv build/ staticiforme:/srv/snowflake.torproject.org/htdocs/
```

You can ignore errors of the form `rsync: failed to set permissions on "<dirname>/": Operation not permitted (1)`.

Then run the command to copy the new files to the live web servers:

```
ssh staticiforme 'static-update-component snowflake.torproject.org'
```

### Publishing

Making a new release involves updating a few places,

1. Uploading the webextension to the Firefox Add-ons and Chrome Web Store
2. Publishing the new version to the npm repository
3. Deploying the badge to snowflake.torproject.org

The following is a rough guide to getting that done:

```
# Clean things up
npm run clean

# Maybe check what's left behind
git clean -n -d -x

# Be sure that translation/en/messages.json has been populated with any new
# strings that may have been merged in the recent patches.  It may take some
# time for transifex to have updated.  You can check with the following,
git submodule update --remote

# But note that it's also run as part of the "pack-webext" script, so return
# it to previously committed state,
git submodule update

# Bump and pack the webext, where "x.y.z" is the version being released
npm run pack-webext x.y.z

# Push the bump commit and tags
git push origin master
git push origin --tags

# Upload the generated webext.zip (and source.zip) to the webextension stores,
# 1. https://addons.mozilla.org/en-US/developers/addon/torproject-snowflake/versions/submit/
# 2. https://chrome.google.com/webstore/devconsole/

# This time, really clean, because we don't want any extraneous files uploaded
git clean -f -d -x

# Send it off to npm
npm publish

# Clean things up
npm run clean

# From here on out, follow the "Deploying" section of the README
```

### Parameters

With no parameters,
snowflake uses the default relay `snowflake.freehaven.net:443` and
uses automatic signaling with the default broker at
`https://snowflake-broker.freehaven.net/`.

### Reuse as a library

The badge and the webextension make use of the same underlying library and
only differ in their UI.  That same library can be produced for use with other
interfaces, such as [Cupcake][1], by running,

```
npm install
npm run library
```

which outputs a `./snowflake-library.js`.

You'd then want to create a subclass of `UI` to perform various actions as
the state of the snowflake changes,

```
class MyUI extends UI {
    ...
}
```

See `WebExtUI` in `init-webext.js` and `BadgeUI` in `init-badge.js` for
examples.

Finally, initialize the snowflake with,

```
var log = function(msg) {
  return console.log('Snowflake: ' + msg);
};
var dbg = log;

var config = new Config("myui");  // NOTE: Set a unique proxy type for metrics
var ui = new MyUI();  // NOTE: Using the class defined above
var broker = new Broker(config.brokerUrl);

var snowflake = new Snowflake(config, ui, broker);

snowflake.setRelayAddr(config.relayAddr);
snowflake.beginWebRTC();
```

This minimal setup is pretty much what's currently in `init-node.js`.

When configuring the snowflake, set a unique `proxyType` (first argument
to `Config`) that will be used when recording metrics at the broker.  Also,
it would be helpful to get in touch with the [Anti-Censorship Team][2] at the
Tor Project to let them know about your tool.

[1]: https://chrome.google.com/webstore/detail/cupcake/dajjbehmbnbppjkcnpdkaniapgdppdnc
[2]: https://gitlab.torproject.org/tpo/anti-censorship/team
