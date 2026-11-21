const PROJECT_VERSION = '0.18.5';

/*============ ТЕМА ОФОРМЛЕНИЯ ============*/
const THEME_STORAGE_KEY = 'theme';

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Синхронизируем тему Bootstrap
  document.documentElement.setAttribute('data-bs-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* localStorage может быть недоступен */
  }
}

// Применяем текущую тему при загрузке
applyTheme(getTheme());

// Определение языка
let userLang = (navigator.language || navigator.userLanguage).startsWith('ru') ? 'ru' : 'en';

// Функция для применения переводов
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key === 'remaining_memory') {
      element.innerText = translations[userLang][key].replace('{0}', remainingMemory);
    } else {
      element.innerText = translations[userLang][key];
    }
  });
  document.title = translations[userLang].title;
  document.documentElement.lang = userLang;
  if (animationInterval) {
    document.getElementById('play-animation').innerText = translations[userLang].stop_animation;
  }
  const pdfBut = document.getElementById('toggle-pdf-button');
  if (pdfBut.hasAttribute('data-status')) {
    pdfBut.innerText = translations[userLang].close;
  }
  updateLanguageDropdown();
}

// Обновление подписи текущего языка в дропдауне
function updateLanguageDropdown() {
  const currentLangSpan = document.getElementById('current-language');
  currentLangSpan.innerText = translations[userLang][`lang_${userLang}`];
}

// Обработчики выбора языка
document.querySelectorAll('.dropdown-item[data-lang]').forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    userLang = item.getAttribute('data-lang');
    applyTranslations();

    // Закрываем дропдаун после выбора
    const toggle = item.closest('.dropdown').querySelector('.dropdown-toggle');
    bootstrap.Dropdown.getInstance(toggle)?.hide();
  });
});

/*============ ИНИЦИАЛИЗАЦИЯ И ПЕРЕМЕННЫЕ ============*/
let customchar = Array.from({ length: 8 }, () => Array(5).fill(0));
let fps = 2;
let lcdCells = document.querySelectorAll('.lcd-cell');
let currentCell = null;
let currentCellIndex = 0;
let cellAnimations = Array.from({ length: 32 }, () => []);
let displayAnimations = {}; // Объект для хранения анимаций по конфигурациям
let currentConfig; // Текущая конфигурация дисплея (например, "16x2")

const memoryPerChar = 40;
const totalMemory = 320;
let remainingMemory = totalMemory; // Оставшаяся память для отображения в интерфейсе

function generatePixelGrid(rows = 8, cols = 5) {
  const gridContainer = document.getElementById('pixel-grid');
  gridContainer.innerHTML = ''; // Очищаем контейнер

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Создаём canvas-элемент
      const pixel = document.createElement('canvas');
      pixel.id = `pixel-${row}-${col}`;
      pixel.className = 'pixel off';

      // Добавляем в контейнер
      gridContainer.appendChild(pixel);
      gridContainer.appendChild(document.createTextNode(' '));
    }

    // После каждой строки добавляем <br> (кроме последней)
    if (row < rows - 1) {
      gridContainer.appendChild(document.createElement('br'));
    }
  }
}

/*============ ФУНКЦИЯ ДЛЯ ВЫЧИСЛЕНИЯ ИСПОЛЬЗУЕМОЙ ПАМЯТИ ============*/
function calculateMemoryUsage() {
  const usedMemory = savedFrames.length * memoryPerChar;
  remainingMemory = totalMemory - usedMemory;
  document.getElementById('memory-status').innerText = translations[
    userLang
  ].remaining_memory.replace('{0}', remainingMemory);
}

/*============ ОБРАБОТЧИКИ СОБЫТИЙ И ИЗМЕНЕНИЯ FPS ============*/
document.getElementById('fps').addEventListener('input', (event) => {
  fps = Number(event.target.value);
  document.getElementById('fpsValue').innerText = fps;
  if (animationInterval) {
    stopAnimation();
    playAnimation();
  }
});

/*============ ОЧИСТКА И ОБНОВЛЕНИЕ ПИКСЕЛЕЙ ============*/
function clear() {
  customchar.forEach((row) => row.fill(0));
  $('.pixel').removeClass('on').addClass('off');
  generateOutput();
  calculateMemoryUsage();
}

