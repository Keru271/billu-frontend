import { jsPDF } from 'jspdf';

export interface BillReceiptData {
  shopName: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  gstin?: string | null;
  billNo: number;
  date: string;
  cashierName?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  items: Array<{
    name: string;
    qty: number;
    pricePaise: number;
    taxPct?: number;
  }>;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  cgstPaise?: number;
  sgstPaise?: number;
  roundOffPaise?: number;
  totalPaise: number;
  priceIncludesTax?: boolean;
  payments: Array<{
    method: 'CASH' | 'UPI' | 'CREDIT';
    amountPaise: number;
    cashReceivedPaise?: number | null;
    changeGivenPaise?: number | null;
    upiRef?: string | null;
  }>;
}

export type ThermalPaperSize = '58mm' | '80mm';

export function getSavedThermalPaperSize(): ThermalPaperSize {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('billo_thermal_paper_size');
    if (saved === '80mm' || saved === '58mm') return saved;
  }
  return '58mm'; // Default to 2-inch (58mm) for compact thermal printers like Seznik Veer
}

export function saveThermalPaperSize(size: ThermalPaperSize): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('billo_thermal_paper_size', size);
  }
}

/**
 * Generate full standalone HTML for 58mm (2-inch) or 80mm (3-inch) thermal printing
 */
