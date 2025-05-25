const PROJECT_VERSION = '0.18.0';

/*============ ПЕРЕВОДЫ ============*/
const translations = {
  en: {
    title: 'LCD Character Generator',
    save_state: 'Save State',
    load_state: 'Load State',
    custom_character: 'Custom Character',
    arduino_code: 'Arduino Code',
    pixels: 'Pixels',
    clear: 'Clear',
    invert: 'Invert',
    reflect_horizontal: 'Reflect Horizontal',
    reflect_vertical: 'Reflect Vertical',
    output: 'Output',
    copy: 'COPY',
    remaining_memory: 'Remaining memory: {0} bytes',
    saved_frames: 'Saved Frames',
    animation_fps: 'Animation FPS:',
    save_frame: 'Save Frame',
    play_animation: 'Play Animation',
    stop_animation: 'Stop Animation',
    symbols_table: 'Symbols table',
    close: 'Close',
    mt_20s4a: 'MT–20S4A',
    hd44780u: 'HD44780U',
    lcd_16x2: 'LCD Display 16x2',
    lcd_20x4: 'LCD Display 20x4',
    soon: 'SOON',
    project_source: 'Project source on GitHub',
    license: 'Licensed under GNU GPL v3 or later',
    copyright: '© 2025 Copyright: LCD-Character-Generator',
    confirm_clear: 'Do you really want to clear the frame?',
    error_no_space: 'There is not enough space to save the new frame',
    error_load: 'Something went wrong...',
    soon_message: 'This section is still under development :(',
    duplicate: 'Duplicate',
    delete: 'Delete',
    yes: 'Yes',
    no: 'No',
    ok: 'Ok',
    error: 'Error',
    lang_en: 'English',
    lang_ru: 'Russian',
  },
  ru: {
    title: 'Генератор символов LCD',
    save_state: 'Сохранить состояние',
    load_state: 'Загрузить состояние',
    custom_character: 'Пользовательский символ',
    arduino_code: 'Код для Arduino',
    pixels: 'Пиксели',
    clear: 'Очистить',
    invert: 'Инвертировать',
    reflect_horizontal: 'Отразить по горизонтали',
    reflect_vertical: 'Отразить по вертикали',
    output: 'Вывод',
    copy: 'КОПИРОВАТЬ',
    remaining_memory: 'Оставшаяся память: {0} байт',
    saved_frames: 'Сохранённые кадры',
    animation_fps: 'Частота анимации:',
    save_frame: 'Сохранить кадр',
    play_animation: 'Воспроизвести анимацию',
    stop_animation: 'Остановить анимацию',
    symbols_table: 'Таблица символов',
    close: 'Закрыть',
    mt_20s4a: 'MT–20S4A',
    hd44780u: 'HD44780U',
    lcd_16x2: 'Дисплей LCD 16x2',
    lcd_20x4: 'Дисплей LCD 20x4',
    soon: 'СКОРО',
    project_source: 'Исходный код проекта на GitHub',
    license: 'Лицензировано под GNU GPL v3 или новее',
    copyright: '© 2025 Авторское право: LCD-Character-Generator',
    confirm_clear: 'Вы действительно хотите очистить кадр?',
    error_no_space: 'Недостаточно места для сохранения нового кадра',
    error_load: 'Что-то пошло не так...',
    soon_message: 'Этот раздел всё ещё в разработке :(',
    duplicate: 'Дублировать',
    delete: 'Удалить',
    yes: 'Да',
    no: 'Нет',
    ok: 'ОК',
    error: 'Ошибка',
    lang_en: 'English',
    lang_ru: 'Русский',
  },
};

// Определение языка
let userLang = (navigator.language || navigator.userLanguage).startsWith('ru') ? 'ru' : 'en';

