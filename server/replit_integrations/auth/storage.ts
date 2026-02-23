import { users, type User, type UpsertUser } from "@shared/models/auth";
import { getDb } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  listUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  updateUserActive(id: string, isActive: boolean): Promise<User | undefined>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async listUsers(): Promise<User[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db.select().from(users);
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserActive(id: string, isActive: boolean): Promise<User | undefined> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [user] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
