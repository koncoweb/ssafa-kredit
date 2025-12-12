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
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
            margin: 0;
            padding: 10px;
            background-color: #fff;
            width: 100%; 
            max-width: 380px;
            margin: 0 auto; 
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .double-divider { border-top: 2px double #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .small { font-size: 10px; }
          .header { margin-bottom: 10px; }
          .item-name { margin-bottom: 2px; font-weight: bold;}
        </style>
      </head>
      <body>
        <div class="header text-center">
          <div class="bold" style="font-size: 16px;">${companyName}</div>
          <div class="small">${companyAddress}</div>
          <div class="small">${companyPhone}</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="row small">
          <div>${dateStr}</div>
          <div>${docNumber}</div>
        </div>
        <div class="row small">
          <div>Admin: ${officerName}</div>
        </div>

        <div class="divider"></div>

        <div class="small">PELANGGAN:</div>
        <div class="bold">${customer.name}</div>
        <div class="small">${customer.address}</div>
        <div class="small">${customer.phone}</div>

        <div class="divider"></div>

        <div class="item-name">${product.name}</div>
        <div class="row">
          <div>Harga Cash</div>
          <div>${formatCurrency(product.priceCash)}</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="row">
          <div>Total Kredit</div>
          <div class="bold">${formatCurrency(transaction.priceCredit)}</div>
        </div>
        <div class="row">
          <div>Uang Muka (DP)</div>
          <div>${formatCurrency(transaction.downPayment)}</div>
        </div>
        <div class="row">
          <div>Sisa Pokok</div>
          <div>${formatCurrency(transaction.principal)}</div>
        </div>
        
        <div class="double-divider"></div>
        
        <div class="text-center bold" style="margin-bottom: 5px;">Rincian Angsuran</div>
        <div class="row bold" style="font-size: 14px;">
          <div>Cicilan x${transaction.tenorCount}</div>
          <div>${formatCurrency(transaction.installmentAmount)}</div>
        </div>
        <div class="text-center small">(${transaction.tenorType === 'weekly' ? 'Mingguan' : transaction.tenorType === 'daily' ? 'Harian' : 'Bulanan'})</div>

        <div class="divider"></div>
        
        <div class="text-center bold" style="margin-bottom: 5px;">Jadwal Pembayaran</div>
        ${schedule.map(s => `
          <div class="row small">
            <div style="width: 20px;">${s.installment}.</div>
            <div style="flex: 1;">${s.date}</div>
            <div>${formatCurrency(transaction.installmentAmount)}</div>
          </div>
        `).join('')}

        <div class="divider"></div>
        
        <div class="small text-center" style="margin-top: 15px;">
          Saya menyetujui ketentuan kredit ini.<br>
          Barang yang dibeli tidak dapat dikembalikan.
        </div>

        <br><br><br>
        <div class="text-center">
          ( ${customer.name} )
        </div>
        <div class="text-center small">Tanda Tangan Pelanggan</div>

        <div class="divider"></div>
        <div class="text-center small">Terima Kasih</div>
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
