import type { ClientIdentity } from "@earendil-works/pi-ai";
import { VERSION } from "../config.ts";

/**
 * How pi's requests identify it to providers: a detailed `User-Agent` with pi's version and no attribution headers.
 * `attribution: null` is explicit because the agent loop's default identity attributes requests to pi.
 */
export const CLIENT_IDENTITY: ClientIdentity = {
	userAgent: "detailed",
	version: VERSION,
	attribution: null,
};
