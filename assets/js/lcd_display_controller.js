const lcdSelect = document.getElementById('lcd-select');
const lcdDisplay = document.getElementById('lcd-display');

// Функция создания ячеек LCD
function createLcdCells(rows, cols) {
  // Останавливаем анимации старых ячеек
  lcdCells.forEach((cell) => {
    if (cell.dataset.animationFrame) {
      cancelAnimationFrame(cell.dataset.animationFrame);
      delete cell.dataset.animationFrame;
    }
  });

  lcdDisplay.replaceChildren(); // Очистка экрана перед созданием новых ячеек
  lcdDisplay.setAttribute('data-cols', cols); // Число колонок — для CSS-подстройки размера ячеек
  lcdDisplay.dataset.rows = rows;

  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.classList.add('lcd-row');
    row.setAttribute('role', 'presentation');

    for (let c = 0; c < cols; c++) {
      const index = r * cols + c;
      const cell = document.createElement('canvas');
      cell.classList.add('lcd-cell');
      cell.setAttribute('data-index', index);
      cell.width = 50;
      cell.height = 80;
      // Выбор ячейки — это выбор одного из вариантов, поэтому radio
      cell.setAttribute('role', 'radio');
      cell.setAttribute('aria-checked', 'false');
      cell.setAttribute(
        'aria-label',
        translations[userLang].lcd_cell_label.replace('{0}', index + 1)
      );
      cell.tabIndex = -1;
      row.appendChild(cell);
    }

    lcdDisplay.appendChild(row);
  }

  // Обновляем переменную lcdCells после пересоздания ячеек
  lcdCells = lcdDisplay.querySelectorAll('.lcd-cell');

  // Назначаем обработчики кликов на новые ячейки
  lcdCells.forEach((cell) => {
    cell.addEventListener('click', () => {
      switchCell(parseInt(cell.getAttribute('data-index'), 10));
    });
  });

  // Сбрасываем текущую ячейку и активируем первую
  currentCell = null;
  currentCellIndex = 0;

  // Активируем первую ячейку и запускаем анимации для всех ячеек
  switchCell(0);
  startAllCellsAnimations();
}

// Обработчик изменения select
lcdSelect.addEventListener('change', (event) => {
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
  scheduleWorkspaceSave();
});

function switchCell(index) {
  // Останавливаем предпросмотр анимации
  if (animationInterval) {
    stopAnimation();
  }

  // Редактируемый кадр принадлежит старой ячейке — выходим из режима
  stopEditingFrame();

  if (currentCell !== null) {
    currentCell.classList.remove('active');
    syncCurrentCellFrames();
    generateOutput();
  }

  currentCellIndex = index;
  currentCell = lcdCells[index] ?? null;

  // Синхронизируем состояние выбора с ARIA и roving tabindex
  lcdCells.forEach((cell, cellIndex) => {
    const isActive = cellIndex === index;
    cell.classList.toggle('active', isActive);
    cell.setAttribute('aria-checked', String(isActive));
    cell.tabIndex = isActive ? 0 : -1;
  });

  if (currentCell) {
    // Загружаем кадры из хранилища
    savedFrames = clone(cellAnimations[index]);
    renderSavedFrames();
    // Счётчик памяти зависит от числа кадров выбранной ячейки
    calculateMemoryUsage();

    if (savedFrames.length > 0) {
      loadFrame(savedFrames[0]);
      startCellAnimation(index); // Запускаем анимацию для новой ячейки
    } else {
      clear();
    }
  }
}

// Клавиатурная навигация по сетке: стрелки перемещают выбор, Enter/Space подтверждают
lcdDisplay.addEventListener('keydown', (event) => {
  const cell = event.target.closest?.('.lcd-cell');
  if (!cell) return;

  const index = Number(cell.dataset.index);
  const cols = Number(lcdDisplay.dataset.cols);
  let next = null;

  switch (event.key) {
    case 'ArrowRight':
      next = index + 1;
      break;
    case 'ArrowLeft':
      next = index - 1;
      break;
    case 'ArrowDown':
      next = index + cols;
      break;
    case 'ArrowUp':
      next = index - cols;
      break;
    case 'Home':
      next = index - (index % cols);
      break;
    case 'End':
      next = index - (index % cols) + cols - 1;
      break;
    case 'Enter':
      event.preventDefault();
      switchCell(index);
      return;
    case ' ':
      // Активация по Space — на keyup, как у нативной кнопки
      event.preventDefault();
      return;
    default:
      return;
  }

  if (next === null || next < 0 || next >= lcdCells.length) return;
  // Стрелки влево/вправо не должны перескакивать на соседнюю строку
  if (
    (event.key === 'ArrowRight' || event.key === 'ArrowLeft') &&
    Math.floor(next / cols) !== Math.floor(index / cols)
  ) {
    return;
  }

  event.preventDefault();
  switchCell(next);
  lcdCells[next].focus();
});

lcdDisplay.addEventListener('keyup', (event) => {
  if (event.key !== ' ') return;
  const cell = event.target.closest?.('.lcd-cell');
  if (!cell) return;
  event.preventDefault();
  switchCell(Number(cell.dataset.index));
});

function startCellAnimation(cellIndex) {
  if (!Array.isArray(cellAnimations[cellIndex]) || cellAnimations[cellIndex].length === 0) {
    return;
  }

  // Проверяем, что все кадры — массивы
  const isValid = cellAnimations[cellIndex].every((frame) => Array.isArray(frame));
  if (!isValid) {
    return;
  }

  const cell = document.querySelector(`.lcd-cell[data-index="${cellIndex}"]`);
  if (!cell) {
    return;
  }

  let frameIndex = 0;
  let lastUpdate = 0;

  function animate(timestamp) {
    // Интервал пересчитывается на каждом тике, чтобы смена FPS применялась сразу
    const interval = 1000 / fps;
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

// Останавливает анимацию ячейки и очищает её канвас
function stopCellAnimation(cellIndex) {
  const cell = document.querySelector(`.lcd-cell[data-index="${cellIndex}"]`);
  if (!cell) {
    return;
  }
  if (cell.dataset.animationFrame) {
    cancelAnimationFrame(cell.dataset.animationFrame);
    delete cell.dataset.animationFrame;
  }
  const ctx = cell.getContext('2d');
  ctx.clearRect(0, 0, cell.width, cell.height);
}

function startAllCellsAnimations() {
  lcdCells.forEach((cell, index) => {
    if (cellAnimations[index] && cellAnimations[index].length > 0) {
      startCellAnimation(index);
    }
  });
}

function renderFrameInCell(cell, frame) {
  const ctx = cell.getContext('2d');
  ctx.clearRect(0, 0, cell.width, cell.height);

  if (!Array.isArray(frame)) {
    return;
  }

  for (let i = 0; i < frame.length; i++) {
    if (!Array.isArray(frame[i])) {
      continue; // Пропускаем некорректные строки
    }
    for (let j = 0; j < frame[i].length; j++) {
      ctx.fillStyle = frame[i][j] ? '#000' : '#5efb6e';
      ctx.fillRect(j * 10, i * 10, 10, 10);
    }
  }
}
