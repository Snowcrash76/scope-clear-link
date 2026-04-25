import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteNotificationRequest {
  quoteToken: string;
  notificationType: "approved" | "declined";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quoteToken, notificationType }: QuoteNotificationRequest = await req.json();

    // Validate inputs
    if (!quoteToken || typeof quoteToken !== "string") {
      return new Response(JSON.stringify({ error: "quoteToken is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (notificationType !== "approved" && notificationType !== "declined") {
      return new Response(JSON.stringify({ error: "notificationType must be 'approved' or 'declined'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch the quote by token
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("quote_token", quoteToken)
      .single();

    if (quoteError || !quote) {
      throw new Error(`Failed to fetch quote: ${quoteError?.message}`);
    }

    // Verify quote status matches the notification type to prevent spoofed/replayed notifications
    if (quote.status !== notificationType) {
      return new Response(
        JSON.stringify({ error: "Quote status does not match notificationType — notification not sent" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Fetch the project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", quote.project_id)
      .single();

    if (projectError || !project) {
      throw new Error(`Failed to fetch project: ${projectError?.message}`);
    }

    // Fetch the trade profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", project.user_id)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to fetch trade profile: ${profileError?.message}`);
    }

    const recipientEmail = profile.email;
    if (!recipientEmail) {
      throw new Error("Tradesperson email not found");
    }

    const recipientName = profile.contact_name || profile.business_name || "there";
    const clientName = project.client_name;
    const projectName = project.name;
    const quoteNumber = quote.quote_number;
    const clientComment = quote.client_comment;

    const baseUrl = Deno.env.get("SITE_URL");
    if (!baseUrl) {
      throw new Error("SITE_URL is not configured as a Supabase secret");
    }
    const projectUrl = `${baseUrl}/manage/${project.id}`;

    let subject: string;
    let heading: string;
    let message: string;
    let statusColor: string;
    let statusIcon: string;

    if (notificationType === "approved") {
      subject = `[${projectName}] ${clientName} has accepted your quote`;
      heading = "Quote Accepted";
      message = `<strong>${clientName}</strong> has accepted your quote for <strong>${projectName}</strong>. You can now proceed with planning the work.`;
      statusColor = "#16a34a";
      statusIcon = "✓";
    } else {
      subject = `[${projectName}] ${clientName} has declined your quote`;
      heading = "Quote Declined";
      message = `<strong>${clientName}</strong> has declined your quote for <strong>${projectName}</strong>.`;
      statusColor = "#dc2626";
      statusIcon = "✕";
    }

    let commentHtml = "";
    if (clientComment) {
      commentHtml = `
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #6b7280;">
          <h4 style="margin: 0 0 8px 0; color: #374151;">Client's comment</h4>
          <p style="margin: 0; color: #6b7280;">${clientComment}</p>
        </div>
      `;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <div style="display: inline-block; width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.2); line-height: 48px; font-size: 24px; color: white; margin-bottom: 12px;">${statusIcon}</div>
            <h1 style="color: white; margin: 0; font-size: 24px;">${heading}</h1>
          </div>

          <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #6b7280; margin-bottom: 24px;">Hi ${recipientName},</p>

            <p style="margin-bottom: 24px;">${message}</p>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor}; margin: 24px 0;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Quote</p>
              <h3 style="margin: 0 0 4px 0; color: #1f2937;">${quoteNumber}</h3>
              <p style="margin: 0; color: #6b7280;">${projectName}</p>
            </div>

            ${commentHtml}

            <div style="text-align: center; margin-top: 32px;">
              <a href="${projectUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Project</a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              This email was sent regarding project: ${projectName}<br>
              Client: ${clientName}
            </p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "ScopeClear <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: subject,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(emailResult)}`);
    }

    console.log("Quote notification email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailResponse: emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending quote notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
