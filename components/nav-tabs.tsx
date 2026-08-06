"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Section navigation with the current tab marked.
 *
 * Without it every tab looks identical and the only clue to where you are is
 * the page heading — which is fine until someone is three levels deep in a
 * record and cannot tell which part of the system they are in.
 */
export default function NavTabs({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="mx-auto max-w-6xl px-6">
      <ul className="flex gap-6 overflow-x-auto">
        {items.map((item) => {
          // Overview is only current on an exact match; everything else also
          // covers its detail pages, so /admin/rooms/abc keeps Laboratories lit.
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="inline-block py-3 text-sm whitespace-nowrap border-b-2 transition-colors"
                style={{
                  borderColor: active ? "#0B6E5F" : "transparent",
                  color: active ? "#0B6E5F" : "#16202B",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
