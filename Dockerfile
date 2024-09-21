FROM node:16-slim

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

EXPOSE 3000

# Start the Node.js app (update path to src/app.js)
CMD ["node", "src/app.js"]

# # Base image with Node.js
# FROM node:16-slim

# # Install necessary dependencies for Puppeteer
# RUN apt-get update && apt-get install -y \
#     libx11-xcb1 \
#     libxcomposite1 \
#     libxcursor1 \
#     libxdamage1 \
#     libxi6 \
#     libxtst6 \
#     libnss3 \
#     libxrandr2 \
#     libasound2 \
#     libpangocairo-1.0-0 \
#     libatk1.0-0 \
#     libcups2 \
#     libatk-bridge2.0-0 \
#     libgbm1 \
#     libxshmfence1 \
#     libglu1-mesa \
#     && rm -rf /var/lib/apt/lists/*

# # Create app directory
# WORKDIR /app

# # Copy package.json and package-lock.json
# COPY package*.json ./

# # Install app dependencies
# RUN npm install

# # Copy the rest of the app source code
# COPY . .

# # Expose the app port
# EXPOSE 3000

# # Start the Node.js app
# CMD ["npm", "start"]
