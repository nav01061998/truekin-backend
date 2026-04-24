# Medicines API - Testing Guide

## Quick Test Commands

### 1. Test Consuming Currently (Page 1)
```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingPage=1&consumingLimit=10" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token" \
  -H "Accept: application/json"
```

**Expected Response Structure:**
```json
{
  "pageTitle": "Medicines",
  "backLabel": "Medicines",
  "consumingCurrently": {
    "medicines": [...],
    "pagination": {
      "total": <number>,
      "page": 1,
      "limit": 10,
      "offset": 0,
      "hasMore": <boolean>
    },
    "emptyState": {...}
  },
  "pastMedicines": {...}
}
```

### 2. Test Consuming Currently (Page 2)
```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingPage=2&consumingLimit=10" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token"
```

**Verify:**
- `page`: 2
- `offset`: 10
- `hasMore`: depends on total

### 3. Test Past Medicines
```bash
curl -X GET "http://localhost:3000/v1/medicines?pastPage=1&pastLimit=10" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token"
```

**Verify:**
- `pastMedicines.sections` is array
- Each section has `dateRange`, `medicines`, `pagination`
- Date format is "Month Year"

### 4. Test Custom Page Sizes
```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingLimit=5&pastLimit=20" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token"
```

**Verify:**
- `consumingCurrently.pagination.limit`: 5
- `pastMedicines.sections[0].pagination.limit`: 20

### 5. Test Empty State
```bash
curl -X GET "http://localhost:3000/v1/medicines" \
  -H "x-user-id: new-user-with-no-medicines" \
  -H "x-session-token: valid-token"
```

**Expected:**
- `consumingCurrently.medicines`: []
- `consumingCurrently.emptyState.title`: "No Medicines Being Taken"
- `pastMedicines.sections`: []

### 6. Test Missing Auth Header
```bash
curl -X GET "http://localhost:3000/v1/medicines"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Missing authentication headers",
  "code": "MISSING_AUTH",
  "requestId": "..."
}
```

**Expected Status:** 401

### 7. Test Invalid Session
```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingPage=1" \
  -H "x-user-id: user-123" \
  -H "x-session-token: invalid-token"
```

**Expected Status:** 401
**Expected Code:** "UNAUTHORIZED"

### 8. Test Invalid Page Parameter
```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingPage=0" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token"
```

**Expected Status:** 400
**Expected Error:** Validation error about page >= 1

### 9. Test Limit Exceeding Max
```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingLimit=200" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token"
```

**Expected:**
- Limit should be capped at 100
- Request succeeds with limit: 100

---

## Assertion Tests

### Response Structure Assertions

```javascript
// Test 1: Response contains required top-level fields
assert(response.pageTitle === "Medicines");
assert(response.backLabel === "Medicines");
assert(response.consumingCurrently !== undefined);
assert(response.pastMedicines !== undefined);

// Test 2: Consuming section structure
assert(Array.isArray(response.consumingCurrently.medicines));
assert(response.consumingCurrently.pagination !== undefined);
assert(response.consumingCurrently.emptyState !== undefined);

// Test 3: Pagination object structure
const pagination = response.consumingCurrently.pagination;
assert(typeof pagination.total === 'number');
assert(typeof pagination.page === 'number');
assert(typeof pagination.limit === 'number');
assert(typeof pagination.offset === 'number');
assert(typeof pagination.hasMore === 'boolean');

// Test 4: Medicine object fields
if (response.consumingCurrently.medicines.length > 0) {
  const medicine = response.consumingCurrently.medicines[0];
  assert(medicine.id !== undefined);
  assert(medicine.name !== undefined);
  assert(medicine.dosage !== undefined);
  assert(medicine.frequency !== undefined);
  assert(medicine.indication !== undefined);
  assert(medicine.components !== undefined);
  assert(medicine.prescribedBy !== undefined);
  assert(medicine.startedOn !== undefined);
  assert(['active', 'inactive', 'discontinued'].includes(medicine.status));
}

// Test 5: Empty state structure
const emptyState = response.consumingCurrently.emptyState;
assert(typeof emptyState.title === 'string');
assert(typeof emptyState.description === 'string');
assert(emptyState.title !== '');
assert(emptyState.description !== '');

// Test 6: Past medicines sections structure
if (response.pastMedicines.sections.length > 0) {
  const section = response.pastMedicines.sections[0];
  assert(typeof section.dateRange === 'string');
  assert(Array.isArray(section.medicines));
  assert(section.pagination !== undefined);
}
```

### Pagination Logic Assertions

```javascript
// Test 1: Offset calculation
// offset = (page - 1) * limit
assert(response.consumingCurrently.pagination.offset === 
  (response.consumingCurrently.pagination.page - 1) * 
  response.consumingCurrently.pagination.limit);

// Test 2: hasMore flag
const p = response.consumingCurrently.pagination;
const expectedHasMore = (p.page * p.limit) < p.total;
assert(p.hasMore === expectedHasMore);

// Test 3: Correct number of items returned
if (p.hasMore) {
  // Not last page, should return full limit
  assert(response.consumingCurrently.medicines.length === p.limit);
} else {
  // Last page, might have fewer items
  assert(response.consumingCurrently.medicines.length <= p.limit);
}

// Test 4: Total count is correct
// Total should match actual count of medicines in database
// (This requires knowing the database state)
```

