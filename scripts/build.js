// Builds the deployable site into dist/: compiled CSS + only the files the page needs.
const { execSync } = require('child_process');
const fs = require('fs');
execSync('npx tailwindcss -i src/input.css -o css/tailwind.css --minify', { stdio: 'inherit' });
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');
['index.html', 'favicon.svg', 'robots.txt', 'sitemap.xml', 'css', 'js', 'images'].forEach(p => {
  if (fs.existsSync(p)) fs.cpSync(p, 'dist/' + p, { recursive: true });
});
console.log('dist/ ready');
