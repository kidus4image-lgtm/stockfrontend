const next = require('next');
const { createServer } = require('http');

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000);
});
