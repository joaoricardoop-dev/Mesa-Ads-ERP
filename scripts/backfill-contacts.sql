-- One-time backfill: create CRM contacts from active_restaurants and users data
-- Safe to run multiple times (idempotent via NOT EXISTS checks)

-- 1. Create contacts from active_restaurants contact fields (as primary contacts)
INSERT INTO contacts ("restaurantId", "name", "email", "phone", "isPrimary", "createdAt", "updatedAt")
SELECT ar.id, ar."contactName", ar.email, ar.whatsapp, true, NOW(), NOW()
FROM active_restaurants ar
WHERE ar."contactName" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contacts c 
    WHERE c."restaurantId" = ar.id 
      AND (
        (ar.email IS NOT NULL AND c.email = ar.email)
        OR (ar.email IS NULL AND c.name = ar."contactName" AND c.email IS NULL)
      )
  );

-- 2. Create contacts from users linked to restaurants
INSERT INTO contacts ("restaurantId", "name", "email", "isPrimary", "createdAt", "updatedAt")
SELECT u.restaurant_id, 
       COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''), u.email, 'Sem nome'),
       u.email, false, NOW(), NOW()
FROM users u
WHERE u.restaurant_id IS NOT NULL 
  AND u.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM contacts c 
    WHERE c."restaurantId" = u.restaurant_id 
      AND (
        (u.email IS NOT NULL AND c.email = u.email)
        OR (u.email IS NULL AND c.name = COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''), 'Sem nome') AND c.email IS NULL)
      )
  );

-- 3. Create contacts from users linked to clients (advertisers)
INSERT INTO contacts ("clientId", "name", "email", "isPrimary", "createdAt", "updatedAt")
SELECT u.client_id,
       COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''), u.email, 'Sem nome'),
       u.email, false, NOW(), NOW()
FROM users u
WHERE u.client_id IS NOT NULL
  AND u.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM contacts c
    WHERE c."clientId" = u.client_id 
      AND (
        (u.email IS NOT NULL AND c.email = u.email)
        OR (u.email IS NULL AND c.name = COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''), 'Sem nome') AND c.email IS NULL)
      )
  );