// Функция для применения переводов
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (key === 'remaining_memory') {
      const memory = element.innerText.match(/\d+/) ? element.innerText.match(/\d+/)[0] : '1016';
      element.innerText = translations[userLang][key].replace('{0}', memory);
    } else {
      element.innerText = translations[userLang][key];
    }
  });
  document.title = translations[userLang].title;
  if (animationInterval) {
    document.getElementById('play-animation').innerText = translations[userLang].stop_animation;
  }
  const pdfBut = document.getElementById('toggle-pdf-button');
  if (pdfBut.hasAttribute('data-status')) {
    pdfBut.innerText = translations[userLang].close;
  }
  updateLanguageDropdown();
}

// Обновление дропдауна языка
function updateLanguageDropdown() {
  const currentLangSpan = document.getElementById('current-language');
  currentLangSpan.innerText = translations[userLang][`lang_${userLang}`];
  document.querySelectorAll('.dropdown-item[data-lang]').forEach(item => {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      userLang = this.getAttribute('data-lang');
      applyTranslations();

      // Закрываем дропдаун после выбора
      const dropdown = bootstrap.Dropdown.getInstance(document.querySelector('.dropdown-toggle'));
      dropdown.hide();
    });
  });
}

/*============ ИНИЦИАЛИЗАЦИЯ И ПЕРЕМЕННЫЕ ============*/
let customchar = Array.from({ length: 8 }, () => Array(5).fill(0));
let fps = 2;
let lcdCells = document.querySelectorAll('.lcd-cell');
let currentCell = null;
let currentCellIndex = 0;
let cellAnimations = Array.from({ length: 32 }, () => []);
const memoryPerChar = 40;
const totalMemory = 320;

/*============ ФУНКЦИЯ ДЛЯ ВЫЧИСЛЕНИЯ ИСПОЛЬЗУЕМОЙ ПАМЯТИ ============*/
function calculateMemoryUsage() {
  let usedMemory = savedFrames.length * memoryPerChar;
  let remainingMemory = totalMemory - usedMemory;
  document.getElementById('memory-status').innerText = translations[userLang].remaining_memory.replace(
    '{0}',
    remainingMemory
  );
}

/*============ ОБРАБОТЧИКИ СОБЫТИЙ И ИЗМЕНЕНИЯ FPS ============*/
document.getElementById('fps').addEventListener('input', event => {
  fps = Number(event.target.value);
  document.getElementById('fpsValue').innerText = fps;
  if (animationInterval) {
    stopAnimation();
    playAnimation();
  }
});

