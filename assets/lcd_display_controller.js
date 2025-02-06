// Инициализация дисплея
const lcdCells = document.querySelectorAll('.lcd-cell');
let currentCell = null;
let currentCellIndex = { row: 0, col: 0 };

// Объект для хранения анимаций для каждой ячейки
const cellAnimations = Array.from({ length: 2 }, () =>
  Array.from({ length: 16 }, () => [])
);

// Функция для переключения на ячейку
function switchCell(row, col) {
  if (currentCell) {
    currentCell.classList.remove('active');
    // Сохраняем текущую анимацию в ячейку
    cellAnimations[currentCellIndex.row][currentCellIndex.col] = JSON.parse(JSON.stringify(savedFrames));
  }

  currentCellIndex = { row, col };
  currentCell = document.querySelector(`.lcd-cell[data-row="${row}"][data-col="${col}"]`);
  currentCell.classList.add('active');

  // Загружаем анимацию для выбранной ячейки
  savedFrames = JSON.parse(JSON.stringify(cellAnimations[row][col]));
  renderSavedFrames();
  if (savedFrames.length > 0) {
    loadFrame(savedFrames[0]);
  } else {
    clear();
  }
}

// Обработчик клика на ячейку
lcdCells.forEach(cell => {
  cell.addEventListener('click', () => {
    const row = parseInt(cell.getAttribute('data-row'));
    const col = parseInt(cell.getAttribute('data-col'));
    switchCell(row, col);
  });
});

// Инициализация первой ячейки
switchCell(0, 0);