const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mammoth = require('mammoth');
const pdfParser = require('pdf-parse');
const fs = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');
const marked = require('marked');
require('dotenv').config();

const app = express();
const port = 3000;

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Middleware to parse JSON body for the download endpoint
app.use(express.json());
// Middleware to parse URL-encoded bodies for form submissions
app.use(express.urlencoded({ extended: true }));
// Serve static files from the 'public' directory
app.use(express.static('public'));

app.post('/upload-and-summarize', upload.single('documentFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
        const filePath = req.file.path;
        const mimeType = req.file.mimetype;
        let contentToSummarize = '';

        if (mimeType === 'application/pdf') {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdfParser(dataBuffer);
            contentToSummarize = data.text;
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            contentToSummarize = result.value;
        } else if (mimeType === 'application/msword') {
            await fs.unlink(filePath);
            return res.status(400).json({ message: 'File type .doc is not supported. Please upload a .docx or .pdf file.' });
        } else {
            await fs.unlink(filePath);
            return res.status(400).json({ message: 'Unsupported file type. Please upload a PDF, or DOCX file.' });
        }

        if (!contentToSummarize) {
            await fs.unlink(filePath);
            return res.status(400).json({ message: 'Could not extract text from the document.' });
        }

        const outputLanguage = req.body.language || 'Indonesian';

        const prompt = `Please summarize the following document in ${outputLanguage} with explanations of important topics I need to know.
Use markdown for headings, bullet points, and important notes. Keep it concise.
---
${contentToSummarize}
---`;

        const maxRetries = 3;
        const retryDelay = 5000;
        let response;

        for (let i = 0; i < maxRetries; i++) {
            try {
                const result = await model.generateContent(prompt);
                response = result.response;
                break;
            } catch (error) {
                if (error.status === 503 && i < maxRetries - 1) {
                    console.warn(`Attempt ${i + 1} failed with 503 error. Retrying in ${retryDelay / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    throw error;
                }
            }
        }
        
        await fs.unlink(filePath);
        if (response && response.text) {
            res.json({ summary: response.text() });
        } else {
            res.status(500).json({ message: 'Failed to get a valid response from the AI model.' });
        }

    } catch (error) {
        console.error('Error processing file:', error);
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting temporary file:', unlinkError);
            }
        }
        res.status(500).json({ message: 'Error processing document: ' + error.message });
    }
});

app.post('/download-pdf', async (req, res) => {
    let browser;
    try {
        console.log('Received download request. req.body:', req.body);
        
        // Cek apakah req.body dan req.body.summary ada
        if (!req.body || !req.body.summary || req.body.summary.length === 0) {
            console.error('Error: Summary content is missing or empty.');
            return res.status(400).json({ message: 'Summary content is missing or empty.' });
        }
        
        const summaryMarkdown = req.body.summary;
        const summaryHtml = marked.parse(summaryMarkdown);
        
        console.log('Summary content received. Length:', summaryMarkdown.length);

        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Dokumen Ringkas</title>
                <style>
                    body {
                        font-family: 'Times New Roman', serif;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        font-family: 'Times New Roman', serif;
                        color: #333;
                        border-bottom: 2px solid #ccc;
                        padding-bottom: 10px;
                    }
                    p, ul, ol, li {
                        font-family: 'Times New Roman', serif;
                        color: #555;
                    }
                    h1 { font-size: 24px; }
                    h2 { font-size: 20px; }
                    h3 { font-size: 18px; }
                    p { margin-bottom: 1em; }
                    ul, ol { margin-left: 2em; }
                    li { margin-bottom: 0.5em; }
                    pre {
                        background-color: #f4f4f4;
                        padding: 10px;
                        border-radius: 5px;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                </style>
            </head>
            <body>
                <h1>Ringkasan Dokumen</h1>
                <div>${summaryHtml}</div>
            </body>
            </html>
        `;

        console.log('Launching Puppeteer browser...');
        browser = await puppeteer.launch({ 
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: 'new'
        });
        const page = await browser.newPage();
        
        console.log('Setting HTML content on the page...');
        await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
        
        console.log('Generating PDF...');
        const pdfBuffer = await page.pdf({ 
            format: 'A4', 
            printBackground: true,
            margin: {
                top: '1cm',
                bottom: '1cm',
                left: '1cm',
                right: '1cm'
            }
        });
        
        // Menambahkan log untuk memeriksa ukuran buffer PDF
        console.log(`Generated PDF buffer size: ${pdfBuffer.length} bytes`);

        if (pdfBuffer.length === 0) {
            console.error('Puppeteer generated an empty PDF buffer. Sending 500 error.');
            return res.status(500).json({ message: 'Failed to generate PDF file. The file is empty.' });
        }

        res.setHeader('Content-Disposition', 'attachment; filename="hasil.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ message: 'Failed to generate PDF file: ' + error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
