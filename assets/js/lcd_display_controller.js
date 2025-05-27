const lcdSelect = document.getElementById('lcd-select');
const lcdDisplay = document.getElementById('lcd-display');

// Инициализация дисплея при загрузке
window.addEventListener('DOMContentLoaded', () => {
  const [cols, rows] = lcdSelect.value.split('x').map(Number);
  createLcdCells(rows, cols);
});

// Функция создания ячеек LCD
function createLcdCells(rows, cols) {
  lcdDisplay.innerHTML = ''; // Очистка экрана перед созданием новых ячеек

  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.classList.add('lcd-row');

    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('canvas');
      cell.classList.add('lcd-cell');
      cell.setAttribute('data-index', r * cols + c);
      cell.width = 50;
      cell.height = 80;
      row.appendChild(cell);
    }

    lcdDisplay.appendChild(row);
  }

  // Обновляем переменную lcdCells после пересоздания ячеек
  lcdCells = document.querySelectorAll('.lcd-cell');

  // Назначаем обработчики кликов на новые ячейки
  lcdCells.forEach(cell => {
    if (cell) {
      cell.addEventListener('click', () => {
        const index = parseInt(cell.getAttribute('data-index'));
        switchCell(index);
      });
    }
  });

  // Обнуляем данные кадров после смены дисплея
  currentCell = null;
  currentCellIndex = 0;
  cellAnimations = Array.from({ length: rows * cols }, () => []);

  // Активируем первую ячейку после смены дисплея
  switchCell(0);
}

// Обработчик изменения select
lcdSelect.addEventListener('change', event => {
  const [cols, rows] = event.target.value.split('x').map(Number);
  createLcdCells(rows, cols);
});

function switchCell(index) {
  if (currentCell !== null) {
    currentCell.classList.remove('active');
    cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
    clearInterval(currentCell.dataset.animationFrame); // Останавливаем анимацию
  }

  currentCellIndex = index;
  currentCell = document.querySelector(`.lcd-cell[data-index="${index}"]`);

  if (currentCell) {
    currentCell.classList.add('active');

    // Загружаем кадры из хранилища
    savedFrames = JSON.parse(JSON.stringify(cellAnimations[index]));
    renderSavedFrames();

    if (savedFrames.length > 0) {
      loadFrame(savedFrames[0]);
      startCellAnimation(index); // Запускаем анимацию для новой ячейки
    } else {
      clear();
    }
  }
}

function startCellAnimation(cellIndex) {
  if (cellAnimations[cellIndex].length === 0) return;

  const cell = document.querySelector(`.lcd-cell[data-index="${cellIndex}"]`);
  let frameIndex = 0;
  const interval = 1000 / fps; // Интервал между кадрами в миллисекундах
  let lastUpdate = 0;

  function animate(timestamp) {
    if (timestamp - lastUpdate >= interval) {
      lastUpdate = timestamp;
      const frame = cellAnimations[cellIndex][frameIndex];
      console.log(`Rendering frame ${frameIndex}`, frame); // Отладочное сообщение
      renderFrameInCell(cell, frame);
      frameIndex = (frameIndex + 1) % cellAnimations[cellIndex].length; // Увеличиваем индекс последовательно
    }
    cell.dataset.animationFrame = requestAnimationFrame(animate);
  }

  // Останавливаем предыдущую анимацию, если она еще работает
  if (cell.dataset.animationFrame) {
    cancelAnimationFrame(cell.dataset.animationFrame);
  }

  cell.dataset.animationFrame = requestAnimationFrame(animate);
}

function startAllCellsAnimations() {
  lcdCells.forEach((cell, index) => {
    if (cellAnimations[index].length > 0) {
      try {
        startCellAnimation(index);
      } catch {}
    }
  });
}

function renderFrameInCell(cell, frame) {
  const ctx = cell.getContext('2d');
  ctx.clearRect(0, 0, cell.width, cell.height); // Очистка холста перед рисованием

  for (let i = 0; i < frame.length; i++) {
    for (let j = 0; j < frame[i].length; j++) {
      ctx.fillStyle = frame[i][j] ? '#000' : '#5efb6e';
      ctx.fillRect(j * 10, i * 10, 10, 10);
    }
  }
}

// Назначаем обработчики кликов на начальные ячейки
lcdCells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = parseInt(cell.getAttribute('data-index'));
    switchCell(index);
  });
});

// Устанавливаем первую активную ячейку при загрузке
switchCell(0);
