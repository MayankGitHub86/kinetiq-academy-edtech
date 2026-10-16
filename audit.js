const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const htmlFiles = [];

function findHtmlFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'backend' || file === 'node_modules' || file.startsWith('.')) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findHtmlFiles(fullPath);
    } else if (fullPath.endsWith('.html')) {
      htmlFiles.push(fullPath);
    }
  }
}

findHtmlFiles(rootDir);

const imageAssets = new Set();
const cssBackgrounds = new Set();
const scriptImageRefs = new Set();

const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const bgUrlRegex = /url\(['"]?([^'"\)]+)['"]?\)/gi;

htmlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    imageAssets.add(match[1]);
  }
  
  while ((match = bgUrlRegex.exec(content)) !== null) {
    cssBackgrounds.add(match[1]);
  }
});

console.log('--- FOUND IMAGES IN HTML ---');
imageAssets.forEach(img => console.log(img));
console.log('\n--- FOUND CSS BACKGROUND URLS ---');
cssBackgrounds.forEach(bg => console.log(bg));
