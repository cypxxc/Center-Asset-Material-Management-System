FROM php:8.3-fpm-bookworm

# Set working directory
WORKDIR /var/www/html

# Install system dependencies, Chromium, and Thai fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    libpq-dev \
    zip \
    unzip \
    fontconfig \
    fonts-thai-tlwg \
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install required PHP extensions
RUN docker-php-ext-install pdo pdo_pgsql pgsql bcmath gd zip pcntl opcache

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Download and install Sarabun and Capriola fonts for Browsershot PDF rendering
RUN mkdir -p /usr/share/fonts/truetype/camms \
    && curl -sSLo /usr/share/fonts/truetype/camms/Sarabun-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf" \
    && curl -sSLo /usr/share/fonts/truetype/camms/Sarabun-Bold.ttf "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Bold.ttf" \
    && curl -sSLo /usr/share/fonts/truetype/camms/Capriola-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/capriola/Capriola-Regular.ttf" \
    && fc-cache -f -v

# Install Composer
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

# Environment variables for Chromium in Browsershot
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose ports
EXPOSE 8000 9000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
