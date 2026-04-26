
import { corsHeaders } from "./cors-header";

interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

// ─── PUBLIC: POST /api/contact ──────────────────────────────
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // Safe body parsing
    let body: ContactRequest;
    try {
      body = await request.json<ContactRequest>();
    } catch {
      return Response.json(
        { error: "Invalid or missing JSON body" },
        { status: 400, headers: corsHeaders }
      );
    }

    let { name, email, message } = body;

    // Trim inputs
    name = name?.trim();
    email = email?.trim();
    message = message?.trim();

    // Required validation
    if (!name || !email || !message) {
      return Response.json(
        { error: "All fields required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Email validation
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!isValidEmail.test(email)) {
      return Response.json(
        { error: "Invalid email format" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Prevent undefined (D1 issue)
    const ip = request.headers.get("CF-Connecting-IP") ?? null;

    // Safer query (avoid REPLACE issues)
    await env.DB.prepare(
      `INSERT INTO contacts (email, name, message, ip_address)
       VALUES (?, ?, ?, ?)`
    )
      .bind(email, name, message, ip)
      .run();

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("ERROR:", err);
    if (err?.message?.includes("UNIQUE constraint failed")) {
      return Response.json(
        { error: "You've already sent this exact message." },
        { status: 409, headers: corsHeaders }
      );
    }
    return Response.json(
      { error: err?.message || "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
};

// ─── PRIVATE: GET /api/contact ──────────────────────────────
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const adminKey = request.headers.get("X-Admin-Key");

    if (!adminKey || adminKey !== env.ADMIN_KEY) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { results } = await env.DB.prepare(
      `SELECT * FROM contacts ORDER BY created_at DESC`
    ).all();

    return Response.json(results, { headers: corsHeaders });
  } catch (err) {
    return Response.json(
      { error: "Server error", e: err },
      { status: 500, headers: corsHeaders }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};
