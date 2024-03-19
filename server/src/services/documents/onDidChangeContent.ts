import assert from "node:assert";
import {
  Diagnostic,
  DiagnosticSeverity,
  TextDocumentChangeEvent,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TokenNode } from "@nomicfoundation/slang/cst";
import { RuleKind } from "@nomicfoundation/slang/kinds";
import { Query } from "@nomicfoundation/slang/query";
import { analyze } from "@nomicfoundation/solidity-analyzer";
import { debounce } from "../../utils/debounce";
import { ServerState } from "../../types";
import { analyse } from "../validation/analyse";
import { validate } from "../validation/validate";
import { isTestMode } from "../../utils";
import { getLanguage, slangToVSCodeRange } from "../../parser/slangHelpers";

type ChangeAction = (
  serverState: ServerState,
  change: TextDocumentChangeEvent<TextDocument>
) => void;

interface DocumentChangeActions {
  [uri: string]: ChangeAction;
}

interface FunctionDebounceState {
  action: ChangeAction;
  changeActions: DocumentChangeActions;
  wait: number;
}

interface DebounceState {
  analyse: FunctionDebounceState;
  validate: FunctionDebounceState;
}

export function onDidChangeContent(serverState: ServerState) {
  const debounceState: DebounceState = {
    analyse: {
      action: analyse,
      changeActions: {},
      wait: isTestMode() ? 0 : 240,
    },
    validate: {
      action: validate,
      changeActions: {},
      wait: isTestMode() ? 0 : 250,
    },
  };

  return (change: TextDocumentChangeEvent<TextDocument>) => {
    const { logger } = serverState;
    try {
      if (change.document.languageId !== "solidity") {
        return;
      }

      logger.trace("onDidChangeContent");

      debouncePerDocument(debounceState.analyse, serverState, change);
      // For the purposes of the demo, don't peform the validation with diagnostics
      // debouncePerDocument(debounceState.validate, serverState, change);
      lintOnTextChange(change.document, serverState);
    } catch (err) {
      logger.error(err);
    }
  };
}

function debouncePerDocument(
  { action, changeActions, wait }: FunctionDebounceState,
  serverState: ServerState,
  change: TextDocumentChangeEvent<TextDocument>
) {
  if (changeActions[change.document.uri] === undefined) {
    changeActions[change.document.uri] = debounce(action, wait);
  }

  changeActions[change.document.uri](serverState, change);
}

function lintOnTextChange(doc: TextDocument, serverState: ServerState) {
  const text = doc.getText();

  // Get the document's solidity version
  const { versionPragmas } = analyze(text);

  try {
    const language = getLanguage(versionPragmas);

    const parseOutput = language.parse(RuleKind.SourceUnit, doc.getText());

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

    const diagnostics = errorRanges.map((range) =>
      Diagnostic.create(
        slangToVSCodeRange(doc, range),
        "Use uint256 directly",
        DiagnosticSeverity.Warning
      )
    );

    void serverState.connection.sendDiagnostics({
      uri: doc.uri,
      diagnostics,
    });
  } catch (err) {
    serverState.logger.error(err);
  }
}
