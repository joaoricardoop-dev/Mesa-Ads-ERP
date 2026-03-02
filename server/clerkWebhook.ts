import type { Request, Response } from "express";
import { Webhook } from "svix";
import { authStorage } from "./replit_integrations/auth";

export async function clerkWebhookHandler(req: Request, res: Response) {
  try {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      if (process.env.NODE_ENV === "production") {
        return res.status(500).json({ error: "Webhook secret not configured" });
      }
      console.warn("CLERK_WEBHOOK_SECRET not set — skipping signature verification (dev only)");
    }

    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);

    if (webhookSecret) {
      const svixId = req.headers["svix-id"] as string;
      const svixTimestamp = req.headers["svix-timestamp"] as string;
      const svixSignature = req.headers["svix-signature"] as string;

      if (!svixId || !svixTimestamp || !svixSignature) {
        return res.status(400).json({ error: "Missing svix headers" });
      }

      const wh = new Webhook(webhookSecret);
      try {
        wh.verify(rawBody, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
      } catch (err) {
        console.error("Webhook verification failed:", err);
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
    }

    const event = JSON.parse(rawBody);
    const type = event?.type;

    if (type === "user.created" || type === "user.updated") {
      const userData = event.data;
      const email = userData.email_addresses?.[0]?.email_address || null;
      const role = userData.public_metadata?.role || "user";
      const clientId = userData.public_metadata?.clientId || null;

      await authStorage.upsertUser({
        id: userData.id,
        email,
        firstName: userData.first_name || null,
        lastName: userData.last_name || null,
        profileImageUrl: userData.image_url || null,
        role,
        clientId: clientId ? Number(clientId) : null,
      });
    }

    if (type === "user.deleted") {
      const userData = event.data;
      if (userData?.id) {
        await authStorage.updateUserActive(userData.id, false);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
