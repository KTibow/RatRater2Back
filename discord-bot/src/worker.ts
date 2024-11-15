import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from "discord-interactions";
import scan from "./scan";

export interface Env {
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  quantiy: Fetcher;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname != "/") {
      return new Response("Not Found", { status: 404 });
    }
    if (request.method != "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const signature = request.headers.get("x-signature-ed25519");
    const timestamp = request.headers.get("x-signature-timestamp");
    const body = await request.text();
    if (!signature || !timestamp || !body) {
      return new Response("Bad Request", { status: 400 });
    }
    if (
      !(await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY))
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const interaction = JSON.parse(body);
    if (!interaction) {
      return new Response("Bad Request", { status: 400 });
    }
    if (interaction.type == InteractionType.PING) {
      return new Response(
        JSON.stringify({ type: InteractionResponseType.PONG })
      );
    }
    if (interaction.type == InteractionType.APPLICATION_COMMAND) {
      if (interaction.data.name == "scan") {
        return await scan(interaction, env, ctx);
      } else {
        return new Response("Unknown Command", { status: 400 });
      }
    }
    return new Response("Unknown Interaction", { status: 400 });
  },
};
