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

fs.writeFileSync(path.join(root, 'voidspire.html'), html);
console.log('bundled voidspire.html (' + html.length + ' bytes)');
