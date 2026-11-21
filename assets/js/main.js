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
  scheduleWorkspaceSave();
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
// Индекс кадра, который сейчас перетаскивают, и маркер места вставки
let dragFrameIndex = null;
let dropIndicator = null;

const framesContainerEl = document.querySelector('#savedFrames .frames-container');

const clone = (value) => JSON.parse(JSON.stringify(value));

// Синхронизирует кадры текущей ячейки с общим хранилищем анимаций
function syncCurrentCellFrames() {
  cellAnimations[currentCellIndex] = clone(savedFrames);
  scheduleWorkspaceSave();
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
  removeDropIndicator();
  framesContainerEl.innerHTML = '';

  if (savedFrames.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'frames-empty';
    empty.innerText = translations[userLang].no_frames;
    framesContainerEl.appendChild(empty);
    return;
  }

  savedFrames.forEach((frame, index) => {
    // Обёртка — перетаскиваемый элемент, канвас — только картинка
    const wrapper = document.createElement('div');
    wrapper.className = 'frame-wrapper';
    if (index === editingFrameIndex) {
      wrapper.classList.add('editing');
    }
    wrapper.dataset.index = index;
    wrapper.draggable = true;
    wrapper.title = translations[userLang].frame_tooltip.replace('{0}', index + 1);

    // Номер кадра — наглядный порядок в анимации
    const number = document.createElement('span');
    number.className = 'frame-number';
    number.innerText = index + 1;

    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 80;
    canvas.className = 'saved-frame';
    drawFrameToCanvas(canvas, frame);

    wrapper.appendChild(number);
    wrapper.appendChild(canvas);

    // Клик по кадру — вход в режим редактирования (повторный клик — выход)
    wrapper.addEventListener('click', () => toggleEditFrame(index));
    wrapper.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      showContextMenu(event, index);
    });

    wrapper.addEventListener('dragstart', (event) => {
      dragFrameIndex = index;
      wrapper.classList.add('dragging');
      // dataTransfer обязателен для запуска DnD в Firefox
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    wrapper.addEventListener('dragend', () => {
      wrapper.classList.remove('dragging');
      dragFrameIndex = null;
      removeDropIndicator();
    });

    framesContainerEl.appendChild(wrapper);
  });
}

/*============ ПЕРЕТАСКИВАНИЕ КАДРОВ ============*/
// Маркер места вставки показывается, пока курсор над контейнером кадров
function showDropIndicator(referenceWrapper, before) {
  if (!dropIndicator) {
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';
  }
  // Не трогаем DOM без необходимости — индикатор уже в нужном месте
  if (dropIndicator.parentElement === framesContainerEl) {
    if (before && dropIndicator.nextElementSibling === referenceWrapper) return;
    if (!before && dropIndicator.previousElementSibling === referenceWrapper) return;
  }
  if (before) {
    framesContainerEl.insertBefore(dropIndicator, referenceWrapper);
  } else {
    framesContainerEl.insertBefore(dropIndicator, referenceWrapper.nextSibling);
  }
}

function removeDropIndicator() {
  if (dropIndicator && dropIndicator.parentElement) {
    dropIndicator.remove();
  }
}

// Автопрокрутка, когда кадр тащат у края контейнера
function autoScrollFramesContainer(event) {
  const rect = framesContainerEl.getBoundingClientRect();
  const threshold = 40;
  if (event.clientX < rect.left + threshold) {
    framesContainerEl.scrollLeft -= 24;
  } else if (event.clientX > rect.right - threshold) {
    framesContainerEl.scrollLeft += 24;
  }
}

