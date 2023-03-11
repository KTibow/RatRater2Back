type Match =
  | { type: "name" | "contents"; contains: string }
  | { type: "name" | "contents"; regex: [string, string] }
  | { type: "and"; match: Match[] }
  | { type: "or"; match: Match[] };
export function testMatch(match: Match, path: string, contents?: string): boolean;
