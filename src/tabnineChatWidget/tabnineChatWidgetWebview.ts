import * as vscode from "vscode";
import { ChatViewProvider } from "./ChatViewProvider";
import { Capability, isCapabilityEnabled } from "../capabilities/capabilities";
import { getMessageSegments } from "./messageParser";

const VIEW_ID = "tabnine.chat";

export default function registerTabnineChatWidgetWebview(
  context: vscode.ExtensionContext
): void {
  if (
    isCapabilityEnabled(Capability.ALPHA_CAPABILITY) ||
    isCapabilityEnabled(Capability.TABNINE_CHAT)
  ) {
    const chatProvider = new ChatViewProvider(context);
    registerWebview(context, chatProvider);
    vscode.interactive.registerInteractiveEditorSessionProvider({
      async provideInteractiveEditorResponse(
        request: vscode.InteractiveEditorRequest
      ): Promise<
        | vscode.InteractiveEditorResponse
        | vscode.InteractiveEditorMessageResponse
      > {
        const response = await chatProvider.getResponse(request.prompt);
        console.log("provideInteractiveEditorResponse", request);

        const messageParts = getMessageSegments(response);
        const codeBlock = messageParts.find((part) => part.type === "code")
          ?.content;
        console.log("codeBlock", codeBlock);

        if (codeBlock) {
          if (!request.wholeRange.isEmpty) {
            return {
              edits: [new vscode.TextEdit(request.wholeRange, codeBlock)],
            };
          }
        }

        return { contents: new vscode.MarkdownString(response) };
      },

      prepareInteractiveEditorSession(
        interactiveContext: vscode.TextDocumentContext
      ): vscode.ProviderResult<vscode.InteractiveEditorSession> {
        console.log(
          "prepareInteractiveEditorSession",
          interactiveContext.action
        );
        return {
          placeholder: "Type your question here...",
          message: "tabnine assistant",
        };
      },
    });

    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        { pattern: "**" },
        {
          provideCodeActions(
            document,
            position: vscode.Range | vscode.Selection,
            codeActionContext: vscode.CodeActionContext
          ) {
            const warnings = codeActionContext.diagnostics
              .filter((e) => e.severity <= vscode.DiagnosticSeverity.Warning)
              .map((e) => e.message)
              .join(", ");
            if (!warnings || warnings === "") {
              return [];
            }

            const codeAction = new vscode.CodeAction(
              "Fix using Tabnine",
              vscode.CodeActionKind.QuickFix
            );
            codeAction.command = {
              command: "interactiveEditor.start",
              title: "Fix using Tabnine",
              arguments: [
                {
                  autoSend: true,
                  message: `Please fix my code. ${warnings}`,
                },
              ],
            };
            return [codeAction];
          },
        },
        {
          providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
        }
      )
    );
    void vscode.commands.executeCommand(
      "setContext",
      "tabnine.chat.ready",
      true
    );
  }
}

function registerWebview(
  context: vscode.ExtensionContext,
  chatProvider: ChatViewProvider
): void {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, chatProvider, {
      webviewOptions: {
        retainContextWhenHidden: true, // keeps the state of the webview even when it's not visible
      },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tabnine.chat.focus-input", () => {
      chatProvider.focusWebviewInput();
    }),
    vscode.commands.registerCommand("tabnine.chat.history", () => {
      chatProvider.moveToView("history");
    }),
    vscode.commands.registerCommand(
      "tabnine.chat.create-new-conversation",
      () => {
        chatProvider.createNewConversation();
      }
    ),
    vscode.commands.registerCommand("tabnine.chat.clear-conversation", () => {
      chatProvider.clearConversation();
    })
  );
}
