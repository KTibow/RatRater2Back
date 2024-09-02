import { InteractionResponseType } from "discord-interactions";
import JSZip, { type JSZipObject } from "jszip";
import type { Env } from "./worker";
import { Analysis, prescan, scan } from "./engine";

const json = (data: any) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
const escape = (str: string) => str.replace(/[\n\\`]/g, "");
const getSize = (bytes: number) =>
  bytes < 1000
    ? bytes + " B"
    : bytes < 1000000
    ? Math.floor(bytes / 1000) + " kB"
    : Math.floor(bytes / 1000000) + " MB";

export default async (interaction: any, env: Env, ctx: ExecutionContext) => {
  const { options: optionsList, resolved } = interaction.data;
  const options = Object.fromEntries(
    optionsList.map((option: any) => [option.name, option.value])
  );
  const file = resolved.attachments[options.file];

  if (!file.filename.endsWith(".jar"))
    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "🚫 Please upload a .jar file" },
    });

  const applicationId = env.DISCORD_APPLICATION_ID;
  const interactionToken = interaction.token;
  const updateMessage = (message: any) =>
    fetch(
      `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
      {
        method: "PATCH",
        body: JSON.stringify(message),
        headers: { "Content-Type": "application/json" },
      }
    );
  const start = async () => {
    let data: ArrayBuffer, hashes: unknown;
    try {
      [data, hashes] = await Promise.all([
        fetch(file.url).then((r) => r.arrayBuffer()),
        fetch(
          "https://raw.githubusercontent.com/KTibow/RatRater2Back/main/hash-grab/hashes.json"
        ).then((r) => r.json()),
      ]);
    } catch (e) {
      await updateMessage({ content: "🚫 Failed to download" });
      throw e;
    }
    const update1 = updateMessage({
      content: "<a:loading:1280263471748874250> Opening file...",
    });

    let zip: JSZip & JSZipObject,
      hash: string,
      files: string[],
      state: Analysis = { obfuscation: {}, flags: {} };
    try {
      const [_zip, hashBytes] = await Promise.all([
        new JSZip().loadAsync(data),
        crypto.subtle.digest("SHA-256", data),
      ]);
      zip = _zip as JSZip & JSZipObject;
      hash = [...new Uint8Array(hashBytes)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      files = Object.values(zip.files)
        .filter((f) => !f.dir)
        .map((f) => f.name);
    } catch (e) {
      await update1;
      await updateMessage({ content: "🚫 Failed to open file" });
      throw e;
    }

    const fileDesc = `\`${escape(file.filename)}\` (${getSize(file.size)})`;
    const genFlagEmbed = () => {
      const flagDescription = [];

      const obfuscationList = Object.keys(state.obfuscation);
      if (obfuscationList.length > 0) {
        flagDescription.push(`This mod *might* have been obfuscated, so RatRater *might* miss stuff.
Obf flags: ${obfuscationList.join(", ")}`);
      }

      const flagList = Object.keys(state.flags);
      if (flagList.length > 0) {
        flagDescription.push(`Flags mean something might be malicious. Click on one to see what it means.
These flags were found: ${flagList
          .map((f) => {
            const link = state.flags[f].link;
            if (link) {
              return `[${f}](${encodeURI(link)})`;
            }
            return f;
          })
          .join(", ")}`);
      }

      return {
        title: "Flags",
        color: 11192319,
        description: flagDescription.join("\n\n") || "*No flags.*",
      };
    };
    const genOfficialEmbed = () => {
      const officialFile = (hashes as any[]).find((h) => h.hash == hash);
      if (state.flagged) {
        return {
          title: "Almost definitely a rat",
          color: 16757931,
          description:
            `Classification: ${state.flagged.name}
` +
            (state.flagged.file
              ? `Example file: \`${escape(state.flagged.file)}\``
              : "To prevent reverse engineering, you cannot see the cause"),
        };
      } else if (officialFile) {
        return {
          title: "Probably safe",
          color: 14531808,
          description:
            `Found in an official source, ${officialFile.source}` +
            `, as \`${escape(officialFile.file)}\``,
        };
      }
    };
    const genEmbeds = () => {
      const officialEmbed = genOfficialEmbed();
      return [genFlagEmbed(), ...(officialEmbed ? [officialEmbed] : [])];
    };

    await update1;
    if (files.length > 10000) {
      const officialEmbed = genOfficialEmbed();
      await updateMessage({
        content:
          `🚫 ${files.length} classes is too many. ` +
          `RR2 (the bot) would crash if it tried to scan this.`,
        embeds: officialEmbed ? [officialEmbed] : [],
      });
      return;
    }

    let totalSize = 0;
    for (const file of files) {
      if (!file.endsWith(".class") && !file.endsWith(".mf")) continue;
      // @ts-ignore
      const size = zip.files[file]._data.uncompressedSize;
      totalSize += size < 0 ? size + 2 ** 32 : size;
    }
    const gb = totalSize / 1024 / 1024 / 1024;
    if (gb > 0.5) {
      const officialEmbed = genOfficialEmbed();
      await updateMessage({
        content:
          `🚫 ${gb.toFixed(2)} GB of classes is too big. ` +
          `RR2 (the bot) would crash if it tried to scan this.`,
        embeds: officialEmbed ? [officialEmbed] : [],
      });
      return;
    }

    await updateMessage({
      content: `<a:loading:1280263471748874250> Prescanning...`,
    });
    try {
      prescan(zip, files, state);
    } catch (e) {
      await updateMessage({ content: "🚫 Failed to run prescan\n" + e });
      throw e;
    }

    const tasks = files
      .filter((path) => path.endsWith(".class"))
      .map(async (f) => {
        const contents = await zip.files[f].async("string");
        scan(f, contents, state);
      });

    const manifest = files.find((f) => /manifest\.mf$/i.test(f));
    const manifestTask = async (manifest: string) => {
      const contents = await zip.files[manifest].async("string");
      const protectedLine = contents.match(/^(?=.*protected).*$/im);
      if (!protectedLine) return;
      state.obfuscation["Obfuscator noted in manifest.mf"] = {
        file: manifest,
        initialFind: {
          searchString: "^(?=.*protected).*$",
          isRegex: true,
          wholeWord: false,
          matchCase: false,
        },
      };
    };
    if (manifest) tasks.push(manifestTask(manifest));

    const apiAnalysisTask = async () => {
      const resp = await env.quantiy.fetch(
        "https://rr-quantiy.ktibow.workers.dev/",
        {
          body: data,
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );
      if (!resp.ok) {
        console.error(await resp.text());
        throw new Error("API analysis failed");
      }
      const json: any = await resp.json();
      if (!state.flagged) {
        if (json.class == "yes") {
          state.flagged = { name: "Quantiy" };
        } else if (json.class == "medium") {
          state.flagged = { name: "Quantiy (medium confidence)" };
        } else if (json.class == "low") {
          state.flagged = { name: "Quantiy (low confidence)" };
        }
      }
    };
    tasks.push(apiAnalysisTask());

    const update2 = updateMessage({
      content: `<a:loading:1280263471748874250> Scanning ${tasks.length} things...
${fileDesc}`,
      embeds: genEmbeds(),
    });
    let done = 0;
    let lastEmbeds = genEmbeds();

    const updateTask = async () => {
      done++;
      const newEmbeds = genEmbeds();
      if (JSON.stringify(newEmbeds) != JSON.stringify(lastEmbeds)) {
        lastEmbeds = newEmbeds;
        const pct = Math.floor((done / tasks.length) * 100);
        await updateMessage({
          content: `<a:loading:1280263471748874250> Scanning (${pct}%)...`,
          embeds: newEmbeds,
        });
      }
    };
    const catchTask = (e: Error) => {
      done++;
      console.error("While scanning,", e);
    };
    await Promise.all(
      tasks.map((task) => task.then(updateTask).catch(catchTask))
    );

    await update2;
    await updateMessage({
      content: `✅ ${fileDesc}`,
      embeds: genEmbeds(),
    });
  };
  ctx.waitUntil(start());
  return json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content:
        "<a:loading:1280263471748874250> Downloading `" +
        escape(file.filename) +
        "`...",
    },
  });
};
