// functions/api/lead.ts
// Cloudflare Pages Function — automatically served at /api/lead
//
// Env vars needed (set in Cloudflare Pages > Settings > Environment variables):
//   AIRTABLE_TOKEN      - Personal access token, data.records:write, scoped to the Deloy base
//   AIRTABLE_BASE_ID    - e.g. appJTHtkTGQbiuCpR
//   AIRTABLE_TABLE_NAME - "Inbound Leads"

interface Env {
    AIRTABLE_TOKEN: string;
    AIRTABLE_BASE_ID: string;
    AIRTABLE_TABLE_NAME: string;
  }
  
  interface LeadPayload {
    name?: string;
    contact?: string;
    projectLocation?: string;
    description?: string;
    // Anti-spam fields, not stored in Airtable
    website?: string;   // honeypot — real users never fill this in
    loadedAt?: number;  // timestamp (ms) captured when the form rendered
  }
  
  const MIN_SUBMIT_SECONDS = 3;
  
  function jsonResponse(body: Record<string, unknown>, status: number): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
  
    let payload: LeadPayload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  
    const { name, contact, projectLocation, description, website, loadedAt } = payload;
  
    // --- Spam checks ---
    // 1. Honeypot: a real visitor never sees or fills this field.
    if (website && website.trim() !== "") {
      // Return a generic success so bots don't learn the honeypot was tripped.
      return jsonResponse({ ok: true }, 200);
    }
  
    // 2. Timing check: bots submit almost instantly after the page loads.
    if (typeof loadedAt === "number") {
      const elapsedSeconds = (Date.now() - loadedAt) / 1000;
      if (elapsedSeconds < MIN_SUBMIT_SECONDS) {
        return jsonResponse({ ok: true }, 200);
      }
    }
  
    // --- Basic field validation ---
    if (!name || !contact) {
      return jsonResponse({ error: "Name and contact are required" }, 400);
    }
  
    // --- Write to Airtable ---
    const airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(
      env.AIRTABLE_TABLE_NAME
    )}`;
  
    const airtableRes = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          Name: name,
          Contact: contact,
          "Project Location": projectLocation || "",
          Description: description || "",
          "Submitted At": new Date().toISOString(),
          Status: "New",
        },
      }),
    });
  
    if (!airtableRes.ok) {
      const errText = await airtableRes.text();
      console.error("Airtable error:", errText);
      return jsonResponse({ error: "Could not save lead" }, 502);
    }
  
    return jsonResponse({ ok: true }, 200);
  };