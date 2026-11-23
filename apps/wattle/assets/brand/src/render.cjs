const { Resvg } = require(process.argv[2] + '/node_modules/@resvg/resvg-js');
const fs = require('fs');
const [,, , src, out, w, bg] = process.argv;
let svg = fs.readFileSync(src, 'utf8');
const r = new Resvg(svg, { fitTo: { mode: 'width', value: Number(w) }, background: bg || undefined });
fs.writeFileSync(out, r.render().asPng());
console.log('wrote', out);
