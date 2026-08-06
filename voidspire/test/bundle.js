/* Inlines css/style.css + all js/*.js into a single-file voidspire.html. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// inline the stylesheet
html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/,
  () => '<style>\n' + fs.readFileSync(path.join(root, 'css/style.css'), 'utf8') + '\n</style>');

// inline each script in order
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g,
  (_, src) => '<script>\n' + fs.readFileSync(path.join(root, src), 'utf8') + '\n</script>');

// Stamp the build so a cached page is identifiable at a glance rather than
// after two rounds of "are you sure you reloaded".
let stamp = 'dev';
try {
  const cp = require('child_process');
  const sha = cp.execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
  const day = new Date(parseInt(cp.execSync('git log -1 --format=%ct', { cwd: root }).toString().trim(), 10) * 1000)
    .toISOString().slice(0, 10);
  stamp = day + ' ' + sha;
} catch (e) { /* not a git checkout; leave it as dev */ }
html = html.replace('__BUILD__', stamp);

fs.writeFileSync(path.join(root, 'voidspire.html'), html);
console.log('bundled voidspire.html (' + html.length + ' bytes)');
