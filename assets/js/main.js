const PROJECT_VERSION = '0.19.0';

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
    } else if (key === 'editing_frame') {
      element.innerText = translations[userLang].editing_frame.replace(
        '{0}',
        editingFrameIndex === null ? '' : editingFrameIndex + 1
      );
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

    // Перегенерируем вывод
    generateOutput();
    // Перерисовываем динамические подписи (список кадров) на новом языке
    renderSavedFrames();

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
    // Ряд пикселей (зазоры задаёт CSS gap)
    const rowEl = document.createElement('div');
    rowEl.className = 'pixel-row';

    for (let col = 0; col < cols; col++) {
      // Создаём canvas-элемент
      const pixel = document.createElement('canvas');
      pixel.id = `pixel-${row}-${col}`;
      pixel.className = 'pixel off';

      rowEl.appendChild(pixel);
    }

    gridContainer.appendChild(rowEl);
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
  onEditorContentChanged();
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
// Трансформации идут через onEditorContentChanged
function invert() {
  customchar = customchar.map((row) => row.map((val) => 1 - val));
  updateAllPixels();
  onEditorContentChanged();
}

function reflectHorizontal() {
  customchar = customchar.map((row) => row.reverse());
  updateAllPixels();
  onEditorContentChanged();
}

function reflectVertical() {
  customchar = customchar.reverse();
  updateAllPixels();
  onEditorContentChanged();
}

/*============ СОХРАНЕНИЕ И РЕНДЕРИНГ КАДРОВ ============*/
let savedFrames = [];
let currentFrameIndex = -1;
// Индекс кадра, который сейчас редактируется в пиксель-редакторе (null — режим выключен)
let editingFrameIndex = null;

const framesContainerEl = document.querySelector('#savedFrames .frames-container');

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

/* Рисует кадр на канвасе миниатюры в цветах текущей темы */
function drawFrameToCanvas(canvas, frame) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const onColor = getTheme() === 'dark' ? '#e0e0e0' : '#000';
  const offColor = getTheme() === 'dark' ? '#494949' : '#FFF';
  frame.forEach((row, i) => {
    row.forEach((val, j) => {
      ctx.fillStyle = val ? onColor : offColor;
      ctx.fillRect(j * 10, i * 10, 10, 10);
    });
  });
}

function renderSavedFrames() {
  // Очищаем только контейнер кадров, не трогая заголовок
  framesContainerEl.innerHTML = '';

  if (savedFrames.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'frames-empty';
    empty.innerText = translations[userLang].no_frames;
    framesContainerEl.appendChild(empty);
    return;
  }

  savedFrames.forEach((frame, index) => {
    // Обёртка — кликабельный элемент, канвас — только картинка
    const wrapper = document.createElement('div');
    wrapper.className = 'frame-wrapper';
    if (index === editingFrameIndex) {
      wrapper.classList.add('editing');
    }
    wrapper.dataset.index = index;

    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 80;
    canvas.className = 'saved-frame';
    drawFrameToCanvas(canvas, frame);

    wrapper.appendChild(canvas);

    // Клик по кадру — вход в режим редактирования (повторный клик — выход)
    wrapper.addEventListener('click', () => toggleEditFrame(index));
    wrapper.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      showContextMenu(event, index);
    });

    framesContainerEl.appendChild(wrapper);
  });
}

/*============ РЕДАКТИРОВАНИЕ СОХРАНЁННЫХ КАДРОВ ============*/
function updateEditingStatus() {
  const statusEl = document.getElementById('editing-status');
  const labelEl = document.getElementById('editing-frame-label');
  if (editingFrameIndex === null) {
    statusEl.hidden = true;
  } else {
    labelEl.innerText = translations[userLang].editing_frame.replace(
      '{0}',
      editingFrameIndex + 1
    );
    statusEl.hidden = false;
  }
}

function startEditingFrame(index) {
  if (animationInterval) {
    stopAnimation();
  }
  editingFrameIndex = index;
  loadFrame(savedFrames[index]);
  updateEditingStatus();
  renderSavedFrames();
}

function stopEditingFrame() {
  if (editingFrameIndex === null) return;
  editingFrameIndex = null;
  updateEditingStatus();
  renderSavedFrames();
}

function toggleEditFrame(index) {
  if (editingFrameIndex === index) {
    stopEditingFrame();
  } else {
    startEditingFrame(index);
  }
}

// Применяет текущее содержимое пиксель-редактора к редактируемому кадру
function commitEditorToFrame() {
  if (editingFrameIndex === null || editingFrameIndex >= savedFrames.length) return;
  savedFrames[editingFrameIndex] = clone(customchar);
  syncCurrentCellFrames();
  renderSavedFrames();
}

// Единая точка после любых изменений пикселей: обновляет кадр и вывод кода
function onEditorContentChanged() {
  if (editingFrameIndex !== null) {
    commitEditorToFrame();
  }
  generateOutput();
}

function deleteFrame(index) {
  savedFrames.splice(index, 1);
  // Корректируем режим редактирования под новое расположение кадров
  if (editingFrameIndex !== null) {
    if (editingFrameIndex === index) {
      stopEditingFrame();
    } else if (index < editingFrameIndex) {
      editingFrameIndex--;
      updateEditingStatus();
    }
  }
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
    // Дубликат вставляется до редактируемого кадра — сдвигаем его индекс
    if (editingFrameIndex !== null && index <= editingFrameIndex) {
      editingFrameIndex++;
      updateEditingStatus();
    }
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
    edit: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
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
      text: translations[userLang].edit,
      icon: menuIcons.edit,
      action: () => startEditingFrame(index),
    },
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
  // Просмотр анимации и редактирование кадра несовместимы
  stopEditingFrame();
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
    onEditorContentChanged();
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
  // Перерисовываем миниатюры кадров в цветах новой темы
  renderSavedFrames();
});

/*============ СОБЫТИЯ КАДРОВ И РЕДАКТИРОВАНИЯ ============*/
document.getElementById('stop-editing-btn').addEventListener('click', stopEditingFrame);

// Esc — быстрый выход из режима редактирования кадра
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    stopEditingFrame();
  }
});

async function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  const textToCopy = element.tagName === 'TEXTAREA' ? element.value : element.textContent;

  let copied = false;

  // Clipboard API доступен только в защищённом контексте
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      copied = true;
    } catch {
      /* переходим к резервному способу */
    }
  }

  // Резервное копирование через execCommand
  if (!copied) {
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = textToCopy;
    tempTextarea.setAttribute('readonly', '');
    tempTextarea.style.position = 'fixed';
    tempTextarea.style.top = '0';
    tempTextarea.style.opacity = '0';
    document.body.appendChild(tempTextarea);
    tempTextarea.focus();
    tempTextarea.select();
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    document.body.removeChild(tempTextarea);
  }

  if (copied) {
    Swal.fire({
      icon: 'success',
      title: translations[userLang].success,
      text: translations[userLang].copy_success,
      theme: getTheme(),
      timer: 2000,
      showConfirmButton: false,
    });
  } else {
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
