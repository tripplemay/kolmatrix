import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  filters: z.record(z.string(), z.unknown()),
});

export async function GET() {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await withTenant(tenantId, (tx) =>
    tx.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        filters: true,
        createdAt: true,
      },
    })
  );

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      filters: r.filters,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const row = await withTenant(tenantId, (tx) =>
    tx.savedSearch.create({
      data: {
        tenantId,
        userId,
        name: parsed.data.name,
        filters: parsed.data.filters as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        name: true,
        filters: true,
        createdAt: true,
      },
    })
  );

  return NextResponse.json(
    {
      id: row.id,
      name: row.name,
      filters: row.filters,
      createdAt: row.createdAt.toISOString(),
    },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const deleted = await withTenant(tenantId, async (tx) => {
    const hit = await tx.savedSearch.findFirst({ where: { id, userId }, select: { id: true } });
    if (!hit) return false;
    await tx.savedSearch.delete({ where: { id } });
    return true;
  });

  if (!deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
