import { getDb } from "./db";
import { contacts } from "../drizzle/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function ensureContact(opts: {
  clientId?: number | null;
  restaurantId?: number | null;
  leadId?: number | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { clientId, restaurantId, leadId, email, phone, isPrimary } = opts;
  if (!clientId && !restaurantId && !leadId) return;

  const trimmedName = (opts.name || "").trim();
  const contactName = trimmedName || email || "Sem nome";

  if (!email && !trimmedName) return;

  const entityFilter = clientId
    ? eq(contacts.clientId, clientId)
    : restaurantId
      ? eq(contacts.restaurantId, restaurantId)
      : eq(contacts.leadId, leadId!);

  if (email) {
    const existing = await db
      .select({ id: contacts.id, isPrimary: contacts.isPrimary })
      .from(contacts)
      .where(and(entityFilter, eq(contacts.email, email)))
      .limit(1);
    if (existing.length > 0) {
      if (isPrimary && !existing[0].isPrimary) {
        await db.update(contacts).set({ isPrimary: false }).where(entityFilter);
        await db.update(contacts).set({ isPrimary: true, updatedAt: new Date() }).where(eq(contacts.id, existing[0].id));
      }
      return;
    }
  } else {
    const existing = await db
      .select({ id: contacts.id, isPrimary: contacts.isPrimary })
      .from(contacts)
      .where(and(entityFilter, eq(contacts.name, contactName), isNull(contacts.email)))
      .limit(1);
    if (existing.length > 0) {
      if (isPrimary && !existing[0].isPrimary) {
        await db.update(contacts).set({ isPrimary: false }).where(entityFilter);
        await db.update(contacts).set({ isPrimary: true, updatedAt: new Date() }).where(eq(contacts.id, existing[0].id));
      }
      return;
    }
  }

  if (isPrimary) {
    await db.update(contacts).set({ isPrimary: false }).where(entityFilter);
  }

  await db.insert(contacts).values({
    clientId: clientId ?? undefined,
    restaurantId: restaurantId ?? undefined,
    leadId: leadId ?? undefined,
    name: contactName,
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
              (ar.email IS NOT NULL AND c.email = ar.email)
              OR (ar.email IS NULL AND c.name = ar."contactName" AND c.email IS NULL)
            )
        )
    `);

    await db.execute(sql`
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
        )
    `);

    await db.execute(sql`
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
        )
    `);

    console.log("Contact backfill completed successfully");
  } catch (err) {
    console.error("Contact backfill error:", err);
  }
}
