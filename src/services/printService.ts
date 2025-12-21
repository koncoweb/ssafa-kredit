import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const DEFAULT_THERMAL_WIDTH_MM = 58;

interface PrintAgreementParams {
  customer: {
    name: string;
    id: string; // KTP or internal ID
    address: string;
    phone: string;
  };
  product: {
    name: string;
    priceCash: number;
  };
  transaction: {
    priceCredit: number;
    downPayment: number;
    principal: number;
    tenorType: 'weekly' | 'monthly' | 'daily';
    tenorCount: number;
    installmentAmount: number;
    markupPercentage: number;
  };
  schedule: {
    installment: number;
    date: string;
  }[];
  company?: {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string; // Optional URL or Base64
  };
  officerName: string;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function companyHeaderHtml(params: { name: string; address: string; phone: string; logoUrl?: string }) {
  const logo = params.logoUrl
    ? `<div style="margin-bottom: 6px;"><img src="${params.logoUrl}" style="max-width: 160px; max-height: 60px; object-fit: contain;" /></div>`
    : '';
  return `
    <div class="text-center">
      ${logo}
      <div class="bold" style="font-size: 16px;">${escapeHtml(params.name)}</div>
      <div class="small">${escapeHtml(params.address)}</div>
      <div class="small">${escapeHtml(params.phone)}</div>
    </div>
  `;
}

async function printOrShareHtml(html: string) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}

