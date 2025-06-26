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
    return headerRow.map((item) => (item.width) || (item.styles?.cellWidth) || 120);
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

      // Calculate vertical position based on valign
      let textY = startY + (padding.top || 5);
      if (valign === "middle") {
        const textHeight = fontSize || 10;
        textY = startY + (rowHeight - textHeight) / 2;
      } else if (valign === "bottom") {
        textY = startY + rowHeight - (padding.bottom || 5) - (fontSize || 10);
      }

      // Set text options
      const textOptions = {
        width: width - (padding.left || 5) - (padding.right || 5),
        align,
        lineBreak: cellStyle.overflow === "linebreak" || false,
      };

      // Draw text
      doc.text(cell || "", x + (padding.left || 5), textY, textOptions);

      x += width;
    });

    console.log("drawn row", this.count++);
    return startY + rowHeight;
  }


  drawRow(doc, rowData, colWidths, startX, startY, rowHeight, options = {}) {
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
      const align = cellStyle.halign || aligns[i] || "left";
      const valign = cellStyle.valign || "middle";
      const padding = cellStyle.cellPadding || {
        left: 5,
        top: 5,
        right: 5,
        bottom: 5,
      };

      // Calculate vertical position based on valign
      let textY = startY + (padding.top || 5);
      if (valign === "middle") {
        const textHeight = fontSize || 10;
        textY = startY + (rowHeight - textHeight - (padding.bottom || 5)) / 2;
      } else if (valign === "bottom") {
        textY = startY + rowHeight - (padding.bottom || 5) - (fontSize || 10);
      }

      // Set text options
      const textOptions = {
        width: width - (padding.left || 5) - (padding.right || 5),
        align,
        lineBreak: cellStyle.overflow === "linebreak" || false,
      };

      // Draw text
      doc.text(cell, x + (padding.left || 5), textY, textOptions);

      x += width;
    });

    console.log("drawn row", this.count++);
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

  drawHeader(doc, y) {
    const headerStyles = this.tableConfig.head[0].map(
      (item) => item.styles || {}
    );
    const headerHeight = this.getHeaderHeight(this.tableConfig.head[0]);

    const nextY = this.drawRow(
      doc,
      this.headers,
      this.columnWidths,
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


  async generateTableWithPagination() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Total column groups: ${this.columnGroups.length}`);
        console.log(
          "Column groups:",
          this.columnGroups.map(
            (g) =>
              `Cols ${g.startIndex}-${g.endIndex} (${g.columns.length} cols)`
          )
        );

        // Process each column group
        for (
          let groupIndex = 0;
          groupIndex < this.columnGroups.length;
          groupIndex++
        ) {
          const columnGroup = this.columnGroups[groupIndex];

          // Start new page for each column group (except the first one)
          if (groupIndex > 0) {
            this.doc.addPage();
          }

          let currentY = this.doc.y;
          let remainingRows = [...this.rows];

          // Draw header for this column group
          currentY = this.drawHeaderForColumns(
            this.doc,
            columnGroup.columns,
            currentY
          );

          // Process rows with pagination
          while (remainingRows.length > 0) {
            // Calculate how many rows can fit
            const { fittingRowsCount } = this.calculateFittingRows(
              currentY,
              remainingRows
            );

            if (fittingRowsCount === 0) {
              // No rows can fit, start new page
              this.doc.addPage();
              currentY = this.doc.page.margins.top;
              // Redraw header on new page
              currentY = this.drawHeaderForColumns(
                this.doc,
                columnGroup.columns,
                currentY
              );
              continue;
            }

            // Draw the fitting rows
            const rowsToProcess = remainingRows.slice(0, fittingRowsCount);
            for (const row of rowsToProcess) {
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

            // Remove processed rows
            remainingRows = remainingRows.slice(fittingRowsCount);

            // If there are more rows, add a new page
            if (remainingRows.length > 0) {
              this.doc.addPage();
              currentY = this.doc.page.margins.top;
              // Redraw header on new page
              currentY = this.drawHeaderForColumns(
                this.doc,
                columnGroup.columns,
                currentY
              );
            }
          }
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


  async generateTable() {
    return new Promise((resolve, reject) => {
      try {
        // Start rendering
        let currentY = this.doc.y;
        currentY = this.drawHeader(this.doc, currentY);

        // Stream rows
        this.rows.forEach((row, idx) => {
          if (currentY + row.height > this.pageHeight) {
            this.doc.addPage();
            currentY = this.doc.page.margins.top;
            currentY = this.drawHeader(this.doc, currentY);
          }

          currentY = this.drawRow(
            this.doc,
            row.data,
            this.columnWidths,
            this.startX,
            currentY,
            row.height,
            {
              aligns: this.columnAligns,
              cellStyles: row.styles,
            }
          );
        });

        // Finalize the document
        this.doc.end();

        this.doc.on("end", () => {
          console.log(`PDF generated: ${this.options.outputPath}`);
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

}

module.exports = PDFGenerator;
