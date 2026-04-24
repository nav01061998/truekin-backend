# Documents API - Pagination Design

## Problem Statement

The current Documents API has a **single pagination** that applies to both prescriptions and reports sections. This is problematic because:

### Issue Example
- User has 25 prescriptions and 50 reports
- Request: `GET /v1/documents?limit=10&offset=0`

**Current behavior (WRONG):**
```
Response:
{
  "prescriptions": {
    "documents": [10 prescriptions],
    "pagination": { "total": 25, "page": 1, "limit": 10, "offset": 0, "hasMore": true }
  },
  "reports": {
    "documents": [10 reports],
    "pagination": { "total": 50, "page": 1, "limit": 10, "offset": 0, "hasMore": true }
  }
}
```

The problem:
1. ❌ When user clicks "next page", which section should advance? Both?
2. ❌ If advancing both, they both load page 2. But what if user only wants to see more prescriptions?
3. ❌ Single pagination object doesn't represent the state of two independent data sources
4. ❌ Frontend can't independently scroll/paginate through prescriptions vs reports

---

## Solution Options

### Option 1: Separate Pagination Per Section ⭐ **RECOMMENDED**

Each section (prescriptions, reports) has its own independent pagination.

**Pros:**
- ✅ Users can independently paginate through prescriptions and reports
- ✅ Matches typical UI pattern (two independent scrollable lists)
- ✅ Clear, intuitive API contract
- ✅ No ambiguity about which section to paginate
- ✅ Scales if more document types are added in future

**Cons:**
- Slightly more complex query parameters

**Frontend UX:**
```
┌─────────────────────────────────────┐
│         Medical Documents           │
├─────────────────────────────────────┤
│ 💊 Prescriptions (Page 1 of 3)       │
│  ├─ Aspirin 75mg                    │
│  ├─ Metformin 500mg                 │
│  ├─ Lisinopril 10mg                 │
│  └─ [More] [Page 2]                 │
├─────────────────────────────────────┤
│ 📋 Medical Reports (Page 1 of 5)     │
│  ├─ Blood Test (Jan 2024)           │
│  ├─ CT Scan (Feb 2024)              │
│  └─ [More] [Page 2]                 │
└─────────────────────────────────────┘
```

User can scroll/paginate each section independently.

---

### Option 2: Two Separate Endpoints

- `GET /v1/documents/prescriptions?page=1&limit=10`
- `GET /v1/documents/reports?page=1&limit=10`

**Pros:**
- Very simple and clear
- Standard RESTful design

**Cons:**
- Frontend needs to make 2 API calls instead of 1
- No unified "documents" view
- More network overhead

---

### Option 3: Single Combined List (NOT RECOMMENDED)

Treat all documents as one list (prescriptions first, then reports), paginate across combined set.

**Cons:**
- ❌ Mixing two different data types
- ❌ Unintuitive - "page 2" might only have reports, no prescriptions
- ❌ Bad UX
- ❌ Confusing ordering

---

## **Recommended Implementation: Option 1 - Separate Pagination Per Section**

---

# Final API Contract

## GET /v1/documents

**Description**: Retrieve all medical documents (prescriptions and reports) for the authenticated user, with independent pagination for each section.

### Request

**Headers:**
```
GET /v1/documents
x-user-id: {user_id}
x-session-token: {session_token}
Accept: application/json
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prescriptionsPage` | number | No | 1 | Page number for prescriptions (1-indexed) |
| `prescriptionsLimit` | number | No | 10 | Items per page for prescriptions (max 100) |
| `reportsPage` | number | No | 1 | Page number for reports (1-indexed) |
| `reportsLimit` | number | No | 10 | Items per page for reports (max 100) |
| `prescriptionsStatus` | string | No | - | Filter prescriptions: `active`, `expired`, `filled`, `pending` |
| `reportsStatus` | string | No | - | Filter reports: `completed`, `pending`, `reviewed` |
| `prescriptionsFromDate` | string (ISO 8601) | No | - | Filter prescriptions from date: `2024-01-15T00:00:00Z` |
| `prescriptionsToDate` | string (ISO 8601) | No | - | Filter prescriptions to date: `2024-03-15T00:00:00Z` |
| `reportsFromDate` | string (ISO 8601) | No | - | Filter reports from date: `2024-01-15T00:00:00Z` |
| `reportsToDate` | string (ISO 8601) | No | - | Filter reports to date: `2024-03-15T00:00:00Z` |

