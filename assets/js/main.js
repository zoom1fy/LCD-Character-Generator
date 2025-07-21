const PROJECT_VERSION = "0.18.0";

// Определение языка
let userLang = (navigator.language || navigator.userLanguage).startsWith("ru")
  ? "ru"
  : "en";

// Функция для применения переводов
function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key === "remaining_memory") {
      const memory = element.innerText.match(/\d+/)
        ? element.innerText.match(/\d+/)[0]
        : "1016";
      element.innerText = translations[userLang][key].replace("{0}", memory);
    } else {
      element.innerText = translations[userLang][key];
    }
  });
  document.title = translations[userLang].title;
  if (animationInterval) {
    document.getElementById("play-animation").innerText =
      translations[userLang].stop_animation;
  }
  const pdfBut = document.getElementById("toggle-pdf-button");
  if (pdfBut.hasAttribute("data-status")) {
    pdfBut.innerText = translations[userLang].close;
  }
  updateLanguageDropdown();
}

// Обновление дропдауна языка
function updateLanguageDropdown() {
  const currentLangSpan = document.getElementById("current-language");
  currentLangSpan.innerText = translations[userLang][`lang_${userLang}`];
  document.querySelectorAll(".dropdown-item[data-lang]").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      userLang = this.getAttribute("data-lang");
      applyTranslations();

      // Закрываем дропдаун после выбора
      const dropdown = bootstrap.Dropdown.getInstance(
        document.querySelector(".dropdown-toggle")
      );
      dropdown.hide();
    });
  });
}

/*============ ИНИЦИАЛИЗАЦИЯ И ПЕРЕМЕННЫЕ ============*/
let customchar = Array.from({ length: 8 }, () => Array(5).fill(0));
let fps = 2;
let lcdCells = document.querySelectorAll(".lcd-cell");
let currentCell = null;
let currentCellIndex = 0;
let cellAnimations = Array.from({ length: 32 }, () => []);
let displayAnimations = {}; // Объект для хранения анимаций по конфигурациям
let currentConfig; // Текущая конфигурация дисплея (например, "16x2")

const memoryPerChar = 40;
const totalMemory = 320;

function generatePixelGrid(rows = 8, cols = 5) {
  const gridContainer = document.getElementById("pixel-grid");
  gridContainer.innerHTML = ""; // Очищаем контейнер

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Создаём canvas-элемент
      const pixel = document.createElement("canvas");
      pixel.id = `pixel-${row}-${col}`;
      pixel.className = "pixel off";

      // Добавляем в контейнер
      gridContainer.appendChild(pixel);
      gridContainer.appendChild(document.createTextNode(" "));
    }

    // После каждой строки добавляем <br> (кроме последней)
    if (row < rows) {
      gridContainer.appendChild(document.createElement("br"));
    }
  }
}

/*============ ФУНКЦИЯ ДЛЯ ВЫЧИСЛЕНИЯ ИСПОЛЬЗУЕМОЙ ПАМЯТИ ============*/
function calculateMemoryUsage() {
  let usedMemory = savedFrames.length * memoryPerChar;
  let remainingMemory = totalMemory - usedMemory;
  document.getElementById("memory-status").innerText = translations[
    userLang
  ].remaining_memory.replace("{0}", remainingMemory);
}

/*============ ОБРАБОТЧИКИ СОБЫТИЙ И ИЗМЕНЕНИЯ FPS ============*/
document.getElementById("fps").addEventListener("input", (event) => {
  fps = Number(event.target.value);
  document.getElementById("fpsValue").innerText = fps;
  if (animationInterval) {
    stopAnimation();
    playAnimation();
  }
});

/*============ ОЧИСТКА И ОБНОВЛЕНИЕ ПИКСЕЛЕЙ ============*/
function clear() {
  customchar.forEach((row) => row.fill(0));
  $(".pixel").removeClass("on").addClass("off");
  generateOutput();
  calculateMemoryUsage();
}

function togglePixel(pixel) {
  const [row, column] = pixel.id.split("-").slice(1).map(Number);
  const isOn = pixel.classList.contains("on");
  pixel.classList.toggle("on", !isOn);
  pixel.classList.toggle("off", isOn);
  customchar[row][column] = isOn ? 0 : 1;
  calculateMemoryUsage();
}

function updateAllPixels() {
  customchar.forEach((row, i) => {
    row.forEach((val, j) => {
      const pixel = document.getElementById(`pixel-${i}-${j}`);
      pixel.classList.toggle("on", val === 1);
      pixel.classList.toggle("off", val === 0);
    });
  });
}

