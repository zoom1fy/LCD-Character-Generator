const symbolTable = document.getElementById("symbolTable");

// Создание таблицы символов
symbols.forEach((symbol, index) => {
  const symbolCell = document.createElement("div");
  symbolCell.className = "symbol-cell";
  symbolCell.dataset.index = index;

  // Отрисовка символа
  const canvas = document.createElement("canvas");
  canvas.width = 20;
  canvas.height = 20;
  const ctx = canvas.getContext("2d");

  symbol.forEach((row, i) => {
    row.forEach((val, j) => {
      ctx.fillStyle = val ? "#000" : "#fff";
      ctx.fillRect(j * 4, i * 2.5, 4, 2.5);
    });
  });

  symbolCell.appendChild(canvas);

  // Обработчик нажатия на символ
  symbolCell.addEventListener("click", () => {
    loadSymbol(symbol);
  });

  symbolTable.appendChild(symbolCell);
});

// Функция для загрузки символа на панель
function loadSymbol(symbol) {
  customchar = JSON.parse(JSON.stringify(symbol));
  updateAllPixels();
  generateOutput();
}