function togglePixel(pixel) {
  const [row, column] = pixel.id.split('-').slice(1).map(Number);
  const isOn = pixel.classList.contains('on');
  pixel.classList.toggle('on', !isOn);
  pixel.classList.toggle('off', isOn);
  customchar[row][column] = isOn ? 0 : 1;
}

function updateAllPixels() {
  customchar.forEach((row, i) => {
    row.forEach((val, j) => {
      const pixel = document.getElementById(`pixel-${i}-${j}`);
      pixel.classList.toggle('on', val === 1);
      pixel.classList.toggle('off', val === 0);
    });
  });
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

const clone = (value) => JSON.parse(JSON.stringify(value));

// Синхронизирует кадры текущей ячейки с общим хранилищем анимаций
function syncCurrentCellFrames() {
  cellAnimations[currentCellIndex] = clone(savedFrames);
}

function saveFrame() {
  if (savedFrames.length * memoryPerChar < totalMemory) {
    savedFrames.push(clone(customchar));
    syncCurrentCellFrames();
    renderSavedFrames();
    calculateMemoryUsage();
    startCellAnimation(currentCellIndex);
    generateOutput();
  } else {
    showErrorAlert('error_no_space');
  }
}

function renderSavedFrames() {
  const savedFramesContainer = document.getElementById('savedFrames');
  savedFramesContainer.innerHTML = '';
  savedFrames.forEach((frame, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 80;
    canvas.className = 'saved-frame';
    canvas.addEventListener('click', () => loadFrame(frame));
    canvas.draggable = true;
    canvas.dataset.index = index;
    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      showContextMenu(event, index);
    });
    canvas.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', index);
    });
    canvas.addEventListener('dragover', (event) => {
      event.preventDefault();
    });
    canvas.addEventListener('drop', (event) => {
      event.preventDefault();
      const draggedIndex = event.dataTransfer.getData('text/plain');
      const targetIndex = canvas.dataset.index;
      [savedFrames[draggedIndex], savedFrames[targetIndex]] = [
        savedFrames[targetIndex],
        savedFrames[draggedIndex],
      ];
      syncCurrentCellFrames();
      renderSavedFrames();
      calculateMemoryUsage();
    });
    const ctx = canvas.getContext('2d');
    frame.forEach((row, i) => {
      row.forEach((val, j) => {
        ctx.fillStyle = val ? '#000' : '#FFF';
        ctx.fillRect(j * 10, i * 10, 10, 10);
      });
    });
    savedFramesContainer.appendChild(canvas);
  });
}

function deleteFrame(index) {
  savedFrames.splice(index, 1);
  syncCurrentCellFrames();
  if (savedFrames.length === 0) {
    stopCellAnimation(currentCellIndex);
  }
  renderSavedFrames();
  calculateMemoryUsage();
}

function duplicateFrame(index) {
  if (savedFrames.length * memoryPerChar < totalMemory) {
    const frame = savedFrames[index];
    savedFrames.splice(index, 0, clone(frame));
    syncCurrentCellFrames();
    renderSavedFrames();
    calculateMemoryUsage();
  } else {
    showErrorAlert('error_no_space');
  }
}

// Иконки контекстного меню с цветом текущей темы
function getContextMenuIcons() {
  const fill = getTheme() === 'dark' ? '%23e0e0e0' : '%23444444';
  return {
    duplicate: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    delete: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  };
}