export function generateThermalHtml(data: BillReceiptData, is58mm: boolean): string {
  const lineItemsHtml = data.items
    .map((item) => {
      const rate = (item.pricePaise / 100).toFixed(2);
      const total = ((item.qty * item.pricePaise) / 100).toFixed(2);
      return `
        <tr>
          <td class="col-item">${item.name}</td>
          <td class="col-qty">${item.qty}</td>
          <td class="col-rate">${rate}</td>
          <td class="col-amt">${total}</td>
        </tr>
      `;
    })
    .join('');

  const paymentsHtml = data.payments
    .map((p) => {
      let extra = '';
      if (p.upiRef) {
        extra += `<div class="sub-row"><span>Ref:</span><span>${p.upiRef}</span></div>`;
      }
      return `
        <div class="row">
          <span>Paid by ${p.method}:</span>
          <span class="font-bold">Rs.${(p.amountPaise / 100).toFixed(2)}</span>
        </div>
        ${extra}
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${data.billNo}</title>
  <style>
    @page {
      size: ${is58mm ? '58mm auto' : '80mm auto'};
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: ${is58mm ? '48mm' : '72mm'};
      margin: 0 auto;
      padding: ${is58mm ? '2mm 1mm' : '4mm 2mm'};
      font-family: 'Courier New', Courier, monospace;
      font-size: ${is58mm ? '10px' : '12px'};
      line-height: 1.2;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .shop-name {
      font-size: ${is58mm ? '13px' : '16px'};
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin-bottom: 2px;
    }
    .subtext {
      font-size: ${is58mm ? '9px' : '10.5px'};
      text-align: center;
      line-height: 1.2;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: ${is58mm ? '3px 0' : '5px 0'};
      width: 100%;
    }
    .double-divider {
      border-top: 2px solid #000;
      margin: ${is58mm ? '4px 0' : '6px 0'};
      width: 100%;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2px 0;
    }
    th {
      font-size: ${is58mm ? '9px' : '10.5px'};
      font-weight: bold;
      border-bottom: 1px dashed #000;
      padding-bottom: 2px;
      text-align: left;
    }
    td {
      padding: 1px 0;
      vertical-align: top;
      font-size: ${is58mm ? '9.5px' : '11px'};
    }
    .col-item {
      width: 48%;
      word-break: break-word;
    }
    .col-qty {
      width: 14%;
      text-align: center;
    }
    .col-rate {
      width: 18%;
      text-align: right;
    }
    .col-amt {
      width: 20%;
      text-align: right;
      font-weight: bold;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 1px 0;
      font-size: ${is58mm ? '9.5px' : '11px'};
    }
    .sub-row {
      display: flex;
      justify-content: space-between;
      margin-left: 6px;
      font-size: ${is58mm ? '8.5px' : '10px'};
      color: #333;
    }
    .grand-total {
      display: flex;
      justify-content: space-between;
      font-size: ${is58mm ? '12.5px' : '15px'};
      font-weight: bold;
      margin: 3px 0;
    }
    .barcode-box {
      margin: 4px 0 2px 0;
      text-align: center;
    }
    .barcode-bars {
      display: inline-flex;
      height: 22px;
      align-items: center;
    }
    .bar {
      background: #000;
      height: 100%;
      margin: 0 0.5px;
    }
    .footer {
      font-size: ${is58mm ? '8px' : '9.5px'};
      text-align: center;
      margin-top: 4px;
      color: #222;
    }
  </style>
</head>
<body>
  <div class="shop-name">${data.shopName}</div>
  ${data.shopAddress ? `<div class="subtext">${data.shopAddress}</div>` : ''}
  ${data.shopPhone ? `<div class="subtext">Ph: ${data.shopPhone}</div>` : ''}
  ${data.gstin ? `<div class="subtext">GSTIN: ${data.gstin}</div>` : ''}

  <div class="divider"></div>

  <div class="row">
    <span>Bill: #${data.billNo}</span>
    <span>${data.date}</span>
  </div>
  ${data.customerName ? `<div class="row"><span>Cust: ${data.customerName}${data.customerPhone ? ` (${data.customerPhone})` : ''}</span></div>` : ''}

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th class="col-item">ITEM</th>
        <th class="col-qty">QTY</th>
        <th class="col-rate">RATE</th>
        <th class="col-amt">AMT</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHtml}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="row">
    <span>Subtotal:</span>
    <span>Rs.${(data.subtotalPaise / 100).toFixed(2)}</span>
  </div>
  ${data.discountPaise > 0 ? `<div class="row"><span>Discount:</span><span>-Rs.${(data.discountPaise / 100).toFixed(2)}</span></div>` : ''}
  ${data.taxPaise > 0 ? `<div class="row"><span>GST ${data.priceIncludesTax ? '(Incl)' : 'Total'}:</span><span>Rs.${(data.taxPaise / 100).toFixed(2)}</span></div>` : ''}
  ${data.roundOffPaise && data.roundOffPaise !== 0 ? `<div class="row"><span>Round Off:</span><span>${data.roundOffPaise > 0 ? '+' : ''}Rs.${(data.roundOffPaise / 100).toFixed(2)}</span></div>` : ''}

  <div class="double-divider"></div>

  <div class="grand-total">
    <span>GRAND TOTAL:</span>
    <span>Rs.${(data.totalPaise / 100).toFixed(2)}</span>
  </div>

  <div class="divider"></div>

  <div class="font-bold" style="font-size: ${is58mm ? '9.5px' : '10.5px'}; margin-bottom: 2px;">PAYMENT DETAILS:</div>
  ${paymentsHtml}

  <div class="divider"></div>

  <div class="footer">
    Instagram: @thecaramelpan<br />
    Thank you! Please visit us again.
  </div>
</body>
</html>`;
}

/**
 * Direct Print to Thermal Printer via hidden iframe.
 * Never triggers browser pop-up blockers because it operates inside the current window!
 */
export function printThermalReceipt(data: BillReceiptData, paperSize?: ThermalPaperSize): void {
  const resolvedSize = paperSize || getSavedThermalPaperSize();
  const is58mm = resolvedSize === '58mm';
  const html = generateThermalHtml(data, is58mm);

  // Remove any stale print iframe
  const oldIframe = document.getElementById('billo-thermal-print-frame');
  if (oldIframe && oldIframe.parentNode) {
    oldIframe.parentNode.removeChild(oldIframe);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'billo-thermal-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Give iframe a moment to process styles and fonts before opening print dialog
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print error, falling back to window.print():', err);
        window.print();
      }
    }, 250);
  }
}

