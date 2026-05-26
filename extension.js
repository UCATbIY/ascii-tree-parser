const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
function isFileItem(name) {
  const cleanName = name.trim();
  if (cleanName.endsWith("/")) return false;
  if (/\.\w+$/.test(cleanName)) return true;
  if (cleanName.startsWith(".")) return true;
  const knownFiles = [
    "readme",
    "license",
    "dockerfile",
    "makefile",
    "gemfile",
    "procfile",
    "rakefile",
    "vagrantfile",
    "cabal",
    "cargo",
    "containerfile",
    "justfile",
    "build",
    "install",
    "configure",
    "jenkinsfile",
    "changelog",
    "contributing",
    "code_of_conduct",
    "security",
    "authors",
    "notice",
    "copying",
    "podfile",
    "mod",
    "cartfile",
    "brewfile",
    "fastfile",
    "appfile",
    "matchfile",
    "sum",
    "codeowners",
    ".terraformrc",
    ".vscode",
    ".idea",
    ".editorconfig",
    ".prettierignore",
    ".github",
    ".env",
    ".npmrc",
    ".npmignore",
    ".yarnrc",
    ".gitattributes",
    ".gitmodules",
    ".gitconfig",
    ".dockerignore",
    ".editorconfig",
    ".prettierrc",
    ".eslintrc",
    ".stylelintrc",
    ".babelrc",
    ".flaskenv",
    ".python-version",
    ".nvmrc",
    ".node-version",
    ".tool-versions",
    ".mailmap",
    ".gitmessage",
    ".htaccess",
    ".htpasswd",
    ".gitignore",
    ".bashrc",
    ".bash_profile",
    ".bash_history",
    ".zshrc",
    ".zprofile",
    ".profile",
    ".vimrc",
  ];
  return knownFiles.includes(cleanName.toLowerCase());
}
function cleanName(name) {
  let cleaned = name;
  cleaned = cleaned.replace(/^[├─└│\s]+/, "");
  cleaned = cleaned.replace(/\s*\/\*.*?\*\//g, "");
  cleaned = cleaned.replace(/\s*\/\/.*$/, "");
  cleaned = cleaned.replace(/\s*#.*$/, "");
  cleaned = cleaned.replace(/\s*--.*$/, "");
  cleaned = cleaned.replace(/\s*<-.*$/, "");
  cleaned = cleaned.replace(/\s*->.*$/, "");
  cleaned = cleaned.replace(/\s*<--.*$/, "");
  cleaned = cleaned.replace(/\s*-->.*$/, "");
  cleaned = cleaned.replace(/\s*=>.*$/, "");
  cleaned = cleaned.replace(/\s*<=\s*.*$/, "");
  cleaned = cleaned.replace(/\s*\(.*?\)$/, "");
  cleaned = cleaned.replace(/\s*\[.*?\]$/, "");
  cleaned = cleaned.replace(/\s*\{.*?\}$/, "");
  cleaned = cleaned.replace(/\s*[;,:|<>+=~!@$%^&*].*$/, "");
  cleaned = cleaned.replace(/[│├└─┐┌┬┴┼]/g, "");
  return cleaned.trim();
}
function parseTreeStructure(treeString) {
  const lines = treeString.split("\n");
  const items = [];
  for (let line of lines) {
    if (line.trim() === "") continue;
    let nameStart = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (
        ch === "│" ||
        ch === "├" ||
        ch === "└" ||
        ch === "─" ||
        ch === "┐" ||
        ch === "┌" ||
        ch === "┴" ||
        ch === "┬" ||
        ch === "┼" ||
        ch === " " ||
        ch === "в" ||
        ch === "”" ||
        ch === "Ђ"
      ) {
        nameStart = i + 1;
      } else {
        break;
      }
    }
    let name = line.substring(nameStart).trim();
    if (name === "") continue;
    name = cleanName(name);
    if (name === "") continue;
    items.push({
      position: nameStart,
      name: name,
    });
  }
  if (items.length === 0) return null;
  const root = {
    name: items[0].name,
    position: 0,
    level: 0,
    isRoot: true,
    children: [],
    parent: null,
  };
  const itemsWithLevel = [root];
  for (let i = 1; i < items.length; i++) {
    const level = Math.floor(items[i].position / 2);
    const node = {
      name: items[i].name,
      position: items[i].position,
      level: level,
      isRoot: false,
      children: [],
      parent: null,
      isFile: false,
    };
    itemsWithLevel.push(node);
  }
  const stack = [root];
  for (let i = 1; i < itemsWithLevel.length; i++) {
    const current = itemsWithLevel[i];
    while (stack.length > 0 && stack[stack.length - 1].level >= current.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    current.parent = parent;
    parent.children.push(current);
    stack.push(current);
  }
  function markFiles(node) {
    if (node.children.length === 0 && !node.isRoot) {
      node.isFile = isFileItem(node.name);
    }
    for (const child of node.children) {
      markFiles(child);
    }
  }
  markFiles(root);
  return root;
}
function createStructure(root, basePath) {
  if (!root) return false;
  const rootPath = path.join(basePath, root.name.replace(/\/$/, ""));
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true });
  }
  function createNode(node, currentPath) {
    const nodePath = path.join(currentPath, node.name.replace(/\/$/, ""));
    if (!node.isFile) {
      if (!fs.existsSync(nodePath)) {
        fs.mkdirSync(nodePath, { recursive: true });
      }
      for (const child of node.children) {
        createNode(child, nodePath);
      }
    } else {
      const dir = path.dirname(nodePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(nodePath)) {
        fs.writeFileSync(nodePath, "", "utf8");
      }
    }
  }
  for (const child of root.children) {
    createNode(child, rootPath);
  }
  return true;
}
function activate(context) {
  let disposable = vscode.commands.registerCommand(
    "ascii-tree-parser.generate",
    async () => {
      try {
        const treeString = await vscode.env.clipboard.readText();
        if (!treeString || treeString.trim().length === 0) {
          vscode.window.showErrorMessage("Clipboard is empty!");
          return;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage(
            "Please open a folder in VS Code first.",
          );
          return;
        }
        const root = parseTreeStructure(treeString);
        if (!root || root.children.length === 0) {
          vscode.window.showErrorMessage(
            "No valid tree structure found in clipboard!",
          );
          return;
        }
        const success = createStructure(root, workspaceFolders[0].uri.fsPath);
        if (success) {
          vscode.window.showInformationMessage(
            "Project structure created successfully!",
          );
        } else {
          vscode.window.showErrorMessage("Failed to create structure!");
        }
      } catch (err) {
        vscode.window.showErrorMessage("Error: " + err.message);
      }
    },
  );
  context.subscriptions.push(disposable);
}
function deactivate() {}
module.exports = {
  activate,
  deactivate,
};
