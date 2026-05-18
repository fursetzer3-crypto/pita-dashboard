const http = require('http');
const options = {
  hostname: 'localhost',
  port: 3690,
  path: '/api/agents',
  method: 'GET'
};
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log(data);
    process.exit(0);
  });
});
req.on('error', (err) => {
  console.error('ERROR', err.message);
  process.exit(1);
});
req.end();
