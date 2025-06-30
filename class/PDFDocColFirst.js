const PDFDocument = require("pdfkit");
const fs = require("fs");

class PDFGenerator {
  constructor(config, options = {}) {
    this.config = config;
    this.options = {
      outputPath: options.outputPath || "generatedpdfkit.pdf",
      layout: config.pageConfig.orientation === "p" ? "portrait" : "landscape",
      pageSize: config.pageConfig.format.toUpperCase() || "A4",
      ...options,
    };

    // Initialize document
    this.doc = new PDFDocument({
      margins: this.config.baseConfig.margin,
      size: this.options.pageSize,
      layout: this.options.layout,
    });

    // Setup output stream
    this.doc.pipe(fs.createWriteStream(this.options.outputPath));

    // Initialize properties
    this.startX = this.doc.page.margins.left;
    this.pageHeight = this.doc.page.height - this.doc.page.margins.bottom;
    this.pageWidth =
      this.doc.page.width -
      this.doc.page.margins.left -
      this.doc.page.margins.right;
    this.count = 0;
    this.tableConfig = this.config.tableConfig[0];

    // Initialize table data
    this.headers = this.getHeaders(this.tableConfig.head[0]);
    this.rows = this.getRows(this.tableConfig.body);
    this.columnWidths = this.getColumnWidths(this.tableConfig.head[0]);
    this.columnAligns = this.getColumnAligns(this.tableConfig.head[0]);

    // Calculate column groups for pagination
    this.columnGroups = this.calculateColumnGroups();
  }


  
  calculateColumnGroups() {
    const groups = [];
    const firstColumnWidth = this.columnWidths[0];

    // If there's only one column or all columns fit in one page
    if (this.columnWidths.length <= 1) {
      return [
        {
          startIndex: 0,
          endIndex: this.columnWidths.length - 1,
          columns: Array.from(
            { length: this.columnWidths.length },
            (_, i) => i
          ),
          totalWidth: this.columnWidths.reduce((sum, width) => sum + width, 0),
        },
      ];
    }

    // Check if all columns fit in one page
    const totalWidth = this.columnWidths.reduce((sum, width) => sum + width, 0);
    if (totalWidth <= this.pageWidth) {
      return [
        {
          startIndex: 0,
          endIndex: this.columnWidths.length - 1,
          columns: Array.from(
            { length: this.columnWidths.length },
            (_, i) => i
          ),
          totalWidth: totalWidth,
        },
      ];
    }

    // First group: start from column 0
    let currentGroup = {
      startIndex: 0,
      endIndex: 0,
      columns: [0],
      totalWidth: firstColumnWidth,
    };

    // Add columns to first group
    for (let i = 1; i < this.columnWidths.length; i++) {
      const columnWidth = this.columnWidths[i];

      if (currentGroup.totalWidth + columnWidth <= this.pageWidth) {
        currentGroup.columns.push(i);
        currentGroup.totalWidth += columnWidth;
        currentGroup.endIndex = i;
      } else {
        // Column doesn't fit in this page, create a new
        groups.push({ ...currentGroup });

        // Start new group with first column (row labels) + current column
        currentGroup = {
          startIndex: 0, // to add the label column
          endIndex: i,
          columns: [0, i],
          totalWidth: firstColumnWidth + columnWidth,
        };
      }
    }

    // Add the last group if it has columns beyond just the first column
    if (currentGroup.columns.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  
  getColumnWidths(headerRow) {
    return headerRow.map((item) => item.width || item.styles?.cellWidth || 120);
  }

  getColumnAligns(headerRow) {
    return headerRow.map((item) => item.styles?.halign || "left");
  }

  getHeaderHeight(headerRow) {
    let maxHeight = 50;
    headerRow.forEach((item) => {
      const cellHeight = item.styles?.minCellHeight || 30;
      maxHeight = Math.max(maxHeight, cellHeight);
    });
    return maxHeight;
  }

  getHeaders(headerRow) {
    const headers = [];
    headerRow.map((item) => headers.push(item.content));
    return headers;
  }

  getRows(data) {
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
        height: maxRowHeight,
      });
    });
    return rows;
  }

  drawCellBorders(doc, x, y, width, height, cellStyle) {
    const lineSides = cellStyle.lineSide || [];
    const lineWidths = cellStyle.lineWidth || [];
    const lineColors = cellStyle.lineColors || [];
    const lineStyles = cellStyle.lineStyle || [];
    const lineTypes = cellStyle.lineType || [];

    lineSides.forEach((side, index) => {
      const lineWidth = lineWidths[index] || 0.5;
      const lineColor = lineColors[index] || "#000000";
      const lineStyle = lineStyles[index] || "solid";
      const lineType = lineTypes[index] || "single";

      // Set line properties
      doc.lineWidth(lineWidth);
      doc.strokeColor(lineColor.startsWith("#") ? lineColor : `#${lineColor}`);

      // Set line style (solid, dashed, dotted)
      if (lineStyle === "dashed") {
        doc.dash(5, { space: 3 });
      } else if (lineStyle === "dotted") {
        doc.dash(1, { space: 2 });
      } else {
        doc.undash(); // solid line
      }

      // Draw the border line based on side
      switch (side) {
        case "top":
          doc
            .moveTo(x, y)
            .lineTo(x + width, y)
            .stroke();
          break;
        case "bottom":
          doc
            .moveTo(x, y + height)
            .lineTo(x + width, y + height)
            .stroke();
          break;
        case "left":
          doc
            .moveTo(x, y)
            .lineTo(x, y + height)
            .stroke();
          break;
        case "right":
          doc
            .moveTo(x + width, y)
            .lineTo(x + width, y + height)
            .stroke();
          break;
      }

      // Draw double lines if specified
      if (lineType === "double") {
        const spacing = cellStyle.doubleLineSpacing || 2;
        switch (side) {
          case "top":
            doc
              .moveTo(x, y - spacing)
              .lineTo(x + width, y - spacing)
              .stroke();
            break;
          case "bottom":
            doc
              .moveTo(x, y + height + spacing)
              .lineTo(x + width, y + height + spacing)
              .stroke();
            break;
          case "left":
            doc
              .moveTo(x - spacing, y)
              .lineTo(x - spacing, y + height)
              .stroke();
            break;
          case "right":
            doc
              .moveTo(x + width + spacing, y)
              .lineTo(x + width + spacing, y + height)
              .stroke();
            break;
        }
      }
    });

    // Reset to solid line for next operations
    doc.undash();
  }

  drawRowForColumns(
    doc,
    rowData,
    colWidths,
    columnIndices,
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

    columnIndices.forEach((colIndex) => {
      const cell = rowData[colIndex];
      const width = colWidths[colIndex];
      const cellStyle = cellStyles[colIndex] || {};

      // Apply background color
      const fillColor = cellStyle.fillColor || backgroundColor;
      if (fillColor) {
        const color = fillColor.startsWith("#") ? fillColor : `#${fillColor}`;
        doc.rect(x, startY, width, rowHeight).fill(color);
      }

      // Draw cell borders
      this.drawCellBorders(doc, x, startY, width, rowHeight, cellStyle);

      // Set text properties
      const textColor = cellStyle.textColor || "000000";
      doc.fillColor(textColor.startsWith("#") ? textColor : `#${textColor}`);

      const fontSize = cellStyle.fontSize || 10;
      doc.fontSize(fontSize);

      const fontFamily = "Helvetica";
      const fontStyle = cellStyle.fontStyle || "normal";
      const font = fontStyle === "bold" ? `${fontFamily}-Bold` : fontFamily;
      doc.font(font);

      // Set alignment and positioning
      const align = cellStyle.halign || aligns[colIndex] || "left";
      const valign = cellStyle.valign || "middle";
      const padding = cellStyle.cellPadding || {
        left: 5,
        top: 5,
        right: 5,
        bottom: 5,
      };

      // Set text options
      const textOptions = {
        width: width - (padding.left || 5) - (padding.right || 5),
        align,
        lineBreak: cellStyle.overflow === "linebreak" || false,
      };

      // Calculate vertical position based on valign
      let textY = startY + (padding.top || 5);
      if (valign === "middle") {
        const textHeight = doc.heightOfString(cell || "", textOptions);
        textY = startY + (rowHeight - textHeight) / 2;
      } else if (valign === "bottom") {
        textY = startY + rowHeight - (padding.bottom || 5) - (fontSize || 10);
      }

      // Draw text
      doc.text(cell || "", x + (padding.left || 5), textY, textOptions);

      x += width;
    });

    // console.log("drawn row", this.count++);
    return startY + rowHeight;
  }

  drawHeaderForColumns(doc, columnIndices, y) {
    const headerStyles = this.tableConfig.head[0].map(
      (item) => item.styles || {}
    );
    const headerHeight = this.getHeaderHeight(this.tableConfig.head[0]);

    const nextY = this.drawRowForColumns(
      doc,
      this.headers,
      this.columnWidths,
      columnIndices,
      this.startX,
      y,
      headerHeight,
      {
        isHeader: true,
        aligns: this.columnAligns,
        cellStyles: headerStyles,
      }
    );
    return nextY;
  }

  calculateFittingRows(currentY, remainingRows) {
    let totalHeight = 0;
    let fittingRowsCount = 0;

    for (let i = 0; i < remainingRows.length; i++) {
      const rowHeight = remainingRows[i].height;
      if (currentY + totalHeight + rowHeight <= this.pageHeight) {
        totalHeight += rowHeight;
        fittingRowsCount++;
      } else {
        break;
      }
    }

    return { fittingRowsCount, totalHeight };
  }

  async drawStreamingRow(row) {
  const headerHeight = this.getHeaderHeight(this.tableConfig.head[0]);
  const rowHeight = row.cellHeight;
  const bottomY = this.pageHeight;

  // Check: does the next row fit?
  if (this.doc.y + rowHeight > bottomY) {
    this.doc.addPage();
    this.doc.y = this.doc.page.margins.top;

    // Redraw header for each column group on new page
    for (let i = 0; i < this.columnGroups.length; i++) {
      const columnGroup = this.columnGroups[i];

      // Draw header
      const currentY = this.drawHeaderForColumns(this.doc, columnGroup.columns, this.doc.y);

      // Advance Y after header
      this.doc.y = currentY;
    }
  }

  // Draw row across all column groups
  for (let i = 0; i < this.columnGroups.length; i++) {
    const columnGroup = this.columnGroups[i];

    if (i > 0) {
      this.doc.addPage();
      this.doc.y = this.doc.page.margins.top;
      const currentY = this.drawHeaderForColumns(this.doc, columnGroup.columns, this.doc.y);
      this.doc.y = currentY;
    }

    // Draw actual row
    const nextY = this.drawRowForColumns(
      this.doc,
      row.data,
      this.columnWidths,
      columnGroup.columns,
      this.startX,
      this.doc.y,
      rowHeight,
      {
        aligns: this.columnAligns,
        cellStyles: row.styles,
      }
    );

    // Save the next Y position for continuity
    this.doc.y = nextY;
  }
}

