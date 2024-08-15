import fetch from "cross-fetch";
import crypto from "crypto";
import { readFile, writeFile } from "fs/promises";
import "dotenv/config";

const repos = [
  "Skytils/SkytilsMod",
  "Moulberry/NotEnoughUpdates",
  "NotEnoughUpdates/NotEnoughUpdates",
  "BiscuitDevelopment/SkyblockAddons",
  "PartlySaneStudios/partly-sane-skies",
  "inglettronald/DulkirMod",
  "hannibal002/SkyHanni",
  "Soopyboo32/SoopyV2Forge",
  "Coflnet/SkyblockMod",
  "NotEnoughCoins/NotEnoughCoins",
];
const repoReleaseResps = await Promise.all(
  repos.map((repo) =>
    fetch(`https://api.github.com/repos/${repo}/releases`, {
      headers: { Authorization: "Bearer " + process.env.GITHUB_TOKEN },
    })
  )
);
const repoReleaseJson = await Promise.all(
  repoReleaseResps.map((resp) => resp.json())
);
const hashes = [];
await Promise.all(
  repoReleaseJson.map(async (releases) => {
    const release = releases[0];
    if (!release) return;
    const jar = release.assets?.find((a) => a.name.endsWith(".jar"));
    if (!jar) return;
    const fileResp = await fetch(jar.browser_download_url);
    if (!fileResp.ok)
      return console.error("release response not ok on", jar.name);
    const fileBytes = await fileResp.arrayBuffer();
    const hashBytes = await crypto.subtle.digest("SHA-256", fileBytes); // eslint-disable-line
    const hash = [...new Uint8Array(hashBytes)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    hashes.push({
      file: jar.name,
      hash,
      source: "github releases",
    });
    console.log("digested", jar.name);
  })
);
console.log("writing");
const currentHashes = JSON.parse(await readFile("./hashes.json"));
hashes.forEach((hash) => {
  let usedHash = currentHashes.find((h) => h.hash == hash.hash);
  if (!usedHash) {
    currentHashes.push(hash);
    usedHash = hash;
  }
  usedHash.recent = true;
});
await writeFile("./hashes.json", JSON.stringify(currentHashes, null, 2));
