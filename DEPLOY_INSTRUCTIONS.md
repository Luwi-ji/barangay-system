# Deploy Edge Functions - Step by Step

## Step 1: Login to Supabase

Run this command in your terminal:
```bash
npx supabase login
```

This will open a browser window asking you to log in to your Supabase account. Log in and authorize the CLI.

## Step 2: Link to Your Project

After logging in, link your Supabase project:
```bash
npx supabase link --project-ref iikwlhjgzydxpprnipgm
```

When prompted, enter your Supabase database password (or press Enter if you want to skip linking the local database).

## Step 3: Deploy the Edge Functions

Once linked, deploy both functions:

```bash
# Deploy create-payment-intent
npx supabase functions deploy create-payment-intent

# Deploy verify-payment
npx supabase functions deploy verify-payment
```

## Step 4: Verify Deployment

Check if the functions deployed successfully:
```bash
npx supabase functions list
```

You should see both `create-payment-intent` and `verify-payment` in the list.

## Step 5: Test the Payment Flow

1. Go back to your app
2. Try submitting a new document request
3. The payment modal should appear
4. Click "Pay" button
5. You should be redirected to the checkout page
6. Payment should be marked as completed and you'll see the success screen

## Troubleshooting

If you get an error about missing database password, you can use:
```bash
npx supabase link --project-ref iikwlhjgzydxpprnipgm --password your_db_password
```

Or skip the database linking with:
```bash
npx supabase link --project-ref iikwlhjgzydxpprnipgm --skip-confirmation
```