/*============ ГЕНЕРАЦИЯ ВЫВОДА ДЛЯ ARDUINO ============*/
function generateOutput() {
  let output = "byte customChar[8] = {\n";
  output += customchar.map((row) => `\t0b${row.join("")}`).join(",\n");
  output += "\n};";
  $(".output").text(output);
  $("#codeArduino").text(`#include <LiquidCrystal.h>
    LiquidCrystal lcd(${$("#RSPin").val()}, ${$("#EnablePin").val()}, ${$(
    "#D4Pin"
  ).val()}, ${$("#D5Pin").val()}, ${$("#D6Pin").val()}, ${$("#D7Pin").val()});
    ${output}
    void setup() {
        lcd.createChar(0, customChar);
        lcd.begin(16, 2);
        lcd.write((uint8_t)0);
    }
    void loop() {}`);
  calculateMemoryUsage();
}

/*============ ТРАНСФОРМАЦИИ И ИНВЕРСИЯ ============*/
function invert() {
  customchar = customchar.map((row) => row.map((val) => 1 - val));
  updateAllPixels();
  generateOutput();
}

function reflectHorizontal() {
  customchar = customchar.map((row) => row.reverse());
  updateAllPixels();
  generateOutput();
}

function reflectVertical() {
  customchar = customchar.reverse();
  updateAllPixels();
  generateOutput();
}

/*============ СОХРАНЕНИЕ И РЕНДЕРИНГ КАДРОВ ============*/
let savedFrames = [];
let currentFrameIndex = -1;
const framesContainer = document.querySelector(".frames-container");

function saveFrame() {
  if (savedFrames.length * memoryPerChar < totalMemory) {
    savedFrames.push(JSON.parse(JSON.stringify(customchar)));
    cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
    renderSavedFrames();
    calculateMemoryUsage();
    startCellAnimation(currentCellIndex);
  } else {
    showErrorAlert("error_no_space");
  }
}

function renderSavedFrames() {
  const savedFramesContainer = document.getElementById("savedFrames");
  savedFramesContainer.innerHTML = "";
  savedFrames.forEach((frame, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 80;
    canvas.className = "saved-frame";
    canvas.addEventListener("click", () => loadFrame(frame));
    canvas.draggable = true;
    canvas.dataset.index = index;
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      showContextMenu(event, index);
    });
    canvas.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", index);
    });
    canvas.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    canvas.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedIndex = event.dataTransfer.getData("text/plain");
      const targetIndex = canvas.dataset.index;
      [savedFrames[draggedIndex], savedFrames[targetIndex]] = [
        savedFrames[targetIndex],
        savedFrames[draggedIndex],
      ];
      renderSavedFrames();
      calculateMemoryUsage();
    });
    const ctx = canvas.getContext("2d");
    frame.forEach((row, i) => {
      row.forEach((val, j) => {
        ctx.fillStyle = val ? "#000" : "#FFF";
        ctx.fillRect(j * 10, i * 10, 10, 10);
      });
    });
    savedFramesContainer.appendChild(canvas);
    cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
  });
}

function deleteFrame(index) {
  savedFrames.splice(index, 1);
  cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
  renderSavedFrames();
  calculateMemoryUsage();
}

function duplicateFrame(index) {
  if (savedFrames.length * memoryPerChar < totalMemory) {
    const frame = savedFrames[index];
    savedFrames.splice(index, 0, JSON.parse(JSON.stringify(frame)));
    cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
    renderSavedFrames();
    calculateMemoryUsage();
  } else {
    showErrorAlert("error_no_space");
  }
}