### Empty State Assertions

```javascript
// Test 1: Correct empty state when no medicines
if (response.consumingCurrently.medicines.length === 0) {
  assert(response.consumingCurrently.pagination.total === 0);
  assert(response.consumingCurrently.pagination.hasMore === false);
  assert(response.consumingCurrently.emptyState.title === 
    "No Medicines Being Taken");
  assert(response.consumingCurrently.emptyState.description === 
    "You don't have any medicines you're currently taking");
}

// Test 2: Correct empty state for past medicines
if (response.pastMedicines.sections.length === 0) {
  assert(response.pastMedicines.emptyState.title === 
    "No Past Medicines");
  assert(response.pastMedicines.emptyState.description === 
    "You don't have any past medicines in your history");
}
```

---

## Console Log Verification

### Expected Log Pattern

When you make a request, you should see logs like:

```
[med-list-1713967890123-abc123] Step 1: Extracting auth from headers
[med-list-1713967890123-abc123] Step 1: Auth extracted - userId: present, sessionToken: present
[med-list-1713967890123-abc123] Step 2: Validating session for user: user-123
[med-list-1713967890123-abc123] Step 2: Session validated successfully
[med-list-1713967890123-abc123] Step 3: Parsing query parameters: {...}
[med-list-1713967890123-abc123] Step 3: Query params validated successfully
[med-list-1713967890123-abc123] Step 4: Fetching medicines list for user: user-123
[med-list-1713967890123-abc123] Step 1: Parsing and validating pagination parameters
[med-list-1713967890123-abc123] Step 1: Pagination validated - consuming: page=1, limit=10, offset=0
[med-list-1713967890123-abc123] Step 2: Fetching active medicines for consuming section
[med-list-1713967890123-abc123] Step 2: Active medicines fetched successfully - total count: 15
[med-list-1713967890123-abc123] Step 3: Transforming active medicines data
[med-list-1713967890123-abc123] Step 3: Transformed 15 active medicines
[med-list-1713967890123-abc123] Step 4: Applying pagination to consuming medicines
[med-list-1713967890123-abc123] Step 4: Pagination applied - returned: 10, total: 15, hasMore: true
[med-list-1713967890123-abc123] Step 5: Fetching past medicines (inactive or discontinued)
[med-list-1713967890123-abc123] Step 5: Past medicines fetched successfully - count: 5
[med-list-1713967890123-abc123] Step 6: Transforming past medicines data
[med-list-1713967890123-abc123] Step 6: Transformed 5 past medicines
[med-list-1713967890123-abc123] Step 7: Grouping past medicines by date
[med-list-1713967890123-abc123] Step 7: Past medicines grouped into 2 date sections
[med-list-1713967890123-abc123] Step 8: Building final response
[med-list-1713967890123-abc123] Step 8: Response built successfully: {...}
[med-list-1713967890123-abc123] getMedicinesList completed successfully
[med-list-1713967890123-abc123] Step 5: Successfully built response
[med-list-1713967890123-abc123] GET /v1/medicines completed successfully
```

### Verify Logging
- ✅ Each request has unique requestId
- ✅ requestId appears in all logs
- ✅ Both route and service logs visible
- ✅ All 8 service steps logged
- ✅ All 5 route steps logged

---

## ELK Stack Verification

### Expected Logger Calls

When logs are shipped to ELK, you should see entries like:

```json
{
  "event": "MEDICINES_LIST_PAGINATION_PARSED",
  "requestId": "med-list-...",
  "userId": "user-123",
  "consumingPage": 1,
  "consumingLimit": 10
}
```

```json
{
  "event": "MEDICINES_LIST_ACTIVE_FETCHED",
  "requestId": "med-list-...",
  "totalCount": 15,
  "rowsReturned": 10
}
```

```json
{
  "event": "MEDICINES_LIST_API_SUCCESS",
  "requestId": "med-list-...",
  "userId": "user-123",
  "consumingCount": 10,
  "consumingTotal": 15,
  "pastSections": 2
}
```

### Verify in Kibana
1. Go to Kibana
2. Search for logs with `requestId: med-list-...`
3. Verify complete flow from route through service
4. Check error logs for any failures

---

## Pagination Edge Case Testing

### Test 1: Last Page Detection
```bash
# Get count first
curl -X GET "http://localhost:3000/v1/medicines?consumingLimit=1" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token"
```

Response: `{ "total": 15 }`

Then test each page:
```bash
# Page 15 should have hasMore: false
curl -X GET "http://localhost:3000/v1/medicines?consumingPage=15&consumingLimit=1"
# Expected: hasMore: false
```

### Test 2: Past Due Date Ordering
```bash
curl -X GET "http://localhost:3000/v1/medicines?pastPage=1&pastLimit=100" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token"
```

**Verify:**
- Sections ordered most recent first
- Date ranges look like "February 2026", "January 2026"
- Within same month, medicines ordered by start date

