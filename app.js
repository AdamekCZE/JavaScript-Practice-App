const consoleOutput = document.getElementById("consoleOutput");
const consoleInput = document.getElementById("consoleInput");
const scrollToBottomButton = document.getElementById("scrollToBottomButton");

const runButton = document.getElementById("runButton");
const clearButton = document.getElementById("clearButton");
const openButton = document.getElementById("openButton");
const saveButton = document.getElementById("saveButton");
const saveAsButton = document.getElementById("saveAsButton");
const themeButton = document.getElementById("themeButton");
const settingsMenuWrap = document.getElementById("settingsMenuWrap");
const settingsButton = document.getElementById("settingsButton");
const hideEditorButton = document.getElementById("hideEditorButton");
const hideConsoleButton = document.getElementById("hideConsoleButton");
const swapButton = document.getElementById("swapButton");
const layoutButton = document.getElementById("layoutButton");
const resetLayoutButton = document.getElementById("resetLayoutButton");

const fileInput = document.getElementById("fileInput");
const fileNameText = document.getElementById("fileNameText");
const sandboxFrame = document.getElementById("sandboxFrame");
const statusText = document.getElementById("statusText");
const app = document.querySelector(".app");
const splitter = document.getElementById("splitter");

let liveUpdateTimeout = null;
let userCodeUrl = null;
let highlightedLineHandle = null;
let shouldAutoScrollConsole = true;

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

