"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  labelClass,
  selectClass,
  selectChevron,
  inputBoxClass,
} from "@/components/admin-ui";

export default function Filters({
  departments,
  role,
  department,
  q,
}: {
  departments: string[];
  role: string;
  department: string;
  q: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/users?${next.toString()}`);
  }

  return (
    <div className="bg-white border border-[#D8DFE5] rounded-lg p-5 grid gap-5 sm:grid-cols-3">
      <div>
        <label htmlFor="q" className={labelClass}>Search</label>
        <input
          id="q"
          defaultValue={q}
          placeholder="Name or ID number"
          onKeyDown={(e) => {
            if (e.key === "Enter") update("q", (e.target as HTMLInputElement).value);
          }}
          className={`${inputBoxClass} placeholder:text-[#B4BFC8]`}
        />
      </div>

      <div>
        <label htmlFor="role" className={labelClass}>Role</label>
        <select
          id="role"
          value={role}
          onChange={(e) => update("role", e.target.value)}
          className={selectClass}
          style={selectChevron}
        >
          <option value="">Everyone</option>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
      </div>

      <div>
        <label htmlFor="department" className={labelClass}>Department</label>
        <select
          id="department"
          value={department}
          onChange={(e) => update("department", e.target.value)}
          className={selectClass}
          style={selectChevron}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