/**
 * Builds raw ESC/POS binary commands for direct Bluetooth thermal receipt printers
 */
export function buildEscPosBytes(data: BillReceiptData, is58mm: boolean): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: number[] = [];

  const write = (...bytes: number[]) => chunks.push(...bytes);
  const writeText = (text: string) => {
    const encoded = encoder.encode(text);
    for (let i = 0; i < encoded.length; i++) chunks.push(encoded[i]);
  };

  const lineChars = is58mm ? 32 : 48;
  const divider = '-'.repeat(lineChars) + '\n';
  const padRight = (label: string, val: string) => {
    const spaces = Math.max(1, lineChars - label.length - val.length);
    return label + ' '.repeat(spaces) + val + '\n';
  };

  // ESC @: Initialize printer
  write(0x1b, 0x40);

  // ESC a 1: Center alignment
  write(0x1b, 0x61, 0x01);

  // GS ! 17: Double height & width for shop name
  write(0x1d, 0x21, 0x11);
  writeText(`${data.shopName}\n`);

  // GS ! 0: Normal text
  write(0x1d, 0x21, 0x00);
  if (data.shopAddress) writeText(`${data.shopAddress}\n`);
  if (data.shopPhone) writeText(`Ph: ${data.shopPhone}\n`);
  if (data.gstin) writeText(`GSTIN: ${data.gstin}\n`);

  writeText(divider);

  // ESC a 0: Left alignment
  write(0x1b, 0x61, 0x00);
  writeText(padRight(`Bill: #${data.billNo}`, data.date));
  if (data.customerName || data.customerPhone) {
    writeText(`Cust: ${data.customerName || 'Walk-in'}${data.customerPhone ? ` (${data.customerPhone})` : ''}\n`);
  }
  writeText(divider);

  // Table header
  if (is58mm) {
    writeText('ITEM          QTY   RATE     AMT\n');
  } else {
    writeText('ITEM                   QTY      PRICE        AMT\n');
  }
  writeText(divider);

  // Line items
  for (const item of data.items) {
    const rate = (item.pricePaise / 100).toFixed(2);
    const amt = ((item.qty * item.pricePaise) / 100).toFixed(2);
    if (is58mm) {
      const name = (item.name.length > 12 ? item.name.substring(0, 11) + '.' : item.name).padEnd(14, ' ');
      const qty = String(item.qty).padStart(4, ' ');
      const r = rate.padStart(6, ' ');
      const a = amt.padStart(8, ' ');
      writeText(`${name}${qty}${r}${a}\n`);
    } else {
      const name = (item.name.length > 20 ? item.name.substring(0, 19) + '.' : item.name).padEnd(22, ' ');
      const qty = String(item.qty).padStart(4, ' ');
      const r = rate.padStart(10, ' ');
      const a = amt.padStart(12, ' ');
      writeText(`${name}${qty}${r}${a}\n`);
    }
  }

  writeText(divider);

  // Totals
  writeText(padRight('Subtotal:', `Rs. ${(data.subtotalPaise / 100).toFixed(2)}`));
  if (data.discountPaise > 0) {
    writeText(padRight('Discount:', `-Rs. ${(data.discountPaise / 100).toFixed(2)}`));
  }
  if (data.taxPaise > 0) {
    writeText(padRight(data.priceIncludesTax ? 'GST (Incl):' : 'GST Total:', `Rs. ${(data.taxPaise / 100).toFixed(2)}`));
  }
  if (data.roundOffPaise && data.roundOffPaise !== 0) {
    writeText(padRight('Round Off:', `${data.roundOffPaise > 0 ? '+' : ''}Rs. ${(data.roundOffPaise / 100).toFixed(2)}`));
  }

  // Grand total bold
  write(0x1b, 0x45, 0x01); // Bold on
  writeText(padRight('GRAND TOTAL:', `Rs. ${(data.totalPaise / 100).toFixed(2)}`));
  write(0x1b, 0x45, 0x00); // Bold off

  writeText(divider);

  // Payment details
  writeText('PAYMENT DETAILS:\n');
  for (const pay of data.payments) {
    writeText(padRight(`Paid ${pay.method}:`, `Rs. ${(pay.amountPaise / 100).toFixed(2)}`));
    if (pay.upiRef) {
      writeText(` Ref/UTR: ${pay.upiRef}\n`);
    }
  }

  writeText(divider);

  // Footer centered
  write(0x1b, 0x61, 0x01);
  writeText('Instagram: @thecaramelpan\n');
  writeText('Thank you! Please visit us again.\n\n\n\n');

  // Feed & Cut
  write(0x1d, 0x56, 0x41, 0x10);

  return new Uint8Array(chunks);
}

