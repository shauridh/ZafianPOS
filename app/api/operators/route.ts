import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const outletId = process.env.NEXT_PUBLIC_OUTLET_ID!;

async function authorized(request: NextRequest) {
  if (!url || !serviceKey || !outletId) return null;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/, "");
  if (!token) return null;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;
  const { data: operator } = await admin
    .from("operators")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .maybeSingle();
  return operator ? admin : null;
}

export async function GET(request: NextRequest) {
  const admin = await authorized(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await admin
    .from("operators")
    .select("id,name,initials,is_active,auth_user_id,created_at")
    .eq("outlet_id", outletId)
    .order("name");
  return NextResponse.json(
    error ? { error: error.message } : { operators: data },
    { status: error ? 400 : 200 },
  );
}

export async function POST(request: NextRequest) {
  const admin = await authorized(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as {
    email: string;
    name: string;
    initials?: string;
  };
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(body.email, {
      data: { name: body.name },
      redirectTo: `${request.nextUrl.origin}`,
    });
  if (inviteError)
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  const { data, error } = await admin
    .from("operators")
    .insert({
      outlet_id: outletId,
      auth_user_id: invited.user.id,
      name: body.name,
      initials: body.initials || body.name.slice(0, 2).toUpperCase(),
    })
    .select("id,name,initials,is_active")
    .single();
  return NextResponse.json(
    error ? { error: error.message } : { operator: data },
    { status: error ? 400 : 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const admin = await authorized(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as {
    id: string;
    name: string;
    initials?: string;
    isActive: boolean;
  };
  const { data, error } = await admin
    .from("operators")
    .update({
      name: body.name,
      initials: body.initials,
      is_active: body.isActive,
    })
    .eq("id", body.id)
    .eq("outlet_id", outletId)
    .select("id,name,initials,is_active")
    .single();
  return NextResponse.json(
    error ? { error: error.message } : { operator: data },
    { status: error ? 400 : 200 },
  );
}

export async function DELETE(request: NextRequest) {
  const admin = await authorized(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await admin
    .from("operators")
    .update({ is_active: false })
    .eq("id", id)
    .eq("outlet_id", outletId);
  return NextResponse.json(error ? { error: error.message } : { ok: true }, {
    status: error ? 400 : 200,
  });
}
