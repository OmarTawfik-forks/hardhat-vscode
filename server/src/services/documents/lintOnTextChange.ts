import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TokenNode } from "@nomicfoundation/slang/cst";
import { RuleKind } from "@nomicfoundation/slang/kinds";
import { Query } from "@nomicfoundation/slang/query";
import { Language } from "@nomicfoundation/slang/language";
import { Cursor } from "@nomicfoundation/slang/cursor";
import { slangToVSCodeRange } from "../../parser/slangHelpers";

export function lintOnTextChange(doc: TextDocument): Diagnostic[] {
  const language = new Language("0.8.0");
  const parseOutput = language.parse(RuleKind.SourceUnit, doc.getText());
  const cursor = parseOutput.createTreeCursor();

  const diagnostics: Diagnostic[] = [];

  checkUnsizedUint(doc, cursor, diagnostics);
  checkDuplicateStructFields(doc, cursor, diagnostics);

  return diagnostics;
}

function checkUnsizedUint(
  doc: TextDocument,
  cursor: Cursor,
  diagnostics: Diagnostic[]
) {
  const query = Query.parse("@unsizedUint [UintKeyword]");
  const results = cursor.query([query]);

  let result;
  while ((result = results.next())) {
    const nodeCursor = result.bindings.unsizedUint[0];
    const node = nodeCursor.node() as TokenNode;

    if (node.text === "uint") {
      diagnostics.push(
        Diagnostic.create(
          slangToVSCodeRange(doc, nodeCursor.textRange),
          "Use uint256 directly.",
          DiagnosticSeverity.Information
        )
      );
    }
  }
}

function checkDuplicateStructFields(
  doc: TextDocument,
  cursor: Cursor,
  diagnostics: Diagnostic[]
) {
  const query = Query.parse(
    `[StructDefinition
        [name: @structName],
        ...,
        [StructMembers
            [StructMember [name: @fieldName]]
        ]
    ]`
  );

  const results = cursor.query([query]);

  let result;
  while ((result = results.next())) {
    const structNameCursor = result.bindings.structName[0];
    const structName = structNameCursor.node() as TokenNode;

    const fieldNameCursor = result.bindings.fieldName[0];
    const fieldName = fieldNameCursor.node() as TokenNode;

    if (structName.text === fieldName.text) {
      diagnostics.push(
        Diagnostic.create(
          slangToVSCodeRange(doc, fieldNameCursor.textRange),
          "Fields should have a different name than the parent struct.",
          DiagnosticSeverity.Information
        )
      );
    }
  }
}
