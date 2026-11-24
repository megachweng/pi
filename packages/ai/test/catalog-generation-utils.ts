import { writeFileSync } from "node:fs";
import type { ModelsDevV2Catalog } from "../catalog/sources/models-dev.ts";

/**
 * Write a `node --import` preload that serves every upstream catalog the
 * generator fetches: the given models.dev v2 catalog and a minimal decision
 * model list. Any other request fails.
 */
export function writeUpstreamMock(preloadPath: string, modelsDev: ModelsDevV2Catalog): void {
	const responses = {
		"https://models.dev/experimental/v2.0/api.json": modelsDev,
		"https://models.dev/models.json?type=decision": {
			"typesafe/jev-latest": { id: "typesafe/jev-latest", name: "Jev", type: "decision", limit: { context: 64000 } },
		},
	};
	writeFileSync(
		preloadPath,
		`const responses = ${JSON.stringify(responses)};\n` +
			`globalThis.fetch = async (input) => {\n` +
			`  const url = String(input);\n` +
			`  if (url in responses) return Response.json(responses[url]);\n` +
			`  throw new Error(\`Unexpected fetch: \${url}\`);\n` +
			`};\n`,
	);
}
