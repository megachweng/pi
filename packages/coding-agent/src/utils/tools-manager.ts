import { spawnSync } from "child_process";

export type ToolName = "fd" | "rg";

export type ToolLookup = { type: "found"; path: string } | { type: "missing"; message: string };

interface ToolConfig {
	name: string;
	// An environment variable, not a setting: a project's settings file must not choose an executable Pi runs.
	pathEnvVar: string;
	commandNames: string[];
}

const TOOLS: Record<ToolName, ToolConfig> = {
	fd: { name: "fd", pathEnvVar: "PI_FD_PATH", commandNames: ["fd", "fdfind"] },
	rg: { name: "ripgrep", pathEnvVar: "PI_RG_PATH", commandNames: ["rg"] },
};

/** Finds an installed tool: the executable its environment variable names, else a command on PATH. Never downloads. */
export function findTool(tool: ToolName): ToolLookup {
	const config = TOOLS[tool];

	const configuredPath = process.env[config.pathEnvVar];
	if (configuredPath) {
		const failure = getRunFailure(configuredPath);
		if (failure === undefined) return { type: "found", path: configuredPath };
		// A wrong setting must surface: falling through to PATH could run a different executable.
		return { type: "missing", message: `${config.pathEnvVar} is set to ${configuredPath}, but ${failure}` };
	}

	for (const commandName of config.commandNames) {
		if (getRunFailure(commandName) === undefined) return { type: "found", path: commandName };
	}

	return {
		type: "missing",
		message: `${config.name} not found. Set ${config.pathEnvVar} to its executable or add it to PATH.`,
	};
}

function getRunFailure(command: string): string | undefined {
	const result = spawnSync(command, ["--version"], { stdio: "pipe" });
	if (result.error) return `it cannot be run: ${result.error.message}`;
	if (result.status !== 0) return `it exited with status ${result.status ?? "unknown"}`;
	return undefined;
}
