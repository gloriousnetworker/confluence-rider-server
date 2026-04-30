import PDFDocument from "pdfkit";

interface ReceiptData {
  bookingId: string;
  rideType: string;
  pickup: string;
  destination: string;
  suggestedFare: number;
  negotiatedFare: number | null;
  finalFare: number | null;
  driverName: string | null;
  riderName: string;
  riderPhone: string;
  startedAt: string | null;
  completedAt: string | null;
  estimatedDistanceKm: string | null;
}

/**
 * Generate a PDF receipt and return as Buffer.
 */
export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fare = data.finalFare || data.negotiatedFare || data.suggestedFare;
    const date = data.completedAt
      ? new Date(data.completedAt).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "N/A";

    // ─── Header ───
    doc
      .rect(0, 0, doc.page.width, 80)
      .fill("#1e3a8a");

    doc
      .fontSize(22)
      .fillColor("#ffffff")
      .text("Confluence", 40, 25, { continued: true })
      .fillColor("#4ade80")
      .text("Ride")
      .fillColor("#93c5fd")
      .fontSize(10)
      .text("Move Kogi Better", 40, 52);

    doc
      .fillColor("#ffffff")
      .fontSize(10)
      .text("TRIP RECEIPT", doc.page.width - 140, 35, { width: 100, align: "right" });

    // ─── Body ───
    let y = 100;

    doc.fillColor("#111827").fontSize(14).font("Helvetica-Bold").text("Trip Details", 40, y);
    y += 25;

    const addRow = (label: string, value: string) => {
      doc.fillColor("#6b7280").fontSize(10).font("Helvetica").text(label, 40, y);
      doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold").text(value, 220, y, { width: 180, align: "right" });
      y += 20;
    };

    addRow("Booking ID", data.bookingId.substring(0, 8).toUpperCase());
    addRow("Ride Type", data.rideType.charAt(0).toUpperCase() + data.rideType.slice(1));
    addRow("Date", date);

    // Divider
    y += 5;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
    y += 15;

    doc.fillColor("#111827").fontSize(14).font("Helvetica-Bold").text("Route", 40, y);
    y += 25;

    // Pickup
    doc.circle(48, y + 5, 4).fill("#16a34a");
    doc.fillColor("#111827").fontSize(10).font("Helvetica").text(data.pickup, 60, y);
    y += 20;

    // Line
    doc.moveTo(48, y - 5).lineTo(48, y + 5).strokeColor("#d1d5db").lineWidth(2).stroke();
    y += 10;

    // Destination
    doc.circle(48, y + 5, 4).fill("#dc2626");
    doc.fillColor("#111827").fontSize(10).font("Helvetica").text(data.destination, 60, y);
    y += 20;

    if (data.estimatedDistanceKm) {
      doc.fillColor("#6b7280").fontSize(9).text(`Distance: ${data.estimatedDistanceKm} km`, 60, y);
      y += 15;
    }

    // Divider
    y += 5;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
    y += 15;

    addRow("Driver", data.driverName || "N/A");
    addRow("Rider", data.riderName);
    addRow("Phone", data.riderPhone);

    // Divider
    y += 5;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
    y += 15;

    // Fare
    doc.fillColor("#111827").fontSize(14).font("Helvetica-Bold").text("Fare", 40, y);
    y += 25;

    if (data.suggestedFare !== fare) {
      addRow("Suggested Fare", `₦${data.suggestedFare.toLocaleString()}`);
    }
    if (data.negotiatedFare && data.negotiatedFare !== fare) {
      addRow("Negotiated Fare", `₦${data.negotiatedFare.toLocaleString()}`);
    }

    // Total
    y += 5;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor("#1e3a8a").lineWidth(2).stroke();
    y += 10;
    doc.fillColor("#6b7280").fontSize(12).font("Helvetica").text("Total Paid", 40, y);
    doc.fillColor("#1e3a8a").fontSize(20).font("Helvetica-Bold").text(`₦${fare.toLocaleString()}`, 220, y - 3, { width: 180, align: "right" });

    // ─── Footer ───
    const footerY = doc.page.height - 60;
    doc.moveTo(40, footerY).lineTo(doc.page.width - 40, footerY).strokeColor("#e5e7eb").lineWidth(1).stroke();

    doc
      .fillColor("#9ca3af")
      .fontSize(8)
      .font("Helvetica")
      .text("© 2026 Mega-Tech Solutions LTD. All rights reserved.", 40, footerY + 10, { width: doc.page.width - 80, align: "center" })
      .text("Confluence Ride — Ride the Confluence", 40, footerY + 22, { width: doc.page.width - 80, align: "center" });

    doc.end();
  });
}
