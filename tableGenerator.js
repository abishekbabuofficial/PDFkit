const PDFDocument = require("pdfkit");
const fs = require("fs");

// This is the config obtained after the margin application and SF done in previous PDFDocument.ts flow
const config = require("./new.json");

// setting up basic page configuration from config file with some modification needed for pdfkit
const doc = new PDFDocument({ margins: config.baseConfig.margin,
  layout: config.pageConfig.orientation === "p" ? "portrait" : "landscape",
  size: config.pageConfig.format.toUpperCase()});

// Create the document into a writable stream
doc.pipe(fs.createWriteStream("generatedpdfki.pdf"));

const startX = doc.page.margins.left;
const pageHeight = doc.page.height - doc.page.margins.bottom;
let count = 0;
const tableConfig = config.tableConfig[0];


// It gets column width from the headers
const getColumnWidths = (headerRow) => {
  return headerRow.map((item) => (item.width)*1.25 || item.styles?.cellWidth || 120);
};

// It aligns columns horizontally
const getColumnAligns = (headerRow) => {
  return headerRow.map((item) => item.styles?.halign || "left");
};

// set header height for header row
const getHeaderHeight = (headerRow) => {
  let maxHeight = 30;
  headerRow.forEach((item) => {
    const cellHeight = item.styles?.minCellHeight || 30;
    maxHeight = Math.max(maxHeight, cellHeight);
  });
  return maxHeight;
};


// Headers and Rows are obtained separately
// Headers will only return the content of the cells.
const getHeaders = (headerRow) => {
  const headers = [];
  headerRow.map((item) => headers.push(item.content));
  return headers;
};

// It returns an array of objects containing both the content and styles of each cell in a row.
const getRows = (data) => {
  let rows = [];
  data.forEach((item) => {
    const rowData = [];
    const rowStyles = [];
    let maxRowHeight = 30; 
    
    item.forEach((element) => {
      rowData.push(element.content);
      const cellStyle = element.styles || {};
      rowStyles.push(cellStyle);
      
      // Calculate the maximum height needed for this row
      const cellHeight = cellStyle.minCellHeight || 30;
      maxRowHeight = Math.max(maxRowHeight, cellHeight);
    });
    
    rows.push({ 
      data: rowData, 
      styles: rowStyles, 
      height: maxRowHeight 
    });
  });
  return rows;
};

// Helper function to draw borders for each cell's each side
function drawCellBorders(doc, x, y, width, height, cellStyle) {
  const lineSides = cellStyle.lineSide || [];
  const lineWidths = cellStyle.lineWidth || [];
  const lineColors = cellStyle.lineColors || [];
  const lineStyles = cellStyle.lineStyle || [];
  const lineTypes = cellStyle.lineType || [];
  
  lineSides.forEach((side, index) => {
    const lineWidth = lineWidths[index];
    const lineColor = lineColors[index];
    const lineStyle = lineStyles[index] || 'solid';
    const lineType = lineTypes[index] || 'single';
    
    // Set line properties
    doc.lineWidth(lineWidth);
    doc.strokeColor(lineColor.startsWith('#') ? lineColor : `#${lineColor}`);
    
    // Set line style (solid, dashed, dotted)
    if (lineStyle === 'dashed') {
      doc.dash(5, { space: 3 });
    } else if (lineStyle === 'dotted') {
      doc.dash(1, { space: 2 });
    } else {
      doc.undash(); 
    }
    
    // Draw the border line based on side for single line
    switch (side) {
      case 'top':
        doc.moveTo(x, y).lineTo(x + width, y).stroke();
        break;
      case 'bottom':
        doc.moveTo(x, y + height).lineTo(x + width, y + height).stroke();
        break;
      case 'left':
        doc.moveTo(x, y).lineTo(x, y + height).stroke();
        break;
      case 'right':
        doc.moveTo(x + width, y).lineTo(x + width, y + height).stroke();
        break;
    }
    
    if (lineType === 'double') {
      const spacing = cellStyle.doubleLineSpacing || 2;
      switch (side) {
        case 'top':
          doc.moveTo(x, y - spacing).lineTo(x + width, y - spacing).stroke();
          break;
        case 'bottom':
          doc.moveTo(x, y + height + spacing).lineTo(x + width, y + height + spacing).stroke();
          break;
        case 'left':
          doc.moveTo(x - spacing, y).lineTo(x - spacing, y + height).stroke();
          break;
        case 'right':
          doc.moveTo(x + width + spacing, y).lineTo(x + width + spacing, y + height).stroke();
          break;
      }
    }
  });
  
  doc.undash();
}

