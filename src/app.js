const express = require("express");
const puppeteer = require("puppeteer");
const { URL } = require("url");

const app = express();
const port = 3000;

class LinkPreview {
  constructor(url, title, description, image) {
    this.url = url;
    this.title = title;
    this.description = description;
    this.image = image;
  }
}

class PlatformConfig {
  constructor(selectors) {
    this.selectors = selectors;
  }
}

const PLATFORM_CONFIGS = {
  default: new PlatformConfig({
    url: ['meta[property="og:url"]', 'meta[name="twitter:url"]'],
    title: ['meta[property="og:title"]', 'meta[name="twitter:title"]', "title"],
    description: [
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ],
    image: ['meta[property="og:image"]', 'meta[name="twitter:image"]'],
  }),
  "tiktok.com": new PlatformConfig({
    url: ['meta[property="og:url"]'],
    title: ['meta[property="og:title"]'],
    description: ['meta[property="og:description"]'],
    image: ['meta[property="og:image"]', 'meta[name="twitter:image"]'],
  }),
  "facebook.com": new PlatformConfig({
    url: ['meta[property="og:url"]'],
    title: ['meta[property="og:title"]'],
    description: ['meta[property="og:description"]'],
    image: ['meta[property="og:image"]', 'meta[name="twitter:image"]'],
  }),
  "twitter.com": new PlatformConfig({
    url: ['meta[name="twitter:url"]'],
    title: ['meta[name="twitter:title"]'],
    description: ['meta[name="twitter:description"]'],
    image: ['meta[name="twitter:image"]'],
  }),
  "youtube.com": new PlatformConfig({
    url: ['meta[property="og:url"]'],
    title: ['meta[name="twitter:title"]'],
    description: ['meta[name="twitter:description"]'],
    image: ['meta[property="og:image"]', 'meta[name="twitter:image"]'],
  }),
  "linkedin.com": new PlatformConfig({
    url: ['meta[property="og:url"]'],
    title: ['meta[name="twitter:title"]'],
    description: ['meta[name="twitter:description"]'],
    image: ['meta[property="og:image"]', 'meta[name="twitter:image"]'],
  }),
};

async function getElementContent(page, selectors) {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        return (
          (await element.evaluate(
            (el) => el.getAttribute("content") || el.innerText
          )) || null
        );
      }
    } catch {
      continue;
    }
  }
  return null;
}

function getActualImageUrl(baseUrl, imageUrl) {
  if (!imageUrl || imageUrl.trim() === "" || imageUrl.startsWith("data:")) {
    return null;
  }

  if (imageUrl.includes(".svg") || imageUrl.includes(".gif")) {
    return null;
  }

  if (imageUrl.startsWith("//")) {
    imageUrl = `https:${imageUrl}`;
  }

  if (!imageUrl.startsWith("http")) {
    const url = new URL(imageUrl, baseUrl);
    imageUrl = url.href;
  }

  return imageUrl;
}

async function getThumbnailImageUrl(page, baseUrl) {
  // Try to get image from og:image or twitter:image meta tags first
  const metaElements = await page.$$(
    'meta[property="og:image"], meta[name="twitter:image"]'
  );
  for (const element of metaElements) {
    const imageUrl = await element.evaluate((el) => el.getAttribute("content"));
    const actualUrl = getActualImageUrl(baseUrl, imageUrl);
    if (actualUrl) {
      return actualUrl;
    }
  }

  // If no meta image, fallback to the first reasonably sized img tag
  try {
    const images = await page.$$("img");
    for (const img of images) {
      const src = await img.evaluate((el) => el.getAttribute("src"));
      const actualUrl = getActualImageUrl(baseUrl, src);
      if (!actualUrl) continue;

      const boundingBox = await img.boundingBox();
      if (boundingBox) {
        const { width, height } = boundingBox;
        if (width >= 200 && height >= 200) {
          return actualUrl; // Return the first image with decent size
        }
      }
    }
  } catch (e) {
    console.error(`Error finding thumbnail image: ${e}`);
  }

  return null;
}

async function getLinkPreview(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: "/usr/bin/google-chrome-stable",
  });
  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (["document", "script", "image"].includes(request.resourceType())) {
      request.continue();
    } else {
      request.abort();
    }
  });

  await page.setExtraHTTPHeaders({
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  });

  try {
    console.log(`Fetching preview for URL: ${url}`);
    const response = await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    const finalUrl = response.url();
    const domain = new URL(finalUrl).hostname;
    const config = PLATFORM_CONFIGS[domain] || PLATFORM_CONFIGS["default"];
    console.log(`Using config for domain: ${domain}`);

    const mainImage = await getThumbnailImageUrl(page, finalUrl);

    const preview = new LinkPreview(
      (await getElementContent(page, config.selectors.url)) || finalUrl,
      await getElementContent(page, config.selectors.title),
      await getElementContent(page, config.selectors.description),
      mainImage
    );

    console.log(`Successfully generated preview for URL: ${finalUrl}`);
    return preview;
  } catch (e) {
    console.error(`Error generating preview for URL ${url}: ${e}`);
    return null;
  } finally {
    await browser.close();
  }
}

app.get("/preview", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }
  try {
    const preview = await getLinkPreview(url);
    if (preview) {
      res.json(preview);
    } else {
      res.status(400).json({ error: "Could not generate preview" });
    }
  } catch (error) {
    console.error(`Error processing request: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

//get all image
async function getAllImages(page, baseUrl) {
  const images = await page.$$("img");
  const imageUrls = [];

  for (const img of images) {
    const src = await img.evaluate((el) => el.getAttribute("src"));
    const actualUrl = getActualImageUrl(baseUrl, src);
    if (actualUrl) {
      imageUrls.push(actualUrl);
    }
  }

  return imageUrls;
}

app.get("/all-images", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: "/usr/bin/google-chrome-stable",
    });
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (["document", "script", "image"].includes(request.resourceType())) {
        request.continue();
      } else {
        request.abort();
      }
    });

    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    });

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const finalUrl = page.url();
    const allImages = await getAllImages(page, finalUrl);

    await browser.close();

    if (allImages.length > 0) {
      res.json({ images: allImages });
    } else {
      res.status(400).json({ error: "No images found" });
    }
  } catch (error) {
    console.error(`Error processing request: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

//get original url
async function getOriginalUrl(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: "/usr/bin/google-chrome-stable",
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
    return page.url();
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}
app.get("/original-url", async (req, res) => {
  const url = req.query.url;
  const originalUrl = await getOriginalUrl(url);
  res.json({ original_url: originalUrl });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Link preview server listening at http://0.0.0.0:${port}`);
});
