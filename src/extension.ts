import * as vscode from "vscode";

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

	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document, collection, getWorkspacePath());
	}

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			updateDiagnostics(event.document, collection, getWorkspacePath());
		})
	);
}

// Define an execute function
import {spawnSync} from "child_process";
function executeIn(stdin: string, cwd: string | null): string {
	let result = spawnSync("luau-analyze", ["--formatter=plain", "-"], {input: stdin, cwd: cwd as any});

	return result.stdout.toString();
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection, cwd: string | null): void {
	let path = document.uri.fsPath;

	if (document && (path.endsWith(".lua") || path.endsWith(".luau"))) {
		let errors = executeIn(document.getText(), cwd);
		let split = errors.split("\n");

		collection.delete(document.uri);
		let diagnostics: vscode.Diagnostic[] = [];

		split.forEach((line) => {
			let match = line.match(/^.*:(\d*):(\d*-\d*): \(.*\) (.*?): (.*)/);
			if (!match) {
				return;
			}

			let lineNumber = parseInt(match[1]) - 1;
			let range1 = parseInt(match[2].split("-")[0]);
			let range2 = parseInt(match[2].split("-")[1]);

			let severity = vscode.DiagnosticSeverity.Warning;

			if (match[3].match(/Error/)) {
				severity = vscode.DiagnosticSeverity.Error;
			} else if (match[3].match(/Unused/)) {
				severity = vscode.DiagnosticSeverity.Information;
			}

			let lineDiagnostic = new vscode.Diagnostic(
				new vscode.Range(new vscode.Position(lineNumber, range1 - 1), new vscode.Position(lineNumber, range2)),
				match[4] + (match[4].endsWith(".") ? "." : ""),
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
