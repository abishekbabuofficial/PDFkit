const PDFDocument = require("pdfkit");
const fs = require("fs");
const PageSetManager = require("./PageSetManager");
const { pageMarginParser } = require("./ScaleFactor");
const StyleAdapter = require('./StyleAdapter');
const { applySFMainConfig } = require("./scaleFactorHandler.ts");

class PDFGenerator {
  constructor(config, options = {}) {
    this.config = this.setConfig(config) || config;
    this.options = {
      outputPath: options.outputPath || "generatedpdfkit.pdf",
      layout: config.pageConfig.orientation === "p" ? "portrait" : "landscape",
      pageSize: config.pageConfig.format.toUpperCase() || "A4",
      ...options,
    };

    // Initialize document
    this.doc = new PDFDocument({
      margins: pageMarginParser(this.config.baseConfig.margin),
      size: this.options.pageSize,
      layout: this.options.layout,
      bufferPages: true,
    });
    console.log(this.doc.page.margins)

    // Setup output stream
    this.doc.pipe(fs.createWriteStream(this.options.outputPath));

    // apply scale factor
    this.config = applySFMainConfig(
      this.doc,
      this.config,
    );

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
    this.rows = this.tableConfig.body;
    this.columnWidths = this.getColumnWidths(this.tableConfig.head[0]);
    this.columnAligns = this.getColumnAligns(this.tableConfig.head[0]);

    // Calculate column groups for pagination
    this.columnGroups = this.calculateColumnGroups();

    // Initialize PageSetManager
    this.pageSetManager = new PageSetManager();
    this.StyleAdapter = new StyleAdapter(this.doc)
  }

  returnConfig(){
    return this.config
  }


  setConfig(config) {
        if (config.baseConfig && config.baseConfig.margin) {
            config.baseConfig.margin = pageMarginParser(
                config.baseConfig.margin,
            );
        }

        return config;
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
    return headerRow.map((item) => (item.width || item.styles?.cellWidth)+item.styles?.cellPadding.left+item.styles?.cellPadding.right);
  }

  getColumnAligns(headerRow) {
    return headerRow.map((item) => item.styles?.halign || "left");
  }

  getCellHeight(row) {
    let maxHeight = 50;
    row.forEach((cell) => {
      const textHeight = cell.styles?.fontSize;
      const verticalPadding = cell.styles?.cellPadding.top + cell.styles?.cellPadding.bottom;
      const cellHeight = cell.styles?.minCellHeight + verticalPadding;
      maxHeight = Math.min(maxHeight, cellHeight);
    });
    return maxHeight;
  }

  getHeaders(headerRow) {
    const headers = [];
    headerRow.map((item) => headers.push(item.content));
    return headers;
  }

  getRows(data) {
    if(!data){
        return []
    }
    let rows = [];
    // data.forEach((item) => {
      const rowData = [];
      const rowStyles = [];
      let maxRowHeight = this.getCellHeight(data)

      data.forEach((element) => {
        rowData.push(element.content);
        const cellStyle = element.styles || {};
        rowStyles.push(cellStyle);
      });

      rows = {
        data: rowData,
        styles: rowStyles,
        height: maxRowHeight,
      };
    // });
    return rows;
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

      this.StyleAdapter.drawCell(x, startY, width, rowHeight, cell || "" ,cellStyle,{
        isHeader,
        backgroundColor,
        aligns
      })

      x += width;
    });

    // console.log("drawn row", this.count++);
    return startY + rowHeight;
  }

  drawHeaderForColumns(doc, columnIndices, y) {
    const headerStyles = this.tableConfig.head[0].map(
      (item) => item.styles || {}
    );
    const headerHeight = this.getCellHeight(this.tableConfig.head[0]);

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


  async *rowStreamGenerator() {
    for (const row of this.rows) {
      const rown = this.getRows(row)
      yield rown;
    }
  }

  async generateStreamingTable(rowStream) {
    return new Promise(async (resolve, reject) => {
      try {
        const topY = this.doc.page.margins.top;
        const maxY = this.pageHeight;
        const totalGroups = this.columnGroups.length;

        // Create header drawing function for PageSetManager
        const headerDrawFunction = (doc, columns, y) => {
          return this.drawHeaderForColumns(doc, columns, y);
        };
        
        // Initialize first page set
        this.pageSetManager.createPageSet(
          this.columnGroups,
          this.doc,
          topY,
          headerDrawFunction
        );
        
        const range = this.doc.bufferedPageRange();
        
        console.log("Pages in buffer:", range);
        // Row streaming
        for await (const row of rowStream) {
          const rowHeight = row.height;
          // Check if the row fits in current page set
          if (!this.pageSetManager.canFitRow(rowHeight, maxY)) {
            // Clean up old page sets to save memory, keeps only prev and current pageset
            this.pageSetManager.cleanup(1);

            // Create new page set when row not fits in current page set
            this.pageSetManager.createPageSet(
              this.columnGroups,
              this.doc,
              topY,
              headerDrawFunction
            );
          }

          // Draw this row across all column group pages
          for (let i = 0; i < totalGroups; i++) {
            const columnGroup = this.columnGroups[i];
            const pageState = this.pageSetManager.getPageState(i);

            if (!pageState) {
              throw new Error(`Page state not found for column group ${i}`);
            }

            // Switch to the correct page
            this.doc.switchToPage(pageState.pageIndex);
            // console.log("Switching to page:", pageState.pageIndex,"And added page");

            const newY = this.drawRowForColumns(
              this.doc,
              row.data,
              this.columnWidths,
              columnGroup.columns,
              this.startX,
              pageState.currentY,
              row.height,
              {
                aligns: this.columnAligns,
                cellStyles: row.styles,
              }
            );

            // Update page state
            this.pageSetManager.updatePageState(i, newY);
          }
        }

        console.log("Final buffer range:", this.doc.bufferedPageRange());

        console.log(this.pageSetManager.pageSets)

        this.pageSetManager.clear();

        this.doc.end();

        this.doc.on("end", () => resolve(this.options.outputPath));
        this.doc.on("error", reject);
      } catch (err) {
        reject(err);
      }
    });
  }






  // Old Buffering of Rows
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
            currentPageHeight + row.height + headerHeight <=
            this.pageHeight - this.doc.page.margins.top
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

        console.log(currentPageRows.length);

        // End and resolve
        this.doc.end();
        this.doc.on("end", () => resolve(this.options.outputPath));
        this.doc.on("error", reject);
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
