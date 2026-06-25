const consoleOutput = document.getElementById("consoleOutput");
const consoleInput = document.getElementById("consoleInput");

const runButton = document.getElementById("runButton");
const clearButton = document.getElementById("clearButton");
const openButton = document.getElementById("openButton");
const saveButton = document.getElementById("saveButton");
const saveAsButton = document.getElementById("saveAsButton");
const themeButton = document.getElementById("themeButton");

const fileInput = document.getElementById("fileInput");
const fileNameText = document.getElementById("fileNameText");
const sandboxFrame = document.getElementById("sandboxFrame");
const statusText = document.getElementById("statusText");

let liveUpdateTimeout = null;

let commandHistory = [];
let commandHistoryIndex = -1;

let currentFileHandle = null;
let currentFileName = "script.js";

const codeEditor = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
  mode: "javascript",
  lineNumbers: true,
  tabSize: 2,
  indentUnit: 2,
  lineWrapping: true,
  autofocus: true,
  extraKeys: {
    "Ctrl-Enter": function () {
      runCode();
    },

    "Ctrl-S": function () {
      saveFile();
    },

    "Ctrl-O": function () {
      openFile();
    },

    "Tab": function (editor) {
      if (editor.somethingSelected()) {
        editor.indentSelection("add");
      } else {
        editor.replaceSelection("  ", "end");
      }
    }
  }
});

const defaultCode = `console.log("JavaScript is working!");

function sayHello() {
  console.log("Hello from function");
}

sayHello();

let number = 10;
console.log("Number is:", number);
`;

codeEditor.setValue(defaultCode);

function applyTheme(themeName) {
  if (themeName === "light") {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
    themeButton.textContent = "Dark";
    localStorage.setItem("mini-js-editor-theme", "light");
  } else {
    document.body.classList.remove("light-theme");
    document.body.classList.add("dark-theme");
    themeButton.textContent = "Light";
    localStorage.setItem("mini-js-editor-theme", "dark");
  }

  codeEditor.refresh();
}

function toggleTheme() {
  if (document.body.classList.contains("dark-theme")) {
    applyTheme("light");
  } else {
    applyTheme("dark");
  }
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem("mini-js-editor-theme");

  if (savedTheme === "light") {
    applyTheme("light");
  } else {
    applyTheme("dark");
  }
}

function updateFileNameText() {
  fileNameText.textContent = currentFileName;
}

function formatValue(value) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "function") {
    return value.toString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }

  return String(value);
}

function addConsoleLine(message, type = "log") {
  const line = document.createElement("div");

  line.classList.add("console-line");

  if (type === "error") {
    line.classList.add("console-error");
  } else if (type === "warn") {
    line.classList.add("console-warn");
  } else if (type === "info") {
    line.classList.add("console-info");
  } else if (type === "system") {
    line.classList.add("console-system");
  } else if (type === "command") {
    line.classList.add("console-command");
  } else if (type === "result") {
    line.classList.add("console-result");
  } else {
    line.classList.add("console-log");
  }

  line.textContent = message;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
  consoleOutput.innerHTML = "";
}

function runCode() {
  clearConsole();

  const userCode = codeEditor.getValue();

  addConsoleLine("Running " + currentFileName + "...", "system");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>

<script>
(function() {
  function formatValue(value) {
    if (value === null) {
      return "null";
    }

    if (value === undefined) {
      return "undefined";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (typeof value === "function") {
      return value.toString();
    }

    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return String(value);
      }
    }

    return String(value);
  }

  function sendToParent(type, values) {
    parent.postMessage({
      source: "mini-js-editor",
      type: type,
      values: values.map(formatValue)
    }, "*");
  }

  console.log = function() {
    sendToParent("log", Array.from(arguments));
  };

  console.warn = function() {
    sendToParent("warn", Array.from(arguments));
  };

  console.error = function() {
    sendToParent("error", Array.from(arguments));
  };

  console.info = function() {
    sendToParent("info", Array.from(arguments));
  };

  window.addEventListener("error", function(event) {
    sendToParent("error", [
      "Error: " + event.message + " on line " + event.lineno
    ]);
  });

  window.addEventListener("unhandledrejection", function(event) {
    sendToParent("error", [
      "Promise error: " + event.reason
    ]);
  });
})();
<\/script>

<script>
${userCode}
<\/script>

