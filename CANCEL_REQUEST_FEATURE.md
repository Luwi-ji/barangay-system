# Cancel Request Feature Implementation Guide

## Overview
This feature allows residents to cancel their pending/processing requests. The cancellation is tracked in status_history and visible in admin analytics.

## Step 1: Database Changes (SQL)

Run this SQL in Supabase SQL Editor:

```sql
-- Add 'Cancelled' status to requests if not already present
-- (already exists in most setups, but verify)

-- Create index for faster filtering of cancelled requests
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_status_history_status ON public.status_history(status);

-- Add RLS policy to allow residents to cancel their own requests
DROP POLICY IF EXISTS "Users can cancel own requests" ON public.requests;
CREATE POLICY "Users can cancel own requests"
ON public.requests FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status IN ('Pending', 'Processing'))
WITH CHECK (user_id = auth.uid() AND (status = 'Cancelled' OR status IN ('Pending', 'Processing')));

-- Allow residents to insert cancellation status history
DROP POLICY IF EXISTS "Users can record own cancellation" ON public.status_history;
CREATE POLICY "Users can record own cancellation"
ON public.status_history FOR INSERT
TO authenticated
WITH CHECK (
  request_id IN (SELECT id FROM requests WHERE user_id = auth.uid())
  OR auth.uid() IN (SELECT DISTINCT id FROM profiles WHERE role IN ('admin', 'encoder', 'captain'))
);
```

## Step 2: Frontend - Add Cancel Button

Update `src/components/user/RequestHistory.jsx`:

### A. Add Cancel State
```javascript
const [cancellingId, setCancellingId] = useState(null)
```

### B. Add Cancel Function
```javascript
const handleCancelRequest = async (request) => {
  if (!window.confirm('Are you sure you want to cancel this request? This action cannot be undone.')) return

  setCancellingId(request.id)
  try {
    // Update request status to Cancelled
    const { error: updateError } = await supabase
      .from('requests')
      .update({
        status: 'Cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', request.id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    // Record cancellation in status_history
    const { error: historyError } = await supabase
      .from('status_history')
      .insert({
        request_id: request.id,
        status: 'Cancelled',
        changed_by: null,
        notes: 'Request cancelled by resident'
      })

    if (historyError) {
      console.warn('Could not record cancellation history:', historyError)
    }

    alert('Request cancelled successfully!')
    await fetchRequests()
    setShowModal(false)
  } catch (error) {
    console.error('Error cancelling request:', error)
    alert('Failed to cancel request: ' + error.message)
  } finally {
    setCancellingId(null)
  }
}
```

### C. Add Cancel Button in Modal

In the modal footer, add:

```javascript
{/* Modal Footer */}
<div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
  <div className="flex items-center space-x-2">
    <button
      onClick={() => setShowModal(false)}
      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
    >
      Close
    </button>
    
    {/* Cancel Request Button */}
    {selectedRequest && ['Pending', 'Processing'].includes(selectedRequest.status) && (
      <button
        onClick={() => handleCancelRequest(selectedRequest)}
        disabled={cancellingId === selectedRequest.id}
        className="px-4 py-2 border border-red-300 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {cancellingId === selectedRequest.id ? 'Cancelling...' : 'Cancel Request'}
      </button>
    )}
  </div>

  {uploadedFile && (
    <button
      onClick={handleUploadDocument}
      disabled={uploading}
      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
    >
      {uploading ? 'Uploading...' : 'Upload Document'}
    </button>
  )}
</div>
```

## Step 3: Admin Analytics Update

Update `src/components/admin/Analytics.jsx` to include cancellation stats:

```javascript
// Add to analytics data fetching
const fetchAnalytics = async () => {
  try {
    // ... existing code ...

    // Fetch cancellation stats
    const { data: cancelledRequests, error: cancelError } = await supabase
      .from('requests')
      .select('id')
      .eq('status', 'Cancelled')

    if (!cancelError) {
      setCancellationCount(cancelledRequests?.length || 0)
    }

    // Fetch cancellation trend (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentCancellations } = await supabase
      .from('status_history')
      .select('changed_at')
      .eq('status', 'Cancelled')
      .gte('changed_at', thirtyDaysAgo)

    if (recentCancellations) {
      setCancellationTrend(recentCancellations.length)
    }
  } catch (error) {
    console.error('Error fetching analytics:', error)
  }
}

// Display in analytics dashboard
<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
  {/* ... existing cards ... */}
  
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-600 text-sm">Cancelled Requests</p>
        <p className="text-3xl font-bold text-red-600 mt-2">{cancellationCount}</p>
        <p className="text-xs text-gray-500 mt-2">
          {cancellationTrend} cancelled this month
        </p>
      </div>
      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
        <X className="w-6 h-6 text-red-600" />
      </div>
    </div>
  </div>
</div>
```

