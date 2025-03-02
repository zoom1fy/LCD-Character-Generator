/*============ ИНИЦИАЛИЗАЦИЯ И ПЕРЕМЕННЫЕ ============*/
// Create a 2D array for the custom char
let customchar = Array.from({ length: 8 }, () => Array(5).fill(0));

let fps = 2; // Начальное значение FPS

// Инициализация
let lcdCells = document.querySelectorAll(".lcd-cell");
let currentCell = null;
let currentCellIndex = 0;

// Хранение кадров для каждой ячейки
let cellAnimations = Array.from({ length: 32 }, () => []);

// Память, зарезервированная для одного символа на Arduino (40 байт)
const memoryPerChar = 40;

const totalMemory = 320;

/*============ ФУНКЦИЯ ДЛЯ ВЫЧИСЛЕНИЯ ИСПОЛЬЗУЕМОЙ ПАМЯТИ ============*/
function calculateMemoryUsage() {
  // Используем память на все сохраненные кадры
  let usedMemory = savedFrames.length * memoryPerChar;

  // Оставшаяся память
  let remainingMemory = totalMemory - usedMemory;

  // Выводим оставшуюся память в элемент с id "memory-status"
  document.getElementById(
    "memory-status"
  ).innerText = `Оставшаяся память: ${remainingMemory} байт`;
}

/*============ ОБРАБОТЧИКИ СОБЫТИЙ И ИЗМЕНЕНИЯ FPS ============*/
// Обновляем FPS, если пользователь изменяет значение
document.getElementById("fps").addEventListener("input", (event) => {
  fps = Number(event.target.value);
  document.getElementById("fpsValue").innerText = fps;

  // Если анимация уже запущена, перезапускаем её с новым FPS
  if (animationInterval) {
    stopAnimation();
    playAnimation();
  }
});

/*============ ОЧИСТКА И ОБНОВЛЕНИЕ ПИКСЕЛЕЙ ============*/
// Очистка массива customchar и перерисовка
function clear() {
  customchar.forEach((row) => row.fill(0));
  $(".pixel").removeClass("on").addClass("off");
  generateOutput();
  calculateMemoryUsage(); // Пересчитываем память после очистки
}

// Переключение состояния пикселя и обновление массива
function togglePixel(pixel) {
  const [row, column] = pixel.id.split("-").slice(1).map(Number);
  const isOn = pixel.classList.contains("on");

  pixel.classList.toggle("on", !isOn);
  pixel.classList.toggle("off", isOn);
  customchar[row][column] = isOn ? 0 : 1;
  calculateMemoryUsage(); // Пересчитываем память после изменения пикселя
}

