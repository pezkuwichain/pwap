import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCaller, getCorsHeaders, unauthorized } from "../_shared/caller-auth.ts";

function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    codes.push(code);
  }
  return codes;
}

function generateTOTP(secret: string, window: number = 0): string {
  // Simple TOTP implementation
  const time = Math.floor(Date.now() / 30000) + window;
  const encoder = new TextEncoder();
  const data = encoder.encode(secret + time.toString());

  // Simple hash-based OTP
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data[i];
    hash = hash & hash;
  }

  const otp = Math.abs(hash) % 1000000;
  return otp.toString().padStart(6, "0");
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Every action below touches one account's 2FA state, so the account is
    // taken from the caller's token. The body used to name it, which let an
    // anon-key request read or disable anyone's 2FA.
    const caller = await getCaller(req, supabase);
    if (!caller) return unauthorized(corsHeaders);
    const userId = caller.id;

    const { action, code, backupCode } = await req.json();

    switch (action) {
      case "setup": {
        // Generate new 2FA setup
        const secret = generateSecret();
        const backupCodes = generateBackupCodes();

        // Store in database
        const { error } = await supabase.from("two_factor_auth").upsert({
          user_id: userId,
          secret,
          backup_codes: backupCodes,
          enabled: false,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        // Generate QR code URL for authenticator apps
        const otpUrl = `otpauth://totp/PezKuwiChain:user?secret=${secret}&issuer=PezKuwiChain`;

        return new Response(
          JSON.stringify({
            success: true,
            secret,
            qrCode: otpUrl,
            backupCodes,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      case "enable": {
        // Verify code and enable 2FA
        const { data: twoFA } = await supabase
          .from("two_factor_auth")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!twoFA) {
          throw new Error("2FA not set up");
        }

        // Check code with time window
        let isValid = false;
        for (let window = -1; window <= 1; window++) {
          if (code === generateTOTP(twoFA.secret, window)) {
            isValid = true;
            break;
          }
        }

        if (!isValid) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Invalid verification code",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Enable 2FA
        await supabase
          .from("two_factor_auth")
          .update({ enabled: true, updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        return new Response(
          JSON.stringify({
            success: true,
            message: "2FA enabled successfully",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      case "verify": {
        // Verify 2FA code during login
        const { data: twoFA } = await supabase
          .from("two_factor_auth")
          .select("*")
          .eq("user_id", userId)
          .eq("enabled", true)
          .single();

        if (!twoFA) {
          return new Response(
            JSON.stringify({
              success: true,
              required: false,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Check if it's a backup code
        if (backupCode) {
          const codes = twoFA.backup_codes || [];
          const codeIndex = codes.indexOf(backupCode);

          if (codeIndex === -1) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Invalid backup code",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          // Remove used backup code
          codes.splice(codeIndex, 1);
          await supabase
            .from("two_factor_auth")
            .update({ backup_codes: codes })
            .eq("user_id", userId);

          return new Response(
            JSON.stringify({
              success: true,
              message: "Backup code verified",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Verify TOTP code with time window
        let isValid = false;
        for (let window = -1; window <= 1; window++) {
          if (code === generateTOTP(twoFA.secret, window)) {
            isValid = true;
            break;
          }
        }

        if (!isValid) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Invalid verification code",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Code verified successfully",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      case "disable": {
        // Disable 2FA
        await supabase.from("two_factor_auth").delete().eq("user_id", userId);

        return new Response(
          JSON.stringify({
            success: true,
            message: "2FA disabled successfully",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      case "check": {
        // Check if 2FA is enabled
        const { data: twoFA } = await supabase
          .from("two_factor_auth")
          .select("enabled")
          .eq("user_id", userId)
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            enabled: twoFA?.enabled || false,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      case "regenerate-backup": {
        // Regenerate backup codes
        const newBackupCodes = generateBackupCodes();

        await supabase
          .from("two_factor_auth")
          .update({
            backup_codes: newBackupCodes,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        return new Response(
          JSON.stringify({
            success: true,
            backupCodes: newBackupCodes,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      default:
        throw new Error("Invalid action");
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
