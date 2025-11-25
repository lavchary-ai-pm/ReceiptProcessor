// Cloudflare Worker for Receipt Processing
// This handles the API endpoint that processes receipts

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only handle POST requests to /api/process-receipt
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/process-receipt') {
      try {
        const { image, mimeType } = await request.json();

        // Step 1: Send image to Claude for processing
        const receiptData = await processReceiptWithClaude(image, mimeType, env.ANTHROPIC_API_KEY);

        // Step 2: Add to Google Sheets
        await addToGoogleSheet(receiptData, env);

        return new Response(JSON.stringify({ success: true, data: receiptData }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        console.error('Error processing receipt:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // For all other requests, return 404
    return new Response('Not Found', { status: 404 });
  },
};

async function processReceiptWithClaude(base64Image, mimeType, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Extract the following information from this receipt and return ONLY a valid JSON object with no additional text:

{
  "date": "YYYY-MM-DD format (use today's date if not visible)",
  "vendor": "Store or restaurant name",
  "total": "Total amount as a number (e.g., 45.67)",
  "payment_method": "Cash, Credit, Debit, or Unknown",
  "category": "Food, Transportation, Shopping, Entertainment, or Other",
  "notes": "Any relevant details or items purchased"
}

CRITICAL: Return ONLY the JSON object, no other text before or after.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = await response.json();
  let jsonText = data.content[0].text;

  // Remove markdown code blocks if present
  jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Parse the JSON
  const receiptData = JSON.parse(jsonText);

  return receiptData;
}

async function addToGoogleSheet(receiptData, env) {
  // Get access token using service account
  const accessToken = await getGoogleAccessToken(env);

  // Append row to Google Sheet
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/Sheet1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [
          [
            receiptData.date,
            receiptData.vendor,
            receiptData.total,
            receiptData.payment_method,
            receiptData.category,
            receiptData.notes,
          ],
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Sheets API error: ${error}`);
  }

  return await response.json();
}

async function getGoogleAccessToken(env) {
  // Parse the service account JSON
  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);

  // Create JWT
  const jwt = await createJWT(serviceAccount);

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createJWT(serviceAccount) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signRS256(signatureInput, serviceAccount.private_key);

  return `${signatureInput}.${signature}`;
}

async function signRS256(data, privateKeyPem) {
  // Import the private key
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the data
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(data)
  );

  return base64UrlEncode(signature);
}

function pemToArrayBuffer(pem) {
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlEncode(data) {
  let base64;
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else if (data instanceof ArrayBuffer) {
    base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  } else {
    base64 = btoa(data);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