export const generateAgreementPDF = async (params: PrintAgreementParams) => {
  const { customer, product, transaction, schedule, company, officerName } = params;
  const today = new Date();
  const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const docNumber = `AGR/${today.getFullYear()}/${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  const companyName = company?.name || 'SSAFA KREDIT';
  const companyAddress = company?.address || 'Jl. Contoh No. 123, Kota, Provinsi';
  const companyPhone = company?.phone || '0812-3456-7890';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #000;
            margin: 0;
            padding: 20px;
            background-color: #fff;
            width: 100%; 
            max-width: 80mm; /* Standard thermal paper width */
            margin: 0 auto; 
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-justify { text-align: justify; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .double-divider { border-top: 2px double #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .col { display: flex; flex-direction: column; }
          .small { font-size: 10px; }
          .header { margin-bottom: 15px; }
          .section-title { margin-top: 10px; margin-bottom: 5px; text-decoration: underline; font-weight: bold; }
          .clause-title { margin-top: 8px; font-weight: bold; }
          .clause-content { margin-left: 10px; margin-bottom: 4px; line-height: 1.2; }
          .signature-box { margin-top: 30px; display: flex; justify-content: space-between; }
          .sign-area { text-align: center; width: 45%; }
          .sign-line { border-bottom: 1px solid #000; margin-top: 40px; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <!-- Header Perusahaan -->
        <div class="header text-center">
          <div class="bold" style="font-size: 16px;">${companyName}</div>
          <div class="small">${companyAddress}</div>
          <div class="small">${companyPhone}</div>
        </div>
        
        <div class="double-divider"></div>
        
        <div class="text-center bold" style="font-size: 14px; margin-bottom: 5px;">SURAT PERJANJIAN KREDIT</div>
        <div class="text-center small">No: ${docNumber}</div>
        <div class="text-center small">Tgl: ${dateStr}</div>

        <div class="divider"></div>

        <!-- Identitas Pihak -->
        <div class="small text-justify">
          Pada hari ini, <b>${dateStr}</b>, kami yang bertanda tangan di bawah ini:
        </div>

        <div class="clause-title">PIHAK PERTAMA (KREDITUR):</div>
        <div class="clause-content">
          <div>Nama: ${officerName} (Admin)</div>
          <div>Mewakili: ${companyName}</div>
        </div>

        <div class="clause-title">PIHAK KEDUA (DEBITUR):</div>
        <div class="clause-content">
          <div>Nama: ${customer.name}</div>
          <div>ID: ${customer.id}</div>
          <div>Alamat: ${customer.address}</div>
          <div>Telp: ${customer.phone}</div>
        </div>

        <div class="divider"></div>

        <!-- Isi Perjanjian -->
        <div class="text-center bold">PASAL - PASAL PERJANJIAN</div>

        <div class="clause-title">PASAL 1: OBYEK KREDIT</div>
        <div class="clause-content">
          Pihak Pertama memberikan fasilitas kredit kepada Pihak Kedua untuk pembelian barang:
          <div class="row" style="margin-top: 2px;">
            <div>Barang</div>
            <div class="bold">${product.name}</div>
          </div>
          <div class="row">
            <div>Harga Tunai</div>
            <div>${formatCurrency(product.priceCash)}</div>
          </div>
        </div>

        <div class="clause-title">PASAL 2: NILAI & PEMBAYARAN</div>
        <div class="clause-content">
          Rincian kewajiban pembayaran Pihak Kedua adalah sebagai berikut:
          <div class="row">
            <div>Harga Kredit</div>
            <div>${formatCurrency(transaction.priceCredit)}</div>
          </div>
          <div class="row">
            <div>Uang Muka (DP)</div>
            <div>${formatCurrency(transaction.downPayment)}</div>
          </div>
          <div class="row bold">
            <div>Sisa Pokok</div>
            <div>${formatCurrency(transaction.principal)}</div>
          </div>
          <div style="margin-top: 4px;">Dicicil sebanyak <b>${transaction.tenorCount}x</b> sebesar <b>${formatCurrency(transaction.installmentAmount)}</b> setiap <b>${transaction.tenorType === 'weekly' ? 'Minggu' : transaction.tenorType === 'daily' ? 'Hari' : 'Bulan'}</b>.</div>
        </div>

        <div class="clause-title">PASAL 3: JATUH TEMPO</div>
        <div class="clause-content">
          Pembayaran angsuran pertama dimulai pada tanggal <b>${schedule[0]?.date || '-'}</b> dan angsuran berikutnya sesuai jadwal terlampir.
        </div>

        <div class="clause-title">PASAL 4: KEPEMILIKAN</div>
        <div class="clause-content">
          Hak milik barang tetap berada pada Pihak Pertama hingga seluruh kewajiban pembayaran lunas. Pihak Kedua dilarang memindah-tangankan barang tanpa ijin tertulis.
        </div>

        <div class="clause-title">PASAL 5: SANKSI</div>
        <div class="clause-content">
          Keterlambatan pembayaran dapat dikenakan denda atau penarikan barang sesuai kebijakan perusahaan.
        </div>

        <div class="divider"></div>
        
        <!-- Jadwal Ringkas (3 baris pertama) -->
        <div class="clause-title">JADWAL PEMBAYARAN (Ringkasan)</div>
        ${schedule.slice(0, 5).map(s => `
          <div class="row small" style="margin-left: 10px;">
            <div style="width: 20px;">${s.installment}.</div>
            <div style="flex: 1;">${s.date}</div>
            <div>${formatCurrency(transaction.installmentAmount)}</div>
          </div>
        `).join('')}
        ${schedule.length > 5 ? `<div class="small text-center" style="font-style:italic;">... (lihat lampiran untuk jadwal lengkap) ...</div>` : ''}

        <div class="double-divider"></div>
        
        <!-- Footer / Tanda Tangan -->
        <div class="small text-center">
          Demikian perjanjian ini dibuat dalam keadaan sadar dan tanpa paksaan.
        </div>
        
        <div class="small text-right" style="margin-top: 10px;">
          ${companyAddress.split(',')[1] || 'Tempat'}, ${dateStr}
        </div>

        <div class="signature-box">
          <div class="sign-area">
            <div class="small">Pihak Pertama</div>
            <div class="small">(Kreditur)</div>
            <div class="sign-line"></div>
            <div class="bold small">${officerName}</div>
          </div>
          
          <div class="sign-area">
            <div class="small">Pihak Kedua</div>
            <div class="small">(Debitur)</div>
            <div class="sign-line"></div>
            <div class="bold small">${customer.name}</div>
          </div>
        </div>

        <div class="text-center small" style="margin-top: 20px; font-style: italic;">
          * Simpan struk perjanjian ini sebagai bukti transaksi yang sah.
        </div>
      </body>
    </html>
  `;

  try {
    await printOrShareHtml(html);
  } catch (error) {
    console.error('Print error:', error);
    throw new Error('Gagal mencetak dokumen');
  }
};

interface PrintEmployeeWithdrawalReceiptParams {
  employeeName: string;
  amount: number;
  createdAt: Date;
  actorName?: string;
  notes?: string;
  company?: {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string;
  };
  receiptNumber?: string;
  paperWidthMm?: number;
}

