const config = require("../config/raw.json");
const PDFGenerator = require("./PdfDocument");

async function main() {
  try {
    
    // Create table generator instance
    const tableGenerator = new PDFGenerator(config, {
      outputPath: "testing.pdf",
    });

    console.log('memory before', Math.round(process.memoryUsage().heapUsed / 1024 / 1024));
 
    // Generate the table
    await tableGenerator.generateStreamingTable(tableGenerator.rowStreamGenerator());

    console.log('memory after', Math.round(process.memoryUsage().heapUsed / 1024 / 1024));    

    console.log("PDF generation completed successfully!");
  } catch (error) {
    console.error("Error generating PDF:", error);
  }
}

// Run the main function
main();
