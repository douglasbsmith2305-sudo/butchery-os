import "server-only";

export type AppRole = "ADMIN" | "MANAGER" | "WAREHOUSE" | "BUTCHER" | "CASHIER";
export type Permission =
  | "receive:delivery" | "process:batch" | "count:stock" | "adjust:stock"
  | "book:ticket" | "take:payment" | "view:management" | "manage:settings";

const grants: Record<AppRole, Permission[]> = {
  ADMIN: ["receive:delivery","process:batch","count:stock","adjust:stock","book:ticket","take:payment","view:management","manage:settings"],
  MANAGER: ["receive:delivery","process:batch","count:stock","adjust:stock","view:management"],
  WAREHOUSE: ["receive:delivery","process:batch","count:stock"],
  BUTCHER: ["book:ticket"],
  CASHIER: ["take:payment"],
};

export function authorize(role: AppRole, permission: Permission) {
  if (!grants[role].includes(permission)) {
    throw new Error(`Forbidden: ${role} cannot perform ${permission}`);
  }
}
