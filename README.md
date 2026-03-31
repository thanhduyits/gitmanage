# 🚀 GitManage Dashboard

**GitManage Dashboard** là một công cụ quản lý hàng loạt repository Git trực quan, hiện đại, được thiết kế để giải quyết các vấn đề trong môi trường Microservices hoặc các dự án có cấu trúc phức tạp.

---

## ✨ Tính năng nổi bật

- **🔍 Global Code Search**: Tìm kiếm mã nguồn xuyên suốt tất cả các repositories trong workspace bằng sức mạnh của `git grep`. Hỗ trợ: *Match Case*, *Whole Word*, *Regex*.
- **🕸️ Git Graph Visualizer**: Xem biểu đồ lịch sử Git trực quan (SVG) với sơ đồ branch, merge commit và các nhãn (Tag/Branch) ngay trên dashboard.
- **⚔️ Smart Conflict Resolver**: Tự động phát hiện các repository đang gặp xung đột merge. Cung cấp danh sách file lỗi và phím tắt mở nhanh thư mục giải quyết.
- **⚡ Bulk Actions**: Thực hiện đồng loạt `Fetch`, `Pull`, `Check Health` cho toàn bộ các repos chỉ bằng 1 cú click.
- **🎨 Modern UI/UX**: Giao diện phong cách **Glassmorphism**, mượt mà, hỗ trợ Dark Mode và các hiệu ứng tương tác cao cấp.

---

## 🛠️ Yêu cầu hệ thống

Hệ thống của bạn cần được cài đặt sẵn:
- **Node.js** (Phiên bản 18 trở lên)
- **Git** (Hỗ trợ tốt nhất trên Windows/Linux/macOS)

---

## 🚀 Hướng dấn Cài đặt & Khởi động

Chỉ mất đúng 3 bước để bắt đầu:

1. **Tải về & Chuyển vào thư mục dự án:**
   ```bash
   cd gitmanage
   ```

2. **Cài đặt các thư viện cần thiết (Dependencies):**
   ```bash
   npm install
   ```

3. **Khởi chạy ứng dụng:**
   ```bash
   npm start
   ```

Sau khi chạy lệnh trên, hãy mở trình duyệt và truy cập: [http://localhost:3000](http://localhost:3000)

---

## 💡 Cách sử dụng

1. **Thêm Workspace**: Nhấn nút `ADD WORKSPACE` ở góc phải để chọn thư mục chứa các dự án Git của bạn. Hệ thống sẽ tự động quét và thêm vào danh sách.
2. **Xem Git Graph**: Nhấn vào **Tên Repository** trong bảng để mở biểu đồ lịch sử Git.
3. **Tìm kiếm toàn cục**: Nhấn nút `Global Search` ở góc trên cùng bên phải để mở thanh tìm kiếm code.
4. **Xử lý Conflict**: Khi một hàng có badge màu đỏ `⚔️ Conflict`, hãy nhấn vào đó để xem danh sách file bị lỗi.

---

## 📦 Công nghệ sử dụng

- **Backend**: Node.js, Express, `simple-git`.
- **Frontend**: Vanilla JavaScript (ES6+), CSS (Tailwind CDN), SVG Graphics.

---
*Phát triển bởi Wanda Scarlet - Antigravity Orchestrator* 🛡️
