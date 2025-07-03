

const STYLE_PROPERTIES = [
    'cellWidth',
    'cellPadding',
    'cellMargin',
    'lineWidth',
    'doubleLineSpacing',
    'dashedLineLength',
    'dashedLineSpace',
    'fontSize',
    'minCellHeight',
    'maxCellHeight',
    'minCellWidth',
    'stripeSpacing',
    'shadeProps',
];

const CELL_ANNOTATION_PROPERTIES = ['size', 'fontSize', 'margin'];

function applyScaleFactorOnAnnotationConfig(
    config,
    scaleFactor = 1,
) {
    if (!config) {
        return {};
    }

    config = config.map((annoConfig) => {
        let nc = { ...annoConfig };

        CELL_ANNOTATION_PROPERTIES.map((propName) => {
            let val = nc[propName];

            if (!val) {
                return;
            }

            if (typeof val === 'number') {
                val = val * scaleFactor;
                nc[propName] = val;
                annoConfig = nc;
                return;
            } else if (propName === 'margin') {
                if (typeof val === 'object') {
                    const kys = Object.keys(val);
                    if (kys && kys.length > 0) {
                        kys.map((ky) => {
                            val[ky] = val[ky] * scaleFactor;
                        });
                        nc[propName] = val;
                        annoConfig = nc;
                        return;
                    }
                }
            }
        });

        return nc;
    });

    return config;
}

function applyScaleFactorOnStyle(
    styles,
    scaleFactor = 1,
    exceptions = [],
) {
    if (!styles) {
        return {};
    }

    STYLE_PROPERTIES.map((propName) => {
        // handle cellPadding cellMargin doubleLineSpacing dashedLineLength dashedLineSpace
        let val = styles[propName];
        if (!val || exceptions.includes(propName)) {
            return;
        }

        if (typeof val === 'number') {
            val = val * scaleFactor;
            styles[propName] = val;
            return;
        }

        // convert cellPadding and cellMargin
        if (
            propName === 'cellPadding' ||
            (propName === 'cellMargin' && typeof val !== 'number')
        ) {
            // check and process if value type is number
            if (typeof val === 'object') {
                const kys = Object.keys(val);
                if (kys && kys.length > 0) {
                    kys.map((ky) => {
                        val[ky] = val[ky] * scaleFactor;
                    });
                    styles[propName] = val;
                    return;
                }
            }
        }

        if (
            propName === 'doubleLineSpacing' ||
            propName === 'dashedLineLength' ||
            propName === 'dashedLineSpace' ||
            (propName === 'lineWidth' && typeof val !== 'number')
        ) {
            if (Array.isArray(val) === true) {
                const len = val.length;
                let i = 0;
                while (i < len) {
                    val[i] = val[i] * scaleFactor;
                    i++;
                }
                styles[propName] = val;
                return;
            }
        }

        if (propName === 'shadeProps' && val?.length) {
            val.forEach((valProp) => {
                Object.keys(valProp).forEach((key) => {
                    if (typeof valProp[key] === 'number') {
                        valProp[key] = valProp[key] * scaleFactor;
                    }
                });
            });
        }
    });

    return styles;
}



function applyScaleFactorOnCustomBlockMargins(
    margins,
    scaleFactor,
) {
    margins.bottom *= scaleFactor;
    margins.top *= scaleFactor;
    margins.left *= scaleFactor;
    margins.right *= scaleFactor;
}

function applyGridScale(
    width,
    gridSize,
    availableWidth,
) {
    const widthPercentage = (width * 100) / gridSize;
    return (widthPercentage / 100) * availableWidth;
}