// Обновление всех пикселей на основе customchar
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
// Генерация вывода для Arduino
function generateOutput() {
  let output = "byte customChar[8] = {\n";
  output += customchar.map((row) => `\t0b${row.join("")}`).join(",\n");
  output += "\n};";

  $(".output").text(output);

  $("#codeArduino").text(`#include <LiquidCrystal.h>

    // Initialize the library
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

  calculateMemoryUsage(); // Пересчитываем память после генерации вывода
}

/*============ ТРАНСФОРМАЦИИ И ИНВЕРСИЯ ============*/
// Преобразования
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
// Сохранение текущего кадра
let savedFrames = [];
let currentFrameIndex = -1;

const framesContainer = document.querySelector(".frames-container");

// Функция для сохранения кадра
function saveFrame() {
  // Проверяем, достаточно ли памяти для нового кадра
  if (savedFrames.length * memoryPerChar < totalMemory) {
    savedFrames.push(JSON.parse(JSON.stringify(customchar))); // Сохраняем кадр
    cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames)); // Обновляем анимацию для текущей ячейки
    renderSavedFrames(); // Обновляем отображение сохраненных кадров
    calculateMemoryUsage(); // Пересчитываем память после сохранения кадра
    startCellAnimation(currentCellIndex); // Запускаем анимацию для текущей ячейки
  } else {
    alert("Недостаточно памяти для сохранения нового кадра!");
  }
}

// Функция для рендеринга сохраненных кадров
function renderSavedFrames() {
  const savedFramesContainer = document.getElementById("savedFrames");
  savedFramesContainer.innerHTML = "";

  savedFrames.forEach((frame, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 80;
    canvas.className = "saved-frame";
    canvas.addEventListener("click", () => loadFrame(frame));

    canvas.draggable = true; // Позволяем перетаскивание
    canvas.dataset.index = index; // Сохраняем индекс кадра

    // Обработчик ПКМ для отображения контекстного меню
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault(); // Предотвращаем стандартное меню браузера
      showContextMenu(event, index); // Отображаем контекстное меню
    });

    canvas.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", index);
    });

    canvas.addEventListener("dragover", (event) => {
      event.preventDefault(); // Позволяем сброс
    });

    canvas.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedIndex = event.dataTransfer.getData("text/plain");
      const targetIndex = canvas.dataset.index;

      // Меняем кадры местами
      [savedFrames[draggedIndex], savedFrames[targetIndex]] = [
        savedFrames[targetIndex],
        savedFrames[draggedIndex],
      ];

      renderSavedFrames(); // Перерисовываем кадры
      calculateMemoryUsage(); // Обновляем информацию о памяти
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

// Функция для удаления кадра
function deleteFrame(index) {
  savedFrames.splice(index, 1); // Удаляем кадр из массива
  cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames)); // Обновляем анимацию для текущей ячейки
  renderSavedFrames(); // Перерисовываем список кадров
  calculateMemoryUsage(); // Пересчитываем память после удаления кадра
}

// Функция для дублирования кадра
function duplicateFrame(index) {
  const frame = savedFrames[index];
  savedFrames.splice(index, 0, JSON.parse(JSON.stringify(frame))); // Дублируем кадр
  cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
  renderSavedFrames(); // Перерисовываем список кадров
  calculateMemoryUsage(); // Пересчитываем память после дублирования кадра
}

// Функция для отображения контекстного меню
function showContextMenu(event, index) {
  const contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.style.position = "absolute";
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  contextMenu.style.backgroundColor = "#fff";
  contextMenu.style.border = "1px solid #ccc";
  contextMenu.style.padding = "10px";
  contextMenu.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.1)";
  contextMenu.style.zIndex = 1000;

  const duplicateItem = document.createElement("div");
  duplicateItem.innerText = "Duplicate";
  duplicateItem.style.cursor = "pointer";
  duplicateItem.addEventListener("click", () => {
    duplicateFrame(index);
    document.body.removeChild(contextMenu);
  });

  const deleteItem = document.createElement("div");
  deleteItem.innerText = "Delete";
  deleteItem.style.cursor = "pointer";
  deleteItem.addEventListener("click", () => {
    deleteFrame(index);
    document.body.removeChild(contextMenu);
  });

  contextMenu.appendChild(duplicateItem);
  contextMenu.appendChild(deleteItem);

  document.body.appendChild(contextMenu);

  // Удаляем контекстное меню при клике вне его
  document.addEventListener(
    "click",
    () => {
      document.body.removeChild(contextMenu);
    },
    { once: true }
  );
}

/*============ ВОСПРОИЗВЕДЕНИЕ АНИМАЦИИ ============*/
// Загрузка сохранённого кадра
function loadFrame(frame) {
  customchar = JSON.parse(JSON.stringify(frame));
  updateAllPixels();
  generateOutput();
}

// Воспроизведение анимации
let animationInterval = null;

// Воспроизведение анимации с учётом FPS
function playAnimation() {
  if (savedFrames.length === 0) return;

  document.getElementById("play-animation").innerText = "Stop Animation";

  currentFrameIndex = 0;
  const interval = 1000 / fps; // Интервал между кадрами в миллисекундах

  animationInterval = setInterval(() => {
    loadFrame(savedFrames[currentFrameIndex]);
    currentFrameIndex = (currentFrameIndex + 1) % savedFrames.length;
  }, interval);
}

function stopAnimation() {
  clearInterval(animationInterval);
  animationInterval = null;
  document.getElementById("play-animation").innerText = "Start Animation";
}

/*============ СОXРАНЕНИЕ РАБОЧЕГО ПРОСТРАНСТВА ============*/

function loadStateFromFile(file) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const state = JSON.parse(event.target.result);
    customchar = state.customchar;
    fps = state.fps;
    savedFrames = state.savedFrames;
    currentCellIndex = state.currentCellIndex;
    cellAnimations = state.cellAnimations;

    updateAllPixels();
    renderSavedFrames();
    calculateMemoryUsage();
    generateOutput();
    startAllCellsAnimations();
  };
  reader.readAsText(file);
}

function saveStateToFile() {
  const state = {
    customchar,
    fps,
    savedFrames,
    currentCellIndex,
    cellAnimations,
    memoryPerChar,
    totalMemory,
  };

  const jsonState = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonState], { type: "application/json" });

  // Получаем текущую дату и время
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Месяцы начинаются с 0
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const formattedDate = `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`;

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `saved_state_${formattedDate}.json`; // Имя файла с датой и временем
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/*============ ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ============*/
// Слушатели событий
$(document).ready(function () {
  clear();

  $("#clear").click(clear);
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

  // Обработчики для переключения вкладок
  $("#customCharacterLink").click(function () {
    $("#tab-pixel").show();
    $("#tab-code").hide();
    document
      .getElementById("customCharacterLink")
      .setAttribute("class", "active");
    document
      .getElementById("arduinoCodeLink")
      .removeAttribute("class", "active");
  });

  $("#arduinoCodeLink").click(function () {
    $("#tab-code").show();
    $("#tab-pixel").hide();
    document
      .getElementById("customCharacterLink")
      .removeAttribute("class", "active");
    document.getElementById("arduinoCodeLink").setAttribute("class", "active");
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
      pdfBut.innerText = "Symbols table";
    } else {
      pdfBut.setAttribute("data-status", "active");
      pdfPanel.classList.add("open");
      pdfBut.classList.add("open");
      pdfBut.innerText = "Close";
    }
  });

// Обработчик события для изменения выбора в select
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
        alert("Что-то пошло не так...");
      }
    }
  });
