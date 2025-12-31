// backend/routes/adminRoutes.js
const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const adminAuth = require("../middlewares/adminAuth");

// =================== AUTH ===================
router.post("/login", adminController.login);
router.get("/me", adminAuth, adminController.me);

// =================== LAYER GUARD ===================
// chỉ cho phép đúng 5 lớp bạn dùng trong admin CRUD
const ALLOWED_LAYERS = new Set(["bhx", "cho", "truong", "doithu", "giaothong"]);

function layerGuard(req, res, next) {
  const layer = String(req.params.layer || "").trim().toLowerCase();
  if (!ALLOWED_LAYERS.has(layer)) {
    return res.status(400).json({
      error: "Layer không hợp lệ",
      allowed: Array.from(ALLOWED_LAYERS),
    });
  }
  // chuẩn hoá lại layer (đỡ sai hoa/thường)
  req.params.layer = layer;
  next();
}

// =================== CRUD ===================
// CRUD theo layer: bhx | cho | truong | doithu | giaothong
router.get("/:layer", adminAuth, layerGuard, adminController.list);
router.get("/:layer/:id", adminAuth, layerGuard, adminController.getOne);

router.post("/:layer", adminAuth, layerGuard, adminController.create);
router.put("/:layer/:id", adminAuth, layerGuard, adminController.update);
router.delete("/:layer/:id", adminAuth, layerGuard, adminController.remove);

module.exports = router;
