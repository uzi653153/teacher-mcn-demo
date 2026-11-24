// 本地开发默认连本机后端
// 真机调试：改成电脑的局域网 IP，例如 http://192.168.1.10:3000
// 正式环境：必须使用 HTTPS，并在小程序管理后台配置 request 合法域名
module.exports = {
  baseUrl: 'http://127.0.0.1:3000',
  timeout: 10000,
  pageSize: 10,
  defaultNickname: '同学'
}