function showContextMenu(event, index) {
  // Закрываем предыдущее меню, если оно есть
  const existingMenu = document.querySelector(".context-menu");
  if (existingMenu) document.body.removeChild(existingMenu);

  // Создаем контекстное меню
  const contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.style.position = "fixed";
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.style.minWidth = "180px";
  contextMenu.style.backgroundColor = "#ffffff";
  contextMenu.style.borderRadius = "6px";
  contextMenu.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.15)";
  contextMenu.style.zIndex = "1000";
  contextMenu.style.overflow = "hidden";
  contextMenu.style.fontFamily = "'Segoe UI', Arial, sans-serif";
  contextMenu.style.fontSize = "14px";
  contextMenu.style.userSelect = "none";

  // Создаем пункты меню
  const menuItems = [
    {
      text: translations[userLang].duplicate,
      action: () => duplicateFrame(index),
    },
    {
      text: translations[userLang].delete,
      action: () => deleteFrame(index),
    },
  ];

  menuItems.forEach((item) => {
    const menuItem = document.createElement("div");
    menuItem.className = "context-menu-item";
    menuItem.innerText = item.text;
    menuItem.style.padding = "8px 16px";
    menuItem.style.cursor = "pointer";
    menuItem.style.transition = "background-color 0.2s";
    menuItem.style.display = "flex";
    menuItem.style.alignItems = "center";
    menuItem.style.gap = "8px";

    // Hover-эффект
    menuItem.addEventListener("mouseenter", () => {
      menuItem.style.backgroundColor = "#f5f5f5";
    });
    menuItem.addEventListener("mouseleave", () => {
      menuItem.style.backgroundColor = "transparent";
    });

    // Добавляем иконки (можно заменить на свои)
    const icon = document.createElement("div");
    icon.style.width = "16px";
    icon.style.height = "16px";
    icon.style.backgroundSize = "contain";

    if (item.text === translations[userLang].duplicate) {
      icon.style.backgroundImage =
        'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23444444"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>\')';
    } else {
      icon.style.backgroundImage =
        'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23444444"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>\')';
    }

    menuItem.prepend(icon);
    menuItem.addEventListener("click", () => {
      item.action();
      document.body.removeChild(contextMenu);
    });

    contextMenu.appendChild(menuItem);
  });

  // Добавляем разделитель
  const divider = document.createElement("div");
  divider.style.height = "1px";
  divider.style.backgroundColor = "#eeeeee";
  divider.style.margin = "4px 0";
  contextMenu.insertBefore(divider, contextMenu.lastChild);

  // Добавляем меню на страницу
  document.body.appendChild(contextMenu);

  // Закрытие при клике вне меню
  const closeMenu = (e) => {
    if (!contextMenu.contains(e.target)) {
      document.body.removeChild(contextMenu);
      document.removeEventListener("click", closeMenu);
    }
  };

  document.addEventListener("click", closeMenu);

  // Предотвращаем закрытие при клике внутри меню
  contextMenu.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Корректировка позиции, если меню выходит за границы экрана
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${window.innerWidth - rect.width - 5}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${window.innerHeight - rect.height - 5}px`;
  }
}

/*============ ВОСПРОИЗВЕДЕНИЕ АНИМАЦИИ ============*/
function loadFrame(frame) {
  customchar = JSON.parse(JSON.stringify(frame));
  updateAllPixels();
  generateOutput();
}

let animationInterval = null;

function playAnimation() {
  if (savedFrames.length === 0) return;
  document.getElementById("play-animation").innerText =
    translations[userLang].stop_animation;
  currentFrameIndex = 0;
  const interval = 1000 / fps;
  animationInterval = setInterval(() => {
    loadFrame(savedFrames[currentFrameIndex]);
    currentFrameIndex = (currentFrameIndex + 1) % savedFrames.length;
  }, interval);
}

function stopAnimation() {
  clearInterval(animationInterval);
  animationInterval = null;
  document.getElementById("play-animation").innerText =
    translations[userLang].play_animation;
}

/*============ СОХРАНЕНИЕ РАБОЧЕГО ПРОСТРАНСТВА ============*/
function saveStateToFile() {
  const state = {
    version: PROJECT_VERSION,
    customchar,
    fps,
    savedFrames,
    currentCellIndex,
    displayAnimations, // Save animations for all displays
    currentConfig, // Save the current configuration
    memoryPerChar,
    totalMemory,
  };
  const jsonState = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonState], { type: "application/json" });
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const formattedDate = `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `saved_state_${formattedDate}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function loadStateFromFile(file) {
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const state = JSON.parse(event.target.result);

      // Check the version and load accordingly
      if (state.version === "0.18.0") {
        // New format: load displayAnimations and currentConfig
        displayAnimations = state.displayAnimations;
        currentConfig = state.currentConfig;
        cellAnimations = displayAnimations[currentConfig];
      } else {
        // Old format: load cellAnimations for the current display
        const [cols, rows] = currentConfig.split("x").map(Number);
        displayAnimations[currentConfig] =
          state.cellAnimations || Array.from({ length: rows * cols }, () => []);
        cellAnimations = displayAnimations[currentConfig];
      }

      // Load the remaining common fields
      customchar = state.customchar;
      fps = state.fps;
      savedFrames = state.savedFrames;
      currentCellIndex = state.currentCellIndex;

      // Update the UI and state
      updateAllPixels();
      renderSavedFrames();
      calculateMemoryUsage();
      generateOutput();
      startAllCellsAnimations();
    } catch {
      showErrorAlert("error_load_json");
    }
  };
  reader.readAsText(file);
}

/*============ АЛЕРТЫ ============*/
function showConfirmationAlert(message, callback) {
  Swal.fire({
    title: translations[userLang][message],
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: translations[userLang].yes,
    cancelButtonText: translations[userLang].no,
  }).then((result) => {
    if (result.isConfirmed) {
      callback();
    }
  });
}

function showErrorAlert(message) {
  Swal.fire({
    title: translations[userLang].error,
    text: translations[userLang][message],
    icon: "error",
    confirmButtonText: translations[userLang].ok,
    confirmButtonColor: "#3085d6",
  });
}

function showSoonAlert(message, callback) {
  Swal.fire({
    title: translations[userLang].soon_message,
    icon: "info",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: translations[userLang].yes,
    cancelButtonText: translations[userLang].no,
  });
}

/*============ РАЗДЕЛ АРУДИОНО КОД ============*/

/*============ ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ============*/
$(document).ready(function () {
  applyTranslations();
  clear();
  $("#clear").click(function () {
    showConfirmationAlert("confirm_clear", clear);
  });
  $("#invert").click(invert);
  $("#reflectHorizontal").click(reflectHorizontal);
  $("#reflectVertical").click(reflectVertical);
  $(".pixel").click(function () {
    togglePixel(this);
    generateOutput();
  });
  $("#play-animation").click(function () {
    if (animationInterval) stopAnimation();
    else playAnimation();
  });
  $("#save-frame").click(saveFrame);
  $("#customCharacterLink").click(function () {
    $("#tab-pixel").show();
    $("#tab-code").hide();
    document
      .getElementById("customCharacterLink")
      .setAttribute("class", "nav-link active");
    document
      .getElementById("arduinoCodeLink")
      .removeAttribute("class", "active");
    document
      .getElementById("arduinoCodeLink")
      .setAttribute("class", "nav-link");
  });
  $("#arduinoCodeLink").click(function () {
    $("#tab-code").show();
    $("#tab-pixel").hide();
    document
      .getElementById("customCharacterLink")
      .removeAttribute("class", "active");
    document
      .getElementById("customCharacterLink")
      .setAttribute("class", "nav-link");
    document
      .getElementById("arduinoCodeLink")
      .setAttribute("class", "nav-link active");
  });
  $(".dropdown-item[data-lang]").click(function (e) {
    e.preventDefault();
    userLang = $(this).data("lang");
    applyTranslations();
  });
});

document
  .getElementById("toggle-pdf-button")
  .addEventListener("click", function () {
    const pdfPanel = document.getElementById("pdf-panel");
    const pdfBut = document.getElementById("toggle-pdf-button");
    if (pdfBut.hasAttribute("data-status")) {
      pdfBut.removeAttribute("data-status");
      pdfPanel.classList.remove("open");
      pdfBut.classList.remove("open");
      pdfBut.innerText = translations[userLang].symbols_table;
    } else {
      pdfBut.setAttribute("data-status", "active");
      pdfPanel.classList.add("open");
      pdfBut.classList.add("open");
      pdfBut.innerText = translations[userLang].close;
    }
  });

document.getElementById("pdf-select").addEventListener("change", function () {
  const selectedPdf = this.value;
  document.getElementById("pdf-viewer").src = selectedPdf;
});

document
  .getElementById("save-state")
  .addEventListener("click", saveStateToFile);
document
  .getElementById("load-state-btn")
  .addEventListener("click", function () {
    document.getElementById("load-state").click();
  });
document
  .getElementById("load-state")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
      try {
        loadStateFromFile(file);
      } catch {
        showErrorAlert("error_load");
      }
    }
  });
document.getElementById("theme-toggle").addEventListener("click", function () {
  document.body.setAttribute(
    "data-theme",
    document.body.getAttribute("data-theme") === "dark" ? "light" : "dark"
  );
});

async function copyToClipboard(elementId) {
  try {
    const textarea = document.getElementById(elementId);
    await navigator.clipboard.writeText(textarea.value);
    Swal.fire({
      icon: "success",
      title: "Успех!",
      text: "Текст скопирован в буфер обмена",
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Ошибка",
      text: "Не удалось скопировать текст",
    });
  }
}

/*============ УПРАВЛЕНИЕ ПРЕЛОАДЕРОМ ============*/
document.addEventListener("DOMContentLoaded", () => {
  const preloader = document.getElementById("preloader");
  preloader.classList.add("hidden");
  setTimeout(() => {
    preloader.style.display = "none";
  }, 500);
});

// Инициализация дисплея при загрузке
window.addEventListener("DOMContentLoaded", () => {
  generatePixelGrid(8, 5);

  currentConfig = lcdSelect.value; // Например, "16x2"
  const [cols, rows] = currentConfig.split("x").map(Number);

  // Инициализируем анимации для начальной конфигурации
  displayAnimations[currentConfig] = Array.from(
    { length: rows * cols },
    () => []
  );
  cellAnimations = displayAnimations[currentConfig];

  createLcdCells(rows, cols);
});
