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

/* Stamp the build from the CONTENT, not from git HEAD. Reading HEAD meant the
 * stamp was whatever had been committed when the bundle happened — so bundling
 * before committing (which is the natural order, since the bundle is what gets
 * committed) left it pointing one commit back. It drifted twice before this.
 * A hash of the assembled page cannot drift: identical output, identical stamp,
 * and it names the build rather than a commit that may not contain it. */
var stamp;
try {
  var crypto = require('crypto');
  var day = new Date().toISOString().slice(0, 10);
  stamp = day + ' ' + crypto.createHash('md5').update(html).digest('hex').slice(0, 7);
} catch (e) { stamp = 'dev'; }
html = html.replace('__BUILD__', stamp);

fs.writeFileSync(path.join(root, 'voidspire.html'), html);
console.log('bundled voidspire.html (' + html.length + ' bytes)');