function safeSourceName(fileName) {
  return String(fileName || "script.js").replace(/[\r\n]/g, "").replace(/[\\/]/g, "_");
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

function addConsoleLine(message, type = "log", options = {}) {
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

  if (options.lineNumber && options.lineNumber > 0) {
    line.dataset.lineNumber = String(options.lineNumber);
    line.title = "Click to show this line in the code editor";
  }

  consoleOutput.appendChild(line);
  scrollConsoleToBottomIfNeeded();
}

function clearConsole() {
  consoleOutput.innerHTML = "";
  enableConsoleAutoScroll();
}

function isConsoleScrolledToBottom() {
  const distanceFromBottom = consoleOutput.scrollHeight - consoleOutput.scrollTop - consoleOutput.clientHeight;
  return distanceFromBottom <= 4;
}

function updateScrollToBottomButton() {
  const shouldShowButton = !shouldAutoScrollConsole && !isConsoleScrolledToBottom();
  scrollToBottomButton.classList.toggle("visible", shouldShowButton);
}

function scrollConsoleToBottom() {
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function enableConsoleAutoScroll() {
  shouldAutoScrollConsole = true;
  scrollConsoleToBottom();
  updateScrollToBottomButton();
}

function scrollConsoleToBottomIfNeeded() {
  if (shouldAutoScrollConsole) {
    scrollConsoleToBottom();
  }

  updateScrollToBottomButton();
}

function clearHighlightedErrorLine() {
  if (highlightedLineHandle) {
    highlightedLineHandle.clear();
    highlightedLineHandle = null;
  }
}

function showEditorLine(lineNumber) {
  if (!lineNumber || lineNumber < 1) {
    return;
  }

  if (app.classList.contains("editor-hidden")) {
    app.classList.remove("editor-hidden");
    hideEditorButton.textContent = "Hide Code";
  }

  clearHighlightedErrorLine();

  const zeroBasedLine = lineNumber - 1;
  highlightedLineHandle = codeEditor.addLineClass(zeroBasedLine, "background", "error-line-highlight");
  codeEditor.scrollIntoView({
    line: zeroBasedLine,
    ch: 0
  }, 90);
  codeEditor.setCursor({
    line: zeroBasedLine,
    ch: 0
  });
  codeEditor.focus();
}

function getSandboxHtml(scriptUrl) {
  const safeUrl = scriptUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
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

  function sendToParent(type, values, lineNumber) {
    parent.postMessage({
      source: "mini-js-editor",
      type: type,
      values: values.map(formatValue),
      lineNumber: lineNumber || 0
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

  function getReasonLineNumber(reason) {
    if (!reason || !reason.stack) {
      return 0;
    }

    var match = String(reason.stack).match(/:(\\d+):\\d+\\)?$/m);
    return match ? Number(match[1]) : 0;
  }

  window.addEventListener("error", function(event) {
    sendToParent("error", [
      event.message
    ], event.lineno);
  });

  window.addEventListener("unhandledrejection", function(event) {
    sendToParent("error", [
      "Promise error: " + event.reason
    ], getReasonLineNumber(event.reason));
  });
})();
<\/script>

<script src="${safeUrl}"><\/script>

</body>
</html>`;
}

function runCode() {
  clearConsole();
  clearHighlightedErrorLine();

  const userCode = codeEditor.getValue();

  addConsoleLine("Running " + currentFileName + "...", "system");

  if (userCodeUrl) {
    URL.revokeObjectURL(userCodeUrl);
  }

  const scriptText = userCode + "\n//# sourceURL=" + safeSourceName(currentFileName);
  userCodeUrl = URL.createObjectURL(new Blob([scriptText], {
    type: "text/javascript"
  }));

  sandboxFrame.srcdoc = getSandboxHtml(userCodeUrl);
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
  const lineNumber = Number(event.data.lineNumber) || 0;

  addConsoleLine(values.join(" "), type, {
    lineNumber: type === "error" ? lineNumber : 0
  });
});

codeEditor.on("change", function () {
  statusText.textContent = "Waiting for typing to stop...";
  clearHighlightedErrorLine();

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

settingsButton.addEventListener("click", function (event) {
  event.stopPropagation();
  toggleSettingsMenu();
});

settingsMenuWrap.addEventListener("click", function (event) {
  event.stopPropagation();
});

consoleOutput.addEventListener("scroll", function () {
  shouldAutoScrollConsole = isConsoleScrolledToBottom();
  updateScrollToBottomButton();
});

consoleOutput.addEventListener("click", function (event) {
  const line = event.target.closest(".console-line[data-line-number]");

  if (!line) {
    return;
  }

  showEditorLine(Number(line.dataset.lineNumber));
});

scrollToBottomButton.addEventListener("click", function () {
  enableConsoleAutoScroll();
});

function refreshEditorLayout() {
  window.setTimeout(function () {
    codeEditor.refresh();
  }, 0);
}

function closeSettingsMenu() {
  settingsMenuWrap.classList.remove("open");
  settingsButton.setAttribute("aria-expanded", "false");
}

function toggleSettingsMenu() {
  const isOpen = settingsMenuWrap.classList.toggle("open");
  settingsButton.setAttribute("aria-expanded", String(isOpen));
}

function toggleEditorPanel() {
  app.classList.remove("console-hidden");
  app.classList.toggle("editor-hidden");
  hideEditorButton.textContent = app.classList.contains("editor-hidden") ? "Show Code" : "Hide Code";
  hideConsoleButton.textContent = "Hide Console";
  refreshEditorLayout();
}

function toggleConsolePanel() {
  app.classList.remove("editor-hidden");
  app.classList.toggle("console-hidden");
  hideConsoleButton.textContent = app.classList.contains("console-hidden") ? "Show Console" : "Hide Console";
  hideEditorButton.textContent = "Hide Code";
  refreshEditorLayout();
}

function swapPanels() {
  app.classList.toggle("swapped");
  refreshEditorLayout();
}

function toggleLayoutDirection() {
  app.classList.toggle("vertical-layout");
  layoutButton.textContent = app.classList.contains("vertical-layout") ? "Side By Side" : "Top / Down";
  refreshEditorLayout();
}

function resetLayout() {
  app.classList.remove("editor-hidden", "console-hidden", "swapped", "vertical-layout");
  app.style.setProperty("--editor-size", "50%");
  hideEditorButton.textContent = "Hide Code";
  hideConsoleButton.textContent = "Hide Console";
  layoutButton.textContent = "Top / Down";
  refreshEditorLayout();
}

hideEditorButton.addEventListener("click", function () {
  toggleEditorPanel();
  closeSettingsMenu();
});

hideConsoleButton.addEventListener("click", function () {
  toggleConsolePanel();
  closeSettingsMenu();
});

swapButton.addEventListener("click", function () {
  swapPanels();
  closeSettingsMenu();
});

layoutButton.addEventListener("click", function () {
  toggleLayoutDirection();
  closeSettingsMenu();
});

resetLayoutButton.addEventListener("click", function () {
  resetLayout();
  closeSettingsMenu();
});

splitter.addEventListener("pointerdown", function (event) {
  event.preventDefault();
  splitter.setPointerCapture(event.pointerId);

  function handlePointerMove(moveEvent) {
    const rect = app.getBoundingClientRect();
    const isVertical = app.classList.contains("vertical-layout");
    const position = isVertical ? moveEvent.clientY - rect.top : moveEvent.clientX - rect.left;
    const total = isVertical ? rect.height : rect.width;
    const rawPercent = (position / total) * 100;
    const editorPercent = app.classList.contains("swapped") ? 100 - rawPercent : rawPercent;
    const percent = Math.min(85, Math.max(15, editorPercent));

    app.style.setProperty("--editor-size", percent + "%");
    refreshEditorLayout();
  }

  function stopDragging(upEvent) {
    splitter.releasePointerCapture(upEvent.pointerId);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", stopDragging);
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeSettingsMenu();
  }

  if (event.ctrlKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveFile();
  }

  if (event.ctrlKey && event.key.toLowerCase() === "o") {
    event.preventDefault();
    openFile();
  }
});

document.addEventListener("click", function () {
  closeSettingsMenu();
});

loadSavedTheme();
updateFileNameText();
runCode();
