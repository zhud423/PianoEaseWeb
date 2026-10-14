import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME } from "./config";
import { hashSessionToken } from "./session";
import { getValidSessionByTokenHash } from "@/db/repositories/sessions";

type CurrentUser = {
  id: string;
  username: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const session = await getValidSessionByTokenHash(hashSessionToken(token));
    if (!session) return null;
    return {
      id: session.user.id,
      username: session.user.username,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUsername(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.username ?? null;
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireCurrentUsername(): Promise<string> {
  const user = await requireCurrentUser();
  return user.username;
}
