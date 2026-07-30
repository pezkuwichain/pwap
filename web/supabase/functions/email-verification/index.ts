export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, token, email } = await req.json();

    if (action === "send") {
      // Generate verification token
      const verificationToken = crypto.randomUUID();

      // Store token in database (expires in 24 hours)
      const { createClient } =
        await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: user } = await supabase.auth.admin.getUserByEmail(email);

      if (!user?.user) {
        throw new Error("User not found");
      }

      await supabase.from("email_verification_tokens").insert({
        user_id: user.user.id,
        token: verificationToken,
        email: email,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      // In production, send email via email service
      // For now, return the token
      return new Response(
        JSON.stringify({
          success: true,
          message: "Verification email sent",
          token: verificationToken, // Remove in production
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "verify") {
      const { createClient } =
        await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Check token validity
      const { data: tokenData } = await supabase
        .from("email_verification_tokens")
        .select("*")
        .eq("token", token)
        .single();

      if (!tokenData || new Date(tokenData.expires_at) < new Date()) {
        throw new Error("Invalid or expired token");
      }

      // Update user profile
      await supabase
        .from("profiles")
        .update({
          email_verified: true,
          email_verified_at: new Date().toISOString(),
        })
        .eq("id", tokenData.user_id);

      // Delete used token
      await supabase
        .from("email_verification_tokens")
        .delete()
        .eq("token", token);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email verified successfully",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
