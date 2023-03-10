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
const repoReleaseJson = await Promise.all(repoReleaseResps.map((resp) => resp.json()));
const hashes = [];
await Promise.all(
  repoReleaseJson.map(async (releases) => {
    const release = releases[0];
    if (!release) return;
    const jar = release.assets?.find((a) => a.name.endsWith(".jar"));
    if (!jar) return;
    const fileResp = await fetch(jar.browser_download_url);
    if (!fileResp.ok) return console.error("release response not ok");
    const fileBytes = await fileResp.arrayBuffer();
    const hashBytes = await crypto.subtle.digest("SHA-256", fileBytes); // eslint-disable-line
    const hash = [...new Uint8Array(hashBytes)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    hashes.push({ file: jar.name, hash, source: "github releases", time: Date.now() });
    console.log("digested", jar.name);
  })
);
console.log("writing");
const currentHashes = JSON.parse(await readFile("./hashes.json"));
hashes.forEach((hash) => {
  if (!currentHashes.some((h) => h.hash == hash.hash)) currentHashes.push(hash);
});
await writeFile("./hashes.json", JSON.stringify(currentHashes, null, 2));