### Test 3: Large Dataset Pagination
Insert 500 medicines into database, then:

```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingPage=50&consumingLimit=10"
```

**Verify:**
- Correct medicines returned
- offset = 490
- Correct hasMore flag
- Response time acceptable (< 500ms)

---

## Error Case Testing

### Test 1: Missing Auth Header
```bash
curl -X GET "http://localhost:3000/v1/medicines"
```

**Verify:**
- Status: 401
- Code: "MISSING_AUTH"
- Message: "Missing authentication headers"

### Test 2: Expired Session
```bash
# Get a valid token, wait for it to expire (7 days), then:
curl -X GET "http://localhost:3000/v1/medicines" \
  -H "x-user-id: user-123" \
  -H "x-session-token: expired-token"
```

**Verify:**
- Status: 401
- Code: "UNAUTHORIZED"
- Message: "Invalid or expired session token"

### Test 3: Invalid Page Number
```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingPage=0"
```

**Verify:**
- Status: 400
- Error message about page >= 1

### Test 4: Negative Limit
```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingLimit=-5"
```

**Verify:**
- Status: 400
- Error message about limit validation

### Test 5: Limit Over Maximum
```bash
curl -X GET "http://localhost:3000/v1/medicines?consumingLimit=200"
```

**Verify:**
- Status: 200
- `limit` in response: 100 (capped)
- All medicines returned correctly

---

## Performance Testing

### Test 1: Response Time
```bash
time curl -X GET "http://localhost:3000/v1/medicines?consumingPage=1" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token" \
  -w "\n%{http_code}\n"
```

**Expected:**
- Total time: < 500ms
- HTTP code: 200

### Test 2: Large Response Size
```bash
# Get max items per page
curl -X GET "http://localhost:3000/v1/medicines?consumingLimit=100&pastLimit=100" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token" \
  -w "\nResponse size: %{size_download} bytes\n"
```

**Expected:**
- Response size: < 500KB
- Valid JSON

### Test 3: Multiple Concurrent Requests
```bash
# Run 10 concurrent requests
for i in {1..10}; do
  curl -X GET "http://localhost:3000/v1/medicines?consumingPage=$((i%5+1))" \
    -H "x-user-id: user-123" \
    -H "x-session-token: valid-token" &
done
wait
```

**Expected:**
- All requests succeed
- No race conditions
- Correct data for each page

---

## Integration Testing

### Test 1: Add Medicine Then Fetch
```bash
# 1. Add medicine
curl -X POST "http://localhost:3000/api/medicines/add" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Medicine",
    "dosage": "500mg",
    "frequency": "Once daily",
    "indication": "Test",
    "status": "active"
  }'

# 2. Fetch medicines
curl -X GET "http://localhost:3000/v1/medicines?consumingPage=1" \
  -H "x-user-id: user-123" \
  -H "x-session-token: valid-token"
```

**Verify:**
- New medicine appears in response
- Pagination totals updated
- Response structure correct

### Test 2: Different User Data Isolation
```bash
# User A gets their medicines
curl -X GET "http://localhost:3000/v1/medicines" \
  -H "x-user-id: user-a" \
  -H "x-session-token: token-a"

# User B gets their medicines
curl -X GET "http://localhost:3000/v1/medicines" \
  -H "x-user-id: user-b" \
  -H "x-session-token: token-b"
```

**Verify:**
- User A sees only their medicines
- User B sees only their medicines
- No data cross-contamination

---

## Checklist Before Go-Live

- [ ] All curl tests pass
- [ ] Response structure matches specification exactly
- [ ] Pagination logic correct (offset, hasMore)
- [ ] Empty states display correctly
- [ ] Error cases handled properly
- [ ] Logging visible in console
- [ ] Logging visible in ELK
- [ ] Performance acceptable (< 500ms)
- [ ] Multiple concurrent requests work
- [ ] User data properly isolated
- [ ] All error codes correct (401, 400, 500)
- [ ] Medicine object has all required fields
- [ ] Date grouping works correctly
- [ ] Limit capping works (max 100)
- [ ] Page validation works (>= 1)

---

## Debugging Tips

### If Response Format Is Wrong
1. Check `MEDICINES_API_IMPLEMENTATION_COMPLETE.md` for expected structure
2. Compare actual response to specification
3. Look at code in `src/services/medicines-service.ts` lines 414-440

### If Pagination Is Wrong
1. Check `hasMore` calculation: `(page * limit) < total`
2. Check `offset` calculation: `(page - 1) * limit`
3. Verify total count is correct
4. Look at code in `src/services/medicines-service.ts` lines 352-357

### If Auth Is Failing
1. Verify headers: `x-user-id` and `x-session-token`
2. Check session is not expired (7 day limit)
3. Look at error message in response
4. Check console logs for session validation step

### If Logs Are Missing
1. Check logs are being written to console
2. Check ELK stack is properly configured
3. Check `logger.info()` and `console.log()` calls exist
4. Look for requestId in logs

### If Database Errors
1. Check Supabase connection
2. Verify medicines table exists
3. Check user_id column exists
4. Verify status column values are valid

