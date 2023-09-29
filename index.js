const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const PDFMerger = require('pdf-merger-js');
const ZOOM = 0.625;
const bookUrl = process.argv[2];
const sleep = (milliseconds) => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  };
  const StealthPlugin = require("puppeteer-extra-plugin-stealth");
  
  (async () => {
    puppeteer.use(StealthPlugin());
  
    // Launch a headless browser
    const browser = await puppeteer.launch({
      headless: false,
      executablePath:
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      args: ["--window-size=1366,768"], // Set browser window size
    });
  
    // Set a user-agent to mimic a regular browser
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36"
    );
  
    // Emulate viewport
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto('https://www.scribd.com', { waitUntil: 'domcontentloaded' });
  
    await page.waitForSelector('div.user_row');
    console.log('Logged in successfully.');
  
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(bookUrl, ['geolocation', 'notifications']);
  
    const newPage = await context.newPage();
    await newPage.setViewport({ width: 1200, height: 1600 });
    await newPage.goto(bookUrl.replace('book', 'read'));
  
    if (newPage.content().includes('Browser limit exceeded')) {
      await browser.close();
      process.exit('You have exceeded the browser limit for accessing this book.');
    }
  
    const fontStyle = await newPage.$eval('#fontfaces', (element) => element.innerHTML);
  
    await newPage.click('.icon-ic_displaysettings');
    await newPage.waitForSelector('.vertical_mode_btn');
    await newPage.click('.vertical_mode_btn');
    await newPage.waitForSelector('div.vertical_page[data-page="0"]');
    await newPage.click('.icon-ic_toc_list');
  
    const chapterSelector = await newPage.$$('li.text_btn[role="none"]');
    const numChapters = chapterSelector.length;
  
    let chapterNo = 1;
    const merger = new PDFMerger();
  
    while (chapterNo <= numChapters) {
      const chapterTitle = await chapterSelector[chapterNo - 1].evaluate((node) => node.innerText.trim());
      console.log(`Downloading chapter ${chapterNo}/${numChapters}: ${chapterTitle}`);
  
      let pageNo = 1;
      while (true) {
        await newPage.waitForSelector(`div.vertical_page[data-page="${pageNo - 1}"]`);
        const chapterPages = await newPage.$$eval('div.vertical_page', (pages) => pages.map((page) => page.innerHTML));
  
        const html = chapterPages[pageNo - 1];
        const width = parseFloat(html.match(/width: ([0-9.]+)px; height: ([0-9.]+)px;/)[1]);
        const height = parseFloat(html.match(/width: ([0-9.]+)px; height: ([0-9.]+)px;/)[2]);
        const style = `@page { size: ${width * ZOOM}px ${height * ZOOM}px; margin: 0; } @media print { html, body { height: ${height * ZOOM}px; width: ${width * ZOOM}px; } }`;
  
        const content = `<style>${style}${fontStyle}</style>${html}`;
  
        const pdfFile = `${chapterNo}_${pageNo}.pdf`;
        fs.writeFileSync(pdfFile, content);
  
        merger.add(pdfFile);
  
        if (pageNo === chapterPages.length) {
          break;
        }
  
        pageNo++;
      }
  
      chapterNo++;
      await newPage.click('button.load_next_btn');
      await newPage.waitForTimeout(1000);
    }
  
    console.log('Merging PDF pages...');
    merger.save(`${bookUrl.split('/').pop()}.pdf`);
  
    await browser.close();
    console.log('Download completed, enjoy your book!');
  })();
  