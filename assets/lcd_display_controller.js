const lcdSelect = document.getElementById("lcd-select");
const lcdDisplay = document.getElementById("lcd-display");

// Функция создания ячеек LCD
function createLcdCells(rows, cols) {
  lcdDisplay.innerHTML = ""; // Очистка экрана перед созданием новых ячеек

  for (let r = 0; r < rows; r++) {
    const row = document.createElement("div");
    row.classList.add("lcd-row");

    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.classList.add("lcd-cell");
      cell.setAttribute("data-index", r * cols + c);
      row.appendChild(cell);
    }

    lcdDisplay.appendChild(row);
  }

  // Обновляем переменную lcdCells после пересоздания ячеек
  lcdCells = document.querySelectorAll(".lcd-cell");

  // Назначаем обработчики кликов на новые ячейки
  lcdCells.forEach((cell) => {
    cell.addEventListener("click", () => {
      const index = parseInt(cell.getAttribute("data-index"));
      switchCell(index);
    });
  });

  // Обнуляем данные кадров после смены дисплея
  currentCell = null;
  currentCellIndex = 0;
  cellAnimations = Array.from({ length: rows * cols }, () => []);

  // Активируем первую ячейку после смены дисплея
  switchCell(0);
}

// Обработчик изменения select
lcdSelect.addEventListener("change", (event) => {
  const [cols, rows] = event.target.value.split("x").map(Number);
  createLcdCells(rows, cols);
});

// Инициализация
let lcdCells = document.querySelectorAll(".lcd-cell");
let currentCell = null;
let currentCellIndex = 0;

// Хранение кадров для каждой ячейки
let cellAnimations = Array.from({ length: 32 }, () => []);

function switchCell(index) {
  if (currentCell !== null) {
    currentCell.classList.remove("active");
    cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
  }

  currentCellIndex = index;
  currentCell = document.querySelector(`.lcd-cell[data-index="${index}"]`);

  if (currentCell) {
    currentCell.classList.add("active");

    // Загружаем кадры из хранилища
    savedFrames = JSON.parse(JSON.stringify(cellAnimations[index]));
    renderSavedFrames();

    if (savedFrames.length > 0) {
      loadFrame(savedFrames[0]);
    } else {
      clear();
    }
  }
}

// Назначаем обработчики кликов на начальные ячейки
lcdCells.forEach((cell) => {
  cell.addEventListener("click", () => {
    const index = parseInt(cell.getAttribute("data-index"));
    switchCell(index);
  });
});

// Устанавливаем первую активную ячейку при загрузке
switchCell(0);
