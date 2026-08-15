import { env } from "@/lib/db";

export function getDb() {
  return env.DB;
}
