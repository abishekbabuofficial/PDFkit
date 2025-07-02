const INCH_IN_PX = 96;

const PAGE_MARGINS = {
    lg: {
        top: 0.5 * INCH_IN_PX,
        bottom: 0.5 * INCH_IN_PX,
        left: 0.5 * INCH_IN_PX,
        right: 0.5 * INCH_IN_PX,
    },
    md: {
        top: 0.3 * INCH_IN_PX,
        bottom: 0.3 * INCH_IN_PX,
        left: 0.3 * INCH_IN_PX,
        right: 0.3 * INCH_IN_PX,
    },
    sm: {
        top: 0.15 * INCH_IN_PX,
        bottom: 0.15 * INCH_IN_PX,
        left: 0.15 * INCH_IN_PX,
        right: 0.15 * INCH_IN_PX,
    },
}

const pageMarginParser = (margin) => {
    let m = margin;
    if (typeof margin === 'string') {
        // parse lg, md and sm spacing
        switch (margin) {
            case 'lg':
                m = PAGE_MARGINS.lg;
                break;
            case 'sm':
                m = PAGE_MARGINS.sm;
                break;
            default:
                m = PAGE_MARGINS.md;
                break;
        }
    }
    return m;

};


const calculateScaleFactor = (
    doc,
    tableConfig,
    baseConfig,
) => {
    // to calculate scale factor
    let totalColumnWidth = 0;
    const pageMargin = parseSpacing(baseConfig.margin, 0);
    const head = tableConfig.head[tableConfig.head.length - 1];
    if (Array.isArray(head)) {
        head.forEach((cell) => {
            const { cellWidth } = cell.styles;
            if (typeof cellWidth === 'number') {
                totalColumnWidth += cellWidth;
            } else if (typeof cell.width === 'number') {
                //comments column
                totalColumnWidth += cell.width;
            }
        });
    }
    const pageWidth = Math.floor(
        doc.pageSize().width - (pageMargin.left + pageMargin.right),
    );
    let scaleFactor = 1;
    if (pageWidth < totalColumnWidth) {
        const sf = pageWidth / totalColumnWidth;
        scaleFactor = sf;
        if (scaleFactor > 1) {
            scaleFactor = 1;
        }
    }
    return scaleFactor;
};

const applySFMainConfig = (doc, mainConfig) => {
    let scaleFactor = [1];
    if (mainConfig.tableConfig) {
        scaleFactor = mainConfig.tableConfig.map((table) => {
            if (table.resizeToFitColumns) {
                return calculateScaleFactor(doc, table, mainConfig.baseConfig);
            } else {
                return table.scaleFactor;
            }
        });
    }

    if (mainConfig.tableConfig) {
        applySFTableConfig(
            mainConfig.tableConfig,
            mainConfig.baseConfig,
            scaleFactor,
        );
    }

    mainConfig.baseConfig = applySFBaseConfig(
        mainConfig.baseConfig,
        scaleFactor[0],
    );

    return mainConfig;
};

module.exports = {
    pageMarginParser,
    calculateScaleFactor,
    applySFMainConfig,
}