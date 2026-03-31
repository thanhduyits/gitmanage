const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public', 'index.html');
const jsPath = path.join(__dirname, 'public', 'app.js');

let html = fs.readFileSync(htmlPath, 'utf8');
const scriptRegex = /<script>([\s\S]*?)<\/script>/g;

let appJsContent = '';
let isFirstScript = true;

html = html.replace(scriptRegex, (match, content) => {
    if (content.includes('tailwind.config')) {
        return match;
    }
    appJsContent += content + '\n\n';
    if (isFirstScript) {
        isFirstScript = false;
        return '<script src="app.js"></script>';
    }
    return '';
});

fs.writeFileSync(jsPath, appJsContent.trim() + '\n');
fs.writeFileSync(htmlPath, html);
console.log('Done extracting JS to app.js');