/*============ ОЧИСТКА И ОБНОВЛЕНИЕ ПИКСЕЛЕЙ ============*/
function clear() {
  customchar.forEach(row => row.fill(0));
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
  calculateMemoryUsage();
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

/*============ ГЕНЕРАЦИЯ ВЫВОДА ДЛЯ ARDUINO ============*/
function generateOutput() {
  let output = 'byte customChar[8] = {\n';
  output += customchar.map(row => `\t0b${row.join('')}`).join(',\n');
  output += '\n};';
  $('.output').text(output);
  $('#codeArduino').text(`#include <LiquidCrystal.h>
    LiquidCrystal lcd(${$('#RSPin').val()}, ${$('#EnablePin').val()}, ${$('#D4Pin').val()}, ${$('#D5Pin').val()}, ${$(
    '#D6Pin'
  ).val()}, ${$('#D7Pin').val()});
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
  customchar = customchar.map(row => row.map(val => 1 - val));
  updateAllPixels();
  generateOutput();
}

function reflectHorizontal() {
  customchar = customchar.map(row => row.reverse());
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
const framesContainer = document.querySelector('.frames-container');

function saveFrame() {
  if (savedFrames.length * memoryPerChar < totalMemory) {
    savedFrames.push(JSON.parse(JSON.stringify(customchar)));
    cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
    renderSavedFrames();
    calculateMemoryUsage();
    startCellAnimation(currentCellIndex);
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
    canvas.addEventListener('contextmenu', event => {
      event.preventDefault();
      showContextMenu(event, index);
    });
    canvas.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', index);
    });
    canvas.addEventListener('dragover', event => {
      event.preventDefault();
    });
    canvas.addEventListener('drop', event => {
      event.preventDefault();
      const draggedIndex = event.dataTransfer.getData('text/plain');
      const targetIndex = canvas.dataset.index;
      [savedFrames[draggedIndex], savedFrames[targetIndex]] = [savedFrames[targetIndex], savedFrames[draggedIndex]];
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
    showErrorAlert('error_no_space');
  }
}

function showContextMenu(event, index) {
  const contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.position = 'absolute';
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  contextMenu.style.backgroundColor = '#fff';
  contextMenu.style.border = '1px solid #ccc';
  contextMenu.style.padding = '10px';
  contextMenu.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.1)';
  contextMenu.style.zIndex = 1000;
  const duplicateItem = document.createElement('div');
  duplicateItem.innerText = translations[userLang].duplicate;
  duplicateItem.style.cursor = 'pointer';
  duplicateItem.addEventListener('click', () => {
    duplicateFrame(index);
    document.body.removeChild(contextMenu);
  });
  const deleteItem = document.createElement('div');
  deleteItem.innerText = translations[userLang].delete;
  deleteItem.style.cursor = 'pointer';
  deleteItem.addEventListener('click', () => {
    deleteFrame(index);
    document.body.removeChild(contextMenu);
  });
  contextMenu.appendChild(duplicateItem);
  contextMenu.appendChild(deleteItem);
  document.body.appendChild(contextMenu);
  document.addEventListener(
    'click',
    () => {
      document.body.removeChild(contextMenu);
    },
    { once: true }
  );
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
function loadStateFromFile(file) {
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const state = JSON.parse(event.target.result);
      customchar = state.customchar;
      fps = state.fps;
      savedFrames = state.savedFrames;
      currentCellIndex = state.currentCellIndex;
      cellAnimations = state.cellAnimations;
      // Игнорируем поле version для обратной совместимости
      updateAllPixels();
      renderSavedFrames();
      calculateMemoryUsage();
      generateOutput();
      startAllCellsAnimations();
    } catch {
      showErrorAlert('error_load');
    }
  };
  reader.readAsText(file);
}

function saveStateToFile() {
  const state = {
    version: PROJECT_VERSION,
    customchar,
    fps,
    savedFrames,
    currentCellIndex,
    cellAnimations,
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

/*============ АЛЕРТЫ ============*/
function showConfirmationAlert(message, callback) {
  Swal.fire({
    title: translations[userLang][message],
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: translations[userLang].yes,
    cancelButtonText: translations[userLang].no,
  }).then(result => {
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
    confirmButtonText: translations[userLang].ok,
    confirmButtonColor: '#3085d6',
  });
}

function showSoonAlert(message, callback) {
  Swal.fire({
    title: translations[userLang].soon_message,
    icon: 'info',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: translations[userLang].yes,
    cancelButtonText: translations[userLang].no,
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
  $('#customCharacterLink').click(function () {
    $('#tab-pixel').show();
    $('#tab-code').hide();
    document.getElementById('customCharacterLink').setAttribute('class', 'nav-link active');
    document.getElementById('arduinoCodeLink').removeAttribute('class', 'active');
    document.getElementById('arduinoCodeLink').setAttribute('class', 'nav-link');
  });
  $('#arduinoCodeLink').click(function () {
    $('#tab-code').show();
    $('#tab-pixel').hide();
    document.getElementById('customCharacterLink').removeAttribute('class', 'active');
    document.getElementById('customCharacterLink').setAttribute('class', 'nav-link');
    document.getElementById('arduinoCodeLink').setAttribute('class', 'nav-link active');
  });
  $('.dropdown-item[data-lang]').click(function (e) {
    e.preventDefault();
    userLang = $(this).data('lang');
    applyTranslations();
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
});
document.getElementById('theme-toggle').addEventListener('click', function () {
  document.body.setAttribute('data-theme', document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

async function copyToClipboard(elementId) {
  try {
    const textarea = document.getElementById(elementId);
    await navigator.clipboard.writeText(textarea.value);
    Swal.fire({
      icon: 'success',
      title: 'Успех!',
      text: 'Текст скопирован в буфер обмена',
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Ошибка',
      text: 'Не удалось скопировать текст',
    });
  }
}
