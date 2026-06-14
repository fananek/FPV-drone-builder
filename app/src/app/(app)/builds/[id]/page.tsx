import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { builds, buildComponents, buildWarnings, buildRatings, parts, customParts, users } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { ArrowLeft, Star, Download, Compass, Copy } from "lucide-react";
import ClientDetailsView from "./ClientDetailsView";

// Next.js page configuration to disable static shell if needed, but App router handles dynamic params automatically.
export default async function BuildDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Fetch build details
  const [build] = await db
    .select()
    .from(builds)
    .where(eq(builds.id, id))
    .limit(1);

  if (!build) {
    notFound();
  }

  // If build is private, check ownership
  const session = await auth();
  const isOwner = session?.user?.id === build.userId;
  if (!build.isPublic && !isOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-2">Access Denied</h2>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          This FPV configuration is set to private. Only the creator holds secure telemetry access.
        </p>
        <Link href="/gallery" className="mt-6 text-xs text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider underline underline-offset-4">
          Return to public gallery
        </Link>
      </div>
    );
  }

  // 2. Fetch components for the build
  const comps = await db
    .select()
    .from(buildComponents)
    .where(eq(buildComponents.buildId, id));

  // Resolve parts and custom parts
  const partIds = comps.map((c) => c.partId).filter(Boolean) as string[];
  const customPartIds = comps.map((c) => c.customPartId).filter(Boolean) as string[];

  const resolvedParts = partIds.length > 0
    ? await db.select().from(parts).where(inArray(parts.id, partIds))
    : [];

  const resolvedCustomParts = customPartIds.length > 0
    ? await db.select().from(customParts).where(inArray(customParts.id, customPartIds))
    : [];

  const partsMap = new Map(resolvedParts.map((p) => [p.id, p]));
  const customPartsMap = new Map(resolvedCustomParts.map((cp) => [cp.id, cp]));

  const expandedComponents = comps.map((c) => ({
    id: c.id,
    slot: c.slot,
    quantity: c.quantity,
    customNotes: c.customNotes,
    partId: c.partId,
    customPartId: c.customPartId,
    part: c.partId ? partsMap.get(c.partId) || null : null,
    customPart: c.customPartId ? customPartsMap.get(c.customPartId) || null : null,
  }));

  // 3. Fetch warnings snapshot
  const warnings = await db
    .select()
    .from(buildWarnings)
    .where(eq(buildWarnings.buildId, id));

  // 4. Fetch ratings and reviews (with user names)
  const ratings = await db
    .select({
      id: buildRatings.id,
      stars: buildRatings.stars,
      review: buildRatings.review,
      createdAt: buildRatings.createdAt,
      user: {
        name: users.name,
        email: users.email,
      },
    })
    .from(buildRatings)
    .leftJoin(users, eq(buildRatings.userId, users.id))
    .where(eq(buildRatings.buildId, id))
    .orderBy(desc(buildRatings.createdAt));

  // Convert Date properties to ISO strings for client component passing
  const serializedBuild = {
    ...build,
    createdAt: build.createdAt.toISOString(),
    updatedAt: build.updatedAt.toISOString(),
  };

  const serializedRatings = ratings.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <ClientDetailsView
      build={serializedBuild}
      components={expandedComponents}
      warnings={warnings}
      ratings={serializedRatings}
      session={session}
    />
  );
}
