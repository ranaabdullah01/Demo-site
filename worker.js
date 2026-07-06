/**
 * CLOUDFLARE WORKER
 * Handles API endpoints for lead management and admin authentication
 */

// =============================================
// ENVIRONMENT VARIABLES
// =============================================
// JWT_SECRET - Secret key for JWT signing
// DB - D1 database binding
// BREVO_API_KEY - Brevo (Sendinblue) API key for email

// =============================================
// CORS HEADERS
// =============================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// =============================================
// JWT UTILITY (using Web Crypto API)
// =============================================

async function generateJWT(payload, secret, expiresIn = '24h') {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
  
  const data = {
    ...payload,
    exp: exp
  };
  
  const headerBase64 = btoa(JSON.stringify(header));
  const payloadBase64 = btoa(JSON.stringify(data));
  const signature = await hmacSha256(headerBase64 + '.' + payloadBase64, secret);
  
  return headerBase64 + '.' + payloadBase64 + '.' + signature;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerBase64, payloadBase64, signature] = parts;
    const expectedSignature = await hmacSha256(headerBase64 + '.' + payloadBase64, secret);
    
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(atob(payloadBase64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    
    return payload;
  } catch (err) {
    return null;
  }
}

async function hmacSha256(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// =============================================
// PASSWORD HASHING
// =============================================

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password, hash) {
  const hashed = await hashPassword(password);
  return hashed === hash;
}

// =============================================
// EMAIL SENDER (Brevo)
// =============================================

async function sendAutoReply(to, agentName, agentPhone, type, agentEmail) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.error('BREVO_API_KEY not set');
    return;
  }

  let subject, htmlContent;
  
  if (type === 'contact') {
    subject = `Thanks for contacting ${agentName}!`;
    htmlContent = `
      <h2>Thank You for Reaching Out!</h2>
      <p>Hi there,</p>
      <p>Thank you for contacting ${agentName} about your real estate needs. We've received your message and will get back to you within 24 hours.</p>
      <p>In the meantime, feel free to call us directly at <strong>${agentPhone}</strong>.</p>
      <br>
      <p>Best regards,</p>
      <p><strong>${agentName}</strong><br>Florida Licensed Realtor</p>
    `;
  } else if (type === 'valuation') {
    subject = `Your Home Valuation Request Received`;
    htmlContent = `
      <h2>Home Valuation Request Received</h2>
      <p>Hi there,</p>
      <p>Thank you for submitting a home valuation request to ${agentName}. We're excited to help you understand your property's value in today's market.</p>
      <p>Our team will analyze recent sales in your area and prepare a comprehensive valuation report within <strong>24 hours</strong>.</p>
      <p>If you have any questions, don't hesitate to call us at <strong>${agentPhone}</strong>.</p>
      <br>
      <p>Best regards,</p>
      <p><strong>${agentName}</strong><br>Florida Licensed Realtor</p>
    `;
  } else {
    return;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: agentName,
          email: agentEmail || 'noreply@realestateagent.com'
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Brevo email error:', errorText);
    }
  } catch (err) {
    console.error('Email send error:', err);
  }
}

// =============================================
// VALIDATION HELPERS
// =============================================

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^[\d\+\-\(\)\s]{7,20}$/.test(phone);
}

function validateRequired(value) {
  return value && value.trim() !== '';
}

function getClientIdFromToken(payload) {
  return payload && payload.clientId ? payload.clientId : null;
}

// =============================================
// ROUTE HANDLERS
// =============================================