export const generateEmployeeWithdrawalReceiptPDF = async (params: PrintEmployeeWithdrawalReceiptParams) => {
  const today = params.createdAt || new Date();
  const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const receiptNo =
    params.receiptNumber || `WD/${today.getFullYear()}/${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  const companyName = params.company?.name || 'SSAFA KREDIT';
  const companyAddress = params.company?.address || 'Jl. Contoh No. 123, Kota, Provinsi';
  const companyPhone = params.company?.phone || '0812-3456-7890';
  const paperWidthMm = params.paperWidthMm || DEFAULT_THERMAL_WIDTH_MM;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #000;
            margin: 0;
            padding: 18px;
            background-color: #fff;
            width: 100%;
            max-width: ${paperWidthMm}mm;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .double-divider { border-top: 2px double #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .small { font-size: 10px; }
        </style>
      </head>
      <body>
        ${companyHeaderHtml({ name: companyName, address: companyAddress, phone: companyPhone, logoUrl: params.company?.logoUrl })}
        <div class="double-divider"></div>
        <div class="text-center bold" style="font-size: 14px;">STRUK PENARIKAN</div>
        <div class="text-center small">No: ${receiptNo}</div>
        <div class="text-center small">${dateStr} ${timeStr}</div>
        <div class="divider"></div>
        <div class="row"><div>Karyawan</div><div class="bold">${escapeHtml(params.employeeName)}</div></div>
        <div class="row"><div>Nominal</div><div class="bold">${escapeHtml(formatCurrency(params.amount))}</div></div>
        <div class="row"><div>Petugas</div><div>${escapeHtml(params.actorName || 'Admin')}</div></div>
        ${params.notes ? `<div class="divider"></div><div class="small">Catatan:</div><div class="small">${escapeHtml(params.notes)}</div>` : ''}
        <div class="double-divider"></div>
        <div class="text-center small" style="margin-top: 8px;">
          Simpan struk ini sebagai bukti penarikan.
        </div>
      </body>
    </html>
  `;

  try {
    await printOrShareHtml(html);
  } catch (error) {
    console.error('Print error:', error);
    throw new Error('Gagal mencetak struk');
  }
};

interface PrintPaymentReceiptParams {
  receiptNumber: string;
  createdAt: Date;
  customerName: string;
  customerId: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  collectorName?: string;
  remainingDebt?: number;
  notes?: string;
  paymentReference?: string;
  company?: {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string;
  };
  paperWidthMm?: number;
}

