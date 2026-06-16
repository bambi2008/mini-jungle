import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const PORT = 3000;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const CUSTOMERS_FILE = join(DATA_DIR, 'customers.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// ═══════════════════════════════════════════
// DATA HELPERS
// ═══════════════════════════════════════════
async function ensureDataDir() {
  try { await mkdir(DATA_DIR, { recursive: true }); } catch {}
}

async function loadCustomers() {
  try {
    const raw = await readFile(CUSTOMERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveCustomers(customers) {
  await writeFile(CUSTOMERS_FILE, JSON.stringify(customers, null, 2), 'utf-8');
}

function jsonRes(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { return {}; }
}

// ═══════════════════════════════════════════
// SERVER
// ═══════════════════════════════════════════
await ensureDataDir();

createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  // ── API ROUTES ──
  if (url.startsWith('/api/')) {
    try {
      // ── Register ──
      if (url === '/api/customers/register' && method === 'POST') {
        const body = await readBody(req);
        const customers = await loadCustomers();

        if (!body.email || !body.name || !body.password) {
          return jsonRes(res, { error: 'Name, email and password required.' }, 400);
        }

        if (customers.find(c => c.email === body.email)) {
          return jsonRes(res, { error: 'Email already registered.' }, 409);
        }

        const customer = {
          id: randomUUID(),
          name: body.name,
          email: body.email,
          password: body.password, // plain-text for demo; hash in production
          phone: body.phone || '',
          createdAt: new Date().toISOString(),
          orders: [],
        };

        customers.push(customer);
        await saveCustomers(customers);

        const { password, ...safe } = customer;
        return jsonRes(res, { customer: safe, token: customer.id });
      }

      // ── Login ──
      if (url === '/api/customers/login' && method === 'POST') {
        const body = await readBody(req);
        const customers = await loadCustomers();
        const customer = customers.find(c => c.email === body.email && c.password === body.password);

        if (!customer) {
          return jsonRes(res, { error: 'Invalid email or password.' }, 401);
        }

        const { password, ...safe } = customer;
        return jsonRes(res, { customer: safe, token: customer.id });
      }

      // ── List all (admin) ──
      if (url === '/api/customers' && method === 'GET') {
        const customers = await loadCustomers();
        const list = customers.map(({ password, ...safe }) => safe);
        return jsonRes(res, list);
      }

      // ── Stats (admin) ──
      if (url === '/api/customers/stats' && method === 'GET') {
        const customers = await loadCustomers();
        const today = new Date();
        const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today - 30 * 24 * 60 * 60 * 1000);

        const total = customers.length;
        const thisWeek = customers.filter(c => new Date(c.createdAt) >= weekAgo).length;
        const thisMonth = customers.filter(c => new Date(c.createdAt) >= monthAgo).length;
        const withOrders = customers.filter(c => c.orders && c.orders.length > 0).length;
        const totalOrders = customers.reduce((sum, c) => sum + (c.orders ? c.orders.length : 0), 0);

        return jsonRes(res, {
          total,
          thisWeek,
          thisMonth,
          withOrders,
          totalOrders,
          customers: customers.map(({ password, ...c }) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            createdAt: c.createdAt,
            orderCount: c.orders ? c.orders.length : 0,
          })),
        });
      }

      // ── Delete customer (admin) ──
      if (url.startsWith('/api/customers/') && method === 'DELETE') {
        const id = url.split('/').pop();
        let customers = await loadCustomers();
        const idx = customers.findIndex(c => c.id === id);
        if (idx === -1) return jsonRes(res, { error: 'Not found.' }, 404);
        customers.splice(idx, 1);
        await saveCustomers(customers);
        return jsonRes(res, { ok: true });
      }

      // ── Record order ──
      if (url === '/api/customers/order' && method === 'POST') {
        const body = await readBody(req);
        const customers = await loadCustomers();
        const customer = customers.find(c => c.id === body.token);
        if (!customer) return jsonRes(res, { error: 'Not authenticated.' }, 401);

        customer.orders = customer.orders || [];
        customer.orders.push({
          id: randomUUID(),
          product: body.product,
          price: body.price,
          date: new Date().toISOString(),
        });
        await saveCustomers(customers);
        return jsonRes(res, { ok: true });
      }

      return jsonRes(res, { error: 'Not found.' }, 404);
    } catch (e) {
      console.error('API error:', e);
      return jsonRes(res, { error: 'Server error.' }, 500);
    }
  }

  // ── Send Email (Resend-ready) ──
  if (url === '/api/send-email' && method === 'POST') {
    const body = await readBody(req);
    const RESEND_KEY = process.env.RESEND_API_KEY || '';

    if (!RESEND_KEY) {
      // Demo mode: log to console
      console.log(`[EMAIL] To: ${body.to} | Subject: ${body.subject}`);
      return jsonRes(res, { demo: true, message: 'Email logged (Resend key not configured).' });
    }

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'HK MiniJungle <orders@hkminijungle.com>',
          to: body.to,
          subject: body.subject,
          html: body.html,
        }),
      });
      const data = await emailRes.json();
      return jsonRes(res, { ok: true, data });
    } catch (e) {
      return jsonRes(res, { error: 'Email send failed.' }, 500);
    }
  }

  // ── Stripe Checkout Session ──
  if (url === '/api/create-checkout-session' && method === 'POST') {
    try {
      const body = await readBody(req);
      const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';

      if (!STRIPE_KEY || STRIPE_KEY.startsWith('sk_test_') === false) {
        // Demo mode — save order and return success
        const customers = await loadCustomers();
        if (body.createAccount && body.customer.email) {
          const existing = customers.find(c => c.email === body.customer.email);
          if (!existing) {
            customers.push({
              id: randomUUID(),
              name: body.customer.name,
              email: body.customer.email,
              phone: body.customer.phone || '',
              password: '',
              createdAt: new Date().toISOString(),
              orders: [{
                id: randomUUID(),
                items: body.items,
                total: body.items.reduce((s, i) => s + (parseFloat(i.price) || 0) * i.qty, 0),
                date: new Date().toISOString(),
                address: body.customer.address,
              }],
            });
            await saveCustomers(customers);
          } else if (body.token) {
            existing.orders = existing.orders || [];
            existing.orders.push({
              id: randomUUID(),
              items: body.items,
              total: body.items.reduce((s, i) => s + (parseFloat(i.price) || 0) * i.qty, 0),
              date: new Date().toISOString(),
              address: body.customer.address,
            });
            await saveCustomers(customers);
          }
        }

        return jsonRes(res, {
          demo: true,
          message: 'Stripe key not configured — order saved locally.',
          url: null,
        });
      }

      // Real Stripe integration
      const lineItems = body.items.map(item => ({
        price_data: {
          currency: 'hkd',
          product_data: { name: item.name },
          unit_amount: Math.round((parseFloat(item.price) || 100) * 100), // convert to cents
        },
        quantity: item.qty,
      }));

      const baseUrl = `http://localhost:${PORT}`;
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'line_items': JSON.stringify(lineItems),
          'mode': 'payment',
          'success_url': baseUrl + '/?payment=success',
          'cancel_url': baseUrl + '/checkout.html?payment=cancelled',
          'customer_email': body.customer.email,
          'metadata[source]': 'hk-minijungle',
        }).toString(),
      });

      const session = await stripeRes.json();
      return jsonRes(res, { url: session.url });
    } catch (e) {
      console.error('Stripe error:', e);
      return jsonRes(res, { error: 'Payment setup failed.', url: null }, 500);
    }
  }

  // ── STATIC FILES ──
  try {
    let fileUrl = url;
    if (fileUrl === '/') fileUrl = '/index.html';
    if (fileUrl.endsWith('/')) fileUrl += 'index.html';
    const path = join(ROOT, fileUrl);
    const content = await readFile(path);
    const ext = extname(path).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    try {
      const notFound = await readFile(join(ROOT, '404.html'));
      res.end(notFound);
    } catch {
      res.end('404');
    }
  }
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  console.log('  API: /api/customers/register | /login | /stats');
});
