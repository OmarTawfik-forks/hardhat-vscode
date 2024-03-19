import {
  DidChangeTextDocumentParams,
  NotificationHandler,
  Diagnostic,
} from "vscode-languageserver";
import { DiagnosticSeverity } from "@common/types";
import { analyze } from "@nomicfoundation/solidity-analyzer";
import { RuleKind } from "@nomicfoundation/slang/kinds";
import { TokenNode } from "@nomicfoundation/slang/cst";
import assert from "assert";
import { Query } from "@nomicfoundation/slang/query";
import { ServerState } from "../types";
import { getLanguage, slangToVSCodeRange } from "../parser/slangHelpers";

export const lintOnTextChange = (
  serverState: ServerState
): NotificationHandler<DidChangeTextDocumentParams> => {
  return (params: DidChangeTextDocumentParams) => {
    const { uri } = params.textDocument;

    // Find the file in the documents collection
    const document = serverState.documents.get(uri);
    if (document === undefined) {
      console.warn("Missing doc?");
      return;
    }
    const text = document.getText();

    // Get the document's solidity version
    const { versionPragmas } = analyze(text);

    try {
      const language = getLanguage(versionPragmas);

      const parseOutput = language.parse(
        RuleKind.SourceUnit,
        document.getText()
      );

      const query = Query.parse("@result [UintKeyword]");

      const cursor = parseOutput.createTreeCursor();
      const result = cursor.query([query]);

      const errorRanges = [];

      let elem = null;
      while ((elem = result.next())) {
        const typeNameCur = elem.bindings.result[0];

        const node = typeNameCur.node();
        assert(node instanceof TokenNode);

        if (node.text === "uint") {
          errorRanges.push(typeNameCur.textRange);
        }
      }

      const diagnostics = errorRanges.map((range) => {
        const vscodeRange = slangToVSCodeRange(document, range);

        return Diagnostic.create(
          vscodeRange,
          "Use uint256 directly",
          DiagnosticSeverity.Warning
        );
      });

      void serverState.connection.sendDiagnostics({
        uri,
        diagnostics,
      });
    } catch (err) {
      serverState.logger.error(err);
    }
  };
};
