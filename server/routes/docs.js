const express = require('express')

const router = express.Router()

const GROUPS = [
  {
    title: '基础',
    items: [
      { method: 'GET', path: '/api/health', desc: '健康检查（含数据库与缓存状态）', auth: '否' },
      { method: 'GET', path: '/api/docs', desc: '接口文档（当前页面）', auth: '否' }
    ]
  },
  {
    title: '账号',
    items: [
      { method: 'POST', path: '/api/auth/register', desc: '注册：{ username, password, nickname }', auth: '否' },
      { method: 'POST', path: '/api/auth/login', desc: '登录，返回 token 与用户信息', auth: '否' },
      { method: 'POST', path: '/api/auth/wx-login', desc: '微信静默登录：{ code }，首次自动建号并返回 token', auth: '否' },
      { method: 'GET', path: '/api/auth/me', desc: '当前登录用户', auth: '是' }
    ]
  },
  {
    title: '名师',
    items: [
      { method: 'GET', path: '/api/teachers', desc: '名师列表：category / keyword / page / pageSize', auth: '否' },
      { method: 'GET', path: '/api/teachers/:id', desc: '名师详情', auth: '否' },
      { method: 'GET', path: '/api/teachers/compare?ids=1,2,3', desc: '2-3 位名师对比', auth: '否' }
    ]
  },
  {
    title: '收藏',
    items: [
      { method: 'GET', path: '/api/favorites', desc: '我的收藏列表', auth: '是' },
      { method: 'GET', path: '/api/favorites/ids', desc: '我的收藏 ID 列表', auth: '是' },
      { method: 'POST', path: '/api/favorites/:teacherId', desc: '收藏名师', auth: '是' },
      { method: 'DELETE', path: '/api/favorites/:teacherId', desc: '取消收藏', auth: '是' }
    ]
  },
  {
    title: '预约',
    items: [
      { method: 'POST', path: '/api/bookings', desc: '提交预约：{ teacherId, name, phone, stage, remark }', auth: '否' },
      { method: 'GET', path: '/api/bookings', desc: '我的预约（需 X-Client-Id，登录后按用户聚合）', auth: '可选' },
      { method: 'PATCH', path: '/api/bookings/:id/cancel', desc: '取消预约', auth: '可选' },
      { method: 'GET', path: '/api/admin/bookings?status=0', desc: '管理员查看预约', auth: '管理员' },
      { method: 'PATCH', path: '/api/admin/bookings/:id/status', desc: '预约状态流转：0 待联系 → 1 已联系 / 2 已取消', auth: '管理员' }
    ]
  },
  {
    title: '直播课',
    items: [
      { method: 'GET', path: '/api/courses?status=live', desc: '课程列表：all / upcoming / live / ended', auth: '可选' },
      { method: 'GET', path: '/api/courses/:id', desc: '课程详情（含报名状态）', auth: '可选' },
      { method: 'GET', path: '/api/courses/mine', desc: '我报名的课程', auth: '是' },
      { method: 'POST', path: '/api/courses/:id/enroll', desc: '报名课程（事务防超卖）', auth: '是' },
      { method: 'DELETE', path: '/api/courses/:id/enroll', desc: '取消报名', auth: '是' }
    ]
  },
  {
    title: '搜索与消息',
    items: [
      { method: 'GET', path: '/api/search/hot?limit=8', desc: '热搜榜（Redis ZSET）', auth: '否' },
      { method: 'POST', path: '/api/search/record', desc: '记录搜索词：{ keyword }', auth: '否' },
      { method: 'GET', path: '/api/notifications', desc: '消息列表（分页）', auth: '是' },
      { method: 'GET', path: '/api/notifications/unread-count', desc: '未读消息数', auth: '是' },
      { method: 'PATCH', path: '/api/notifications/:id/read', desc: '标记单条已读', auth: '是' },
      { method: 'PATCH', path: '/api/notifications/read-all', desc: '全部标记已读', auth: '是' }
    ]
  },
  {
    title: '管理后台',
    items: [
      { method: 'GET', path: '/api/admin/stats', desc: '数据看板：预约、用户、收藏、名师热度、7 日趋势', auth: '管理员' },
      { method: 'GET', path: '/api/admin/teachers', desc: '全部名师（含下架）', auth: '管理员' },
      { method: 'POST', path: '/api/admin/teachers', desc: '新增名师', auth: '管理员' },
      { method: 'PATCH', path: '/api/admin/teachers/:id', desc: '编辑名师 / 上下架：{ status: 0|1 }', auth: '管理员' },
      { method: 'POST', path: '/api/admin/teachers/upload', desc: '上传名师头像（multipart，字段名 file）', auth: '管理员' }
    ]
  }
]

const METHOD_COLORS = {
  GET: '#0BA5EC',
  POST: '#12B76A',
  PATCH: '#F79009',
  DELETE: '#F04438'
}

function renderHtml() {
  const sections = GROUPS.map(
    group => `
      <section>
        <h2>${group.title}</h2>
        <div class="table">
          <div class="row head">
            <span>方法</span><span>路径</span><span>说明</span><span>鉴权</span>
          </div>
          ${group.items
            .map(
              item => `
            <div class="row">
              <span class="method" style="color:${METHOD_COLORS[item.method] || '#5B6475'}">${item.method}</span>
              <code>${item.path}</code>
              <span class="desc">${item.desc}</span>
              <span class="auth">${item.auth}</span>
            </div>`
            )
            .join('')}
        </div>
      </section>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>有因有果 · 接口文档</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 24px 80px; background: #F5F7FB; color: #1A2233;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { margin: 0 0 8px; font-size: 28px; }
  .sub { margin: 0 0 8px; color: #5B6475; }
  .tip { padding: 14px 18px; margin: 20px 0 32px; background: #EEF2FF; border-radius: 12px;
    color: #2B4ACB; font-size: 14px; line-height: 1.7; }
  h2 { margin: 34px 0 12px; font-size: 18px; }
  .table { background: #fff; border-radius: 16px; overflow: hidden;
    box-shadow: 0 8px 28px rgba(26,34,51,.06); }
  .row { display: grid; grid-template-columns: 92px 1.15fr 1.6fr 76px; gap: 12px;
    padding: 13px 20px; align-items: center; border-top: 1px solid #EDF0F5; font-size: 13px; }
  .row.head { border-top: none; background: #FAFBFE; color: #98A2B3; font-size: 12px; }
  .method { font-weight: 700; font-size: 12px; letter-spacing: .5px; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; color: #2B4ACB;
    word-break: break-all; }
  .desc { color: #5B6475; line-height: 1.6; }
  .auth { color: #98A2B3; font-size: 12px; }
  .foot { margin-top: 28px; color: #98A2B3; font-size: 12px; }
  @media (max-width: 720px) {
    .row { grid-template-columns: 64px 1fr; }
    .row .desc, .row .auth { display: none; }
  }
</style>
</head>
<body>
<main>
  <h1>有因有果 · 接口文档</h1>
  <p class="sub">Express 5 + MySQL + Redis，统一响应结构 { code, message, data }</p>
  <div class="tip">
    需要登录的接口请携带 <code>Authorization: Bearer &lt;token&gt;</code>；预约相关接口需携带
    <code>X-Client-Id</code>。演示账号：admin / admin123（管理员），student / student123（学员）。
  </div>
  ${sections}
  <p class="foot">小提示：所有响应头包含 X-Request-Id，排查问题时可直接提供该值检索日志。</p>
</main>
</body>
</html>`
}

router.get('/', (req, res) => {
  res.type('html').send(renderHtml())
})

module.exports = router