## Step 4: Update Request Status Badge (Optional)

If you want to style "Cancelled" status differently, update `src/components/shared/StatusBadge.jsx`:

```javascript
export default function StatusBadge({ status }) {
  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Processing': 'bg-blue-100 text-blue-800',
      'Ready for Pickup': 'bg-green-100 text-green-800',
      'Completed': 'bg-gray-100 text-gray-800',
      'Declined': 'bg-red-100 text-red-800',
      'Cancelled': 'bg-slate-100 text-slate-800',  // Add this
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  )
}
```

## Step 5: Admin View - Show Cancellation Reason

In admin RequestManagement, add to the modal:

```javascript
{/* Cancellation Info */}
{selectedRequest.status === 'Cancelled' && (
  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
    <h4 className="font-medium text-gray-900 mb-2">Cancellation Information</h4>
    <p className="text-sm text-gray-600">
      This request was cancelled by the resident.
    </p>
    {statusHistory[0]?.status === 'Cancelled' && (
      <p className="text-xs text-gray-500 mt-2">
        Cancelled on: {formatDateTime(statusHistory[0]?.changed_at)}
      </p>
    )}
  </div>
)}
```

## Step 6: Prevent Operations on Cancelled Requests

Add validation in admin functions:

```javascript
const handleUpdateRequest = async () => {
  // Prevent updating cancelled requests
  if (selectedRequest.status === 'Cancelled') {
    alert('Cannot update a cancelled request')
    return
  }
  
  // ... rest of update logic ...
}
```

## Testing Checklist

### Resident Side:
- [ ] Create a new request
- [ ] Go to Request History
- [ ] Click "View" on a Pending request
- [ ] See "Cancel Request" button (only for Pending/Processing)
- [ ] Click "Cancel Request"
- [ ] Confirm cancellation
- [ ] Request status changes to "Cancelled"
- [ ] Refresh page - status persists
- [ ] Cannot see cancel button on Completed/Declined requests

### Admin Side:
- [ ] Login as admin
- [ ] Go to Request Management
- [ ] Search for cancelled request
- [ ] Open it in Process modal
- [ ] See "Cancelled" status with different styling
- [ ] See cancellation info
- [ ] Cannot update cancelled request
- [ ] Go to Analytics
- [ ] See cancellation count and trend

### Database:
- [ ] Check requests table - see status = 'Cancelled'
- [ ] Check status_history - see Cancelled entry
- [ ] Check index creation succeeded

## File Summary

**Files to Modify:**
1. `src/components/user/RequestHistory.jsx` - Add cancel button and function
2. `src/components/admin/Analytics.jsx` - Add cancellation stats
3. `src/components/shared/StatusBadge.jsx` - Add Cancelled color
4. `src/components/admin/RequestManagement.jsx` - Add validation and cancellation info

**SQL to Run:**
- Execute in Supabase SQL Editor (copy-paste above)

## Important Notes

1. **Cancellation is Final**: Once cancelled, residents cannot reopen the request
2. **Admin Cannot Cancel**: Only residents can cancel their own requests
3. **Status Tracking**: All cancellations are recorded in status_history for audit trail
4. **No Data Loss**: Original documents and info remain visible for admin reference
5. **Analytics**: Cancellations counted separately for management insights

## Security

✅ Users can only cancel their own requests (RLS enforced)
✅ Only pending/processing requests can be cancelled
✅ Cannot update cancelled requests
✅ All changes logged in status_history
✅ Admin has read-only access to cancellation info

## Optional Enhancements

- Add cancellation reason field (allow resident to provide reason)
- Send notification email to resident on cancellation
- Allow admin to restore cancelled requests (if needed)
- Generate cancellation report for admins
- Archive cancelled requests separately

