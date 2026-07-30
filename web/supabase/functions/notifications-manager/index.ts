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
    const {
      action,
      userId,
      notificationId,
      title,
      message,
      type,
      actionUrl,
      notificationIds,
    } = await req.json();

    // Import Supabase client
    const { createClient } =
      await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result;

    switch (action) {
      case "create":
        // Create notification
        const { data: notification, error: createError } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            title,
            message,
            type: type || "info",
            action_url: actionUrl,
          })
          .select()
          .single();

        if (createError) throw createError;
        result = { success: true, notification };
        break;

      case "markRead":
        // Mark notification as read
        const { error: readError } = await supabase
          .from("notifications")
          .update({ read: true, read_at: new Date().toISOString() })
          .eq("id", notificationId)
          .eq("user_id", userId);

        if (readError) throw readError;
        result = { success: true };
        break;

      case "markAllRead":
        // Mark all notifications as read
        const { error: allReadError } = await supabase
          .from("notifications")
          .update({ read: true, read_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("read", false);

        if (allReadError) throw allReadError;
        result = { success: true };
        break;

      case "delete":
        // Delete notification
        const { error: deleteError } = await supabase
          .from("notifications")
          .delete()
          .eq("id", notificationId)
          .eq("user_id", userId);

        if (deleteError) throw deleteError;
        result = { success: true };
        break;

      case "deleteMultiple":
        // Delete multiple notifications
        const { error: deleteMultipleError } = await supabase
          .from("notifications")
          .delete()
          .in("id", notificationIds)
          .eq("user_id", userId);

        if (deleteMultipleError) throw deleteMultipleError;
        result = { success: true };
        break;

      case "getUnreadCount":
        // Get unread notification count
        const { count, error: countError } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("read", false);

        if (countError) throw countError;
        result = { success: true, count };
        break;

      default:
        throw new Error("Invalid action");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
