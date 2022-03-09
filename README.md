# Vscode-Luau-Analyzer

Vscode port of [zuex](https://github.com/zeux)'s [SumblimeLinter-Luau](https://github.com/zeux/SublimeLinter-luau).

NOTE: You need to have v512 luau-analyzer or greater in your environment path! (Found [here](https://github.com/Roblox/luau/releases/))

[Vscode Marketplace Link](https://marketplace.visualstudio.com/items?itemName=HawDevelopment.vscode-luau-analyzer)

## Errors

If your experiencing linter errors when requiring a module, you should try using `::` (typecast).

## Use for Roblox

If your using this extension for roblox development, you should consider creating a [`.luarc`](https://github.com/Roblox/luau/blob/master/rfcs/config-luaurc.md) file in your project root.

Heres a small template:

```json
{
	"languageMode": "strict", // nocheck, nonstrict, strict
	"lint": {"*": true, "LocalUnused": false},
	"lintErrors": true,
	"globals": [
		"delay",
		"DebuggerManager",
		"elapsedTime",
		"PluginManager",
		"printidentity",
		"settings",
		"spawn",
		"stats",
		"tick",
		"time",
		"UserSettings",
		"version",
		"wait",
		"warn",
		"Enum",
		"game",
		"plugin",
		"shared",
		"script",
		"workspace"
	]
}
```
