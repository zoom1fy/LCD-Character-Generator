// Initialize display
const lcdCells = document.querySelectorAll('.lcd-cell');
let currentCell = null;
let currentCellIndex = 0;

// Object to store animations for each cell
const cellAnimations = Array.from({ length: 32 }, () => []);

// Function to switch to a cell
function switchCell(index) {
  if (currentCell !== null) {
    currentCell.classList.remove('active');
    // Save current animation to the cell
    cellAnimations[currentCellIndex] = JSON.parse(JSON.stringify(savedFrames));
  }

  currentCellIndex = index;
  currentCell = document.querySelector(`.lcd-cell[data-index="${index}"]`);
  currentCell.classList.add('active');

  // Load animation for the selected cell
  savedFrames = JSON.parse(JSON.stringify(cellAnimations[index]));
  renderSavedFrames();
  if (savedFrames.length > 0) {
    loadFrame(savedFrames[0]);
  } else {
    clear();
  }
}

// Click event handler for cells
lcdCells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = parseInt(cell.getAttribute('data-index'));
    switchCell(index);
  });
});

// Initialize the first cell as active
switchCell(0);
