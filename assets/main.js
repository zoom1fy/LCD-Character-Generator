// Create a 2D array for the custom char
var customchar = Array.from({ length: 8 }, () => Array(5).fill(0));

function clear() {
    // Clear the custom character array and reset pixels
    customchar.forEach(row => row.fill(0));
    $(".pixel").removeClass('on').addClass('off');
}

function togglePixel(pixel) {
    const [row, column] = $(pixel).attr('id').split("-").slice(1).map(Number);
    const isOn = $(pixel).hasClass('on');

    $(pixel).toggleClass('on off');
    customchar[row][column] = isOn ? 0 : 1;
}

function invert() {
    // Invert all pixels
    $('.pixel').each(function () {
        togglePixel($(this));
    });
}

function reflectHorizontal() {
    // Reflect the custom character horizontally
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 2; j++) {
            // Swap elements in the row
            [customchar[i][j], customchar[i][4 - j]] = [customchar[i][4 - j], customchar[i][j]];

            // Update pixel states
            updatePixel(i, j);
            updatePixel(i, 4 - j);
        }
    }
    generateOutput();
}

function reflectVertical() {
    // Reflect the custom character vertically
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 5; j++) {
            // Swap elements in the column
            [customchar[i][j], customchar[7 - i][j]] = [customchar[7 - i][j], customchar[i][j]];

            // Update pixel states
            updatePixel(i, j);
            updatePixel(7 - i, j);
        }
    }
    generateOutput();
}

function updatePixel(row, column) {
    const pixel = $(`#pixel-${row}-${column}`);
    pixel.toggleClass('on', customchar[row][column] === 1);
    pixel.toggleClass('off', customchar[row][column] === 0);
}

function generateOutput() {
    // Generate the output code for Arduino
    let output = 'byte customChar[8] = {\n';
    customchar.forEach((row, i) => {
        output += `\t0b${row.join('')}`;
        output += i < 7 ? ',\n' : '\n';
    });
    output += '\n};';

    $('.output').text(output);

    $('#codeArduino').text(`#include <LiquidCrystal.h>;

// Initialize the library
LiquidCrystal lcd(${$("#RSPin").val()}, ${$("#EnablePin").val()}, ${$("#D4Pin").val()}, ${$("#D5Pin").val()}, ${$("#D6Pin").val()}, ${$("#D7Pin").val()});

${output}

void setup() {
    lcd.createChar(0, customChar);
    lcd.begin(16, 2);
    lcd.write((uint8_t)0);
}

void loop() {}`);
}

function copy(id, element) {
    const copyText = document.getElementById(id);
    copyText.select();
    document.execCommand('copy');
    window.getSelection().removeAllRanges();

    $(element).text('COPIED!').removeClass('badge-primary').addClass('badge-success');
    setTimeout(() => {
        $(element).text('COPY').removeClass('badge-success').addClass('badge-primary');
    }, 1500);
}

// Save current pixel grid as a frame
function saveFrame() {
    const pixelGrid = document.getElementById('pixel-grid');
    const savedFramesContainer = document.getElementById('savedFrames');

    // Get the size of the grid
    const gridWidth = 5; // Number of columns
    const gridHeight = 8; // Number of rows

    // Create a canvas for the saved frame with same aspect ratio as the original grid
    const savedCanvas = document.createElement('canvas');
    const pixelSize = 10; // The size of each pixel in the grid
    savedCanvas.width = gridWidth * pixelSize; // Width of canvas based on the grid
    savedCanvas.height = gridHeight * pixelSize; // Height of canvas based on the grid
    const ctx = savedCanvas.getContext('2d');

    // Copy the current pixel grid to the saved canvas
    const pixels = pixelGrid.getElementsByClassName('pixel');
    for (let i = 0; i < pixels.length; i++) {
        const pixel = pixels[i];
        const x = (i % gridWidth) * pixelSize; // Calculate x position based on grid
        const y = Math.floor(i / gridWidth) * pixelSize; // Calculate y position based on grid
        ctx.fillStyle = pixel.classList.contains('off') ? '#5EFB6E' : '#000'; // Color based on pixel state
        ctx.fillRect(x, y, pixelSize, pixelSize); // Draw the pixel
    }

    // Create a mini thumbnail and add it to the saved frames
    const frameThumbnail = document.createElement('div');
    frameThumbnail.classList.add('saved-frame');
    const img = document.createElement('img');
    img.src = savedCanvas.toDataURL(); // Convert canvas to image data
    frameThumbnail.appendChild(img);

    // Add the saved frame thumbnail to the UI
    savedFramesContainer.appendChild(frameThumbnail);

    // Make the saved frame clickable to load it
    frameThumbnail.addEventListener('click', function () {
        loadFrame(savedCanvas);
    });
}

// Load the saved frame back into the pixel grid
function loadFrame(savedCanvas) {
    const pixels = document.getElementById('pixel-grid').getElementsByClassName('pixel');
    const ctx = savedCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, savedCanvas.width, savedCanvas.height);

    let pixelIndex = 0;
    for (let y = 0; y < savedCanvas.height; y += 10) {
        for (let x = 0; x < savedCanvas.width; x += 10) {
            const index = (y * savedCanvas.width + x) * 4; // RGBA
            const r = imageData.data[index];     // Red component
            const g = imageData.data[index + 1]; // Green component
            const b = imageData.data[index + 2]; // Blue component

            // Determine if the pixel is black (on) or white (off)
            const isOn = (r === 0 && g === 0 && b === 0); // Pixel is black (on)

            if (isOn) {
                // If pixel is on (black), make it gray
                pixels[pixelIndex].classList.remove('off');
                pixels[pixelIndex].classList.add('on'); // Add 'on' class for active (on) pixel
            } else {
                // If pixel is off (white), make it green
                pixels[pixelIndex].classList.add('off');
                pixels[pixelIndex].classList.remove('on'); // Add 'off' class for inactive (off) pixel
            }

            pixelIndex++;
        }
    }
}





// Add event listener to save frame button
document.getElementById('save-frame').addEventListener('click', saveFrame);

$(document).ready(function () {
    clear();
    generateOutput();

    // Disable text selection on pixel area
    $('#pixels').mousedown(() => false);

    // Button event listeners
    $('#clear').click(() => { clear(); generateOutput(); });
    $('#invert').click(() => { invert(); generateOutput(); });
    $('#reflectHorizontal').click(() => { reflectHorizontal(); });
    $('#reflectVertical').click(() => { reflectVertical(); });

    // Toggle pixel on click
    $(".pixel").click(function () {
        togglePixel($(this));
        generateOutput();
    });

    // Navbar click handlers
    $('#customCharacterLink').click(function (event) {
        event.preventDefault(); // Prevent page scrolling
        $('#tab-pixel').addClass('show active');
        $('#tab-code').removeClass('show active');
        $('#customCharacterLink').addClass('active');
        $('#arduinoCodeLink').removeClass('active');
    });

    $('#arduinoCodeLink').click(function (event) {
        event.preventDefault(); // Prevent page scrolling
        $('#tab-code').addClass('show active');
        $('#tab-pixel').removeClass('show active');
        $('#arduinoCodeLink').addClass('active');
        $('#customCharacterLink').removeClass('active');
    });

    // Handle pin changes
    $(".pinChange").on("change", generateOutput);
});
