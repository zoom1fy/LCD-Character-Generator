const lcdSelect = document.getElementById('lcd-select');
const lcdDisplay = document.getElementById('lcd-display');

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

  // Сбрасываем текущую ячейку и активируем первую
  currentCell = null;
  currentCellIndex = 0;

  // Активируем первую ячейку и запускаем анимации для всех ячеек
  switchCell(0);
  startAllCellsAnimations(); // Добавляем этот вызов
}

// Обработчик изменения select
lcdSelect.addEventListener('change', event => {
  const newConfig = event.target.value; // Новая конфигурация, например "20x4"

  // Сохраняем анимации текущего дисплея
  displayAnimations[currentConfig] = cellAnimations;

  // Обновляем текущую конфигурацию
  currentConfig = newConfig;

  // Загружаем существующие анимации или создаём новые
  if (!displayAnimations[newConfig]) {
    const [cols, rows] = newConfig.split('x').map(Number);
    displayAnimations[newConfig] = Array.from({ length: rows * cols }, () => []);
  }
  cellAnimations = displayAnimations[newConfig];

  // Создаём ячейки для нового дисплея
  const [cols, rows] = newConfig.split('x').map(Number);
  createLcdCells(rows, cols);
});

function switchCell(index) {
  if (currentCell !== null) {
    currentCell.classList.remove('active');
    cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
    clearInterval(currentCell.dataset.animationFrame); // Останавливаем анимацию
    generateOutput();
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
  if (!Array.isArray(cellAnimations[cellIndex]) || cellAnimations[cellIndex].length === 0) {
    console.warn(`No valid animation for cell ${cellIndex}`);
    return;
  }

  // Проверяем, что все кадры — массивы
  const isValid = cellAnimations[cellIndex].every(frame => Array.isArray(frame));
  if (!isValid) {
    console.error(`Invalid frames for cell ${cellIndex}:`, cellAnimations[cellIndex]);
    return;
  }

  const cell = document.querySelector(`.lcd-cell[data-index="${cellIndex}"]`);
  let frameIndex = 0;
  const interval = 1000 / fps;
  let lastUpdate = 0;

  function animate(timestamp) {
    if (timestamp - lastUpdate >= interval) {
      lastUpdate = timestamp;
      const frame = cellAnimations[cellIndex][frameIndex];
      if (frame !== undefined) {
        renderFrameInCell(cell, frame);
        frameIndex = (frameIndex + 1) % cellAnimations[cellIndex].length;
      }
    }
    cell.dataset.animationFrame = requestAnimationFrame(animate);
  }

  if (cell.dataset.animationFrame) {
    cancelAnimationFrame(cell.dataset.animationFrame);
  }

  cell.dataset.animationFrame = requestAnimationFrame(animate);
}

function startAllCellsAnimations() {
  lcdCells.forEach((cell, index) => {
    if (cellAnimations[index] && cellAnimations[index].length > 0) {
      console.log(`Starting animation for cell ${index}:`, cellAnimations[index]);
      try {
        startCellAnimation(index);
      } catch (e) {
        console.error(`Error starting animation for cell ${index}:`, e);
      }
    }
  });
}

function renderFrameInCell(cell, frame) {
  const ctx = cell.getContext('2d');
  ctx.clearRect(0, 0, cell.width, cell.height);

  if (!Array.isArray(frame)) {
    console.error('Frame не является массивом:', frame);
    return;
  }

  for (let i = 0; i < frame.length; i++) {
    // Check if frame[i] is an array
    if (!Array.isArray(frame[i])) {
      console.error(`frame[${i}] is not an array:`, frame[i]);
      continue; // Skip this iteration
    }
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
