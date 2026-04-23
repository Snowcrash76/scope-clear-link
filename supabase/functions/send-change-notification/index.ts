import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  projectId: string;
  changeRequestId: string;
  notificationType: "created" | "approved" | "declined";
  recipientType: "trade" | "client";
  changeTitle: string;
  changeDescription: string;
  costImpact?: number;
  timeImpact?: string;
  // If provided, the edge function will also update the change request status
  // in the DB using the service role key (bypasses RLS for unauthenticated clients)
  updateStatus?: "approved" | "declined";
  resolutionComment?: string;
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

    const {
      projectId,
      changeRequestId,
      notificationType,
      recipientType,
      changeTitle,
      changeDescription,
      costImpact,
      timeImpact,
      updateStatus,
      resolutionComment,
    }: NotificationRequest = await req.json();

    // If requested, update the change request status server-side (bypasses RLS)
    if (updateStatus) {
      const { error: updateError } = await supabase
        .from("change_requests")
        .update({
          status: updateStatus,
          resolved_at: new Date().toISOString(),
          resolution_comment: resolutionComment || null,
        })
        .eq("id", changeRequestId);

      if (updateError) {
        throw new Error(`Failed to update change request status: ${updateError.message}`);
      }
    }

    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Failed to fetch project: ${projectError?.message}`);
    }

    // Fetch trade profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", project.user_id)
      .single();

    // Determine recipient email and sender info
    let recipientEmail: string;
    let recipientName: string;
    let senderName: string;
    let projectUrl: string;

    const baseUrl = Deno.env.get("SITE_URL") || "https://scope-clear-link.lovable.app";

    if (recipientType === "client") {
      recipientEmail = project.client_email;
      recipientName = project.client_name;
      senderName = profile?.business_name || "Your Trade";
      projectUrl = `${baseUrl}/project/${projectId}`;
    } else {
      recipientEmail = profile?.email;
      recipientName = profile?.contact_name || "Trade";
      senderName = project.client_name;
      projectUrl = `${baseUrl}/manage/${projectId}`;
    }

    if (!recipientEmail) {
      throw new Error("Recipient email not found");
    }

    // Build email content based on notification type
    let subject: string;
    let heading: string;
    let message: string;
    let actionText: string;

    switch (notificationType) {
      case "created":
        subject = `[${project.name}] New change request requires your attention`;
        heading = "New Change Request";
        message = recipientType === "client"
          ? `${senderName} has submitted a change request for your project that requires your review.`
          : `Your client ${senderName} has submitted a change request for the project.`;
        actionText = "Review Change Request";
        break;
      case "approved":
        subject = `[${project.name}] Your change request was approved`;
        heading = "Change Request Approved ✓";
        message = `Great news! ${senderName} has approved your change request.`;
        actionText = "View Project";
        break;
      case "declined":
        subject = `[${project.name}] Your change request was declined`;
        heading = "Change Request Declined";
        message = `${senderName} has declined your change request. Please review the details below.`;
        actionText = "View Project";
        break;
      default:
        throw new Error("Invalid notification type");
    }

    // Build impact section
    let impactHtml = "";
    if (costImpact || timeImpact) {
      impactHtml = `
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h4 style="margin: 0 0 8px 0; color: #374151;">Impact</h4>
          ${costImpact ? `<p style="margin: 4px 0; color: #6b7280;">Cost: <strong>$${costImpact.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</strong></p>` : ""}
          ${timeImpact ? `<p style="margin: 4px 0; color: #6b7280;">Time: <strong>${timeImpact}</strong></p>` : ""}
        </div>
      `;
    }

    // Build resolution comment section
    let commentHtml = "";
    if (resolutionComment && notificationType !== "created") {
      commentHtml = `
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #6b7280;">
          <h4 style="margin: 0 0 8px 0; color: #374151;">Comment</h4>
          <p style="margin: 0; color: #6b7280;">${resolutionComment}</p>
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
            <h1 style="color: white; margin: 0; font-size: 24px;">${heading}</h1>
          </div>
          
          <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #6b7280; margin-bottom: 24px;">Hi ${recipientName},</p>
            
            <p style="margin-bottom: 24px;">${message}</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 24px 0;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937;">${changeTitle}</h3>
              <p style="margin: 0; color: #6b7280;">${changeDescription}</p>
            </div>
            
            ${impactHtml}
            ${commentHtml}
            
            <div style="text-align: center; margin-top: 32px;">
              <a href="${projectUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">${actionText}</a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              This email was sent regarding project: ${project.name}<br>
              If you have questions, please contact the ${recipientType === "client" ? "trade" : "client"} directly.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email using Resend API directly
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

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailResponse: emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
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
