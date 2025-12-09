import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Use hardcoded URL - it's public and OK to expose
const SUPABASE_URL = "https://iikwlhjgzydxpprnipgm.supabase.co"
// This should be service role key from Supabase dashboard
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { requestId, amount, documentName, metadata } = await req.json()

    if (!requestId || !amount || !documentName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: requestId, amount, documentName" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    // Get user from auth context
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    // Create Supabase client
    if (!SUPABASE_SERVICE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
      return new Response(
        JSON.stringify({ error: "Server not properly configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    // Generate a mock payment intent ID
    const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const clientSecret = `${paymentIntentId}_secret_${Math.random().toString(36).substr(2, 20)}`

    // Store payment record in database
    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .insert({
        request_id: requestId,
        user_id: user.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_php: amount,
        currency: "PHP",
        payment_method: "card",
        payment_status: "pending",
        description: `Payment for ${documentName}`,
        metadata: metadata || { documentName },
      })
      .select()

    if (paymentError) {
      console.error("Database error:", paymentError)
      return new Response(
        JSON.stringify({ error: "Failed to create payment record: " + paymentError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    // Return client secret for frontend
    return new Response(
      JSON.stringify({
        success: true,
        clientSecret: clientSecret,
        paymentIntentId: paymentIntentId,
        message: "Payment intent created successfully",
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
