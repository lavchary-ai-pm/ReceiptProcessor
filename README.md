# Receipt Processor - Deployment Guide

This is your complete receipt processing web app that automatically extracts data from receipts and adds them to Google Sheets.

## What You'll Need

1. Anthropic API key (from Part 1)
2. Google Service Account JSON file (from Part 2)
3. Your Google Spreadsheet ID (from Part 2)
4. A Cloudflare account (free)

---

## Deployment Steps

### Step 1: Install Wrangler (Cloudflare CLI)

Open your terminal and run:

```bash
npm install -g wrangler
```

If you don't have Node.js installed:
- Mac: `brew install node`
- Windows: Download from https://nodejs.org/
- Linux: `sudo apt install nodejs npm`

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window - login to your Cloudflare account (or create a free one).

### Step 3: Prepare Your Files

Navigate to the receipt-processor folder:

```bash
cd receipt-processor
```

### Step 4: Set Up Environment Variables

You need to add your secrets to Cloudflare. Run these commands one by one:

#### Add Anthropic API Key:
```bash
wrangler secret put ANTHROPIC_API_KEY
```
When prompted, paste your Anthropic API key and press Enter.

#### Add Spreadsheet ID:
```bash
wrangler secret put SPREADSHEET_ID
```
When prompted, paste your Google Spreadsheet ID (from the URL) and press Enter.

#### Add Google Service Account:
```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT
```
When prompted:
1. Open the service account JSON file you downloaded earlier
2. Copy the ENTIRE contents (it's all one line)
3. Paste it and press Enter

**Important:** Make sure you copy the entire JSON including the opening `{` and closing `}`

### Step 5: Deploy to Cloudflare

```bash
wrangler deploy
```

This will deploy your app! You'll see output like:

```
Deployed receipt-processor
  https://receipt-processor.YOUR-SUBDOMAIN.workers.dev
```

**Save this URL!** This is your receipt processor web app.

---

## Using Your Receipt Processor

1. Open the URL from Step 5 in your browser
2. Click or drag & drop a receipt image
3. Click "Process Receipt"
4. Within a few seconds, the data will appear in your Google Sheet!

---

## Troubleshooting

### Error: "Failed to get access token"
- Make sure you copied the ENTIRE service account JSON file
- Check that you shared your Google Sheet with the service account email

### Error: "Claude API error"
- Verify your Anthropic API key is correct
- Make sure you have credits in your Anthropic account

### Error: "Google Sheets API error"
- Confirm your Spreadsheet ID is correct
- Make sure the sheet is named "Sheet1" (or update the code if different)
- Verify the service account has Editor access to the sheet

### The page loads but upload doesn't work
- Check the browser console (F12) for errors
- Make sure you deployed the worker.js file correctly

---

## Customization

### Change the sheet name:
Edit `worker.js` line 65 and change `Sheet1` to your sheet name:
```javascript
`https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/YOUR_SHEET_NAME:append?valueInputOption=USER_ENTERED`,
```

### Add more fields to extract:
Edit the prompt in `worker.js` around line 56 to add more fields.

### Change the styling:
Edit the CSS in `index.html` to match your brand colors.

---

## Cost Breakdown

- **Cloudflare Pages/Workers:** FREE (up to 100,000 requests/day)
- **Anthropic API:** ~$0.003 per receipt (you get $5 free credit = ~1,600 receipts)
- **Google Sheets API:** FREE

---

## Support

If you run into issues:
1. Check the Cloudflare dashboard logs: https://dash.cloudflare.com/
2. Open browser console (F12) to see frontend errors
3. Verify all environment variables are set correctly

Enjoy your automated receipt processing! 🎉
