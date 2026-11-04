// Deterministic derivatives of repository-owned vectors and real Android captures.
// Renderer: npm install --prefix apk-output/render-tools --no-save --ignore-scripts @resvg/resvg-js@2.6.2
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { Resvg } = require(path.join(root, 'apk-output/render-tools/node_modules/@resvg/resvg-js'));
const out = path.join(root, 'apps/linework/store/play');
fs.mkdirSync(out, { recursive: true });
const svg = fs.readFileSync(path.join(root, 'apps/linework/assets/templates/bot-sunflower-head.svg'), 'utf8');
const flower = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
<rect width="1024" height="500" fill="#3B5BDB"/>
<circle cx="968" cy="28" r="176" fill="#4C6BE1"/>
<circle cx="548" cy="498" r="130" fill="#4C6BE1"/>
<text x="80" y="111" fill="#DBE3FF" font-family="Segoe UI, sans-serif" font-size="22" letter-spacing="2">LINEWORK</text>
<text x="76" y="209" fill="#F7F3EE" font-family="Georgia, serif" font-size="67">Find your</text>
<text x="76" y="288" fill="#F7F3EE" font-family="Georgia, serif" font-size="67">own line.</text>
<text x="80" y="356" fill="#E7EBFF" font-family="Segoe UI, sans-serif" font-size="21">Photo tracing and a pocket lightbox</text>
<g transform="rotate(5 766 248)">
<rect x="606" y="77" width="324" height="362" rx="16" fill="#263F9A"/>
<rect x="596" y="65" width="324" height="362" rx="16" fill="#F7F3EE"/>
<path d="M620 371H896 M620 393H896" stroke="#E7E0D6" stroke-width="2"/>
<svg x="616" y="83" width="284" height="284" viewBox="0 0 400 400">${flower}</svg>
<path d="M785 380L856 309L866 319L795 390L779 396Z" fill="#FFC94D"/>
<path d="M779 396L783 383L792 392Z" fill="#1F1D1A"/>
</g></svg>`;
fs.writeFileSync(path.join(out, 'feature.svg'), feature + '\n');
fs.writeFileSync(path.join(out, 'feature.png'), new Resvg(feature).render().asPng());
const icon = fs.readFileSync(path.join(root, 'apps/linework/assets/brand/icon.svg'), 'utf8');
fs.writeFileSync(path.join(out, 'icon.png'), new Resvg(icon, { fitTo: { mode: 'width', value: 512 } }).render().asPng());
console.log('Rendered owned Linework vectors: feature1024x500 and icon512x512. Convert feature to RGB before upload.');
