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
  const start = async () => {
    const [data, hashes] = await Promise.all([
      fetch(file.url).then((r) => r.arrayBuffer()),
      fetch(
        "https://raw.githubusercontent.com/KTibow/RatRater2Back/main/hash-grab/hashes.json"
      ).then((r) => r.json()),
    ]);
    const update1 = fetch(
      `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
      {
        method: "PATCH",
        body: JSON.stringify({
          content: "<a:loading:1121137235123765400> Opening file...",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const [_zip, hashBytes] = await Promise.all([
      new JSZip().loadAsync(data),
      crypto.subtle.digest("SHA-256", data),
    ]);
    const zip = _zip as JSZip & JSZipObject;
    const hash = [...new Uint8Array(hashBytes)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const files = Object.values(zip.files)
      .filter((f) => !f.dir)
      .map((f) => f.name);
    const state: Analysis = { obfuscation: {}, flags: {} };

    const fileDesc = `\`${escape(file.filename)}\` (${getSize(file.size)})`;
    const genEmbeds = () => {
      const embeds = [];
      let flagDescription = [];
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
      embeds.push({
        title: "Flags",
        color: 11192319,
        description:
          flagDescription.join("\n\n") ||
          "*No flags. This mod is safe, unless there's something that RatRater missed.*",
      });
      const officialFile = (hashes as any[]).find((h) => h.hash == hash);
      if (state.flagged) {
        embeds.push({
          title: "Almost definitely a rat",
          color: 16757931,
          description:
            `Classification: ${state.flagged.name}
` +
            (state.flagged.file
              ? `Example file: \`${escape(state.flagged.file)}\``
              : "To prevent reverse engineering, you cannot see the cause"),
        });
      } else if (officialFile) {
        embeds.push({
          title: "Probably safe",
          color: 14531808,
          description:
            `Found in an official source, ${officialFile.source}` +
            `, as \`${escape(officialFile.file)}\``,
        });
      }
      return embeds;
    };

    prescan(zip, files, state);

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
      const json = (await resp.json()) as any;
      if (!state.flagged) {
        if (json.class == "sure") {
          state.flagged = { name: "Quantiy" };
        } else if (json.class == "maybe") {
          state.flagged = { name: "Quantiy (low confidence)" };
        }
      }
    };
    tasks.push(apiAnalysisTask());

    await update1;
    const update2 = fetch(
      `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
      {
        method: "PATCH",
        body: JSON.stringify({
          content: `<a:loading:1121137235123765400> Scanning ${tasks.length} things...
${fileDesc}`,
          embeds: genEmbeds(),
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const catchTask = (e: Error) => {
      console.error("While scanning,", e);
    };
    await Promise.all(tasks.map((task) => task.catch(catchTask)));

    await update2;
    await fetch(
      `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
      {
        method: "PATCH",
        body: JSON.stringify({
          content: `${fileDesc} is **done**.`,
          embeds: genEmbeds(),
        }),
        headers: { "Content-Type": "application/json" },
      }
    );
  };
  ctx.waitUntil(start());
  return json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content:
        "<a:loading:1121137235123765400> Downloading `" +
        escape(file.filename) +
        "`...",
    },
  });
};
