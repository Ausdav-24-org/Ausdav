# Quick Reference: Unified Admin Contacts Table

## Table Structure

```sql
CREATE TABLE admin_contacts (
  id BIGINT PRIMARY KEY,
  contact_type VARCHAR(50) CHECK (contact_type IN ('contact', 'patron')),
  name VARCHAR(255) NOT NULL,
  batch INTEGER,           -- NULL for patrons
  contact_no VARCHAR(20),  -- NULL for patrons
  patron_no VARCHAR(50),   -- NULL for contacts
  description TEXT,        -- NULL for contacts
  created_by UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Insert Examples

### Add a Contact
```sql
INSERT INTO admin_contacts (contact_type, name, batch, contact_no, created_by)
VALUES ('contact', 'John Doe', 2020, '03001234567', auth.uid());
```

### Add a Patron
```sql
INSERT INTO admin_contacts (contact_type, name, patron_no, description, created_by)
VALUES ('patron', 'Dr. Ahmed Khan', 'P001', 'Main Patron', auth.uid());
```

## Select Examples

### Get All Contacts
```sql
SELECT * FROM admin_contacts 
WHERE contact_type = 'contact' 
ORDER BY created_at DESC;
```

### Get All Patrons
```sql
SELECT * FROM admin_contacts 
WHERE contact_type = 'patron' 
ORDER BY created_at DESC;
```

### Get Contact by Batch
```sql
SELECT * FROM admin_contacts 
WHERE contact_type = 'contact' AND batch = 2020;
```

### Get Patron by Number
```sql
SELECT * FROM admin_contacts 
WHERE contact_type = 'patron' AND patron_no = 'P001';
```

## Update Examples

### Update Contact
```sql
UPDATE admin_contacts
SET name = 'Jane Doe', contact_no = '03007654321'
WHERE id = 1 AND contact_type = 'contact';
```

### Update Patron
```sql
UPDATE admin_contacts
SET description = 'Secondary Patron'
WHERE id = 2 AND contact_type = 'patron';
```

## Delete Examples

### Delete Contact
```sql
DELETE FROM admin_contacts 
WHERE id = 1 AND contact_type = 'contact';
```

### Delete Patron
```sql
DELETE FROM admin_contacts 
WHERE id = 2 AND contact_type = 'patron';
```

## Field Mapping

### For Contacts (contact_type = 'contact')
- `name` ← contact_name
- `batch` ← batch year
- `contact_no` ← phone number
- `patron_no` ← NULL
- `description` ← NULL

### For Patrons (contact_type = 'patron')
- `name` ← patron_name
- `patron_no` ← unique patron number
- `description` ← optional description
- `batch` ← NULL
- `contact_no` ← NULL

## Indexes

```sql
idx_admin_contacts_type_created
idx_admin_contacts_created_by
idx_admin_contacts_batch
idx_admin_contacts_patron_no
```

## RLS Policy

```sql
CREATE POLICY "Allow super_admin to view and manage admin contacts" ON admin_contacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid() 
      AND members.role = 'super_admin'
    )
  );
```

## TypeScript Interface

```typescript
interface AdminContact {
  id: number;
  contact_type: 'contact' | 'patron';
  name: string;
  batch: number | null;
  contact_no: string | null;
  patron_no: string | null;
  description: string | null;
  created_at: string;
}
```

## Filtering Logic

```typescript
// Get only contacts
const contacts = allContacts.filter(item => item.contact_type === 'contact');

// Get only patrons
const patrons = allContacts.filter(item => item.contact_type === 'patron');
```

## File Download Formats

### Contact Download
```
Filename: {name}+{batch}+Senior (Ausdav).txt
Content:
Name: {name}
Batch: {batch}
Contact No: {contact_no}

AUSDAV
```

### Patron Download
```
Filename: {name}+Patron(Ausdav).txt
Content:
Name: {name}
Patron No: {patron_no}
[Description: {description}]

AUSDAV
```

## Routes

- **Page**: `/admin/details` (Super Admin only)
- **Components**: AdminDetailsPage.tsx

## Keys for Developers

1. **Always check `contact_type`** when filtering
2. **Set appropriate `null` values** for unused fields
3. **Use descriptive queries** with contact_type filter
4. **Verify RLS policies** before deploying
5. **Test both types** thoroughly
6. **Keep batch/contact_no nullable** (for patrons)
7. **Keep patron_no/description nullable** (for contacts)

## Common Mistakes to Avoid

❌ Forgetting to filter by `contact_type`
```sql
-- Wrong: Returns both contacts and patrons
SELECT * FROM admin_contacts;

-- Right: Get specific type
SELECT * FROM admin_contacts WHERE contact_type = 'contact';
```

❌ Requiring patron_no for contacts
```sql
-- Wrong: Fails for contacts
INSERT INTO admin_contacts (contact_type, name, patron_no)
VALUES ('contact', 'Jane', 'P001');

-- Right: Use contact_no for contacts
INSERT INTO admin_contacts (contact_type, name, batch, contact_no)
VALUES ('contact', 'Jane', 2020, '03001234567');
```

❌ Not checking NULL values in filters
```typescript
// Wrong: May not find patrons with no batch
const items = allContacts.filter(c => c.batch === 2020);

// Right: Filter by type first
const items = allContacts.filter(c => c.contact_type === 'contact' && c.batch === 2020);
```

---

**Ready to use!** Copy-paste queries as needed.
