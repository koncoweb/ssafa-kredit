import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

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
  schedule: Array<{
    installment: number;
    date: string;
  }>;
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
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }
  } catch (error) {
    console.error('Print error:', error);
    throw new Error('Gagal mencetak dokumen');
  }
};
