import { describe, expect, it } from "vitest";
import { compareProviders, isPreferredProvider, PREFERRED_PROVIDER_IDS } from "../src/core/preferred-providers.ts";

describe("compareProviders", () => {
	it("orders preferred partners first, in their order, then the rest by name", () => {
		const providers = [
			{ id: "zai", name: "Z.AI" },
			{ id: "opencode", name: "OpenCode" },
			{ id: "anthropic", name: "Anthropic" },
			{ id: "radius", name: "Radius" },
			{ id: "google", name: "Google" },
		];

		expect(PREFERRED_PROVIDER_IDS).toEqual(["radius"]);
		expect(providers.sort(compareProviders).map((provider) => provider.id)).toEqual([
			"radius",
			"anthropic",
			"google",
			"opencode",
			"zai",
		]);
	});
});

describe("isPreferredProvider", () => {
	it("recognizes only the preferred partners", () => {
		expect(isPreferredProvider("radius")).toBe(true);
		expect(isPreferredProvider("anthropic")).toBe(false);
	});
});