// It is the main function that draws single row by lining up all the cells in it. It also sets
// the alignment and other styles of each cell.
function drawRow(
  doc,
  rowData,
  colWidths,
  startX,
  startY,
  rowHeight,
  options = {}
) {
  const {
    isHeader = false,
    backgroundColor = null,
    aligns = [],
    cellStyles = [],
  } = options;
  let x = startX;

  rowData.forEach((cell, i) => {
    const width = colWidths[i];
    const cellStyle = cellStyles[i] || {};
    
    // Draw background color for the entire cell
    const fillColor = cellStyle.fillColor || backgroundColor;
    if (fillColor) {
      const color = fillColor.startsWith("#") ? fillColor : `#${fillColor}`;
      doc.rect(x, startY, width, rowHeight).fill(color);
    }

    // Draw borders around the cell
    drawCellBorders(doc, x, startY, width, rowHeight, cellStyle);

    // Set text color
    const textColor = cellStyle.textColor || "000000";
    doc.fillColor(textColor.startsWith("#") ? textColor : `#${textColor}`);
    
    // Set font size. I didn't consider the units here but need to do them later.
    const fontSize = cellStyle.fontSize || 10;
    doc.fontSize(fontSize);
    
    // Set font family default to the pdfkit default fonts.
    const fontFamily =  "Helvetica";
    const fontStyle = cellStyle.fontStyle || "normal";
    const font = fontStyle === "bold" ? `${fontFamily}-Bold` : fontFamily;
    doc.font(font);
    
    // Set alignment to the cell content
    const align = cellStyle.halign || aligns[i] || "left";
    const valign = cellStyle.valign || "middle";
    const padding = cellStyle.cellPadding;
    
    // Calculate vertical position based on valign
    let textY = startY + (padding.top || 5);
    if (valign === "middle") {
      const textHeight = fontSize || 10;
      textY = startY + (rowHeight - textHeight - (padding.bottom || 5)) / 2;
    } else if (valign === "bottom") {
      textY = startY + rowHeight - (padding.bottom || 5) - (fontSize || 10);
    }

    const textOptions = {
      width: width - (padding.left || 5) - (padding.right || 5),
      align,
      lineBreak: cellStyle.overflow === 'linebreak' || false,
    };

    doc.text(cell, x + (padding.left || 5), textY, textOptions);

    x += width;
  });
  
  console.log("drawn row", count++);
  // sets cursor position after drawing the row
  return startY + rowHeight;
}

// Draws header row with specified styles
function drawHeader(doc, y) {
  const headerStyles = tableConfig.head[0].map((item) => item.styles || {});
  const headerHeight = getHeaderHeight(tableConfig.head[0]);
  
  const nextY = drawRow(doc, headers, columnWidths, startX, y, headerHeight, {
    isHeader: true,
    aligns: columnAligns,
    cellStyles: headerStyles,
  });
  return nextY;
}

// Initialize data
const headers = getHeaders(tableConfig.head[0]);
const rows = getRows(tableConfig.body);
const columnWidths = getColumnWidths(tableConfig.head[0]);
const columnAligns = getColumnAligns(tableConfig.head[0]);


// Start rendering
let currentY = doc.y;
currentY = drawHeader(doc, currentY);

// Stream rows
rows.forEach((row, idx) => {
  if (currentY + row.height > pageHeight) {
    doc.addPage();
    currentY = doc.page.margins.top;
    currentY = drawHeader(doc, currentY);
  }

  currentY = drawRow(doc, row.data, columnWidths, startX, currentY, row.height, {
    aligns: columnAligns,
    cellStyles: row.styles,
  });
});

doc.end();
console.log("PDF generated! ");