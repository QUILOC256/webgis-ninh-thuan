// backend/routes/ahpRoutes.js
const express = require("express");
const router = express.Router();
const ahp = require("../controllers/ahpController");

// helper: bắt lỗi async (đỡ crash khi deploy)
const asyncWrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Health check riêng cho module AHP
router.get("/health", (_req, res) => {
  res.json({ ok: true, module: "ahp" });
});

// Routes chính
router.get("/criteria", asyncWrap(ahp.getCriteria));
router.post("/calc", asyncWrap(ahp.calcAHP));
router.post("/save", asyncWrap(ahp.saveWeights));
router.get("/latest", asyncWrap(ahp.getLatestSession));

module.exports = router;