async *rowStreamGenerator() {
  for (const row of this.rows) {
    yield row;
  }
}


async generateBufferTable(rowStream) {
  return new Promise(async (resolve, reject) => {
    try {
      let currentPageRows = [];
      let currentPageHeight = 0;
      const headerHeight = this.getHeaderHeight(this.tableConfig.head[0]);
      let isFirstPage = true;
      const show = rowStream;


      for await (const row of rowStream) {
        // Check if this row fits in the current page buffer
        const show = rowStream;
        if (
          currentPageHeight + row.height + headerHeight <= this.pageHeight - this.doc.page.margins.top
        ) {
          currentPageRows.push(row);
          currentPageHeight += row.height;
        } else {
          // Flush rows for this page
          this.processPageRows(currentPageRows, isFirstPage);
          isFirstPage = false;

          // Start buffer with current row
          currentPageRows = [row];
          currentPageHeight = row.height;
        }
      }

      // Flush remaining rows
      if (currentPageRows.length > 0) {
        this.processPageRows(currentPageRows, isFirstPage);
      }

      console.log(currentPageRows.length)

      // End and resolve
      this.doc.end();
      this.doc.on("end", () => resolve(this.options.outputPath));
      this.doc.on("error", reject);

    } catch (error) {
      reject(error);
    }
  });
}




  async generateRowByRowWithHeightCheck() {
    return new Promise((resolve, reject) => {
      try {
        let currentPageRows = [];
        let isFirstPage = true;

        const headerHeight = this.getHeaderHeight(this.tableConfig.head[0]);

        for (let rowIndex = 0; rowIndex < this.rows.length; rowIndex++) {
          const row = this.rows[rowIndex];

          // Check if adding this row would exceed page height
          if (
            currentPageHeight + headerHeight + row.height >
              this.pageHeight - this.doc.page.margins.top &&
            currentPageRows.length > 0
          ) {
            // Process current page rows across column groups
            this.processPageRows(currentPageRows, isFirstPage);
            isFirstPage = false;

            // Start new page group
            currentPageRows = [row];
            currentPageHeight = row.height;
          } else {
            currentPageRows.push(row);
            currentPageHeight += row.height;
          }
        }

        // Process remaining rows
        if (currentPageRows.length > 0) {
          this.processPageRows(currentPageRows, isFirstPage);
        }

        // Finalize the document
        this.doc.end();

        this.doc.on("end", () => {
          console.log(`\nPDF generated: ${this.options.outputPath}`);
          resolve(this.options.outputPath);
        });

        this.doc.on("error", (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  processPageRows(pageRows, isFirstPage) {
    // Process each column group for the rows that fit on this page
    for (
      let groupIndex = 0;
      groupIndex < this.columnGroups.length;
      groupIndex++
    ) {
      const columnGroup = this.columnGroups[groupIndex];

      // Add new page for each column group (except the very first)
      if (!isFirstPage || groupIndex > 0) {
        this.doc.addPage();
      }

      let currentY = this.doc.page.margins.top;

      // Draw header for this column group
      currentY = this.drawHeaderForColumns(
        this.doc,
        columnGroup.columns,
        currentY
      );

      // Draw all rows that fit on this page for this column group
      for (let i = 0; i < pageRows.length; i++) {
        const row = pageRows[i];
        currentY = this.drawRowForColumns(
          this.doc,
          row.data,
          this.columnWidths,
          columnGroup.columns,
          this.startX,
          currentY,
          row.height,
          {
            aligns: this.columnAligns,
            cellStyles: row.styles,
          }
        );
      }
    }
  }
}

module.exports = PDFGenerator;
