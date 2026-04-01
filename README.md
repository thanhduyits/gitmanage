# 🌌 GitManage — Workspace Orchestrator (v1.2.0)

> **GitManage Dashboard** là một công cụ quản lý hàng loạt repository Git trực quan, hiện đại, được thiết kế chuyên biệt để giải quyết các thách thức trong môi trường **Microservices** hoặc các dự án có cấu trúc monorepo phân tán phức tạp.

![Giao diện Glassmorphism Cực Đỉnh](https://img.shields.io/badge/UI-Glassmorphism-purple?style=flat-square) ![Phiên bản](https://img.shields.io/badge/Version-v1.2.0-emerald?style=flat-square) ![Node.js](https://img.shields.io/badge/Node.js-Backend-blue?style=flat-square) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.0+-06B6D4?style=flat-square)

---

## ✨ Tính năng Nâng cao (Pro Max Features)

### 📂 Quản lý Workspace Thông minh
- **Quét Tự động đa thư mục (Multi-select)**: Hỗ trợ pop-up duyệt và đánh dấu cùng lúc nhiều thư mục dự án con. 
- **Nhập Đường dẫn Trực tiếp (Direct Path)**: Nhập nhanh đường dẫn tuyệt đối để thêm trực tiếp repo mà không cần mở thư mục (hỗ trợ kiểm tra trùng lặp thông minh *case-insensitive* trên Windows).

### ⚡ Hành động Hàng loạt (Bulk Actions)
Thay vì dùng terminal vào từng repo, thực hiện thao tác cho hàng tá services với 1 thao tác duy nhất:
- **`Pull` / `Push`**: Đồng bộ code lên/từ remote server. (Hỗ trợ **Commit & Push** liên hoàn trong một lần click).
- **`Stash` / `Pop`**: Cất giữ hoặc khôi phục thay đổi tạm thời.
- **Commit Modal Thông minh (Selective Staging)**: Tự động liệt kê các file Modified/Deleted/New. Cung cấp checkbox để bạn chọn *chính xác* những file cần commit thay vì `git add .` toàn bộ. Hỗ trợ phím tắt `Ctrl+Enter` để xác nhận nhanh.

### 🔍 Global Code Search & Status Filtering
- **Sắp xếp Động (Interactive Sorting)**: Click vào tiêu đề cột (Microservice, Branch, Status) để sắp xếp danh sách tăng dần/giảm dần.
- **Bộ lọc Trạng thái Tức thời**: Xem ngay những repo nào đang `🟢 Clean`, `🟡 Modified`, `⬇️ Behind`, `⬆️ Ahead` hoặc `🔴 Error`.
- **Thanh tìm kiếm (Search)**: Lọc nhanh các microservice theo tên, branch, hoặc môi trường. Hỗ trợ phím tắt `Ctrl+K` hoặc `/` để focus ngay lập tức.
- **Remote URL Linking**: Giao diện tự động phân tích và tạo link Clickable trỏ trực tiếp đến GitHub/Bitbucket của Repo đó.

### 🎨 Giao diện "Premium" (Modern UI/UX)
- Thiết kế **Glassmorphism**, làm mờ nền (backdrop-blur) với các thẻ (cards) nổi.
- **Dark / Light Mode Toggle**: Chuyển đổi linh hoạt giữa giao diện tối bảo vệ mắt và giao diện sáng thanh lịch (Lưu cấu hình qua LocalStorage).
- **Auto-Refresh**: Tính năng tự động làm mới trạng thái Git ngầm mỗi 30 giây (có thể Bật/Tắt).
- Các hiệu ứng chuyển động (*Micro-animations*) mượt mà, phản hồi tức thì qua hệ thống Toast notifications (Success, Error, Info).
- Phím tắt toàn cầu (Global Hotkeys): Dùng phím `R` để làm mới, `T` để mở Timeline, `ESC` để đóng các thanh công cụ an toàn.

---

## 🛠️ Yêu cầu Hệ thống

Hệ thống của bạn cần được cài đặt sẵn:
- **Node.js** (Phiên bản 18 trở lên)
- **Git** được cấu hình biến môi trường toàn cầu. (Khuyến nghị dùng trên Windows, Linux hoặc macOS).

---

## 🚀 Hướng dấn Cài đặt & Khởi động

Chỉ mất đúng 3 bước để khởi chạy hệ thống quản lý siêu tốc:

1. **Di chuyển vào thư mục dự án:**
   ```bash
   cd gitmanage
   ```

2. **Cài đặt các thư viện phụ thuộc (Dependencies):**
   ```bash
   npm install
   ```

3. **Khởi chạy máy chủ (Server):**
   ```bash
   npm start
   ```

Sau khi Terminal báo `🚀 GitManage server running at http://localhost:3000`, hãy mở trình duyệt và truy cập: [http://localhost:3000](http://localhost:3000)

---

## 💡 Hướng dẫn Sử dụng Nhanh

1. **Thêm Workspace**: Nhấn nút `+ Add Folder` ở góc phải trên. Bạn có thể duyệt cây thư mục hoặc gõ trực tiếp đường dẫn gốc vào ô input và nhấn Enter.
2. **Chọn Repos**: Tích chọn checkbox vào các repo bạn muốn thao tác (hoặc dùng nút Select All).
3. **Thao tác Đồng loạt**: Sử dụng thanh công cụ Bulk Actions (có các biểu tượng thư mục, cloud, download, upload trên bảng) để `Stash`, `Pop`, `Pull`, `Push`.
4. **Viết Commit Cẩn thận**: Bấm vào label trạng thái `Modified` màu vàng của Repo để mở Modal Commit, kiểm tra danh sách file và nhập Message trước khi xác nhận.

---

## 📦 Kiến trúc Công nghệ

- **Backend**: Node.js, Express, `simple-git` để thao tác CLI nhẹ nhàng.
- **Frontend**: Vanilla JavaScript (ES6+) không cần bundler rườm rà.
- **Styling**: TailwindCSS (CDN) tối ưu hóa kích thước DOM và tốc độ render bằng Utility Classes.

---
*Được thiết kế và kiến trúc bởi đội ngũ Antigravity Engine* 🛡️
