export interface PluginFeature {
  code: string;
  explain: string;
  cmds: string[];
  ui?: {
    displayType: "button" | "widget";
    label: string;
    icon: string;
    color: string;
  };
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  logo: string;
  entryType: "panel" | "webview";
  main: string;
  features: PluginFeature[];
}
