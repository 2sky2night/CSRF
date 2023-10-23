const fs = require('fs')
const path = require('path')
// 在本地调试中
// hack服务器需要在不同于域访问，例如csrf漏洞的服务器需要在127.0.0.1启动
// hack服务器在localhost中访问，保证两个服务器在不同域中
// 若在同一个域cookie本身就能被访问
require('http')
  .createServer((req, res) => {
    const rs = fs.createReadStream(
      path.resolve(__dirname, './client/index.html'),
      'utf-8'
    )
    rs.pipe(res)
  })
  .listen(3001)
