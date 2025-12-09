# Vercel Deployment Guide

## Prerequisites
- Node.js 18+ installed locally
- A Vercel account (https://vercel.com)
- GitHub/GitLab/Bitbucket account with your project pushed

## Deployment Steps

### 1. Install Vercel CLI (Optional but Recommended)
```bash
npm install -g vercel
```

### 2. Prepare Environment Variables
You'll need these environment variables from your Supabase project:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_STRIPE_PUBLIC_KEY` - Your Stripe public key (if using payments)

### 3. Deploy via Vercel Dashboard (Recommended for First Time)

1. Go to https://vercel.com/new
2. Import your Git repository (GitHub/GitLab/Bitbucket)
3. Vercel will auto-detect it's a Vite project
4. Add environment variables:
   - Click "Environment Variables"
   - Add each variable from step 2
5. Click "Deploy"

### 4. Deploy via Vercel CLI (Alternative)

```bash
# Login to Vercel (first time only)
vercel login

# Deploy to preview environment
vercel

# Deploy to production
vercel --prod
```

### 5. Configure Supabase & Stripe URLs
After deployment, ensure your Supabase and Stripe settings are configured to allow your Vercel domain:

**Supabase:**
- Go to Project Settings > API
- Add your Vercel domain to "Authorized URLs"

**Stripe (if applicable):**
- Go to Webhooks settings
- Update webhook endpoints to your Vercel domain

## Environment Variables Reference

| Variable | Description | Source |
|----------|-------------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard > Settings > API |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key | Stripe Dashboard > Developers > API Keys |

## Monitoring & Logs

- View logs: Go to your Vercel project > Deployments > Click deployment > Logs
- Monitor performance: Vercel Dashboard > Analytics
- Check real-time errors: Vercel Dashboard > Functions (for edge functions)

## Troubleshooting

### Build fails
- Check `npm run build` works locally: `npm install && npm run build`
- Ensure all environment variables are set correctly in Vercel
- Check Node.js version matches: `node --version`

### Application not working
- Check browser console for errors (F12)
- Verify CORS settings in Supabase
- Confirm environment variables are correctly set
- Check Vercel deployment logs

### Database connection issues
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check Supabase project is active (not paused)
- Ensure Vercel domain is in Supabase authorized URLs

## Production Best Practices

1. **Enable automatic deployments** from your main branch
2. **Use preview deployments** for pull requests
3. **Monitor error rates** in Vercel Analytics
4. **Set up alerts** for failed deployments
5. **Enable auto-scaling** if using serverless functions
6. **Review security** - ensure sensitive keys are never in code

## Rollback

If something goes wrong:
1. Go to your Vercel project > Deployments
2. Find the previous working deployment
3. Click the deployment and select "Promote to Production"
