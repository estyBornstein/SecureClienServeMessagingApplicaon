const selfsigned = require(require.resolve('selfsigned', { paths: [require('path').join(__dirname, '..', 'backend')] }));
const fs = require('fs');
const path = require('path');

const certsDir = __dirname;
const keyPath = path.join(certsDir, 'server.key');
const certPath = path.join(certsDir, 'server.cert');

if (fs.existsSync(keyPath) && fs.existsSync(certPath) && !process.argv.includes('--force')) {
  console.log('Certificates already exist. Use --force to regenerate.');
  process.exit(0);
}

const attrs = [{ name: 'commonName', value: 'localhost' }];

(async () => {
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' },
        ],
      },
    ],
  });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  console.log('Self-signed certificates generated successfully.');
  console.log(`  Key:  ${keyPath}`);
  console.log(`  Cert: ${certPath}`);
})();