let cachedDevice: any = null;
let cachedCharacteristic: any = null;

export function resetBluetoothPrinter(): void {
  try {
    if (cachedDevice && cachedDevice.gatt?.connected) {
      cachedDevice.gatt.disconnect();
    }
  } catch (e) {
    // ignore
  }
  cachedDevice = null;
  cachedCharacteristic = null;
}

async function sendBytesToCharacteristic(writeChar: any, bytes: Uint8Array): Promise<void> {
  const chunkSize = 100;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (writeChar.writeValueWithoutResponse) {
      await writeChar.writeValueWithoutResponse(chunk);
    } else {
      await writeChar.writeValue(chunk);
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * Direct Web Bluetooth Printing to Seznik Veer or other Bluetooth POS printers.
 * - Auto-reconnects to the previously paired printer (zero popups on subsequent prints)
 * - Filters for thermal printers to remove random "Unknown or Unsupported Device" clutter
 */
export async function printViaBluetooth(
  data: BillReceiptData,
  paperSize?: ThermalPaperSize
): Promise<{ success: boolean; message: string }> {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
    return {
      success: false,
      message: 'Web Bluetooth is not supported in this browser. Please use Google Chrome or Microsoft Edge.',
    };
  }

  const is58mm = (paperSize || getSavedThermalPaperSize()) === '58mm';
  const bytes = buildEscPosBytes(data, is58mm);

  try {
    const bluetooth = (navigator as any).bluetooth;

    // 1. Try reusing existing connected characteristic directly (silent 1-click print)
    if (cachedDevice && cachedDevice.gatt?.connected && cachedCharacteristic) {
      try {
        await sendBytesToCharacteristic(cachedCharacteristic, bytes);
        return { success: true, message: `Printed directly to ${cachedDevice.name || 'Seznik'}!` };
      } catch (reuseErr) {
        console.warn('Reusing active characteristic failed, will reconnect:', reuseErr);
        cachedCharacteristic = null;
      }
    }

    // 2. Try reconnecting to previously paired device in browser without opening pairing prompt
    let device = cachedDevice;
    if (!device && bluetooth.getDevices) {
      try {
        const knownDevices = await bluetooth.getDevices();
        if (knownDevices && knownDevices.length > 0) {
          device = knownDevices.find((d: any) => /seznik|veer|mtp|pos|rpp|printer/i.test(d.name || '')) || knownDevices[0];
        }
      } catch (getErr) {
        console.warn('getDevices error:', getErr);
      }
    }

    const optionalServices = [
      '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer service
      '0000ffe0-0000-1000-8000-00805f9b34fb', // Common BLE Serial Service
      '0000ff00-0000-1000-8000-00805f9b34fb', // Alternative POS BLE
      '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / Chinese POS module
      '0000ae00-0000-1000-8000-00805f9b34fb', // Android POS Serial
      '0000ae30-0000-1000-8000-00805f9b34fb', // MPT-II serial
      '0000af30-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    ];

    // 3. If device not already granted, request device with clean filters (removes "Unknown or Unsupported" noise)
    if (!device) {
      try {
        device = await bluetooth.requestDevice({
          filters: [
            { namePrefix: 'Seznik' },
            { namePrefix: 'seznik' },
            { namePrefix: 'Veer' },
            { namePrefix: 'veer' },
            { namePrefix: 'MTP' },
            { namePrefix: 'mtp' },
            { namePrefix: 'RPP' },
            { namePrefix: 'POS' },
            { namePrefix: 'pos' },
            { namePrefix: 'Printer' },
            { namePrefix: 'printer' },
            { namePrefix: 'Bluetooth' },
          ],
          optionalServices,
        });
      } catch (filterErr: any) {
        // Fall back to acceptAllDevices if device has unusual broadcast name
        if (filterErr?.name === 'NotFoundError') {
          return { success: false, message: 'No Bluetooth printer was selected.' };
        }
        device = await bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices,
        });
      }
    }

    cachedDevice = device;

    // Connect to GATT
    let server = device.gatt;
    if (!server.connected) {
      server = await device.gatt.connect();
    }

    const services = await server.getPrimaryServices();
    let writeChar: any = null;
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      throw new Error('Could not find a writable Bluetooth printing characteristic on this device.');
    }

    cachedCharacteristic = writeChar;

    await sendBytesToCharacteristic(writeChar, bytes);

    return {
      success: true,
      message: `Receipt sent to ${device.name || 'Seznik'}! Device remembered for 1-click printing.`,
    };
  } catch (err: any) {
    if (err?.name === 'NotFoundError') {
      return { success: false, message: 'No Bluetooth printer was selected.' };
    }
    return { success: false, message: err?.message || 'Bluetooth connection error.' };
  }
}