</body>
</html>
`;

  sandboxFrame.srcdoc = html;
}

function executeConsoleCommand() {
  const command = consoleInput.value;

  if (command.trim() === "") {
    return;
  }

  addConsoleLine("> " + command, "command");

  commandHistory.push(command);
  commandHistoryIndex = commandHistory.length;

  consoleInput.value = "";

  try {
    const iframeWindow = sandboxFrame.contentWindow;

    if (!iframeWindow) {
      addConsoleLine("Console is not ready yet.", "error");
      return;
    }

    const result = iframeWindow.eval(command);

    if (result && typeof result.then === "function") {
      result
        .then(function (value) {
          if (value !== undefined) {
            addConsoleLine(formatValue(value), "result");
          }
        })
        .catch(function (error) {
          addConsoleLine(error.name + ": " + error.message, "error");
        });

      return;
    }

    if (result !== undefined) {
      addConsoleLine(formatValue(result), "result");
    }
  } catch (error) {
    addConsoleLine(error.name + ": " + error.message, "error");
  }
}

async function openFile() {
  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "Text and JavaScript files",
            accept: {
              "text/plain": [".js", ".txt", ".html", ".css", ".json"]
            }
          }
        ]
      });

      const handle = handles[0];
      const file = await handle.getFile();
      const text = await file.text();

      currentFileHandle = handle;
      currentFileName = file.name;

      codeEditor.setValue(text);
      updateFileNameText();

      addConsoleLine("Opened file: " + currentFileName, "system");

      runCode();
    } catch (error) {
      if (error.name !== "AbortError") {
        addConsoleLine("Could not open file: " + error.message, "error");
      }
    }

    return;
  }

  fileInput.click();
}

async function saveFile() {
  const text = codeEditor.getValue();

  if (currentFileHandle && currentFileHandle.createWritable) {
    try {
      const writable = await currentFileHandle.createWritable();

      await writable.write(text);
      await writable.close();

      addConsoleLine("Saved: " + currentFileName, "system");
      return;
    } catch (error) {
      addConsoleLine("Could not save directly to file: " + error.message, "error");
    }
  }

  downloadFile(currentFileName, text);
}

async function saveAsFile() {
  const text = codeEditor.getValue();

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: currentFileName,
        types: [
          {
            description: "JavaScript file",
            accept: {
              "text/plain": [".js", ".txt", ".html", ".css", ".json"]
            }
          }
        ]
      });

      currentFileHandle = handle;
      currentFileName = handle.name || currentFileName;

      const writable = await handle.createWritable();

      await writable.write(text);
      await writable.close();

      updateFileNameText();

      addConsoleLine("Saved as: " + currentFileName, "system");
    } catch (error) {
      if (error.name !== "AbortError") {
        addConsoleLine("Could not save file: " + error.message, "error");
      }
    }

    return;
  }

  downloadFile(currentFileName, text);
}

function downloadFile(fileName, text) {
  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "script.js";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  addConsoleLine("Downloaded file as: " + fileName, "system");
}

window.addEventListener("message", function (event) {
  if (!event.data || event.data.source !== "mini-js-editor") {
    return;
  }

  const type = event.data.type;
  const values = event.data.values;

  addConsoleLine(values.join(" "), type);
});

codeEditor.on("change", function () {
  statusText.textContent = "Waiting for typing to stop...";

  clearTimeout(liveUpdateTimeout);

  liveUpdateTimeout = setTimeout(function () {
    statusText.textContent = "Live update enabled";
    runCode();
  }, 600);
});

consoleInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    executeConsoleCommand();
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();

    if (commandHistory.length === 0) {
      return;
    }

    commandHistoryIndex--;

    if (commandHistoryIndex < 0) {
      commandHistoryIndex = 0;
    }

    consoleInput.value = commandHistory[commandHistoryIndex];
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();

    if (commandHistory.length === 0) {
      return;
    }

    commandHistoryIndex++;

    if (commandHistoryIndex >= commandHistory.length) {
      commandHistoryIndex = commandHistory.length;
      consoleInput.value = "";
      return;
    }

    consoleInput.value = commandHistory[commandHistoryIndex];
  }
});

fileInput.addEventListener("change", function () {
  const file = fileInput.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = function () {
    currentFileHandle = null;
    currentFileName = file.name;

    codeEditor.setValue(String(reader.result));
    updateFileNameText();

    addConsoleLine("Opened file: " + currentFileName, "system");

    runCode();
  };

  reader.onerror = function () {
    addConsoleLine("Could not read file.", "error");
  };

  reader.readAsText(file);
});

openButton.addEventListener("click", function () {
  openFile();
});

saveButton.addEventListener("click", function () {
  saveFile();
});

saveAsButton.addEventListener("click", function () {
  saveAsFile();
});

runButton.addEventListener("click", function () {
  runCode();
});

clearButton.addEventListener("click", function () {
  clearConsole();
});

themeButton.addEventListener("click", function () {
  toggleTheme();
});

document.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveFile();
  }

  if (event.ctrlKey && event.key.toLowerCase() === "o") {
    event.preventDefault();
    openFile();
  }
});

loadSavedTheme();
updateFileNameText();
runCode();
