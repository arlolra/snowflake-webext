#!/usr/bin/env node

/* global require, process */

var { writeFileSync, readFileSync, readdirSync, statSync } = require('fs');
var { execSync, spawn } = require('child_process');
var cldr = require('cldr');
var domino = require('domino');

// All files required.
var FILES = [
  'broker.js',
  'config.js',
  'proxypair.js',
  'snowflake.js',
  'ui.js',
  'util.js',
  'websocket.js',
  'shims.js'
];

var FILES_SPEC = [
  'spec/broker.spec.js',
  'spec/init.spec.js',
  'spec/proxypair.spec.js',
  'spec/snowflake.spec.js',
  'spec/ui.spec.js',
  'spec/util.spec.js',
  'spec/websocket.spec.js'
];

var STATIC = 'static';

var SHARED_FILES = [
  'embed.html',
  'embed.css',
  'popup.js',
  'assets',
  '_locales',
];

var concatJS = function(outDir, init, outFile, pre) {
  var files = FILES;
  if (init) {
    files = files.concat(`init-${init}.js`);
  }
  var outPath = `${outDir}/${outFile}`;
  writeFileSync(outPath, pre, 'utf8');
  execSync(`cat ${files.join(' ')} >> ${outPath}`);
};

var copyTranslations = function(outDir) {
  execSync('git submodule update --init -- translation');
  execSync(`cp -rf translation/* ${outDir}/_locales/`);
};

var getDisplayName = function(locale) {
  var code = locale.split("_")[0];
  try {
    var name = cldr.extractLanguageDisplayNames(code)[code];
  }
  catch(e) {
    return '';
  }
  if (name === undefined) {
    return '';
  }
  return name;
};

var getDirs = function() {
  let dirs = readdirSync('translation').filter((f) => {
    const s = statSync(`translation/${f}`);
    return s.isDirectory() && !/^(\.|en)/.test(f);
  });
  dirs.push('en_US');
  dirs.sort();
  return dirs;
};

var translatedLangs = function() {
  let out = "const availableLangs = new Map([\n";
  let dirs = getDirs();
  dirs = dirs.map(d => `['${d}', '${getDisplayName(d)}'],`);
  out += dirs.join("\n");
  out += "\n]);\n\n";
  return out;
};

// FIXME: This is duplicated from index.js and should be shared in some way
var fill = function(n, func) {
  switch(n.nodeType) {
    case 1:  // Node.ELEMENT_NODE
    {
      const m = /^__MSG_([^_]*)__$/.exec(n.getAttribute('data-msgid'));
      if (m) {
        var val = func(m[1]);
        if (val != undefined) {
          n.innerHTML = val;
        }
      }
      n.childNodes.forEach(c => fill(c, func));
      break;
    }
  }
};

var fillIndex = function(outDir) {
  var indexFile = `${outDir}/index.html`;
  var html = readFileSync(indexFile, 'utf8');
  var dom = domino.createDocument(html);
  var locales = require(`./static/_locales/en_US/messages.json`);
  fill(dom.body, function(m) {
    return locales[m].message;
  });
  html = dom.serialize();
  writeFileSync(indexFile, html, 'utf8');
};

var tasks = new Map();

var task = function(key, msg, func) {
  tasks.set(key, {
    msg, func
  });
};

task('test', 'snowflake unit tests', function() {
  var jasmineFiles, outFile, proc;
  execSync('mkdir -p test');
  execSync('jasmine init >&-');
  // Simply concat all the files because we're not using node exports.
  jasmineFiles = FILES.concat('init-testing.js', FILES_SPEC);
  outFile = 'test/bundle.spec.js';
  execSync('echo "TESTING = true" > ' + outFile);
  execSync('cat ' + jasmineFiles.join(' ') + ' | cat >> ' + outFile);
  proc = spawn('jasmine', ['test/bundle.spec.js'], {
    stdio: 'inherit'
  });
  proc.on("exit", function(code) {
    process.exit(code);
  });
});

var addVersion = function(dir) {
  var file = `${dir}/embed.html`;
  var embed = readFileSync(file, 'utf8');
  var pkg = require('./package.json');
  embed = embed.replace(/<\/head>/, `  <meta name="version" content="${pkg.version}" />\n  $&`);
  writeFileSync(file, embed, 'utf8');
};

task('build', 'build the snowflake proxy', function() {
  const outDir = 'build';
  execSync(`rm -rf ${outDir}`);
  execSync(`cp -r ${STATIC}/ ${outDir}/`);
  addVersion(outDir);
  copyTranslations(outDir);
  concatJS(outDir, 'badge', 'embed.js', translatedLangs());
  writeFileSync(`${outDir}/index.js`, translatedLangs(), 'utf8');
  execSync(`cat ${STATIC}/index.js >> ${outDir}/index.js`);
  fillIndex(outDir);
  console.log('Snowflake prepared.');
});

task('webext', 'build the webextension', function() {
  const outDir = 'webext';
  execSync(`git clean -f -x -d ${outDir}/`);
  execSync(`cp -r ${STATIC}/{${SHARED_FILES.join(',')}} ${outDir}/`, { shell: '/bin/bash' });
  copyTranslations(outDir);
  concatJS(outDir, 'webext', 'snowflake.js', '');
  console.log('Webextension prepared.');
});

task('node', 'build the node binary', function() {
  execSync('mkdir -p build');
  concatJS('build', 'node', 'snowflake.js', '#!/usr/bin/env node\n\n');
  console.log('Node prepared.');
});

var updateVersion = function(file, version) {
  var obj = require(file);
  obj.version = version;
  writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
};

task('pack-webext', 'pack the webextension for deployment', function() {
  try {
    execSync(`rm -f source.zip`);
    execSync(`rm -f webext/webext.zip`);
  } catch (error) {
    //Usually this happens because the zip files were removed previously
    console.log('Error removing zip files');
  }
  execSync(`git submodule update --remote`);
  var version = process.argv[3];
  console.log(version);
  updateVersion('./package.json', version);
  updateVersion('./webext/manifest.json', version);
  execSync(`git commit -am "bump version to ${version}"`);
  try {
    execSync(`git tag webext-${version}`);
  } catch (error) {
    console.log('Error creating git tag');
    // Revert changes
    execSync(`git reset HEAD~`);
    execSync(`git checkout ./webext/manifest.json`);
    execSync(`git submodule update`);
    return;
  }
  execSync(`git archive -o source.zip HEAD .`);
  execSync(`npm run webext`);
  execSync(`cd webext && zip -Xr webext.zip ./*`);
});

task('clean', 'remove all built files', function() {
  execSync('rm -rf build test spec/support');
});

task('library', 'build the library', function() {
  concatJS('.', '', 'snowflake-library.js', '');
  console.log('Library prepared.');
});

var cmd = process.argv[2];

if (tasks.has(cmd)) {
  var t = tasks.get(cmd);
  console.log(t.msg);
  t.func();
} else {
  console.error('Command not supported.');

  console.log('Commands:');

  tasks.forEach(function(value, key) {
    console.log(key + ' - ' + value.msg);
  });
}
