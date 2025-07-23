// Функция для проверки "особых" пинов
function checkSpecialPins(pinValue, pinName) {
  const specialPins = [0, 1]; // Пины, используемые для Serial на Arduino Uno
  if (specialPins.includes(parseInt(pinValue))) {
    showWarningAlert(`pin_warning_${pinValue}`);
  }
}

// Обновленная функция generateOutput
function generateOutput() {
  // Проверка пинов на "особенность"
  ['RSPin', 'EnablePin', 'D4Pin', 'D5Pin', 'D6Pin', 'D7Pin'].forEach((id) => {
    const pinValue = document.getElementById(id).value;
    checkSpecialPins(pinValue, id);
  });

  const frames = cellAnimations[currentCellIndex] || [];

  // Проверка на наличие кадров
  if (frames.length === 0) {
    document.getElementById('codeChar').value = translations[userLang].noFrameMes;
    document.getElementById('codeArduino').textContent = '// No animation for this cell';
    return;
  }

  // Генерация определений пользовательских символов и констант (до 8 кадров)
  let customCharsDefs = '';
  let constDefs = '';
  frames.slice(0, 8).forEach((frame, i) => {
    const bytes = frame.map((row) => `0b${row.join('')}`);
    customCharsDefs += `byte customChar${i}[8] = {\n  ${bytes.join(',\n  ')}\n};\n\n`;
    constDefs += `const char FRAME${i} = ${i};\n`;
  });

  // Получение размеров LCD из текущей конфигурации
  const [colsStr, rowsStr] = currentConfig.split('x');
  const cols = parseInt(colsStr);
  const rows = parseInt(rowsStr);

  // Вычисление позиции текущей ячейки
  const rowPos = Math.floor(currentCellIndex / cols);
  const colPos = currentCellIndex % cols;

  // Получение значений пинов из полей ввода
  const rs = document.getElementById('RSPin').value;
  const en = document.getElementById('EnablePin').value;
  const d4 = document.getElementById('D4Pin').value;
  const d5 = document.getElementById('D5Pin').value;
  const d6 = document.getElementById('D6Pin').value;
  const d7 = document.getElementById('D7Pin').value;

  // Формирование полного скетча Arduino
  const sketch = `#include <LiquidCrystal.h>

LiquidCrystal lcd(${rs}, ${en}, ${d4}, ${d5}, ${d6}, ${d7});

${constDefs}
${customCharsDefs}
void setup() {
  lcd.begin(${cols}, ${rows});
  ${frames
    .slice(0, 8)
    .map((_, i) => `lcd.createChar(FRAME${i}, customChar${i});`)
    .join('\n  ')}
}

int frameIndex = 0;
const int numFrames = ${Math.min(frames.length, 8)};
const int delayMs = 1000 / ${fps};

void loop() {
  lcd.setCursor(${colPos}, ${rowPos});
  lcd.write(FRAME${frames.length > 1 ? 'frameIndex' : '0'});
  frameIndex = (frameIndex + 1) % numFrames;
  delay(delayMs);
}`;

  // Обновление элементов интерфейса
  const block = document.getElementById('codeArduino');
  block.textContent = sketch;
  hljs.highlightElement(block);
  document.getElementById('codeChar').value = customCharsDefs;
}

// Привязка обработчиков событий к полям ввода пинов
['RSPin', 'EnablePin', 'D4Pin', 'D5Pin', 'D6Pin', 'D7Pin'].forEach((id) => {
  document.getElementById(id).addEventListener('input', generateOutput);
});
