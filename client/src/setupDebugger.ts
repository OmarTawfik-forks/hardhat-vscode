import vscode from "vscode";

export async function setupDebugger(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      "solidity",
      new SolidityDebugConfigurationProvider(),
      vscode.DebugConfigurationProviderTriggerKind.Dynamic
    ),
    vscode.debug.registerDebugAdapterDescriptorFactory(
      "solidity",
      new SolidityDebugAdapterDescriptorFactory()
    )
  );
}

class SolidityDebugConfigurationProvider
  implements vscode.DebugConfigurationProvider
{
  public resolveDebugConfiguration(
    _folder: vscode.WorkspaceFolder | undefined,
    _config: vscode.DebugConfiguration,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    return {
      type: "solidity",
      name: "Dynamic Launch",
      request: "launch",
      program: "${file}", // eslint-disable-line no-template-curly-in-string
    };
  }
}

class SolidityDebugAdapterDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  public createDebugAdapterDescriptor(
    _session: vscode.DebugSession,
    _executable: vscode.DebugAdapterExecutable | undefined
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    const command = "../../mycli/out/index.js";
    const args = ["debugger-mode"];
    const options = {
      cwd: undefined,
      env: {},
    };

    return new vscode.DebugAdapterExecutable(command, args, options);
  }
}
