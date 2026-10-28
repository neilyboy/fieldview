import { db } from "./db";

export async function siteForToken(token: string) {
  const share = await db.shareLink.findUnique({
    where: { token },
    include: {
      site: {
        include: {
          cameras: { include: { model: true, photos: { orderBy: { createdAt: "asc" } } }, orderBy: { sortOrder: "asc" } },
          infra: { include: { photos: true } },
          shares: false,
        },
      },
    },
  });
  if (!share || share.revokedAt) return null;
  if (share.expiresAt && share.expiresAt < new Date()) return null;
  return share.site;
}
