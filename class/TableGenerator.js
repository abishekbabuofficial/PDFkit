const config = require("../new.json");
const PDFGenerator = require("./PDFDocument");

async function main() {
  try {
    // Create table generator instance
    const tableGenerator = new PDFGenerator(config, {
      outputPath: "generated-table.pdf",
    });

    // Generate the table
    await tableGenerator.generateTableWithPagination();

    console.log("PDF generation completed successfully!");
  } catch (error) {
    console.error("Error generating PDF:", error);
  }
}

// Run the main function
main();
