const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')

const uploadDir = path.join(__dirname, 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

const EXT_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const ext = EXT_MAP[file.mimetype] || '.jpg'
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!EXT_MAP[file.mimetype]) {
      const err = new Error('仅支持 jpg / png / webp / gif 图片')
      err.code = 'UNSUPPORTED_TYPE'
      return cb(err)
    }
    cb(null, true)
  }
})

module.exports = { upload, uploadDir }
