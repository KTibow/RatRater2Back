import { WebSocketServer } from "ws";
import crypto from "crypto";

const files = {};
const wss = new WebSocketServer({ port: 8080 });

const validateApiKey = (apiKey) => {
  const validKeys = JSON.parse(process.env.API_KEYS);
  return validKeys.includes(apiKey);
};
const saveFile = async (data, name) => {
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hash = new Uint8Array(hashBuf).map((b) => b.toString(16).padStart(2, "0")).join("");
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
      ws.send(JSON.stringify({ type: "success", data: file.data, name: file.name }));
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
