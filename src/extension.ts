import * as vscode from "vscode";
import { spawnSync } from "child_process";
import fetch from "node-fetch";
import { TextEncoder } from "util";

const GLOBAL_TYPES_URL = "https://raw.githubusercontent.com/JohnnyMorganz/luau-analyze-rojo/master/globalTypes.d.lua";

let collection: vscode.DiagnosticCollection;

function getWorkspacePath(): string | null {
	let folders = vscode.workspace.workspaceFolders;
	if (folders) {
		return folders[0].uri.fsPath;
	}
	return null;
}

export function activate(context: vscode.ExtensionContext) {
	collection = vscode.languages.createDiagnosticCollection("luau");
	context.subscriptions.push(collection);

    let currentAnnotations = "";
    let currentSourceMap = "";

	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document, collection, getWorkspacePath());
	}

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "vscode-luau-analyzer.installTypes",
        () => {
          fetch(GLOBAL_TYPES_URL)
            .then((res) => res.text())
            .then((types) => {
              const workspaceFolders = vscode.workspace.workspaceFolders;
              if (!workspaceFolders) {
                throw new Error("No workspace folder open");
              }

              return vscode.workspace.fs.writeFile(
                vscode.Uri.joinPath(
                  workspaceFolders[0].uri,
                  vscode.workspace
                    .getConfiguration("vscode-luau-analyzer")
                    .get("typesFile", "globalTypes.d.lua")
                ),
                new TextEncoder().encode(types)
              );
            })
            .then(() => vscode.window.showInformationMessage("vscode-luau-analyzer: Downloaded latest types"))
            .catch((err) => vscode.window.showErrorMessage(`vscode-luau-analyzer: Failed to download types: ${err}`))
        }
      )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("vscode-luau-analyzer.showAnnotations", () => {
            if (!vscode.window.activeTextEditor) { return
            }
            const document = vscode.window.activeTextEditor.document;
            currentAnnotations = executeIn(document.uri.fsPath, document.getText(), getWorkspacePath(), true);
            vscode.window.showTextDocument(vscode.Uri.parse('luau-analyzer://annotations.luau'));
        })
    )

    context.subscriptions.push(
        vscode.commands.registerCommand("vscode-luau-analyzer.dumpSourceMap", () => {
            if (!vscode.window.activeTextEditor) { return
            }
            const document = vscode.window.activeTextEditor.document;
            currentSourceMap = executeIn(document.uri.fsPath, document.getText(), getWorkspacePath(), false, true);
            vscode.window.showTextDocument(vscode.Uri.parse('luau-analyzer://sourcemap'));
        })
    )

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((document) => {
			updateDiagnostics(document, collection, getWorkspacePath());
		})
	);
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			updateDiagnostics(event.document, collection, getWorkspacePath());
		})
	);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                updateDiagnostics(editor.document, collection, getWorkspacePath());
            }
        })
    );

    const annotationsTdcp = new class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(uri: vscode.Uri, ct: vscode.CancellationToken): vscode.ProviderResult<string> {
            if (uri.authority === "annotations.luau") {
                return currentAnnotations;
            } else if (uri.authority === "sourcemap") {
                return currentSourceMap;
            }
        }
    }
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("luau-analyzer", annotationsTdcp))
}

// Define an execute function
function executeIn(
  filepath: string,
  stdin: string,
  cwd: string | null,
  shouldAnnotate: boolean = false,
  shouldDumpSourceMap: boolean = false
): string {
  const projectName = vscode.workspace
    .getConfiguration("vscode-luau-analyzer")
    .get("projectName", "default.project.json");
  const typesFile = vscode.workspace
    .getConfiguration("vscode-luau-analyzer")
    .get("typesFile", "globalTypes.d.lua");

  const args = [
    "--formatter=plain",
    "--exclude-virtual-path",
    `--project=${projectName}`,
    `--defs=${typesFile}`,
    `--stdin-filepath=${filepath}`,
    "-",
  ];
  if (shouldAnnotate) {
    args.push("--annotate");
  }
  if (shouldDumpSourceMap) {
    args.push("--dump-source-map");
  }

  console.log("Running with arguments", args);
  let result = spawnSync("luau-analyze", args, {
    input: stdin,
    cwd: cwd as any,
  });

  return result.stdout.toString();
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection, cwd: string | null): void {
	let path = document.uri.fsPath;

	if (document && (path.endsWith(".lua") || path.endsWith(".luau"))) {
		let errors = executeIn(document.uri.fsPath, document.getText(), cwd);
		let split = errors.split("\n");

		collection.delete(document.uri);
		let diagnostics: vscode.Diagnostic[] = [];

		split.forEach((line) => {
			let match = line.match(/^(.*):(\d*):(\d*-\d*): \(.*\) (.*?): (.*)/);
			if (!match || match[1] !== "stdin") {
				return;
			}

			let lineNumber = parseInt(match[2]) - 1;
			let range1 = parseInt(match[3].split("-")[0]);
			let range2 = parseInt(match[3].split("-")[1]);

			let severity = vscode.DiagnosticSeverity.Warning;

			if (match[4].match(/Error/)) {
				severity = vscode.DiagnosticSeverity.Error;
			} else if (match[4].match(/Unused/)) {
				severity = vscode.DiagnosticSeverity.Information;
			}

			let lineDiagnostic = new vscode.Diagnostic(
				new vscode.Range(new vscode.Position(lineNumber, range1 - 1), new vscode.Position(lineNumber, range2)),
				match[5] + (match[5].endsWith(".") ? "." : ""),
				severity
			);

			diagnostics.push(lineDiagnostic);
		});

		collection.set(document.uri, diagnostics);
	} else {
		collection.clear();
	}
}

export function deactivate() {}
