import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "../../auth/[...nextauth]/authOptions";

const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim();
    if (!session?.user || !email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const uploadUrl = String(form.get("uploadUrl") ?? "").trim();
    const start = Number(form.get("start") ?? -1);
    const end = Number(form.get("end") ?? -1);
    const total = Number(form.get("total") ?? -1);
    const file = form.get("chunk");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing chunk file" }, { status: 400 });
    }
    if (!uploadUrl || !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(total)) {
      return NextResponse.json({ ok: false, error: "Invalid chunk metadata" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_CHUNK_BYTES) {
      return NextResponse.json({ ok: false, error: "Chunk too large" }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const upstream = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Range": `bytes ${start}-${end}/${total}`,
      },
      body: bytes,
    });

    if (upstream.status === 308) {
      return NextResponse.json({ ok: true, complete: false, status: 308 });
    }
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `Google upload chunk failed (${upstream.status})`, detail: text.slice(0, 300) },
        { status: 502 }
      );
    }

    const body = (await upstream.json().catch(() => ({}))) as { id?: string };
    return NextResponse.json({ ok: true, complete: true, fileId: String(body.id || "") });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Chunk upload failed" }, { status: 500 });
  }
}

