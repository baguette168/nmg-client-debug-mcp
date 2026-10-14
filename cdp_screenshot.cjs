const WebSocket = require("ws");
const fs = require("fs");

const wsUrl = process.argv[2] || "ws://127.0.0.1:9222/devtools/page/0CB0DE06DB46A37AB14B4CFBB1B2881B";
const outputFile = process.argv[3] || "screenshot.png";

const ws = new WebSocket(wsUrl);
ws.on("open", () => {
    ws.send(JSON.stringify({id: 1, method: "Page.enable"}));
    ws.send(JSON.stringify({id: 2, method: "Page.captureScreenshot", params: {format: "png"}}));
});

ws.on("message", (data) => {
    const msg = JSON.parse(data);
    if (msg.id === 2 && msg.result) {
        const buf = Buffer.from(msg.result.data, "base64");
        fs.writeFileSync(outputFile, buf);
        console.log("Screenshot saved:", outputFile, buf.length, "bytes");
        ws.close();
        process.exit(0);
    }
});

ws.on("error", (e) => {
    console.error("WebSocket error:", e.message);
    process.exit(1);
});

setTimeout(() => { console.error("Timeout"); process.exit(1); }, 10000);
