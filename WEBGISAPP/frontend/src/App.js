import React, { useEffect, useState } from "react";
import MapComponent from "./components/MapComponent";
import AdminLogin from "./components/AdminLogin";
import AdminPage from "./components/AdminPage";
import { apiGet, getToken, clearToken } from "./api/apiClient";
import "./App.css";

function App() {
  // home | map | admin
  const [activeTab, setActiveTab] = useState("home");

  // null: đang check, false: chưa login, true: đã login
  const [adminOk, setAdminOk] = useState(null);

  // Khi chuyển qua tab admin thì check token
  useEffect(() => {
    if (activeTab !== "admin") return;

    const run = async () => {
      try {
        const token = getToken();
        if (!token) {
          setAdminOk(false);
          return;
        }
        // gọi /me để verify token
        await apiGet("/api/admin/me");
        setAdminOk(true);
      } catch (e) {
        clearToken();
        setAdminOk(false);
      }
    };

    run();
  }, [activeTab]);

  const handleLoggedIn = async () => {
    try {
      await apiGet("/api/admin/me");
      setAdminOk(true);
    } catch {
      setAdminOk(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setAdminOk(false);
    setActiveTab("home");
  };

  return (
    <div className="app-root">
      {/* HEADER TRÊN CÙNG */}
      <header className="app-header">
        <div className="app-logo">WebGIS phân tích vị trí tiềm năng mở mới Bách Hóa Xanh – Ninh Thuận</div>

        <nav className="app-nav">
          <button
            type="button"
            className={activeTab === "home" ? "active" : ""}
            onClick={() => setActiveTab("home")}
          >
            TRANG CHỦ
          </button>

          <button
            type="button"
            className={activeTab === "map" ? "active" : ""}
            onClick={() => setActiveTab("map")}
          >
            BẢN ĐỒ
          </button>

          <button
            type="button"
            className={activeTab === "admin" ? "active" : ""}
            onClick={() => setActiveTab("admin")}
          >
            QUẢN TRỊ
          </button>
        </nav>
      </header>

      {/* KHU VỰC CHÍNH */}
      <main className="app-main">
        {/* ===== TAB HOME ===== */}
        {activeTab === "home" ? (
          <div className="home-wrapper">
            <div className="home-layout">
              {/* Cột mô tả chính */}
              <section className="home-left">
              

                <h1 className="home-title">
                  Hệ thống WebGIS phân tích vị trí mở rộng Bách Hóa Xanh
                </h1>

                <p className="home-subtitle">
                  Ứng dụng WebGIS kết hợp mô hình AHP và các lớp buffer/chồng lớp để
                  đánh giá mức độ phù hợp không gian, hỗ trợ đề xuất mở mới cửa hàng
                  Bách Hóa Xanh tại tỉnh Ninh Thuận.
                </p>

                <ul className="home-list">
                  <li>
                    Phân tích đa tiêu chí: mật độ dân số (MDDS), chợ, trường học,
                    giao thông, BHX hiện hữu và cửa hàng đối thủ.
                  </li>
                  <li>
                    Bản đồ AHP tổng hợp cho từng ô đánh giá với 5 mức: Rất tốt – Tốt –
                    Trung bình – Kém – Rất kém.
                  </li>
                  <li>
                    Hỗ trợ lọc theo từng tiêu chí buffer, xem chi tiết thuộc tính và
                    thống kê nhanh số ô theo mức AHP.
                  </li>
                  <li>
                    Tích hợp chức năng gợi ý trực tiếp <b>vị trí ưu tiên mở mới BHX</b>{" "}
                    trên bản đồ.
                  </li>
                </ul>

                <div className="home-actions">
                  <button
                    type="button"
                    className="home-cta"
                    onClick={() => setActiveTab("map")}
                  >
                    Mở bản đồ phân tích
                  </button>

                  <button
                    type="button"
                    className="home-cta"
                    style={{
                      marginLeft: 10,
                      background: "linear-gradient(180deg,#0ea5e9,#0369a1)",
                    }}
                    onClick={() => setActiveTab("admin")}
                  >
                    Vào trang quản trị
                  </button>

                  <div className="home-note">
                    * Bản đồ được thiết kế phục vụ luận văn/báo cáo: có điều khiển bản
                    đồ, xuất PNG, chú giải rõ ràng và thống kê AHP.
                  </div>
                </div>
              </section>

              {/* Cột giới thiệu các chức năng trong MapComponent */}
              <aside className="home-right">
                <div className="home-feature">
                  <div className="home-feature-header">
                    <span className="home-feature-icon">🗺️</span>
                    <div>
                      <h3>Điều khiển bản đồ & nền hiển thị</h3>
                      <span className="home-tag">Sidebar trái</span>
                    </div>
                  </div>
                  <p>
                    Zoom, đặt lại góc nhìn, fit tất cả lớp, chuyển đổi giữa
                    OpenStreetMap và OpenTopoMap. Cho phép xuất nhanh bản đồ dạng PNG
                    để chèn vào luận văn hoặc báo cáo.
                  </p>
                </div>

                <div className="home-feature">
                  <div className="home-feature-header">
                    <span className="home-feature-icon">📊</span>
                    <div>
                      <h3>Lọc AHP & các lớp buffer</h3>
                      <span className="home-tag">Panel giữa</span>
                    </div>
                  </div>
                  <p>
                    Lọc theo mức AHP tổng hợp trên lớp <b>bandovitri</b>, kết hợp lọc
                    chi tiết theo từng lớp buffer (BHX, chợ, trường, giao thông, dân
                    số) để phân tích rõ tác động của từng tiêu chí.
                  </p>
                </div>

                <div className="home-feature">
                  <div className="home-feature-header">
                    <span className="home-feature-icon">📍</span>
                    <div>
                      <h3>Gợi ý vùng mở mới BHX</h3>
                      <span className="home-tag">Nút “Gợi ý mở BHX”</span>
                    </div>
                  </div>
                  <p>
                    Tự động chọn và tô nổi bật các ô có kết quả <b>“Rất tốt”</b> trên
                    lớp AHP, đồng thời fit bản đồ đến khu vực này.
                  </p>
                </div>

                <div className="home-feature">
                  <div className="home-feature-header">
                    <span className="home-feature-icon">🧭</span>
                    <div>
                      <h3>Chú giải & thống kê nhanh</h3>
                      <span className="home-tag">Sidebar phải</span>
                    </div>
                  </div>
                  <p>
                    Chú giải màu cho các lớp điểm, tuyến, polygon và thang AHP; kèm
                    bảng thống kê số lượng ô theo từng mức giúp thuyết minh kết quả
                    trực quan và dễ hiểu.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        ) : null}

        {/* ===== TAB MAP ===== */}
        {activeTab === "map" ? (
          <div className="map-wrapper" id="map">
            <MapComponent />
          </div>
        ) : null}

        {/* ===== TAB ADMIN ===== */}
        {activeTab === "admin" ? (
          <div className="admin-wrapper" style={{ minHeight: "calc(100vh - 60px)" }}>
            {adminOk === null ? (
              <div style={{ padding: 16 }}>Đang kiểm tra đăng nhập...</div>
            ) : adminOk === false ? (
              <AdminLogin onLoggedIn={handleLoggedIn} />
            ) : (
              <AdminPage onLogout={handleLogout} />
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
