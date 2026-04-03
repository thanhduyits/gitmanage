# 🌌 GitManage — Workspace Orchestrator (v1.2.1 Beta)

> **GitManage Dashboard** là một công cụ quản lý hàng loạt repository Git trực quan, hiện đại, được thiết kế chuyên biệt để giải quyết các thách thức trong môi trường **Microservices** hoặc các dự án có cấu trúc monorepo phân tán phức tạp.

![Giao diện Glassmorphism Cực Đỉnh](https://img.shields.io/badge/UI-Glassmorphism-purple?style=flat-square) ![Phiên bản](https://img.shields.io/badge/Version-v1.2.0-emerald?style=flat-square) ![Node.js](https://img.shields.io/badge/Node.js-Backend-blue?style=flat-square) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.0+-06B6D4?style=flat-square)

---

## ✨ Tính năng Nâng cao (Pro Max Features)

### 📂 Quản lý Workspace & Multi-repo Thông minh
- **Quét Tự động đa thư mục (Multi-select)**: Hỗ trợ pop-up duyệt và đánh dấu cùng lúc nhiều thư mục dự án con. Workspace Chips tương tác đóng vai trò làm tab quản lý vô cùng thuận tiện.
- **Nhập Đường dẫn Trực tiếp (Direct Path)**: Nhập nhanh đường dẫn tuyệt đối để thêm trực tiếp repo mà không cần mở duyệt thư mục (kiểm tra trùng lặp thông minh *case-insensitive* trên Windows).
- **Trạng thái Code Tức thời & Lọc thông minh**: Click tiêu đề cột để sắp xếp thông tin. Filter xem ngay các repo có trạng thái `🟢 Clean`, `🟡 Modified`, `⬇️ Behind`, `⬆️ Ahead` hoặc `🔴 Error`.
- **Remote URL Linking**: Giao diện tự động phân tích và tạo icon link mở nhanh trực tiếp đến trang chủ GitHub/Bitbucket của Repository gốc từ bảng cấu hình.

### ⚡ Hành động Hàng loạt (Bulk Actions)
Thay vì dùng terminal cd vào từng repo, giờ đây quản lý thao tác cho hàng tá services cùng một lúc chỉ với một click:
- **`Pull` / `Push`**: Đồng bộ code lên/từ remote server. (Có tính năng ghim Combo **Commit & Push** liên hoàn).
- **`Stash` / `Pop`**: Vứt ngay những thay đổi rác tạm thời để giải phóng thư mục, hoặc hoàn tác lấy lại sau.
- **Commit Modal Thông minh (Selective Staging)**: Tự động liệt kê các file Modified/Deleted/New. Cho phép tick chọn chính xác từng file cần commit thay vì `git add .` bừa bãi.

### 🚀 Quản lý Repository Chuyên Sâu (Repository Detail) - *MỚI 🌟*
- **Trải Nghiệm Lựa Chọn Inspired-bởi GitKraken**: Trang chi tiết quản lý hoàn toàn độc lập với các khu vực thanh bên (Sidebar) có thể kéo thả thay đổi kích thước (Resizable), mang lại không gian quan sát linh hoạt nhất giữa danh sách Branch và hiển thị thông tin Commit.
- **Quản lý Toàn diên Local & Remote Branches**: Nhánh mạng máy chủ (Remote) hiển thị tách biệt rõ rệt bằng biểu tượng đánh dấu riêng. Hỗ trợ bấm trực tiếp để Checkout Remote Branch tự động sinh một nhánh local truy vết tương ứng.
- **Thao tác Git Nâng cao**: Form tạo nhánh mới, so sánh nhánh (Compare) với thống kê lịch sử và số lượng file sửa đổi (Diff stats), hỗ trợ tính năng cập nhật hộp thoại Merge an toàn qua cờ cấu hình `--no-ff`.
- **Lịch sử Commit Chi Tiết Toàn Bộ**: Giao diện duyệt timeline trực quan kèm tên tác giả, ngày giờ tháng hiển thị đầy đủ chuyên nghiệp và xem nhanh chi tiết từng cụm file thay đổi.

### 🎨 Giao diện "Premium" & Trải Nghiệm Khách Hàng (Modern UI/UX)
- Chế độ hiển thị cao cấp **Glassmorphism**, làm mờ nền (backdrop-blur) gắn liền thiết kế bảng tóm tắt hệ thống (Summary Cards) hiển thị nổi sống động. Dropdown Menu hành động của Repository tinh giản triệt để tối ưu hóa nút bấm.
- **Chuyển đổi Dark / Light Mode**: Hỗ trợ bộ CSS Custom Variable Theme chuyển qua lại chủ đề Tối sang Sáng chỉ bằng 1 nút bấm (chức năng ghi nhớ trình duyệt tự động).
- **Auto-Refresh Ngầm**: Kiểm tra theo chu kỳ tiến độ đồng bộ Git sau mỗi 30s.
- Hiệu ứng động (*Micro-animations*) mượt mà, Toast notifications nổi bật chuyên nghiệp thông báo kịp thời các trạng thái Success/Error/Info.
- **Tối Ưu Phím Tắt (Global Hotkeys)**: Tăng hiệu suất người dùng chỉ cần thao tác bằng bàn phím qua `Ctrl+K` hoặc `/` để Tìm kiếm, `R` (Làm mới), `T` (Mở giao diện Timeline), `Enter` (Xác nhận), và `ESC` (Đóng Pop-up).

---

## 🛠️ Yêu cầu Hệ thống

Hệ thống của bạn cần được cài đặt sẵn:
- **Node.js** (Phiên bản ít nhất từ 18 trở lên)
- **Git** được cấu hình trong bảng môi trường hệ thống (System Environment Variables). Hoạt động hoàn hảo trên Windows, Linux và macOS.

---

## 🚀 Hướng dấn Cài đặt & Khởi động

Chỉ mất đúng 3 bước để khởi chạy hệ thống:

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

Khi Terminal báo dòng chữ xanh `🚀 GitManage server running at http://localhost:3000`, hãy mở trình duyệt của bạn truy cập vào: [http://localhost:3000](http://localhost:3000)

---

## 💡 Hướng dẫn Sử dụng Nhanh

1. **Khởi Tạo Workspace**: Tại Dashboard, chọn nút `+ Add Folder` nhúng qua trình duyệt cây thư mục hoặc copy-paste hoàn toàn URL thư mục để chèn hàng loạt nhanh.
2. **Xem Nhanh Repositories**: Tổng quan thẻ Summary cards mang đến trực giác tình trạng bao nhiêu project Clean, có lỗi không. Bấm Workspace tab để phân tách nhóm dự án liên quan qua các Chips.
3. **Thao tác Đồng loạt (Bulk)**: Trỏ chuột chọn vào checkbox các dịch vụ và dùng tổ hợp icon thanh điều khiển phía trên cho hành động `Push` nhánh theo mẻ, dọn thư mục `Stash` hàng loạt.
4. **Kiểm Soát Nhánh Trực Tuyến Gắt Gao**: Đừng quên bấm Nút Menu của từng Repo -> Chọn Mục `Details` -> Truy cập ngay phòng làm việc 2 cột chuẩn xịn để đào lại code quá khứ của người khác hoặc chính bạn!

---

## 📦 Kiến trúc Công nghệ

- **Backend**: Xây dựng móng trên Node.js framework Express, thư viện lỗi lạc `simple-git` móc nối mã code Git command siêu mượt.
- **Frontend**: Nền tảng Vanilla JavaScript (ES6+), Kiến trúc Document Object Model API sạch không thư viện rườm rà. Code logic tương tác Drag/Drop thay đổi không gian UI Resizable thuần trơn tru nhẹ nhàng.
- **Styling**: TailwindCSS bản Utilities tối ưu hóa DOM cùng cơ chế CSS Variables kiểm soát chế độ Màu Sáng/Tối linh động toàn vẹn.

---
*Được thiết kế và kiến trúc bởi đội ngũ duynt2 cùng cộng sự (AI đó ^^)* 🛡️