// Позиция вставки по координате курсора (dragover и drop)
function computeDropPosition(event) {
  const wrappers = Array.from(framesContainerEl.querySelectorAll('.frame-wrapper'));
  for (const wrapper of wrappers) {
    const rect = wrapper.getBoundingClientRect();
    if (event.clientX < rect.right) {
      // Курсор над кадром: левая половина — вставка до, правая — после
      const before = event.clientX < rect.left + rect.width / 2;
      return {
        reference: wrapper,
        before,
        insertAt: before ? Number(wrapper.dataset.index) : Number(wrapper.dataset.index) + 1,
      };
    }
  }
  // Курсор правее всех кадров — вставка в конец
  const last = wrappers.length > 0 ? wrappers[wrappers.length - 1] : null;
  return { reference: last, before: false, insertAt: savedFrames.length };
}

function onFramesDragOver(event) {
  if (dragFrameIndex === null) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  autoScrollFramesContainer(event);

  const { reference, before } = computeDropPosition(event);
  if (reference) {
    showDropIndicator(reference, before);
  }
}

function onFramesDrop(event) {
  if (dragFrameIndex === null) return;
  event.preventDefault();

  const { insertAt } = computeDropPosition(event);
  moveFrame(dragFrameIndex, insertAt);
  dragFrameIndex = null;
  removeDropIndicator();
}

// Переносит кадр с позиции fromIndex на позицию вставки insertAt
function moveFrame(fromIndex, insertAt) {
  if (fromIndex < 0 || fromIndex >= savedFrames.length) return;
  if (insertAt < 0 || insertAt > savedFrames.length) return;
  // «До себя» и «после себя» — ничего не делаем
  if (fromIndex === insertAt || fromIndex === insertAt - 1) return;

  // Запоминаем редактируемый кадр по ссылке, чтобы найти его после переноса
  const editedFrame = editingFrameIndex !== null ? savedFrames[editingFrameIndex] : null;

  const moved = savedFrames.splice(fromIndex, 1)[0];
  const target = insertAt > fromIndex ? insertAt - 1 : insertAt;
  savedFrames.splice(target, 0, moved);

  if (editedFrame) {
    const newIndex = savedFrames.indexOf(editedFrame);
    if (newIndex !== -1) {
      editingFrameIndex = newIndex;
      updateEditingStatus();
    }
  }

  syncCurrentCellFrames();
  renderSavedFrames();
  calculateMemoryUsage();
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
  scheduleWorkspaceSave();
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
    moveLeft: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`,
    moveRight: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>`,
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
      text: translations[userLang].move_left,
      icon: menuIcons.moveLeft,
      action: () => moveFrame(index, index - 1),
    },
    {
      text: translations[userLang].move_right,
      icon: menuIcons.moveRight,
      action: () => moveFrame(index, index + 2),
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

/*============ СОХРАНЕНИЕ И ВОССТАНОВЛЕНИЕ РАБОЧЕГО ПРОСТРАНСТВА ============*/
// Полное состояние рабочего пространства — единый формат для JSON-файла и автосохранения
function buildWorkspaceState() {
  return {
    version: PROJECT_VERSION,
    customchar,
    fps,
    savedFrames,
    currentCellIndex,
    displayAnimations, // Анимации для всех конфигураций дисплея
    currentConfig, // Текущая конфигурация
    memoryPerChar,
    totalMemory,
  };
}

function saveStateToFile() {
  const jsonState = JSON.stringify(buildWorkspaceState(), null, 2);
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

// Проверяем, что конфигурация есть среди доступных в выпадающем списке
function isValidLcdConfig(config) {
  return Array.from(lcdSelect.options).some((option) => option.value === config);
}

// Применяет сохранённое состояние (JSON-файл или localStorage) к рабочему пространству
function applyWorkspaceState(state) {
  // Загружаемое состояние полностью заменяет кадры — выходим из редактирования
  stopEditingFrame();

  // Проверяем версию и загружаем анимации
  if (isVersionGte(state.version, '0.18.0') && state.displayAnimations) {
    if (isValidLcdConfig(state.currentConfig)) {
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

  if (Number.isFinite(state.fps)) fps = Math.min(24, Math.max(1, state.fps));
  if (Array.isArray(state.savedFrames)) savedFrames = state.savedFrames;

  const [cols, rows] = currentConfig.split('x').map(Number);
  // createLcdCells сбрасывает активную ячейку в 0 — индекс храним локально
  const savedCellIndex = Number.isInteger(state.currentCellIndex)
    ? Math.min(rows * cols - 1, Math.max(0, state.currentCellIndex))
    : 0;

  // Синхронизируем интерфейс с загруженным состоянием
  document.getElementById('fps').value = fps;
  document.getElementById('fpsValue').innerText = fps;
  lcdSelect.value = currentConfig;
  createLcdCells(rows, cols); // создаёт сетку и запускает анимации
  if (savedCellIndex !== 0) {
    switchCell(savedCellIndex); // восстанавливаем сохранённую активную ячейку
  }

  // После switchCell: он загружает в редактор первый кадр активной ячейки
  if (Array.isArray(state.customchar)) customchar = state.customchar;

  updateAllPixels();
  renderSavedFrames();
  calculateMemoryUsage();
  generateOutput();
}

function loadStateFromFile(file) {
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      applyWorkspaceState(JSON.parse(event.target.result));
      scheduleWorkspaceSave();
    } catch {
      showErrorAlert('error_load_json');
    }
  };
  reader.readAsText(file);
}

/*============ АВТОСОХРАНЕНИЕ В LOCALSTORAGE ============*/
const WORKSPACE_STORAGE_KEY = 'workspaceState';
// Пауза перед записью: изменения идут сериями, пишем один раз на серию
const WORKSPACE_SAVE_DELAY = 300;
let workspaceSaveTimer = null;

function saveWorkspaceState() {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(buildWorkspaceState()));
  } catch {
    /* localStorage может быть недоступен или переполнен */
  }
}

