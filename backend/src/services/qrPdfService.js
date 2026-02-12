import PDFDocument from 'pdfkit';
import { Asset } from '../models/index.js';

/**
 * Helper function to draw a single asset card
 */
function drawAssetCard(doc, asset, x, y, cardWidth, cardHeight, qrSize) {
  // Draw card border
  doc.rect(x, y, cardWidth, cardHeight)
     .lineWidth(1)
     .strokeColor('#e5e7eb')
     .stroke();

  // Draw QR code if available
  if (asset.qrCodeUrl) {
    try {
      // QR code is base64 data URL
      const base64Data = asset.qrCodeUrl.replace(/^data:image\/\w+;base64,/, '');
      const qrBuffer = Buffer.from(base64Data, 'base64');

      doc.image(qrBuffer, x + (cardWidth - qrSize) / 2, y + 10, {
        width: qrSize,
        height: qrSize
      });
    } catch (err) {
      // If QR code fails to load, draw placeholder
      drawPlaceholder(doc, x, y, cardWidth, qrSize, 'QR Code\nNot Available');
    }
  } else {
    // No QR code - draw placeholder
    drawPlaceholder(doc, x, y, cardWidth, qrSize, 'QR Code\nNot Generated');
  }

  // Draw asset info
  const textY = y + qrSize + 20;

  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor('#111827')
     .text(asset.assetId || 'N/A', x + 10, textY, {
       width: cardWidth - 20,
       align: 'center',
       ellipsis: true
     });

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#374151')
     .text(asset.name || 'Unnamed Asset', x + 10, textY + 15, {
       width: cardWidth - 20,
       align: 'center',
       ellipsis: true
     });

  if (asset.model) {
    doc.fontSize(7)
       .fillColor('#6b7280')
       .text(asset.model, x + 10, textY + 30, {
         width: cardWidth - 20,
         align: 'center',
         ellipsis: true
       });
  }
}

function drawPlaceholder(doc, x, y, cardWidth, qrSize, text) {
  doc.rect(x + (cardWidth - qrSize) / 2, y + 10, qrSize, qrSize)
     .fillColor('#f3f4f6')
     .fill()
     .strokeColor('#d1d5db')
     .stroke();

  doc.fontSize(8)
     .fillColor('#9ca3af')
     .text(text, x + (cardWidth - qrSize) / 2, y + 50, {
       width: qrSize,
       align: 'center'
     });
}

/**
 * Generate PDF with QR codes for all assets, grouped by category
 */
export async function generateAssetQRCodesPDF(organizationId, res) {
  try {
    // Fetch all assets for the organization
    const assets = await Asset.find({ organizationId })
      .sort({ category: 1, assetId: 1 })
      .lean();

    if (assets.length === 0) {
      throw new Error('No assets found');
    }

    // Group assets by category
    const assetsByCategory = {};
    assets.forEach(asset => {
      const category = asset.category || 'Uncategorized';
      if (!assetsByCategory[category]) {
        assetsByCategory[category] = [];
      }
      assetsByCategory[category].push(asset);
    });

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="asset-qr-codes-${new Date().toISOString().split('T')[0]}.pdf"`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Add title page
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('Asset QR Codes', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });

    doc.moveDown(0.3);
    doc.fontSize(10)
       .text(`Total Assets: ${assets.length}`, { align: 'center' });

    // QR code dimensions
    const qrSize = 120;
    const labelHeight = 60;
    const cardWidth = 180;
    const cardHeight = qrSize + labelHeight + 20;
    const columns = 3;
    const startX = 50;
    const horizontalGap = 15;
    const verticalGap = 20;
    const maxY = doc.page.height - 70; // Leave space at bottom

    // Iterate through categories
    let isFirstCategory = true;

    for (const [category, categoryAssets] of Object.entries(assetsByCategory)) {
      // Add new page for each category (except first which uses title page)
      if (!isFirstCategory) {
        doc.addPage();
      }
      isFirstCategory = false;

      let currentY = 50;

      // Add category header
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor('#2563eb')
         .text(category, 50, currentY);

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#666666')
         .text(`${categoryAssets.length} asset${categoryAssets.length > 1 ? 's' : ''}`, 50, currentY + 20);

      currentY += 50;

      // Draw assets in grid
      let itemsOnCurrentPage = 0;

      for (let i = 0; i < categoryAssets.length; i++) {
        const asset = categoryAssets[i];
        const col = itemsOnCurrentPage % columns;
        const row = Math.floor(itemsOnCurrentPage / columns);

        const x = startX + col * (cardWidth + horizontalGap);
        const y = currentY + row * (cardHeight + verticalGap);

        // Check if we need a new page
        if (y + cardHeight > maxY) {
          doc.addPage();
          currentY = 50;
          itemsOnCurrentPage = 0;

          // Recalculate position on new page
          const newX = startX;
          const newY = currentY;

          drawAssetCard(doc, asset, newX, newY, cardWidth, cardHeight, qrSize);
          itemsOnCurrentPage++;
        } else {
          drawAssetCard(doc, asset, x, y, cardWidth, cardHeight, qrSize);
          itemsOnCurrentPage++;
        }
      }
    }

    // Finalize the PDF
    doc.end();

    return true;
  } catch (error) {
    console.error('Error generating QR codes PDF:', error);
    throw error;
  }
}

/**
 * Generate PDF for specific category
 */
export async function generateCategoryQRCodesPDF(organizationId, category, res) {
  try {
    const assets = await Asset.find({ organizationId, category })
      .sort({ assetId: 1 })
      .lean();

    if (assets.length === 0) {
      throw new Error(`No assets found in category: ${category}`);
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${category}-qr-codes-${new Date().toISOString().split('T')[0]}.pdf"`);

    doc.pipe(res);

    // Add title
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(`${category} - QR Codes`, { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(10)
       .font('Helvetica')
       .text(`${assets.length} asset${assets.length > 1 ? 's' : ''}`, { align: 'center' });

    // QR code layout
    const qrSize = 120;
    const labelHeight = 60;
    const cardWidth = 180;
    const cardHeight = qrSize + labelHeight + 20;
    const columns = 3;
    const startX = 50;
    const horizontalGap = 15;
    const verticalGap = 20;
    const maxY = doc.page.height - 70;

    let currentY = 150;
    let itemsOnCurrentPage = 0;

    // Draw assets
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const col = itemsOnCurrentPage % columns;
      const row = Math.floor(itemsOnCurrentPage / columns);

      const x = startX + col * (cardWidth + horizontalGap);
      const y = currentY + row * (cardHeight + verticalGap);

      // Check if new page needed
      if (y + cardHeight > maxY) {
        doc.addPage();
        currentY = 50;
        itemsOnCurrentPage = 0;

        const newX = startX;
        const newY = currentY;

        drawAssetCard(doc, asset, newX, newY, cardWidth, cardHeight, qrSize);
        itemsOnCurrentPage++;
      } else {
        drawAssetCard(doc, asset, x, y, cardWidth, cardHeight, qrSize);
        itemsOnCurrentPage++;
      }
    }

    doc.end();
    return true;
  } catch (error) {
    console.error('Error generating category QR codes PDF:', error);
    throw error;
  }
}


