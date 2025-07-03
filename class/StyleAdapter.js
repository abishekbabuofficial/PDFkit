class StyleAdapter {
  constructor(doc) {
    this.doc = doc;
  }

  pxToPt(px, dpi = 96) {
    return (px * 72) / dpi;
  }

  drawCellBorders(x, y, width, height, cellStyle) {
    const doc = this.doc;
    const lineSides = cellStyle.lineSide || [];
    const lineWidths = cellStyle.lineWidth || [];
    const lineColors = cellStyle.lineColors || [];
    const lineStyles = cellStyle.lineStyle || [];
    const lineTypes = cellStyle.lineType || [];

    lineSides.forEach((side, index) => {
      const lineWidth = lineWidths[index] * 1.2 || 0.5;
      const lineColor = lineColors[index] || "#000000";
      const lineStyle = lineStyles[index] || "solid";
      const lineType = lineTypes[index] || "single";

      doc.lineWidth(lineWidth);
      doc.strokeColor(lineColor.startsWith("#") ? lineColor : `#${lineColor}`);

      if (lineStyle === "dashed") {
        doc.dash(5, { space: 3 });
      } else if (lineStyle === "dotted") {
        doc.dash(1, { space: 2 });
      } else {
        doc.undash();
      }

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

    doc.undash();
  }

  drawCell(x, y, width, height, cell, cellStyle, options = {}) {
    const doc = this.doc;
    const {
      backgroundColor = null,
    } = options;

    // Background
    const fillColor = cellStyle.fillColor || backgroundColor;
    if (fillColor) {
      const color = fillColor.startsWith("#") ? fillColor : `#${fillColor}`;
      doc.rect(x, y, width, height).fill(color);
    }

    // Borders
    this.drawCellBorders(x, y, width, height, cellStyle);

     // // Set alignment and positioning
      const align = cellStyle.halign || aligns[colIndex] || "left";
      const valign = cellStyle.valign || "middle";
      const padding = cellStyle.cellPadding || {
        left: 5,
        top: 5,
        right: 5,
        bottom: 5,
      };

    // Text
    const textColor = cellStyle.textColor || "000000";
    doc.fillColor(textColor.startsWith("#") ? textColor : `#${textColor}`);
    const fontSize = cellStyle.fontSize || 10;
    doc.fontSize(fontSize);

    const fontFamily = "Times";
    const fontStyle = cellStyle.fontStyle || "normal";
    const font =
      fontStyle === "bold" ? `${fontFamily}-Bold` : `${fontFamily}-Roman`;
    doc.font(font);

    const textOptions = {
      width: width - (padding.left || 5) - (padding.right || 5),
      align,
      lineBreak: cellStyle.overflow === "linebreak" || false,
    };

    let textY = y + (padding.top || 5);
    if (valign === "middle") {
      const textHeight = doc.heightOfString(cell || "", textOptions);
      textY = y + (height - textHeight) / 2;
    } else if (valign === "bottom") {
      textY = y + height - (padding.bottom || 5) - (fontSize || 10);
    }

    doc.text(cell || "", x + (padding.left || 5), textY, textOptions);
  }
}

module.exports = StyleAdapter;
