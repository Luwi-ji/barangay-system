# Supabase Edge Functions Setup

The payment system uses Supabase Edge Functions to handle payment creation and verification.

## Functions Created

1. **create-payment-intent** - Creates a payment intent in the database
2. **verify-payment** - Verifies payment and updates request status

## Deploying Edge Functions

### Prerequisites
- Supabase CLI installed: `npm install -g supabase`
- Connected to your Supabase project

### Steps

1. **Initialize Supabase locally (if not already done)**
   ```bash
   supabase init
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link your project**
   ```bash
   supabase link --project-ref iikwlhjgzydxpprnipgm
   ```

4. **Deploy the Edge Functions**
   ```bash
   supabase functions deploy create-payment-intent
   supabase functions deploy verify-payment
   ```

5. **Verify deployment**
   ```bash
   supabase functions list
   ```

## Testing

Once deployed, the payment flow will:
1. User fills form → clicks "Submit Request"
2. Request created in database → Payment modal appears
3. User clicks "Pay" → Frontend calls `/functions/v1/create-payment-intent`
4. Backend creates payment record and returns clientSecret
5. Frontend redirects to `/checkout` page
6. Checkout page calls `/functions/v1/verify-payment`
7. Backend marks payment as completed
8. User sees success message and redirects to dashboard

## Environment Variables

The Edge Functions use these Supabase environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key (for frontend)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for backend)

These are automatically available in Edge Functions.

## Future: Stripe Integration

To enable real Stripe payments:
1. Add your Stripe API keys as Supabase secrets:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY your_stripe_secret_key
   supabase secrets set STRIPE_PUBLISHABLE_KEY your_stripe_publishable_key
   ```

2. Update the Edge Functions to call Stripe API:
   - In `create-payment-intent/index.ts`: Call `stripe.paymentIntents.create()`
   - In `verify-payment/index.ts`: Call `stripe.paymentIntents.retrieve()`

3. Handle Stripe webhooks for payment confirmation
