import fetch from "cross-fetch";
import crypto from "crypto";
import { readFile, writeFile } from "fs/promises";
import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import "dotenv/config";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
client.login(process.env.BOT_TOKEN);
await new Promise((resolve) => client.once("ready", resolve));

const channels = { neu: "1082322298058576023", tfm: "1084551253020917770" };
const hashes = [];
await Promise.all(
  Object.values(channels).map(async (cId) => {
    const channel = client.channels.cache.get(cId);
    if (!channel || channel.type != ChannelType.GuildText)
      return console.warn("incorrect channel type for", cId);
    const messagesCollection = await channel.messages.fetch();
    const messages = [...messagesCollection.values()].sort(
      (a, b) => b.createdTimestamp - a.createdTimestamp
    );
    const latestAttachment = messages
      .map((m) => [...m.attachments.values()].find((m) => m.name.endsWith(".jar")))
      .find((a) => a);
    if (!latestAttachment) return console.warn("no attachment in", cId);
    const fileResp = await fetch(latestAttachment.url);
    const fileBytes = await fileResp.arrayBuffer();
    const hashBytes = await crypto.subtle.digest("SHA-256", fileBytes); // eslint-disable-line
    const hash = [...new Uint8Array(hashBytes)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    hashes.push({ file: latestAttachment.name, hash, source: "discord", time: Date.now() });
  })
);
console.log("writing");
const currentHashes = JSON.parse(await readFile("./hashes.json"));
hashes.forEach((hash) => {
  if (!currentHashes.some((h) => h.hash == hash.hash)) currentHashes.push(hash);
});
await writeFile("./hashes.json", JSON.stringify(currentHashes, null, 2));

client.destroy();