export const generatePaymentReceiptPDF = async (params: PrintPaymentReceiptParams) => {
  const today = params.createdAt || new Date();
  const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const companyName = params.company?.name || 'SSAFA KREDIT';
  const companyAddress = params.company?.address || 'Jl. Contoh No. 123, Kota, Provinsi';
  const companyPhone = params.company?.phone || '0812-3456-7890';
  const paperWidthMm = params.paperWidthMm || DEFAULT_THERMAL_WIDTH_MM;

  const methodLabel = params.paymentMethod === 'transfer' ? 'TRANSFER' : 'CASH';
  const remainingDebt =
    typeof params.remainingDebt === 'number' && Number.isFinite(params.remainingDebt) ? params.remainingDebt : null;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #000;
            margin: 0;
            padding: 18px;
            background-color: #fff;
            width: 100%;
            max-width: ${paperWidthMm}mm;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .double-divider { border-top: 2px double #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .small { font-size: 10px; }
        </style>
      </head>
      <body>
        ${companyHeaderHtml({ name: companyName, address: companyAddress, phone: companyPhone, logoUrl: params.company?.logoUrl })}

        <div class="double-divider"></div>

        <div class="text-center bold" style="font-size: 14px;">BUKTI PEMBAYARAN</div>
        <div class="text-center small">No: ${params.receiptNumber}</div>
        <div class="text-center small">${dateStr} ${timeStr}</div>

        <div class="divider"></div>

        <div class="row"><div>Nasabah</div><div class="bold">${escapeHtml(params.customerName)}</div></div>
        <div class="row"><div>ID</div><div>${escapeHtml(params.customerId)}</div></div>
        <div class="row"><div>Metode</div><div class="bold">${methodLabel}</div></div>
        ${params.paymentReference ? `<div class="row"><div>Ref</div><div>${escapeHtml(params.paymentReference)}</div></div>` : ''}

        <div class="divider"></div>

        <div class="row bold"><div>Nominal</div><div>${escapeHtml(formatCurrency(params.amount || 0))}</div></div>
        ${remainingDebt != null ? `<div class="row"><div>Sisa Utang</div><div>${escapeHtml(formatCurrency(remainingDebt))}</div></div>` : ''}

        ${params.collectorName ? `<div class="row"><div>Petugas</div><div>${escapeHtml(params.collectorName)}</div></div>` : ''}

        ${params.notes ? `<div class="divider"></div><div class="small">Catatan: ${escapeHtml(params.notes)}</div>` : ''}

        <div class="double-divider"></div>
        <div class="text-center small" style="font-style: italic;">Terima kasih</div>
      </body>
    </html>
  `;

  try {
    await printOrShareHtml(html);
  } catch (error) {
    console.error('Print error:', error);
    throw new Error('Gagal membuat bukti pembayaran');
  }
};

export const generatePaymentsHistoryPDF = async (params: {
  title?: string;
  customerName: string;
  customerId: string;
  items: Array<{
    id: string;
    receiptNumber?: string;
    createdAt: Date;
    amount: number;
    paymentMethod: 'cash' | 'transfer';
    collectorName?: string;
    paymentReference?: string;
    notes?: string;
  }>;
  startDate?: Date | null;
  endDate?: Date | null;
  officerName: string;
  company?: {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string;
  };
  paperWidthMm?: number;
}) => {
  const paperWidthMm = params.paperWidthMm || DEFAULT_THERMAL_WIDTH_MM;
  const companyName = params.company?.name || 'SSAFA KREDIT';
  const companyAddress = params.company?.address || 'Jl. Contoh No. 123, Kota, Provinsi';
  const companyPhone = params.company?.phone || '0812-3456-7890';

  const periodLabel = (() => {
    const from = params.startDate ? params.startDate.toLocaleDateString('id-ID') : null;
    const to = params.endDate ? params.endDate.toLocaleDateString('id-ID') : null;
    if (from && to) return `${from} - ${to}`;
    if (from) return `Mulai ${from}`;
    if (to) return `Sampai ${to}`;
    return 'Semua Periode';
  })();

  const total = params.items.reduce((acc, it) => acc + (it.amount || 0), 0);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #000;
            margin: 0;
            padding: 18px;
            background-color: #fff;
            width: 100%;
            max-width: ${paperWidthMm}mm;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .double-divider { border-top: 2px double #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
          .small { font-size: 10px; }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; padding: 2px 0; }
          .muted { color: #333; }
        </style>
      </head>
      <body>
        ${companyHeaderHtml({ name: companyName, address: companyAddress, phone: companyPhone, logoUrl: params.company?.logoUrl })}
        <div class="double-divider"></div>
        <div class="text-center bold" style="font-size: 14px;">${escapeHtml(params.title || 'RIWAYAT PEMBAYARAN')}</div>
        <div class="text-center small">${escapeHtml(periodLabel)}</div>
        <div class="divider"></div>
        <div class="row"><div>Nasabah</div><div class="bold">${escapeHtml(params.customerName)}</div></div>
        <div class="row"><div>ID</div><div>${escapeHtml(params.customerId)}</div></div>
        <div class="row"><div>Petugas</div><div>${escapeHtml(params.officerName)}</div></div>
        <div class="divider"></div>
        <div class="row bold"><div>Total</div><div>${escapeHtml(formatCurrency(total))}</div></div>
        <div class="divider"></div>
        <table>
          ${params.items
            .map((it) => {
              const dt = it.createdAt;
              const dtStr = `${dt.toLocaleDateString('id-ID')} ${dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
              const method = it.paymentMethod === 'transfer' ? 'TRANSFER' : 'CASH';
              const right = escapeHtml(formatCurrency(it.amount || 0));
              const receipt = it.receiptNumber ? ` • ${escapeHtml(it.receiptNumber)}` : '';
              const collector = it.collectorName ? ` • ${escapeHtml(it.collectorName)}` : '';
              const ref = it.paymentReference ? ` • Ref:${escapeHtml(it.paymentReference)}` : '';
              const notes = it.notes ? ` • ${escapeHtml(it.notes)}` : '';
              return `
                <tr>
                  <td style="width: 70%;">
                    <div class="small muted">${escapeHtml(dtStr)}${receipt}${collector}${ref}</div>
                    ${notes ? `<div class="small muted">${notes}</div>` : ''}
                  </td>
                  <td style="width: 30%; text-align: right;">
                    <div class="bold">${right}</div>
                    <div class="small muted">${method}</div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </table>
        <div class="double-divider"></div>
        <div class="text-center small">Kontak: ${escapeHtml(companyPhone)}</div>
      </body>
    </html>
  `;

  try {
    await printOrShareHtml(html);
  } catch (error) {
    console.error('Print error:', error);
    throw new Error('Gagal mencetak riwayat pembayaran');
  }
};

export const generateEmployeeWithdrawalsHistoryPDF = async (params: {
  title?: string;
  employeeName?: string;
  items: Array<{
    id: string;
    employeeName: string;
    createdAt: Date;
    amount: number;
    status: string;
    actorName?: string;
    notes?: string;
  }>;
  startDate?: Date | null;
  endDate?: Date | null;
  officerName: string;
  company?: {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string;
  };
  paperWidthMm?: number;
}) => {
  const paperWidthMm = params.paperWidthMm || DEFAULT_THERMAL_WIDTH_MM;
  const companyName = params.company?.name || 'SSAFA KREDIT';
  const companyAddress = params.company?.address || 'Jl. Contoh No. 123, Kota, Provinsi';
  const companyPhone = params.company?.phone || '0812-3456-7890';

  const periodLabel = (() => {
    const from = params.startDate ? params.startDate.toLocaleDateString('id-ID') : null;
    const to = params.endDate ? params.endDate.toLocaleDateString('id-ID') : null;
    if (from && to) return `${from} - ${to}`;
    if (from) return `Mulai ${from}`;
    if (to) return `Sampai ${to}`;
    return 'Semua Periode';
  })();

  const total = params.items.reduce((acc, it) => acc + (it.amount || 0), 0);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #000;
            margin: 0;
            padding: 18px;
            background-color: #fff;
            width: 100%;
            max-width: ${paperWidthMm}mm;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .double-divider { border-top: 2px double #000; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; padding: 2px 0; }
          .small { font-size: 10px; }
          .muted { color: #333; }
        </style>
      </head>
      <body>
        ${companyHeaderHtml({ name: companyName, address: companyAddress, phone: companyPhone, logoUrl: params.company?.logoUrl })}
        <div class="double-divider"></div>
        <div class="text-center bold" style="font-size: 14px;">${escapeHtml(params.title || 'RIWAYAT PENARIKAN')}</div>
        <div class="text-center small">${escapeHtml(periodLabel)}</div>
        <div class="divider"></div>
        <div class="row"><div>Karyawan</div><div class="bold">${escapeHtml(params.employeeName || 'Semua Karyawan')}</div></div>
        <div class="row"><div>Petugas</div><div>${escapeHtml(params.officerName)}</div></div>
        <div class="divider"></div>
        <div class="row bold"><div>Total</div><div>${escapeHtml(formatCurrency(total))}</div></div>
        <div class="divider"></div>
        <table>
          ${params.items
            .map((it) => {
              const dt = it.createdAt;
              const dtStr = `${dt.toLocaleDateString('id-ID')} ${dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
              const notes = it.notes ? ` • ${escapeHtml(it.notes)}` : '';
              return `
                <tr>
                  <td style="width: 70%;">
                    <div class="small muted">${escapeHtml(it.employeeName)} • ${escapeHtml(dtStr)} • ${escapeHtml(it.status)}</div>
                    ${notes ? `<div class="small muted">${notes}</div>` : ''}
                  </td>
                  <td style="width: 30%; text-align: right;">
                    <div class="bold">${escapeHtml(formatCurrency(it.amount || 0))}</div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </table>
        <div class="double-divider"></div>
        <div class="text-center small">Kontak: ${escapeHtml(companyPhone)}</div>
      </body>
    </html>
  `;

  try {
    await printOrShareHtml(html);
  } catch (error) {
    console.error('Print error:', error);
    throw new Error('Gagal mencetak riwayat penarikan');
  }
};

export const generateProfitSharesHistoryPDF = async (params: {
  title?: string;
  employeeName?: string;
  items: Array<{
    id: string;
    customerName: string;
    createdAt: Date;
    paymentAmount: number;
    profitShareAmount: number;
    percentage: number;
    status: string;
    collectorName?: string;
    notes?: string;
  }>;
  startDate?: Date | null;
  endDate?: Date | null;
  officerName: string;
  company?: {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string;
  };
  paperWidthMm?: number;
}) => {
  const paperWidthMm = params.paperWidthMm || DEFAULT_THERMAL_WIDTH_MM;
  const companyName = params.company?.name || 'SSAFA KREDIT';
  const companyAddress = params.company?.address || 'Jl. Contoh No. 123, Kota, Provinsi';
  const companyPhone = params.company?.phone || '0812-3456-7890';

  const periodLabel = (() => {
    const from = params.startDate ? params.startDate.toLocaleDateString('id-ID') : null;
    const to = params.endDate ? params.endDate.toLocaleDateString('id-ID') : null;
    if (from && to) return `${from} - ${to}`;
    if (from) return `Mulai ${from}`;
    if (to) return `Sampai ${to}`;
    return 'Semua Periode';
  })();

  const totalSetoran = params.items.reduce((acc, it) => acc + (it.paymentAmount || 0), 0);
  const totalKomisi = params.items.reduce((acc, it) => acc + (it.profitShareAmount || 0), 0);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #000;
            margin: 0;
            padding: 18px;
            background-color: #fff;
            width: 100%;
            max-width: ${paperWidthMm}mm;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .double-divider { border-top: 2px double #000; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; padding: 2px 0; }
          .small { font-size: 10px; }
          .muted { color: #333; }
        </style>
      </head>
      <body>
        ${companyHeaderHtml({ name: companyName, address: companyAddress, phone: companyPhone, logoUrl: params.company?.logoUrl })}
        <div class="double-divider"></div>
        <div class="text-center bold" style="font-size: 14px;">${escapeHtml(params.title || 'RIWAYAT SETORAN')}</div>
        <div class="text-center small">${escapeHtml(periodLabel)}</div>
        <div class="divider"></div>
        <div class="row"><div>Karyawan</div><div class="bold">${escapeHtml(params.employeeName || 'Semua Karyawan')}</div></div>
        <div class="row"><div>Petugas</div><div>${escapeHtml(params.officerName)}</div></div>
        <div class="divider"></div>
        <div class="row bold"><div>Total Setoran</div><div>${escapeHtml(formatCurrency(totalSetoran))}</div></div>
        <div class="row bold"><div>Total Komisi</div><div>${escapeHtml(formatCurrency(totalKomisi))}</div></div>
        <div class="divider"></div>
        <table>
          ${params.items
            .map((it) => {
              const dt = it.createdAt;
              const dtStr = `${dt.toLocaleDateString('id-ID')} ${dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
              const notes = it.notes ? ` • ${escapeHtml(it.notes)}` : '';
              const pct = Number.isFinite(it.percentage) ? it.percentage : 0;
              return `
                <tr>
                  <td style="width: 68%;">
                    <div class="bold">${escapeHtml(it.customerName)}</div>
                    <div class="small muted">${escapeHtml(dtStr)} • ${escapeHtml(it.status)} • ${escapeHtml(String(pct))}%</div>
                    ${notes ? `<div class="small muted">${notes}</div>` : ''}
                  </td>
                  <td style="width: 32%; text-align: right;">
                    <div class="small muted">Setoran</div>
                    <div class="bold">${escapeHtml(formatCurrency(it.paymentAmount || 0))}</div>
                    <div class="small muted" style="margin-top: 2px;">Komisi</div>
                    <div class="bold">${escapeHtml(formatCurrency(it.profitShareAmount || 0))}</div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </table>
        <div class="double-divider"></div>
        <div class="text-center small">Kontak: ${escapeHtml(companyPhone)}</div>
      </body>
    </html>
  `;

  try {
    await printOrShareHtml(html);
  } catch (error) {
    console.error('Print error:', error);
    throw new Error('Gagal mencetak riwayat setoran');
  }
};

function escapeCsvCell(value: string) {
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export async function shareCsv(params: { fileName: string; headers: string[]; rows: (string | number | null | undefined)[][] }) {
  const lines: string[] = [];
  lines.push(params.headers.map((h) => escapeCsvCell(String(h))).join(','));
  for (const row of params.rows) {
    lines.push(
      row
        .map((cell) => {
          if (cell === null || typeof cell === 'undefined') return '';
          return escapeCsvCell(String(cell));
        })
        .join(',')
    );
  }
  const csv = lines.join('\n');

  const safeFileName = params.fileName.endsWith('.csv') ? params.fileName : `${params.fileName}.csv`;
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }

  const file = new FileSystem.File(FileSystem.Paths.document, safeFileName);
  file.create({ intermediates: true, overwrite: true });
  file.write(csv, { encoding: 'utf8' });
  await shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}
