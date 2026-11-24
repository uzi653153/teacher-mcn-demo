// 直播课种子数据
// startOffsetMin：相对初始化时间的分钟偏移（负数表示已开始），便于演示“预告 / 直播中 / 已结束”三种状态
module.exports = [
  {
    id: 1,
    title: '小学阅读理解提分公开课',
    teacherId: 1,
    teacherName: '汤圆老师',
    cover: '',
    startOffsetMin: 120,
    durationMin: 60,
    platform: '视频号',
    quota: 100,
    enrolled: 37,
    intro: '用 3 个故事化模板拆解小学阅读理解常见题型，现场带练 2 篇真题，适合 3-6 年级。'
  },
  {
    id: 2,
    title: '初中作文高分技巧直播',
    teacherId: 2,
    teacherName: '可乐老师',
    cover: '',
    startOffsetMin: -20,
    durationMin: 90,
    platform: '视频号',
    quota: 80,
    enrolled: 52,
    intro: '40 年一线语文名师现场批改作文，讲透开头、结构、升华三个得分点。'
  },
  {
    id: 3,
    title: '高中英语阅读冲刺课',
    teacherId: 3,
    teacherName: '大希老师',
    cover: '',
    startOffsetMin: 24 * 60,
    durationMin: 60,
    platform: '抖音',
    quota: 120,
    enrolled: 64,
    intro: '雅思阅读讲师带你用定位法解决高考英语阅读，附赠高频同义替换清单。'
  },
  {
    id: 4,
    title: '小升初语文衔接规划',
    teacherId: 9,
    teacherName: '清华飞姐',
    cover: '',
    startOffsetMin: -24 * 60,
    durationMin: 60,
    platform: '视频号',
    quota: 150,
    enrolled: 150,
    intro: '小升初关键节点如何规划语文学习？从阅读量、写作习惯到择校节奏一次讲清。'
  },
  {
    id: 5,
    title: '高三数学压轴题拆解',
    teacherId: 12,
    teacherName: '上交大小明老师',
    cover: '',
    startOffsetMin: 48 * 60,
    durationMin: 75,
    platform: '视频号',
    quota: 60,
    enrolled: 18,
    intro: '圆锥曲线与导数压轴题的通用拆解路径，适合目标 120+ 的高三学生。'
  }
]