function showContextMenu(event, index) {
  // Закрываем предыдущее меню, если оно есть
  const existingMenu = document.querySelector('.context-menu');
  if (existingMenu) existingMenu.remove();

  // Создаем контекстное меню (оформление — в main.css: .context-menu)
  const contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;

  const menuIcons = getContextMenuIcons();

  // Создаем пункты меню
  const menuItems = [
    {
      text: translations[userLang].duplicate,
      icon: menuIcons.duplicate,
      action: () => duplicateFrame(index),
    },
    {
      text: translations[userLang].delete,
      icon: menuIcons.delete,
      action: () => deleteFrame(index),
    },
  ];

  menuItems.forEach((item) => {
    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item';
    menuItem.innerText = item.text;

    const icon = document.createElement('div');
    icon.className = 'context-menu-icon';
    icon.style.backgroundImage = `url('${item.icon}')`;
    menuItem.prepend(icon);

    menuItem.addEventListener('click', () => {
      item.action();
      contextMenu.remove();
    });

    contextMenu.appendChild(menuItem);
  });

  // Добавляем разделитель
  const divider = document.createElement('div');
  divider.className = 'context-menu-divider';
  contextMenu.insertBefore(divider, contextMenu.lastChild);

  // Добавляем меню на страницу
  document.body.appendChild(contextMenu);

  // Закрытие при клике вне меню
  const closeMenu = (e) => {
    if (!contextMenu.contains(e.target)) {
      contextMenu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };

  document.addEventListener('click', closeMenu);

  // Предотвращаем закрытие при клике внутри меню
  contextMenu.addEventListener('click', (e) => {
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
  customchar = clone(frame);
  updateAllPixels();
  generateOutput();
}

let animationInterval = null;

function playAnimation() {
  if (savedFrames.length === 0) return;
  document.getElementById('play-animation').innerText = translations[userLang].stop_animation;
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
  document.getElementById('play-animation').innerText = translations[userLang].play_animation;
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
  const blob = new Blob([jsonState], { type: 'application/json' });
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedDate = `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saved_state_${formattedDate}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function isVersionGte(version, target) {
  const toNums = (v) => v.split('.').map(Number);
  const [v1, v2] = [toNums(version), toNums(target)];

  for (let i = 0; i < 3; i++) {
    if ((v1[i] ?? 0) > (v2[i] ?? 0)) return true;
    if ((v1[i] ?? 0) < (v2[i] ?? 0)) return false;
  }
  return true; // equal
}

function loadStateFromFile(file) {
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const state = JSON.parse(event.target.result);

      // Проверяем версию и загружаем анимации
      if (isVersionGte(state.version, '0.18.0') && state.displayAnimations) {
        if (state.currentConfig) {
          currentConfig = state.currentConfig;
        }
        displayAnimations = state.displayAnimations;
        if (!displayAnimations[currentConfig]) {
          const [cols, rows] = currentConfig.split('x').map(Number);
          displayAnimations[currentConfig] = Array.from({ length: rows * cols }, () => []);
        }
        cellAnimations = displayAnimations[currentConfig];
      } else {
        // Старый формат: плоский массив анимаций для текущей конфигурации
        const [cols, rows] = currentConfig.split('x').map(Number);
        displayAnimations[currentConfig] =
          state.cellAnimations || Array.from({ length: rows * cols }, () => []);
        cellAnimations = displayAnimations[currentConfig];
      }

      if (Array.isArray(state.customchar)) customchar = state.customchar;
      if (Number.isFinite(state.fps)) fps = Math.min(24, Math.max(1, state.fps));
      if (Array.isArray(state.savedFrames)) savedFrames = state.savedFrames;

      const [cols, rows] = currentConfig.split('x').map(Number);
      if (Number.isInteger(state.currentCellIndex)) {
        currentCellIndex = Math.min(rows * cols - 1, Math.max(0, state.currentCellIndex));
      }

      // Синхронизируем интерфейс с загруженным состоянием
      document.getElementById('fps').value = fps;
      document.getElementById('fpsValue').innerText = fps;
      lcdSelect.value = currentConfig;
      createLcdCells(rows, cols); // создаёт сетку и запускает анимации
      if (currentCellIndex !== 0) {
        switchCell(currentCellIndex); // восстанавливаем сохранённую активную ячейку
      }

      updateAllPixels();
      renderSavedFrames();
      calculateMemoryUsage();
      generateOutput();
    } catch {
      showErrorAlert('error_load_json');
    }
  };
  reader.readAsText(file);
}

/*============ АЛЕРТЫ ============*/
function showConfirmationAlert(message, callback) {
  Swal.fire({
    title: translations[userLang][message],
    icon: 'warning',
    theme: getTheme(),
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
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
    icon: 'error',
    theme: getTheme(),
    confirmButtonText: translations[userLang].ok,
    confirmButtonColor: '#3085d6',
  });
}

function showWarningAlert(message, options = {}) {
  Swal.fire({
    title: translations[userLang].warning || 'Warning',
    text: translations[userLang][message] || message,
    icon: 'warning',
    iconColor: '#ffc107',
    theme: getTheme(),
    confirmButtonText: translations[userLang].ok || 'OK',
    confirmButtonColor: '#3085d6',
    backdrop: true,
  });
}

/*============ ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ============*/
$(document).ready(function () {
  applyTranslations();
  clear();
  $('#clear').click(function () {
    showConfirmationAlert('confirm_clear', clear);
  });
  $('#invert').click(invert);
  $('#reflectHorizontal').click(reflectHorizontal);
  $('#reflectVertical').click(reflectVertical);
  $('.pixel').click(function () {
    togglePixel(this);
    generateOutput();
  });
  $('#play-animation').click(function () {
    if (animationInterval) stopAnimation();
    else playAnimation();
  });
  $('#save-frame').click(saveFrame);
  $('#copy-char-btn').click(() => copyToClipboard('codeChar'));
  $('#copy-arduino-btn').click(() => copyToClipboard('codeArduino'));
  $('#customCharacterLink').click(function () {
    $('#tab-pixel').show();
    $('#tab-code').hide();
    $('#customCharacterLink').addClass('active');
    $('#arduinoCodeLink').removeClass('active');
  });
  $('#arduinoCodeLink').click(function () {
    $('#tab-code').show();
    $('#tab-pixel').hide();
    $('#customCharacterLink').removeClass('active');
    $('#arduinoCodeLink').addClass('active');
  });
});

document.getElementById('toggle-pdf-button').addEventListener('click', function () {
  const pdfPanel = document.getElementById('pdf-panel');
  const pdfBut = document.getElementById('toggle-pdf-button');
  if (pdfBut.hasAttribute('data-status')) {
    pdfBut.removeAttribute('data-status');
    pdfPanel.classList.remove('open');
    pdfBut.classList.remove('open');
    pdfBut.innerText = translations[userLang].symbols_table;
  } else {
    pdfBut.setAttribute('data-status', 'active');
    pdfPanel.classList.add('open');
    pdfBut.classList.add('open');
    pdfBut.innerText = translations[userLang].close;
  }
});

document.getElementById('pdf-select').addEventListener('change', function () {
  const selectedPdf = this.value;
  document.getElementById('pdf-viewer').src = selectedPdf;
});

document.getElementById('save-state').addEventListener('click', saveStateToFile);
document.getElementById('load-state-btn').addEventListener('click', function () {
  document.getElementById('load-state').click();
});
document.getElementById('load-state').addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (file) {
    try {
      loadStateFromFile(file);
    } catch {
      showErrorAlert('error_load');
    }
  }
  // Сброс для повторного выбора того же файла
  event.target.value = '';
});
document.getElementById('theme-toggle').addEventListener('click', function () {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
});

async function copyToClipboard(elementId) {
  try {
    const element = document.getElementById(elementId);
    const textToCopy = element.tagName === 'TEXTAREA' ? element.value : element.textContent;
    await navigator.clipboard.writeText(textToCopy);
    Swal.fire({
      icon: 'success',
      title: translations[userLang].success,
      text: translations[userLang].copy_success,
      theme: getTheme(),
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: translations[userLang].error,
      text: translations[userLang].copy_error,
      theme: getTheme(),
    });
  }
}

/*============ ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА ============*/
window.addEventListener('DOMContentLoaded', () => {
  // Скрываем прелоадер
  const preloader = document.getElementById('preloader');
  preloader.classList.add('hidden');
  setTimeout(() => {
    preloader.style.display = 'none';
  }, 500);

  // Пиксельная сетка и дисплей
  generatePixelGrid(8, 5);

  currentConfig = lcdSelect.value; // Например, "16x2"
  const [cols, rows] = currentConfig.split('x').map(Number);

  // Инициализируем анимации для начальной конфигурации
  displayAnimations[currentConfig] = Array.from({ length: rows * cols }, () => []);
  cellAnimations = displayAnimations[currentConfig];

  createLcdCells(rows, cols);
});
