"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import { changeRoleSchema, createUserSchema, resetPasswordSchema, setActiveSchema } from "../schemas";
import { changeUserRole, createUser, resetUserPassword, setUserActive } from "./user-service";

const USERS_PATH = "/admin/settings/users";

export const createUserAction = protectedAction(
  {
    name: "users.create",
    schema: createUserSchema,
    permission: "users:manage",
    rateLimit: { limit: 20, windowMs: 10 * 60_000 },
  },
  async (input, { user }) => {
    const res = await createUser(input, user);
    revalidatePath(USERS_PATH);
    revalidatePath("/admin/staff");
    return res;
  },
);

export const changeUserRoleAction = protectedAction(
  { name: "users.changeRole", schema: changeRoleSchema, permission: "users:manage" },
  async (input, { user }) => {
    const res = await changeUserRole(input, user);
    revalidatePath(USERS_PATH);
    return res;
  },
);

export const setUserActiveAction = protectedAction(
  { name: "users.setActive", schema: setActiveSchema, permission: "users:manage" },
  async (input, { user }) => {
    const res = await setUserActive(input, user);
    revalidatePath(USERS_PATH);
    return res;
  },
);

export const resetUserPasswordAction = protectedAction(
  {
    name: "users.resetPassword",
    schema: resetPasswordSchema,
    permission: "users:manage",
    rateLimit: { limit: 20, windowMs: 10 * 60_000 },
  },
  async (input, { user }) => {
    const res = await resetUserPassword(input, user);
    revalidatePath(USERS_PATH);
    return res;
  },
);
