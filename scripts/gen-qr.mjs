import QRCode from 'qrcode';

const URL = 'https://gains-dominant-largest-heater.trycloudflare.com';

const opts = {
  type: 'png',
  width: 500,
  margin: 3,
  color: { dark: '#0f172a', light: '#f1f5f9' },
  errorCorrectionLevel: 'H'
};

QRCode.toFile('public/fleet-gate-qr.png', URL, opts, (err) => {
  if (err) { console.error('public QR error:', err); process.exit(1); }
  console.log('✅ public/fleet-gate-qr.png generated');
});

QRCode.toFile('dist/fleet-gate-qr.png', URL, opts, (err) => {
  if (err) { console.error('dist QR error:', err); process.exit(1); }
  console.log('✅ dist/fleet-gate-qr.png generated');
});
