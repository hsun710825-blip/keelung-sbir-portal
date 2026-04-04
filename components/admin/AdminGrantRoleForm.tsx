"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Role } from "@prisma/client";

import { grantBackofficeRoleAction, type GrantRoleState } from "@/app/admin/users/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "處理中…" : "新增或更新授權"}
    </button>
  );
}

const initialState: GrantRoleState = {};

export function AdminGrantRoleForm() {
  const [state, formAction] = useActionState(grantBackofficeRoleAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="grant-email" className="block text-sm font-medium text-slate-700">
            Gmail（Email）
          </label>
          <input
            id="grant-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@gmail.com"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="grant-role" className="block text-sm font-medium text-slate-700">
            角色
          </label>
          <select
            id="grant-role"
            name="role"
            required
            defaultValue={Role.COMMITTEE}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={Role.COMMITTEE}>審查委員（COMMITTEE）</option>
            <option value={Role.ADMIN}>管理員（ADMIN）</option>
          </select>
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