function applyScaleFactorOnCustomBlocks(
    config,
    availableWidth,
    scaleFactor = 1,
    isGridCell = false,
) {
    return config.map((conf) => {
        conf.height *= scaleFactor;
        conf.gridContainerHeight *= scaleFactor;
        const gridWidthScale = applyGridScale(
            conf.width,
            conf.gridSize,
            availableWidth,
        );
        if (!isGridCell) conf.width = gridWidthScale;
        const exceptions = isGridCell ? [] : ['fontSize'];
        applyScaleFactorOnStyle(conf.styles, scaleFactor, exceptions);
        applyScaleFactorOnCustomBlockMargins(conf.margins, scaleFactor);
        if (Array.isArray(conf.content)) {
            conf.content = conf.content.map((block) => {
                if (Array.isArray(block.styles)) {
                    block.styles = block.styles.map(
                        (style) => {
                            // style.fontSize *= scaleFactor;
                            // style.width *= scaleFactor;
                            // style.height *= scaleFactor;
                            if (style.lineMargin) {
                                style.lineMargin *= scaleFactor;
                            }

                            if (conf._type === 'image') {
                                if (style.width && style.height) {
                                    // find bigger diff
                                    style.width *= scaleFactor;
                                    style.height *= scaleFactor;
                                }
                            } else {
                                if (style.width) {
                                    style.width *= scaleFactor;
                                }
                                if (style.height) {
                                    style.height *= scaleFactor;
                                }
                            }
                            return style;
                        },
                    );
                }
                return block;
            });
        }
        if (conf.cellValues) {
            conf.cellValues = applySFCustomBlockCellValues(
                conf.cellValues,
                scaleFactor,
                exceptions,
            );
        }

        if (conf.grid) {
            conf.grid = applyScaleFactorOnCustomBlocks(
                conf.grid,
                availableWidth,
                scaleFactor,
                isGridCell,
            );
        }

        if (!conf.grid && isGridCell && conf.layout) {
            if (conf.layout.x) {
                conf.layout.x *= scaleFactor;
            }
            if (conf.layout.y) {
                conf.layout.y *= scaleFactor;
            }
        }

        // TEMPORARY FIX - XPS-5827
        // To handle: default value should not be defined here
        const MARGIN = {
            TOP: 0.5,
        };
        if (!conf.styles) {
            conf.styles = Object.assign({});
        }

        if (!conf.styles.margin) {
            conf.styles.margin = { top: MARGIN.TOP * scaleFactor };
        }
        return conf;
    });
}


/**
 * =======================
 * REFACTOR
 * =======================
 */

/**
 *  To calculate the scalefactor
 * @param doc
 * @param tableConfig
 * @returns
 */
