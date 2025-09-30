# 🔐 Admin Account Setup Guide

## Cách tạo tài khoản Admin

Vì tính năng đăng ký đã bị tắt, bạn cần tạo tài khoản admin thông qua Firebase Console.

### Bước 1: Vào Firebase Console

1. Truy cập https://console.firebase.google.com
2. Chọn project `brand-hub-landing-page`
3. Vào **Authentication** → **Users**

### Bước 2: Thêm User mới

1. Click **Add user**
2. Nhập **Email** của admin (ví dụ: admin@yourdomain.com)
3. Nhập **Password** (tối thiểu 6 ký tự)
4. Click **Add user**

### Bước 3: Test đăng nhập

1. Mở trang `admin.html`
2. Sử dụng email/password vừa tạo để đăng nhập
3. Nếu thành công → có thể truy cập Admin Dashboard

## 📧 Danh sách Admin được phép

Để quản lý tốt hơn, hãy ghi chú những email admin được phép:

- `admin@yourdomain.com` - Admin chính
- `manager@yourdomain.com` - Manager
- (thêm các email khác...)

## 🔒 Bảo mật

- **Không share** thông tin đăng nhập admin
- **Sử dụng password mạnh** (ít nhất 8 ký tự, có chữ hoa, số, ký tự đặc biệt)
- **Thường xuyên đổi password** (mỗi 3-6 tháng)
- **Xóa tài khoản** không còn sử dụng trong Firebase Console

## 🚫 Lưu ý quan trọng

- Trang admin **KHÔNG CÓ** tính năng đăng ký
- Chỉ có thể tạo tài khoản qua Firebase Console
- Người dùng thông thường **KHÔNG THỂ** tự tạo tài khoản admin
