import "dotenv/config";
import fs from "node:fs/promises";

const apiKey = process.env.LYZR_API_KEY;

if (!apiKey) {
  throw new Error("LYZR_API_KEY is not configured");
}

const schema = JSON.parse(
  await fs.readFile(
    new URL("../../openapi.json", import.meta.url),
    "utf8",
  ),
);

const response = await fetch(
  "https://agent-prod.studio.lyzr.ai/v3/tools/",
  {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      tool_set_name: "sage-memory",
      openapi_schema: schema,
      default_headers: {
        "x-sage-tool-key": process.env.SAGE_TOOL_API_KEY,
      },
      enhance_descriptions: false,
    }),
  },
);

const body = await response.text();
console.log("HTTP:", response.status);
console.log(body);

if (!response.ok) {
  process.exit(1);
}
