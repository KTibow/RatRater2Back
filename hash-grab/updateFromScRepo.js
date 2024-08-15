import fetch from "cross-fetch";
import crypto from "crypto";
import { readFile, writeFile } from "fs/promises";

const modsResp = await fetch(
  "https://raw.githubusercontent.com/SkyblockClient/SkyblockClient-REPO/main/files/mods.json"
);
const modsJson = await modsResp.json();
const usedMods = modsJson.filter(
  (mod) =>
    !mod.hidden ||
    modsJson.some((m) => !m.hidden && m.packages?.includes(mod.id))
);
let digestedMods = 0;
const modHashes = await Promise.all(
  usedMods.map(async (mod) => {
    const fileUrl =
      mod.url ||
      encodeURI(
        "https://github.com/SkyblockClient/SkyblockClient-REPO/raw/main/files/mods/" +
          mod.file
      );
    const fileResp = await fetch(fileUrl, {
      headers: { "User-Agent": "github.com/KTibow/RatRater2Back" },
    });
    if (!fileResp.ok) return console.error("file response not ok on", fileUrl);
    const fileBytes = await fileResp.arrayBuffer();
    const hashBytes = await crypto.subtle.digest("SHA-256", fileBytes); // eslint-disable-line
    const hash = [...new Uint8Array(hashBytes)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    console.log("digested", ++digestedMods, "/", usedMods.length);
    return {
      file: mod.file,
      hash,
      source: "skyclient",
    };
  })
);
console.log("writing");
const currentHashes = JSON.parse(await readFile("./hashes.json"));
modHashes.forEach((hash) => {
  if (hash) {
    let usedHash = currentHashes.find((h) => h.hash == hash.hash);
    if (!usedHash) {
      currentHashes.push(hash);
      usedHash = hash;
    }
    usedHash.recent = true;
  }
});
await writeFile("./hashes.json", JSON.stringify(currentHashes, null, 2));