// POST /admin/login
async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { username, password, clientId } = body;

    if (!username || !password || !clientId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Missing required fields' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // Query client from database
    const result = await env.DB.prepare(
      'SELECT * FROM clients WHERE client_id = ? AND username = ?'
    ).bind(clientId, username).first();

    if (!result) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid credentials' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // Verify password
    const valid = await verifyPassword(password, result.password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid credentials' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // Generate JWT
    const token = await generateJWT({ 
      clientId: result.client_id,
      userId: result.id
    }, process.env.JWT_SECRET);

    // Save session
    await env.DB.prepare(
      'INSERT INTO sessions (session_token, client_id, expires_at) VALUES (?, ?, datetime("now", "+24 hours"))'
    ).bind(token, result.client_id).run();

    return new Response(JSON.stringify({ 
      success: true, 
      token: token,
      agentName: result.agent_name
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (err) {
    console.error('Login error:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Internal server error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

// GET /admin/verify
async function handleVerify(request, env) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ valid: false }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const payload = await verifyJWT(token, process.env.JWT_SECRET);
    if (!payload) {
      return new Response(JSON.stringify({ valid: false }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // Check session in database
    const session = await env.DB.prepare(
      'SELECT * FROM sessions WHERE session_token = ? AND client_id = ? AND expires_at > datetime("now")'
    ).bind(token, payload.clientId).first();

    if (!session) {
      return new Response(JSON.stringify({ valid: false }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // Get agent name
    const client = await env.DB.prepare(
      'SELECT agent_name FROM clients WHERE client_id = ?'
    ).bind(payload.clientId).first();

    return new Response(JSON.stringify({ 
      valid: true, 
      clientId: payload.clientId,
      agentName: client?.agent_name || ''
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (err) {
    console.error('Verify error:', err);
    return new Response(JSON.stringify({ valid: false }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

// POST /admin/logout
async function handleLogout(request, env) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (token) {
      await env.DB.prepare(
        'DELETE FROM sessions WHERE session_token = ?'
      ).bind(token).run();
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

// GET /admin/leads
async function handleGetLeads(request, env) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const payload = await verifyJWT(token, process.env.JWT_SECRET);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const clientId = getClientIdFromToken(payload);
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'Invalid client' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const results = await env.DB.prepare(
      'SELECT * FROM contacts WHERE client_id = ? ORDER BY created_at DESC'
    ).bind(clientId).all();

    return new Response(JSON.stringify({ 
      success: true, 
      leads: results.results || [] 
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (err) {
    console.error('Get leads error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

// GET /admin/valuations
async function handleGetValuations(request, env) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const payload = await verifyJWT(token, process.env.JWT_SECRET);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const clientId = getClientIdFromToken(payload);
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'Invalid client' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const results = await env.DB.prepare(
      'SELECT * FROM valuations WHERE client_id = ? ORDER BY created_at DESC'
    ).bind(clientId).all();

    return new Response(JSON.stringify({ 
      success: true, 
      valuations: results.results || [] 
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (err) {
    console.error('Get valuations error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

// POST /admin/update-status
async function handleUpdateStatus(request, env) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const payload = await verifyJWT(token, process.env.JWT_SECRET);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const clientId = getClientIdFromToken(payload);
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'Invalid client' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const body = await request.json();
    const { id, type, status } = body;

    if (!id || !type || !status) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    let table = type === 'contact' ? 'contacts' : 'valuations';
    
    const result = await env.DB.prepare(
      `UPDATE ${table} SET status = ? WHERE id = ? AND client_id = ?`
    ).bind(status, id, clientId).run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: 'Record not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (err) {
    console.error('Update status error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

// POST /leads/contact
async function handleContactLead(request, env) {
  try {
    const body = await request.json();
    const { 
      clientId, 
      visitor_name, 
      visitor_email, 
      visitor_phone, 
      interested_in, 
      message 
    } = body;

    // Validate
    if (!clientId || !validateRequired(visitor_name) || !validateRequired(visitor_email)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    if (!validateEmail(visitor_email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // Insert into database
    await env.DB.prepare(
      `INSERT INTO contacts 
       (client_id, visitor_name, visitor_email, visitor_phone, interested_in, message) 
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      clientId, 
      visitor_name, 
      visitor_email, 
      visitor_phone || '', 
      interested_in || 'general', 
      message || ''
    ).run();

    // Get agent info for email
    const agent = await env.DB.prepare(
      'SELECT agent_name, agent_email, phone FROM clients WHERE client_id = ?'
    ).bind(clientId).first();

    // Send auto-reply
    if (agent) {
      await sendAutoReply(
        visitor_email, 
        agent.agent_name, 
        agent.phone || 'N/A',
        'contact',
        agent.agent_email
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (err) {
    console.error('Contact lead error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

// POST /leads/valuation
async function handleValuationLead(request, env) {
  try {
    const body = await request.json();
    const { 
      clientId, 
      visitor_name, 
      visitor_email, 
      visitor_phone, 
      property_address, 
      property_city, 
      bedrooms, 
      bathrooms, 
      condition, 
      sqft,
      property_type
    } = body;

    // Validate
    if (!clientId || !validateRequired(visitor_name) || !validateRequired(visitor_email) || !validateRequired(property_address)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    if (!validateEmail(visitor_email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // Insert into database
    await env.DB.prepare(
      `INSERT INTO valuations 
       (client_id, visitor_name, visitor_email, visitor_phone, property_address, 
        property_city, bedrooms, bathrooms, condition, sqft) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      clientId, 
      visitor_name, 
      visitor_email, 
      visitor_phone || '', 
      property_address, 
      property_city || '', 
      bedrooms || '', 
      bathrooms || '', 
      condition || '', 
      sqft || ''
    ).run();

    // Get agent info for email
    const agent = await env.DB.prepare(
      'SELECT agent_name, agent_email, phone FROM clients WHERE client_id = ?'
    ).bind(clientId).first();

    // Send auto-reply
    if (agent) {
      await sendAutoReply(
        visitor_email, 
        agent.agent_name, 
        agent.phone || 'N/A',
        'valuation',
        agent.agent_email
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (err) {
    console.error('Valuation lead error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

// =============================================
// MAIN HANDLER
// =============================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Route handling
    try {
      switch (path) {
        case '/admin/login':
          if (method === 'POST') return handleLogin(request, env);
          break;
        case '/admin/verify':
          if (method === 'GET') return handleVerify(request, env);
          break;
        case '/admin/logout':
          if (method === 'POST') return handleLogout(request, env);
          break;
        case '/admin/leads':
          if (method === 'GET') return handleGetLeads(request, env);
          break;
        case '/admin/valuations':
          if (method === 'GET') return handleGetValuations(request, env);
          break;
        case '/admin/update-status':
          if (method === 'POST') return handleUpdateStatus(request, env);
          break;
        case '/leads/contact':
          if (method === 'POST') return handleContactLead(request, env);
          break;
        case '/leads/valuation':
          if (method === 'POST') return handleValuationLead(request, env);
          break;
        default:
          return new Response(JSON.stringify({ error: 'Not found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
          });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
  }
};
