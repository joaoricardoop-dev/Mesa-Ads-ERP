import { getDb } from "./db";
import { contacts } from "../drizzle/schema";
import { eq, and, or, sql } from "drizzle-orm";

export async function ensureContact(opts: {
  clientId?: number | null;
  restaurantId?: number | null;
  leadId?: number | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { clientId, restaurantId, leadId, name, email, phone, isPrimary } = opts;
  if (!clientId && !restaurantId && !leadId) return;
  const trimmedName = (name || "").trim();
  if (!trimmedName) return;

  const entityFilter = clientId
    ? eq(contacts.clientId, clientId)
    : restaurantId
      ? eq(contacts.restaurantId, restaurantId)
      : eq(contacts.leadId, leadId!);

  const matchConditions = [];
  if (email) matchConditions.push(eq(contacts.email, email));
  matchConditions.push(eq(contacts.name, trimmedName));

  const existing = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(entityFilter, or(...matchConditions)))
    .limit(1);

  if (existing.length > 0) return;

  if (isPrimary) {
    await db.update(contacts).set({ isPrimary: false }).where(entityFilter);
  }

  await db.insert(contacts).values({
    clientId: clientId ?? undefined,
    restaurantId: restaurantId ?? undefined,
    leadId: leadId ?? undefined,
    name: trimmedName,
    email: email || undefined,
    phone: phone || undefined,
    isPrimary: isPrimary ?? false,
  });
}

export async function backfillContacts(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(sql`
      INSERT INTO contacts ("restaurantId", "name", "email", "phone", "isPrimary", "createdAt", "updatedAt")
      SELECT ar.id, ar."contactName", ar.email, ar.whatsapp, true, NOW(), NOW()
      FROM active_restaurants ar
      WHERE ar."contactName" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM contacts c 
          WHERE c."restaurantId" = ar.id 
            AND (
              (c.email IS NOT NULL AND ar.email IS NOT NULL AND c.email = ar.email)
              OR (c.name = ar."contactName")
            )
        )
    `);

    await db.execute(sql`
      INSERT INTO contacts ("restaurantId", "name", "email", "isPrimary", "createdAt", "updatedAt")
      SELECT u.restaurant_id, 
             TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))),
             u.email, false, NOW(), NOW()
      FROM users u
      WHERE u.restaurant_id IS NOT NULL 
        AND u.is_active = true
        AND TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM contacts c 
          WHERE c."restaurantId" = u.restaurant_id 
            AND (
              (c.email IS NOT NULL AND u.email IS NOT NULL AND c.email = u.email)
              OR (c.name = TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))))
            )
        )
    `);

    await db.execute(sql`
      INSERT INTO contacts ("clientId", "name", "email", "isPrimary", "createdAt", "updatedAt")
      SELECT u.client_id,
             TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))),
             u.email, false, NOW(), NOW()
      FROM users u
      WHERE u.client_id IS NOT NULL
        AND u.is_active = true
        AND TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM contacts c
          WHERE c."clientId" = u.client_id 
            AND (
              (c.email IS NOT NULL AND u.email IS NOT NULL AND c.email = u.email)
              OR (c.name = TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))))
            )
        )
    `);

    console.log("Contact backfill completed successfully");
  } catch (err) {
    console.error("Contact backfill error:", err);
  }
}
