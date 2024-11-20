const
    katex = require("katex"),
    fs = require("fs"),
    displayMode = Boolean(process.env.KATEX_DISPLAY_MODE),
    input = fs.readFileSync(0, { encoding: "utf8" }),
    html = katex.renderToString(input, {
        throwOnError: false,
        displayMode,
    });
process.stdout.write(html);