// Откладывает запись состояния, чтобы не писать в localStorage на каждый клик
function scheduleWorkspaceSave() {
  clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = setTimeout(() => {
    workspaceSaveTimer = null;
    saveWorkspaceState();
  }, WORKSPACE_SAVE_DELAY);
}

// При закрытии страницы дописываем несохранённые изменения
window.addEventListener('beforeunload', () => {
  if (workspaceSaveTimer !== null) {
    clearTimeout(workspaceSaveTimer);
    workspaceSaveTimer = null;
    saveWorkspaceState();
  }
});

// Восстанавливает состояние из localStorage; false — чистый лист
function restoreWorkspaceState() {
  let stored = null;
  try {
    stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return false;
  }
  if (!stored) return false;
  try {
    const state = JSON.parse(stored);
    if (!state || typeof state !== 'object') return false;
    // Данные пишет сам код — чужой формат считаем повреждённым
    if (!Array.isArray(state.customchar) || !Array.isArray(state.savedFrames)) return false;
    if (typeof state.displayAnimations !== 'object' || state.displayAnimations === null) {
      return false;
    }
    applyWorkspaceState(state);
    return true;
  } catch {
    return false;
  }
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

  // Пиксельная сетка нужна до привязки обработчиков и восстановления состояния
  generatePixelGrid(8, 5);

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

  /* Инициализация дисплея: восстановление или чистый лист (после clear) */
  if (!restoreWorkspaceState()) {
    displayAnimations = {};
    currentConfig = lcdSelect.value; // Например, "16x2"
    const [cols, rows] = currentConfig.split('x').map(Number);

    // Инициализируем анимации для начальной конфигурации
    displayAnimations[currentConfig] = Array.from({ length: rows * cols }, () => []);
    cellAnimations = displayAnimations[currentConfig];

    createLcdCells(rows, cols);
  }
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
// Drag&drop живёт на контейнере: кадры пересоздаются при каждом рендере
framesContainerEl.addEventListener('dragover', onFramesDragOver);
framesContainerEl.addEventListener('drop', onFramesDrop);

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
  // Прелоадер. Сетку пикселей и дисплей инициализирует $(document).ready
  const preloader = document.getElementById('preloader');
  preloader.classList.add('hidden');
  setTimeout(() => {
    preloader.style.display = 'none';
  }, 500);
});
