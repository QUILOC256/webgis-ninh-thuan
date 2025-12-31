// backend/routes/ninhthuan.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/ninhthuanController");

// helper: bắt lỗi async (đỡ crash khi deploy)
const asyncWrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Health check riêng cho module Ninh Thuận
router.get("/health", (_req, res) => {
  res.json({ ok: true, module: "ninhthuan" });
});

// ======================= API NINH THUẬN =======================
// Nhóm lớp điểm hiện trạng
router.get("/bhx-ninhthuan", asyncWrap(controller.getBHXNinhThuan)); // Bách Hóa Xanh
router.get("/cho-ninhthuan", asyncWrap(controller.getChoNinhThuan)); // Chợ
router.get(
  "/doithu-ninhthuan",
  asyncWrap(controller.getDoiThuCanhTranhNinhThuan)
); // Đối thủ cạnh tranh
router.get("/truong-ninhthuan", asyncWrap(controller.getTruongNinhThuan)); // Trường học
router.get(
  "/giaothong-ninhthuan",
  asyncWrap(controller.getGiaoThongNinhThuan)
); // Giao thông (line)
router.get(
  "/ranhgioi-ninhthuan",
  asyncWrap(controller.getRanhGioiNinhThuan)
); // Ranh giới hành chính

// ======================= LỚP BUFFER & BẢN ĐỒ VỊ TRÍ =======================

// Bản đồ vị trí tổng hợp AHP
router.get(
  "/bandovitri-ninhthuan",
  asyncWrap(controller.getBanDoViTriNinhThuan)
);

// Buffer Bách Hóa Xanh
router.get(
  "/buffer-bhx-ninhthuan",
  asyncWrap(controller.getBufferBachHoaXanhNinhThuan)
);

// Buffer Chợ
router.get(
  "/buffer-cho-ninhthuan",
  asyncWrap(controller.getBufferChoNinhThuan)
);

// Buffer Đối thủ
router.get(
  "/buffer-doithu-ninhthuan",
  asyncWrap(controller.getBufferDoiThuNinhThuan)
);

// Buffer Trường học
router.get(
  "/buffer-truong-ninhthuan",
  asyncWrap(controller.getBufferTruongNinhThuan)
);

// Buffer Giao thông
router.get(
  "/buffer-giaothong-ninhthuan",
  asyncWrap(controller.getBufferGiaoThongNinhThuan)
);

// Buffer Ranh giới / mật độ dân số
router.get(
  "/buffer-ranhgioi-ninhthuan",
  asyncWrap(controller.getBufferRanhGioiNinhThuan)
);

module.exports = router;