const calculateScaleFactor = (
    doc,
    tableConfig,
    baseConfig,
) => {
    // to calculate scale factor
    let totalColumnWidth = 0;
    const pageMargin = baseConfig.margin || 0;
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
        doc.page.width - (pageMargin.left + pageMargin.right),
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

/**
 *  To apply scale factor to margin
 * @param margin
 * @param sf
 * @returns
 */
const applySFMargin = (
    margin,
    sf,
) => {
    const parsedMargin = margin || 0;
    return Object.keys(parsedMargin).reduce((acc, obj) => {
        return {
            ...acc,
            [obj]: parsedMargin[obj] * sf,
        };
    },{});
};

/**
 * To apply scale factor to Table head
 * @param headConfigs
 * @param sf
 * @returns
 */
const applySFTableHead = (headConfigs, sf) => {
    return headConfigs.map((headConfig) => {
        if (Array.isArray(headConfig)) {
            headConfig.map((level) => {
                level.styles = applyScaleFactorOnStyle(level.styles, sf);
                // width got omitted for type conflicts
                if (level.width) {
                    level.width = level.width * sf;
                }

                level = Object.assign({}, level);
                if (level.annotationConfig || level.commentConfig) {
                    // to handle annotation config
                    level.annotationConfig = applyScaleFactorOnAnnotationConfig(
                        level.annotationConfig,
                        sf,
                    );
                }
                return level;
            });
        }
        return headConfig;
    });
};



const applySFCustomBlockCellValues = (
    cellValues,
    sf,
    exceptions = [],
) => {
    return cellValues.map((level) => {
        return level.map((cellValue) => {
            if (cellValue.margin) {
                cellValue.margin = applySFMargin(cellValue.margin, sf);
            }
            /* called this method, because some of cellValue.style property such as fontSize
             are available in cellValue itself */
            cellValue = applyScaleFactorOnStyle(cellValue, sf, exceptions);

            if (cellValue.styles) {
                cellValue.styles = applyScaleFactorOnStyle(
                    cellValue.styles,
                    sf,
                    exceptions,
                );
                if (cellValue.styles.margin) {
                    cellValue.styles.margin = applySFMargin(
                        cellValue.styles.margin,
                        sf,
                    );
                }
            }

            if (cellValue._type === 'dataBar') {
                if (cellValue.axisWidth) {
                    cellValue.axisWidth *= sf;
                }
                cellValue.startX *= sf;
                cellValue.imageWidth *= sf;
            }


            cellValue = Object.assign({}, cellValue);

            return cellValue;
        });
    });
};

/**
 * To apply scale factor to cellValues inside table body
 * @param cellValues
 * @param sf
 * @returns
 */
const applySFCellValues = (cellValues, sf) => {
    return cellValues.map((level) => {
        return level.map((cellValue) => {
            if (cellValue.margin) {
                cellValue.margin = applySFMargin(cellValue.margin, sf);
            }
            /* called this method, because some of cellValue.style property such as fontSize
             are available in cellValue itself */
            cellValue = applyScaleFactorOnStyle(cellValue, sf);

            if (cellValue.styles) {
                cellValue.styles = applyScaleFactorOnStyle(
                    cellValue.styles,
                    sf,
                );
                if (cellValue.styles.margin) {
                    cellValue.styles.margin = applySFMargin(
                        cellValue.styles.margin,
                        sf,
                    );
                }
            }

            if (cellValue._type === 'dataBar') {
                if (cellValue.axisWidth) {
                    cellValue.axisWidth *= sf;
                }
                cellValue.startX *= sf;
                cellValue.imageWidth *= sf;
            } else if (cellValue._type === 'circle') {
                cellValue.r *= sf;
                cellValue.cx *= sf;
                cellValue.maxColumnRadius *= sf;
                cellValue.cy *= sf;
            }

            
            cellValue = Object.assign({}, cellValue);

            return cellValue;
        });
    });
};

/**
 * To apply scale factor to Table body
 * @param bodyConfigs
 * @param sf
 * @returns
 */
const applySFTableBody = (bodyConfigs, sf) => {
    return bodyConfigs.map((row) => {
        if (Array.isArray(row)) {
            row.map((cell) => {
                cell.styles = cell.styles
                    ? applyScaleFactorOnStyle(cell.styles, sf)
                    : {};

                cell.cellValues = cell.cellValues
                    ? applySFCellValues(cell.cellValues, sf)
                    : null;

                if (cell?.grid) {
                    cell.grid = Object.assign(
                        cell.grid,
                        applyScaleFactorOnCustomBlocks(
                            cell.grid,
                            cell.styles.cellWidth,
                            sf,
                            true,
                        ),
                    );
                }
                if (cell?.grid) {
                    cell.grid = Object.assign(
                        cell.grid,
                        applyScaleFactorOnCustomBlocks(
                            cell.grid,
                            cell.styles.cellWidth,
                            sf,
                            true,
                        ),
                    );
                }
                cell = Object.assign({}, cell);
                return cell;
            });
        }
        return row;
    });
};

/**
 * To apply scale factor to BaseConfig
 * @param baseConfig
 * @param sf
 * @returns
 */
const applySFBaseConfig = (baseConfig, sf) => {
    // if (baseConfig.margin) {
    //     baseConfig.margin = applySFMargin(
    //         baseConfig.margin || DEFAULT_BASE_CONFIG.margin,
    //         sf,
    //     );
    // }
    baseConfig.fontSize = Math.round(baseConfig.fontSize * sf);
    for (const side in baseConfig.tablePadding) {
        baseConfig.tablePadding[side] *= sf;
    }

    return baseConfig;
};

/**
 * To apply Scale factor for table config
 * @param tableConfig
 * @param sf
 */
const applySFTableConfig = (
    tableConfigs,
    baseConfig,
    sf,
) => {
    return tableConfigs.map((tableConfig, index) => {
        tableConfig.margin = Object.assign(
            {},
            baseConfig.margin,
            tableConfig.margin,
        );

        //tableConfig.margin = applySFMargin(tableConfig.margin, sf[index]);
        tableConfig.headStyles = applyScaleFactorOnStyle(
            tableConfig.headStyles,
            sf[index],
        );
        tableConfig.rowStyle = applyScaleFactorOnStyle(
            tableConfig.rowStyle,
            sf[index],
        );

        tableConfig.head = applySFTableHead(tableConfig.head, sf[index]);
        tableConfig.body = applySFTableBody(tableConfig.body, sf[index]);
        if (tableConfig.scaleBandConfig) {
            applySFTableBody(tableConfig.scaleBandConfig, sf[index]);
        }
        return tableConfig;
    });
};

/**
 *  ** MAIN METHOD **
 *  Apply Scale factor for all values in mainConfig
 * @param mainConfig
 */
const applySFMainConfig = (doc, mainConfig) => {
    // const baseMargin = parseSpacing(mainConfig.baseConfig.margin, 0);
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
    calculateScaleFactor,
    applyScaleFactorOnStyle,
    applyScaleFactorOnCustomBlocks,
    applySFMainConfig,
};
