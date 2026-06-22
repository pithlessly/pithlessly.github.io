const katex = require("katex");
const fs = require("fs");
const stdin = fs.readFileSync(0, { encoding: "utf8" });
const inputs = JSON.parse(stdin);
console.error("input:", inputs);

let macros = {};
let outputs = [];

for (let { is_inline, content } of inputs) {
    outputs.push(katex.renderToString(content.toString(), {
        throwOnError: false,
        trust: true,
        displayMode: !is_inline,
        macros, // gets modified between calls
    }));
}

process.stdout.write(JSON.stringify(outputs));
