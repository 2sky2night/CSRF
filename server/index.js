const http = require('http').createServer(middleware).listen(3000)
const fs = require('fs')
const path = require('path')

// 用户表
const userModel = [
  {
    uid: 1,
    username: 'Mark',
    password: '123456',
    money: 9999
  },
  {
    uid: 2,
    username: 'Hack',
    password: '123456',
    money: 0
  }
]

// 需要鉴权的路径
const authPathlist = ['/', '/api/transfer']

// 路由表
/**
 * @type {{path:string;handler:(req:import('http').IncomingMessage&{pathname:string;query:Record<string,any>;cookie:Record<string,any>;uid?:number},res:import('http').ServerResponse)=>void}[]}
 */
const routes = [
  // 用户首页
  {
    path: '/',
    handler(req, res) {
      const user = findUser(req.uid)
      res.setHeader('Content-Type', 'text/html;charset=utf-8')
      res.end(renderView(user))
    }
  },
  // 登陆页面
  {
    path: '/login.html',
    handler(req, res) {
      res.setHeader('Content-Type', 'text/html;charset=utf-8')
      const rs = new fs.createReadStream(
        path.resolve(__dirname, './client/login.html'),
        'utf-8'
      )
      rs.pipe(res)
    }
  },
  // 登录接口
  {
    path: '/api/login',
    handler(req, res) {
      res.setHeader('Content-Type', 'application/json;charset=utf-8')
      const user = userModel.find(
        (item) =>
          item.password === req.query.password &&
          item.username === req.query.username
      )
      if (user) {
        // cookie的属性字段
        // 1.path:设置cookie哪些路径可以携带cookie，默认path为当前请求的pathname，若想要所以路径都可以自动携带上cookie

        // 设置多个cookie的方式
        res.setHeader('set-cookie', [
          `uid=${user.uid}; path=/; SameSite=none; Secure; `,
          'test=123;path=/;'
        ])
        // 设置一个cookie
        // res.setHeader('set-cookie', `uid=${user.uid};path=/;`)

        res.end(
          JSON.stringify({
            code: 200,
            data: null,
            msg: 'ok!'
          })
        )
      } else {
        res.statusCode = 400
        res.end(
          JSON.stringify({
            code: 400,
            data: null,
            msg: '用户名或密码错误!'
          })
        )
      }
    }
  },
  // 转账接口
  {
    path: '/api/transfer',
    handler(req, res) {
      const { uid: _uid, money: _money } = req.query
      const uid = +_uid
      const money = +_money
      if (isNaN(uid) || isNaN(money)) {
        res.statusCode = 400
        res.end(
          JSON.stringify({
            code: 400,
            data: null,
            msg: '参数错误!'
          })
        )
        return
      }
      const s_user = findUser(req.uid)
      const t_user = findUser(uid)
      s_user.money -= money
      t_user.money += money
      res.setHeader('Content-Type', 'application/json;charset=utf-8')
      console.log(
        `用户:${s_user.username}的账户余额发生变动，现在余额为:${s_user.money}。转账了${money}给了${t_user.username}`
      )
      res.end(
        JSON.stringify({
          code: 200,
          data: `${s_user.username},Your money is ${s_user.money}.`,
          msg: 'ok'
        })
      )
    }
  }
]

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function middleware(req, res) {
  // 0.解析cookie
  resolveCookie(req)
  // 1.解析url
  const { pathname, query } = resolveUrl(req.url)
  // 2.注入查询参数和路径
  req.pathname = pathname
  req.query = query
  // 2.5校验是否需要cookie鉴权
  if (!resolveWhiteList(req, res)) {
    return
  }
  // 3.匹配路由
  const item = routes.find((route) => route.path === pathname)
  if (item) {
    item.handler(req, res)
  } else {
    res.statusCode = 404
    res.end('404 not found!')
  }
}

/**
 * 解析url参数
 * @param {string} url
 */
function resolveUrl(url) {
  const [pathname, queryString] = url.split('?')
  if (queryString) {
    return {
      pathname,
      query: queryString.split('&').reduce((obj, item) => {
        const [key, value] = item.split('=')
        return {
          ...obj,
          [key]: value
        }
      }, {})
    }
  } else {
    return {
      pathname,
      query: {}
    }
  }
}

/**
 * 解析cookie
 * @param {import('http').IncomingMessage} req
 */
function resolveCookie(req) {
  if (req.headers.cookie) {
    const cookie = req.headers.cookie.split('; ')
    req.cookie = cookie.reduce((obj, item) => {
      const [key, value] = item.split('=')
      return {
        ...obj,
        [key]: value
      }
    }, {})
  } else {
    req.cookie = {}
  }
}

/**
 * 用户主页
 * @param {typeof userModel[0]} user
 */
function renderView(user) {
  return `
    <h1>你好，${user.username}</h1>
    <p>你的余额为:$${user.money}</p>
  `
}

/**
 * 查找用户
 * @param {string|number} uid
 */
function findUser(uid) {
  const _uid = +uid
  if (isNaN(_uid)) {
    return null
  } else {
    const user = userModel.find((item) => item.uid === _uid)
    if (user) {
      return user
    } else {
      return null
    }
  }
}

/**
 * 白名单过滤器
 * @param {import('http').IncomingMessage&{cookie:Record<string,any>;pathname:string}} req
 * @param {import('http').ServerResponse} res
 */
function resolveWhiteList(req, res) {
  if (authPathlist.includes(req.pathname)) {
    if (req.cookie.uid) {
      const result = findUser(req.cookie.uid)
      if (result) {
        req.uid = +req.cookie.uid
        return true
      } else {
        res.setHeader('Content-Type', 'text/json;charset=utf-8')
        // 未携带uid
        res.statusCode = 401
        res.end(
          JSON.stringify({
            code: 401,
            data: null,
            msg: '身份校验失败!'
          })
        )
        return false
      }
    } else {
      res.setHeader('Content-Type', 'text/json;charset=utf-8')
      // 未携带uid
      res.statusCode = 401
      res.end(
        JSON.stringify({
          code: 401,
          data: null,
          msg: '身份校验失败!'
        })
      )
      return false
    }
  }
  // 放行
  return true
}
