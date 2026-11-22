import QRCode from 'qrcode';

const URL = 'https://fleetgate.onrender.com';

const opts = {
  type: 'png',
  width: 500,
  margin: 3,
  color: { dark: '#0f172a', light: '#f1f5f9' },
  errorCorrectionLevel: 'H'
};

QRCode.toFile('public/fleet-gate-qr.png', URL, opts, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log('✅ QR saved → public/fleet-gate-qr.png');
});