/**
 * Download thermal PDF file directly to disk
 */
export function downloadThermalPdf(data: BillReceiptData, paperSize?: ThermalPaperSize): void {
  const resolvedSize = paperSize || getSavedThermalPaperSize();
  const is58mm = resolvedSize === '58mm';
  const widthMm = is58mm ? 58 : 80;
  const centerX = widthMm / 2;
  const leftX = is58mm ? 3 : 5;
  const rightX = is58mm ? 55 : 75;

  const baseHeight = is58mm
    ? 110 + data.items.length * 6 + data.payments.length * 5
    : 150 + data.items.length * 8 + data.payments.length * 8;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, Math.max(is58mm ? 90 : 120, baseHeight)],
  });

  doc.setFont('courier', 'bold');
  doc.setFontSize(is58mm ? 11 : 14);
  doc.text(data.shopName, centerX, is58mm ? 7 : 10, { align: 'center', maxWidth: is58mm ? 52 : 70 });

  doc.setFont('courier', 'normal');
  doc.setFontSize(is58mm ? 7.5 : 9);
  let y = is58mm ? 11.5 : 15;

  if (data.shopAddress) {
    doc.text(data.shopAddress, centerX, y, { align: 'center', maxWidth: is58mm ? 52 : 70 });
    y += is58mm ? 6 : 8;
  }
  if (data.shopPhone) {
    doc.text(`Ph: ${data.shopPhone}`, centerX, y, { align: 'center' });
    y += is58mm ? 4 : 5;
  }
  if (data.gstin) {
    doc.text(`GSTIN: ${data.gstin}`, centerX, y, { align: 'center' });
    y += is58mm ? 4 : 5;
  }

  const divider = is58mm ? '--------------------------------' : '------------------------------------------------';
  doc.text(divider, centerX, y, { align: 'center' });
  y += is58mm ? 3.5 : 5;

  doc.setFontSize(is58mm ? 7.5 : 8.5);
  doc.text(`Bill: #${data.billNo}`, leftX, y);
  doc.text(data.date, rightX, y, { align: 'right' });
  y += 3.5;

  doc.text(divider, centerX, y, { align: 'center' });
  y += is58mm ? 3.5 : 5;

  // Table header
  doc.setFont('courier', 'bold');
  if (is58mm) {
    doc.text('ITEM', leftX, y);
    doc.text('QTY', 26, y);
    doc.text('RATE', 36, y);
    doc.text('AMT', rightX, y, { align: 'right' });
  } else {
    doc.text('ITEM', 5, y);
    doc.text('QTY', 42, y);
    doc.text('PRICE', 54, y);
    doc.text('AMT', 75, y, { align: 'right' });
  }
  y += is58mm ? 3.5 : 4;

  doc.setFont('courier', 'normal');
  doc.text(divider, centerX, y, { align: 'center' });
  y += is58mm ? 3.5 : 4;

  // Items
  for (const item of data.items) {
    const lineTotal = ((item.qty * item.pricePaise) / 100).toFixed(2);
    const rate = (item.pricePaise / 100).toFixed(2);
    const maxChars = is58mm ? 11 : 20;
    const displayName = item.name.length > maxChars ? item.name.substring(0, maxChars - 1) + '.' : item.name;

    if (is58mm) {
      doc.text(displayName, leftX, y);
      doc.text(String(item.qty), 27, y);
      doc.text(rate, 36, y);
      doc.text(lineTotal, rightX, y, { align: 'right' });
      y += 3.8;
    } else {
      doc.text(displayName, 5, y);
      doc.text(String(item.qty), 44, y);
      doc.text(rate, 54, y);
      doc.text(lineTotal, 75, y, { align: 'right' });
      y += 5;
    }
  }

  doc.text(divider, centerX, y, { align: 'center' });
  y += is58mm ? 3.5 : 5;

  // Totals
  const labelX = is58mm ? 22 : 40;
  doc.text('Subtotal:', labelX, y);
  doc.text(`Rs. ${(data.subtotalPaise / 100).toFixed(2)}`, rightX, y, { align: 'right' });
  y += is58mm ? 3.5 : 4;

  doc.setFont('courier', 'bold');
  doc.setFontSize(is58mm ? 9.5 : 11);
  doc.text('GRAND TOTAL:', leftX, y + 2);
  doc.text(`Rs. ${(data.totalPaise / 100).toFixed(2)}`, rightX, y + 2, { align: 'right' });
  y += is58mm ? 8 : 10;

  doc.setFont('courier', 'normal');
  doc.setFontSize(is58mm ? 7.5 : 8.5);
  doc.text('Instagram: @thecaramelpan', centerX, y, { align: 'center' });
  y += is58mm ? 3.5 : 4.5;
  doc.text('Thank you! Please visit us again.', centerX, y, { align: 'center' });

  doc.save(`Bill-${data.billNo}.pdf`);
}

/**
 * Backward compatibility alias for generateThermalPdf
 */
export function generateThermalPdf(data: BillReceiptData, paperSize?: ThermalPaperSize): void {
  printThermalReceipt(data, paperSize);
}

export function buildWhatsAppLink(phone: string, data: BillReceiptData): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const targetPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  const message = [
    `🧾 *Invoice from ${data.shopName}*`,
    `Bill #${data.billNo} | Date: ${data.date}`,
    `-------------------------`,
    ...data.items.map((i) => `• ${i.name} (${i.qty}x) = ₹${((i.qty * i.pricePaise) / 100).toFixed(2)}`),
    `-------------------------`,
    `*Total Amount: ₹${(data.totalPaise / 100).toFixed(2)}*`,
    data.payments.map((p) => `Payment: ${p.method} (₹${(p.amountPaise / 100).toFixed(2)})`).join(', '),
    `\nInstagram: @thecaramelpan`,
    `Thank you! Please visit us again.`,
  ].join('\n');

  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}
