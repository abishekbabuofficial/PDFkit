class PageSetManager {
  constructor() {
    this.pageSets = new Map(); 
    this.currentPageSetId = 0;
    this.activePageSetId = null;
  }

  createPageSet(columnGroups, doc, topY, headerDrawFunction) {
    const pageSetId = this.currentPageSetId++;
    const pageSet = new Map();

    for (let i = 0; i < columnGroups.length; i++) {
      // Add page for each column group (skip first page of first set)
      if (!(pageSetId === 0 && i === 0)) {
        doc.addPage();
      }

      // Get page index after adding page
      const { start, count } = doc.bufferedPageRange();
      const pageIndex = start + count - 1;

      // Draw header and get starting Y position
      const currentY = headerDrawFunction(doc, columnGroups[i].columns, topY);

      pageSet.set(i, {
        pageIndex,
        currentY,
        columnGroupIndex: i,
      });
    }

    this.pageSets.set(pageSetId, pageSet);
    this.activePageSetId = pageSetId;

    return pageSetId;
  }

  getActivePageSet() {
    if (this.activePageSetId === null) {
      return null;
    }
    return this.pageSets.get(this.activePageSetId);
  }

  getPageState(columnGroupIndex) {
    const activePageSet = this.getActivePageSet();
    if (!activePageSet) {
      return null;
    }
    return activePageSet.get(columnGroupIndex);
  }

  updatePageState(columnGroupIndex, newY) {
    const pageState = this.getPageState(columnGroupIndex);
    if (pageState) {
      pageState.currentY = newY;
    }
  }

  canFitRow(rowHeight, maxY) {
    const activePageSet = this.getActivePageSet();
    if (!activePageSet) {
      return false;
    }

    // Check if row fits on ALL pages in the current set
    for (const [_, pageState] of activePageSet) {
      if (pageState.currentY + rowHeight > maxY) {
        return false;
      }
    }
    return true;
  }

  cleanup(keepLastN = 2) {
    const pageSetIds = Array.from(this.pageSets.keys()).sort((a, b) => b - a);

    // Keep only the last N page sets
    for (let i = keepLastN; i < pageSetIds.length; i++) {
      this.pageSets.delete(pageSetIds[i]);
    }
  }


  clear() {
    this.pageSets.clear();
    this.activePageSetId = null;
    this.currentPageSetId = 0;
  }
}

module.exports = PageSetManager;
