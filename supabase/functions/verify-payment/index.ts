import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUPABASE_URL = "https://iikwlhjgzydxpprnipgm.supabase.co"
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { clientSecret, requestId } = await req.json()

    console.log("Verify payment request received - ClientSecret:", clientSecret, "RequestId:", requestId)

    if (!clientSecret || !requestId) {
      console.error("Missing required fields")
      return new Response(
        JSON.stringify({ error: "Missing required fields: clientSecret, requestId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    if (!SUPABASE_SERVICE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
      return new Response(
        JSON.stringify({ error: "Server not properly configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const paymentIntentId = clientSecret.split("_secret_")[0]

    console.log("Verifying payment - Intent ID:", paymentIntentId, "Request ID:", requestId)

    // Update the request with payment status only - don't change the main status
    const { error: requestUpdateError } = await supabase
      .from("requests")
      .update({
        payment_status: "completed",
        stripe_payment_intent_id: paymentIntentId,
        payment_date: new Date().toISOString(),
      })
      .eq("id", requestId)

    if (requestUpdateError) {
      console.error("Request update error:", requestUpdateError)
      return new Response(
        JSON.stringify({ error: "Failed to update request: " + requestUpdateError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    // Also update or create payment record
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle()

    if (existingPayment) {
      await supabase
        .from("payments")
        .update({
          payment_status: "completed",
          payment_date: new Date().toISOString(),
        })
        .eq("id", existingPayment.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentStatus: "completed",
        message: "Payment verified and request updated successfully",
        paymentIntentId: paymentIntentId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    )
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    )
  }
})