**Example Requests:**

```
# Get default (page 1 of each section, 10 items per section)
GET /v1/documents?userId={user_id}

# Get page 2 of prescriptions, page 1 of reports
GET /v1/documents?userId={user_id}&prescriptionsPage=2&reportsPage=1

# Custom limits for each section
GET /v1/documents?userId={user_id}&prescriptionsLimit=5&reportsLimit=20

# Filter prescriptions and get page 3
GET /v1/documents?userId={user_id}&prescriptionsStatus=active&prescriptionsPage=3

# Date range filtering
GET /v1/documents?userId={user_id}&prescriptionsFromDate=2024-01-01T00:00:00Z&prescriptionsToDate=2024-12-31T23:59:59Z
```

---

### Response (Success - 200 OK)

```json
{
  "pageTitle": "Medical Documents",
  "backLabel": "Documents",
  "prescriptions": {
    "documents": [
      {
        "id": "rx-001",
        "type": "prescription",
        "medicationName": "Aspirin",
        "dosage": "75mg",
        "frequency": "Once daily in the morning",
        "duration": "3 months",
        "prescribedBy": "Dr. Rajesh Kumar",
        "prescribedDate": "2024-01-15T00:00:00Z",
        "validUntil": "2024-04-15T00:00:00Z",
        "pharmacy": "Apollo Pharmacy",
        "sideEffects": ["Nausea", "Stomach upset"],
        "refillsRemaining": 2,
        "status": "active",
        "notes": "Take with food",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "offset": 0,
      "hasMore": true
    },
    "emptyState": {
      "title": "No Prescriptions",
      "description": "You don't have any prescriptions yet.",
      "imageUrl": null
    }
  },
  "reports": {
    "documents": [
      {
        "id": "rpt-001",
        "type": "report",
        "reportType": "Blood Test",
        "reportTitle": "Complete Blood Count",
        "reportCategory": "Pathology",
        "testDate": "2024-01-10T00:00:00Z",
        "reportDate": "2024-01-12T00:00:00Z",
        "facility": "Apollo Diagnostic Center",
        "performedBy": "Lab Technician",
        "referredBy": "Dr. Priya Sharma",
        "normalValues": {
          "RBC": "4.5-5.5 million/mcL",
          "WBC": "4.5-11.0 thousand/mcL"
        },
        "reportValues": {
          "RBC": {
            "value": "5.2 million/mcL",
            "status": "normal"
          },
          "WBC": {
            "value": "12.5 thousand/mcL",
            "status": "abnormal"
          }
        },
        "summary": "Elevated WBC count, other values normal",
        "recommendations": ["Follow up in 1 week"],
        "attachmentUrl": "https://api.example.com/reports/rpt-001.pdf",
        "status": "completed",
        "createdAt": "2024-01-12T14:00:00Z",
        "updatedAt": "2024-01-12T14:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "offset": 0,
      "hasMore": true
    },
    "emptyState": {
      "title": "No Reports",
      "description": "You don't have any reports yet.",
      "imageUrl": null
    }
  }
}
```

---

### Response - Empty State (200 OK)

```json
{
  "pageTitle": "Medical Documents",
  "backLabel": "Documents",
  "prescriptions": {
    "documents": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "offset": 0,
      "hasMore": false
    },
    "emptyState": {
      "title": "No Prescriptions",
      "description": "You don't have any prescriptions yet.",
      "imageUrl": null
    }
  },
  "reports": {
    "documents": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "offset": 0,
      "hasMore": false
    },
    "emptyState": {
      "title": "No Reports",
      "description": "You don't have any reports yet.",
      "imageUrl": null
    }
  }
}
```

---

### Pagination Object

Each section includes a `pagination` object with:

| Field | Type | Description |
|-------|------|-------------|
| `page` | number | Current page number (1-indexed) |
| `limit` | number | Items per page |
| `total` | number | Total count of items in this section |
| `offset` | number | Calculated offset = (page - 1) * limit |
| `hasMore` | boolean | Whether more pages exist |

---

### Response - Error Cases

**401 Unauthorized - Missing/Invalid Session:**
```json
{
  "success": false,
  "error": "Invalid or expired session token",
  "code": "UNAUTHORIZED",
  "requestId": "doc-1234567-abc123"
}
```

