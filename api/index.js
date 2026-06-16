// Vercel serverless API — wraps server.mjs logic
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_FILE = '/tmp/customers.json';

async function loadCustomers() {
  try { return JSON.parse(await readFile(DATA_FILE, 'utf-8')); }
  catch { return []; }
}

async function saveCustomers(c) {
  await writeFile(DATA_FILE, JSON.stringify(c, null, 2));
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch { return {}; }
}

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function handleAPI(url, method, body) {
  // ── Register ──
  if (url === '/api/customers/register' && method === 'POST') {
    const customers = await loadCustomers();
    if (!body.email || !body.name || !body.password) return jsonRes({ error: 'Name, email and password required.' }, 400);
    if (customers.find(c => c.email === body.email)) return jsonRes({ error: 'Email already registered.' }, 409);
    const customer = { id: randomUUID(), name: body.name, email: body.email, password: body.password, phone: body.phone || '', createdAt: new Date().toISOString(), orders: [] };
    customers.push(customer);
    await saveCustomers(customers);
    const { password, ...safe } = customer;
    return jsonRes({ customer: safe, token: customer.id });
  }

  // ── Login ──
  if (url === '/api/customers/login' && method === 'POST') {
    const customers = await loadCustomers();
    const customer = customers.find(c => c.email === body.email && c.password === body.password);
    if (!customer) return jsonRes({ error: 'Invalid email or password.' }, 401);
    const { password, ...safe } = customer;
    return jsonRes({ customer: safe, token: customer.id });
  }

  // ── Stats ──
  if (url === '/api/customers/stats' && method === 'GET') {
    const customers = await loadCustomers();
    const now = new Date();
    const weekAgo = new Date(now - 7 * 86400000);
    const monthAgo = new Date(now - 30 * 86400000);
    return jsonRes({
      total: customers.length,
      thisWeek: customers.filter(c => new Date(c.createdAt) >= weekAgo).length,
      thisMonth: customers.filter(c => new Date(c.createdAt) >= monthAgo).length,
      withOrders: customers.filter(c => c.orders?.length > 0).length,
      totalOrders: customers.reduce((s, c) => s + (c.orders?.length || 0), 0),
      customers: customers.map(({ password, ...c }) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, createdAt: c.createdAt, orderCount: c.orders?.length || 0 })),
    });
  }

  // ── Order ──
  if (url === '/api/customers/order' && method === 'POST') {
    const customers = await loadCustomers();
    const customer = customers.find(c => c.id === body.token);
    if (!customer) return jsonRes({ error: 'Not authenticated.' }, 401);
    customer.orders = customer.orders || [];
    customer.orders.push({ id: randomUUID(), product: body.product, price: body.price, date: new Date().toISOString() });
    await saveCustomers(customers);
    return jsonRes({ ok: true });
  }

  // ── Stripe Checkout ──
  if (url === '/api/create-checkout-session' && method === 'POST') {
    // Save order locally, return null URL (demo mode)
    if (body.createAccount && body.customer?.email) {
      const customers = await loadCustomers();
      const existing = customers.find(c => c.email === body.customer.email);
      if (!existing) {
        customers.push({
          id: randomUUID(), name: body.customer.name, email: body.customer.email,
          phone: body.customer.phone || '', password: '', createdAt: new Date().toISOString(),
          orders: [{ id: randomUUID(), items: body.items, total: body.items.reduce((s, i) => s + (parseFloat(i.price) || 0) * i.qty, 0), date: new Date().toISOString(), address: body.customer.address }],
        });
        await saveCustomers(customers);
      } else if (body.token) {
        existing.orders = existing.orders || [];
        existing.orders.push({ id: randomUUID(), items: body.items, total: body.items.reduce((s, i) => s + (parseFloat(i.price) || 0) * i.qty, 0), date: new Date().toISOString(), address: body.customer.address });
        await saveCustomers(customers);
      }
    }
    return jsonRes({ demo: true, message: 'Order saved. Stripe key not configured.', url: null });
  }

  // ── Email ──
  if (url === '/api/send-email' && method === 'POST') {
    console.log(`[EMAIL] To: ${body.to} | Subject: ${body.subject}`);
    return jsonRes({ demo: true, message: 'Email logged.' });
  }

  return jsonRes({ error: 'Not found.' }, 404);
}

export default async function handler(req) {
  const url = new URL(req.url).pathname;
  const method = req.method;
  const body = method === 'POST' ? await readBody(req) : {};

  if (method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  return handleAPI(url, method, body);
}

export const config = { runtime: 'nodejs22' };
