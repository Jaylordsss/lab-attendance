"use client";

import { useRouter } from "next/navigation";
import { labelClass, selectClass, selectChevron } from "@/components/admin-ui";

export default function Threshold({
  threshold,
  minClasses,
}: {
  threshold: number;
  minClasses: number;
}) {
  const router = useRouter();

  function set(next: { threshold?: number; min?: number }) {
    const params = new URLSearchParams({
      threshold: String(next.threshold ?? threshold),
      min: String(next.min ?? minClasses),
    });
    router.push(`/admin/at-risk?${params}`);
  }

  return (
    <div className="bg-white border border-[#D8DFE5] rounded-lg p-5 grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="threshold" className={labelClass}>
          Below
        </label>
        <select
          id="threshold"
          value={threshold}
          onChange={(e) => set({ threshold: Number(e.target.value) })}
          className={selectClass}
          style={selectChevron}
        >
          {[90, 85, 80, 75, 70, 60, 50].map((t) => (
            <option key={t} value={t}>
              {t}%
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="min" className={labelClass}>
          After at least
        </label>
        <select
          id="min"
          value={minClasses}
          onChange={(e) => set({ min: Number(e.target.value) })}
          className={selectClass}
          style={selectChevron}
        >
          {[1, 3, 5, 10, 20].map((m) => (
            <option key={m} value={m}>
              {m} {m === 1 ? "class" : "classes"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