**403 Forbidden - UserId Mismatch:**
```json
{
  "success": false,
  "error": "Unauthorized to access this user's documents",
  "code": "FORBIDDEN",
  "requestId": "doc-1234567-abc123"
}
```

**400 Bad Request - Validation Error:**
```json
{
  "success": false,
  "error": "Invalid query parameter",
  "code": "INVALID_PARAMETER",
  "requestId": "doc-1234567-abc123",
  "details": {
    "field": "prescriptionsPage",
    "message": "Page must be >= 1"
  }
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "requestId": "doc-1234567-abc123",
  "message": "Failed to fetch prescriptions: [error details]"
}
```

---

## Frontend Integration Examples

### React Component Pattern

```javascript
// Hook to manage pagination state
const [prescriptionsPage, setPrescriptionsPage] = useState(1);
const [reportsPage, setReportsPage] = useState(1);
const [documentsData, setDocumentsData] = useState(null);

// Fetch documents
const fetchDocuments = async () => {
  const response = await fetch(
    `/v1/documents?userId=${userId}&prescriptionsPage=${prescriptionsPage}&reportsPage=${reportsPage}`,
    {
      headers: {
        'x-user-id': userId,
        'x-session-token': sessionToken
      }
    }
  );
  const data = await response.json();
  setDocumentsData(data);
};

// Pagination handlers
const nextPrescriptionsPage = () => {
  if (documentsData.prescriptions.pagination.hasMore) {
    setPrescriptionsPage(prev => prev + 1);
  }
};

const nextReportsPage = () => {
  if (documentsData.reports.pagination.hasMore) {
    setReportsPage(prev => prev + 1);
  }
};
```

### Rendering Pattern

```jsx
<div>
  {/* Prescriptions Section */}
  <section>
    <h2>Prescriptions</h2>
    {documentsData.prescriptions.documents.length > 0 ? (
      <>
        <ul>
          {documentsData.prescriptions.documents.map(rx => (
            <PrescriptionCard key={rx.id} prescription={rx} />
          ))}
        </ul>
        <Pagination
          page={documentsData.prescriptions.pagination.page}
          total={documentsData.prescriptions.pagination.total}
          hasMore={documentsData.prescriptions.pagination.hasMore}
          onNext={nextPrescriptionsPage}
        />
      </>
    ) : (
      <EmptyState {...documentsData.prescriptions.emptyState} />
    )}
  </section>

  {/* Reports Section */}
  <section>
    <h2>Medical Reports</h2>
    {documentsData.reports.documents.length > 0 ? (
      <>
        <ul>
          {documentsData.reports.documents.map(report => (
            <ReportCard key={report.id} report={report} />
          ))}
        </ul>
        <Pagination
          page={documentsData.reports.pagination.page}
          total={documentsData.reports.pagination.total}
          hasMore={documentsData.reports.pagination.hasMore}
          onNext={nextReportsPage}
        />
      </>
    ) : (
      <EmptyState {...documentsData.reports.emptyState} />
    )}
  </section>
</div>
```

---

## Edge Cases & Behavior

| Scenario | Behavior |
|----------|----------|
| User has 0 prescriptions, 10 reports | Prescriptions show empty state, reports show list with page 1 |
| prescriptionsPage=5 but only 3 pages exist | Return page 3 (last available page) |
| prescriptionsLimit=200 (exceeds max 100) | Capped at 100, no error |
| Invalid page number (page=0 or page=-1) | Return 400 error |
| Both filters and pagination applied | Both work together (e.g., active prescriptions, page 2) |
| Same document type in both? | Not applicable - prescriptions and reports are distinct types |

---

## Implementation Checklist

- [ ] Update documents-service.ts to accept separate pagination parameters
- [ ] Update documents route to accept new query parameters
- [ ] Update response structure to include separate pagination objects
- [ ] Add validation for page numbers (must be >= 1)
- [ ] Add validation for limits (must be 1-100)
- [ ] Update TypeScript types for DocumentsResponse
- [ ] Add comprehensive logging for pagination parameters
- [ ] Test with various page/limit combinations
- [ ] Document in frontend integration guide
- [ ] Update API specification document

---

## Summary

✅ **Recommended Approach**: Separate pagination per section
- `prescriptionsPage`, `prescriptionsLimit` for prescriptions
- `reportsPage`, `reportsLimit` for reports
- Each section has its own pagination object in response
- Clear, intuitive, scales for future document types
