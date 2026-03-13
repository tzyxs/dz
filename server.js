const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const ROOT_DIR = __dirname;
const BACKUP_DIR_NAME = process.env.BACKUP_DIR_NAME || "backups";
const BACKUP_DIR = path.join(ROOT_DIR, BACKUP_DIR_NAME);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const sanitizeFileName = (input) => {
  const normalized = String(input || "backup").replace(/[^a-zA-Z0-9._-\u4e00-\u9fa5]/g, "_");
  return normalized.slice(0, 180);
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, BACKUP_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path.basename(file.originalname || "backup", ext);
    const safeBase = sanitizeFileName(base);
    const finalExt = ext === ".bin" || ext === ".json" ? ext : ".bin";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    cb(null, `${safeBase}_${timestamp}${finalExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ext === ".bin" || ext === ".json") {
      cb(null, true);
      return;
    }
    cb(new Error("只允许上传 .bin 或 .json 备份文件"));
  },
});

app.post("/api/backups/upload", upload.single("backupFile"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: "未接收到备份文件" });
    return;
  }

  res.json({
    success: true,
    filename: req.file.filename,
    path: `${BACKUP_DIR_NAME}/${req.file.filename}`,
    size: req.file.size,
  });
});

app.use(`/${BACKUP_DIR_NAME}`, express.static(BACKUP_DIR));
app.use(express.static(ROOT_DIR));

app.get("/api/backups/health", (_req, res) => {
  res.json({ success: true, backupDir: BACKUP_DIR_NAME });
});

app.use((error, _req, res, _next) => {
  console.error("[Backup API Error]", error);
  res.status(500).json({
    success: false,
    message: error?.message || "服务器内部错误",
  });
});

app.listen(PORT, () => {
  console.log(`电子礼簿服务已启动: http://localhost:${PORT}`);
  console.log(`备份目录: ${BACKUP_DIR}`);
});
