import { WebSocketServer } from "ws";
import crypto from "crypto";
import cors from "cors";
import express from "express";
import http from "http";

const files = {};

const validateApiKey = (apiKey) => {
  const validKeys = JSON.parse(process.env.API_KEYS);
  return validKeys.includes(apiKey);
};
const createHash = async (data) => {
  const dataBytes = new TextEncoder().encode(data);
  const hashBytes = await crypto.subtle.digest("SHA-256", dataBytes);
  const hash = [...new Uint8Array(hashBytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hash;
};
const saveFile = async (data, name) => {
  const hash = await createHash(data);
  const file = {
    data,
    name,
    expires: Date.now() + 1000 * 60 * 10,
  };
  files[hash] = file;
  return hash;
};
const clearExpiredFiles = () => {
  for (const hash in files) {
    if (files[hash].expires < Date.now()) {
      delete files[hash];
    }
  }
};
const handleMessage = async (ws, message) => {
  if (message.type == "get-file") {
    const file = files[message.hash];
    if (file) {
      ws.send(
        JSON.stringify({ type: "success", data: file.data, name: file.name }),
      );
    } else {
      ws.send(JSON.stringify({ type: "error", message: "File not found" }));
    }
  } else if (message.type == "upload-file") {
    if (validateApiKey(message.key)) {
      const hash = await saveFile(message.data, message.name);
      ws.send(JSON.stringify({ type: "success", hash }));
    } else {
      ws.send(JSON.stringify({ type: "error", message: "Invalid API key" }));
    }
  } else {
    ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
  }
};

const app = express();
app.use(cors({ origin: ["https://kendell.dev", "http://localhost:5173"] }));
app.get("/", (req, res) =>
  res.redirect(
    301,
    "https://github.com/KTibow/RatRater2Back/tree/main/rat-to-peer",
  ),
);
app.get("/file", async (req, res) => {
  const url = req.query.url;
  if (!url) res.status(400).send("No url provided");
  const resp = await fetch(url);
  const data = await resp.arrayBuffer();
  res.setHeader("Content-Type", resp.headers.get("Content-Type"));
  res.status(resp.status).send(Buffer.from(data));
});

const wss = new WebSocketServer({ clientTracking: false, noServer: true });
wss.on("connection", async (ws) => {
  clearExpiredFiles();
  try {
    // eslint-disable-next-line
    while (true) {
      const message = await new Promise((resolve, reject) => {
        ws.once("message", resolve);
        ws.once("close", reject);
      });
      const parsedMessage = JSON.parse(message.toString());
      await handleMessage(ws, parsedMessage);
    }
  } catch (err) {
    console.error("An error occurred", err);
    ws.send(JSON.stringify({ type: "error", message: "Internal error" }));
  }
});

const server = http.createServer(app);
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
server.listen(8080, () => console.log("Listening on port 8080"));
