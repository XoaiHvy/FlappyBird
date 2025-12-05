# Sử dụng Nginx bản nhẹ nhất (alpine) làm nền
FROM nginx:alpine

# Xóa các file mặc định của Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copy toàn bộ file code game của bạn vào thư mục web của Nginx
COPY . /usr/share/nginx/html

# Mở port 80 bên trong container
EXPOSE 80

# Chạy Nginx
CMD ["nginx", "-g", "daemon off;"]