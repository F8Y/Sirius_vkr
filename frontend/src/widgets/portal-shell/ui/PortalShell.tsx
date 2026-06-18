"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { hasRole, useAuth } from "@/entities/session";
import { fetchAchievements, fetchChildren, type ChildItem } from "@/entities/me";

interface PortalChildValue {
  /** Selected child's id for a parent; undefined when the viewer is the child. */
  childId: string | undefined;
  children: ChildItem[];
  isParentView: boolean;
}

const PortalChildContext = createContext<PortalChildValue>({
  childId: undefined,
  children: [],
  isParentView: false,
});

/** Read the currently observed student (parent switching) inside portal views. */
export function usePortalChild(): PortalChildValue {
  return useContext(PortalChildContext);
}

const NAV = [
  { href: "/dashboard", label: "Главная" },
  { href: "/courses", label: "Каталог" },
  { href: "/schedule", label: "Расписание" },
  { href: "/achievements", label: "Достижения" },
  { href: "/profile", label: "Профиль" },
];

export function PortalShell({ children: content }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";

  const isChild = hasRole(user, "child");
  const isParentView = hasRole(user, "parent") && !isChild;

  const [kids, setKids] = useState<ChildItem[]>([]);
  const [childId, setChildId] = useState<string | undefined>(undefined);
  const [stat, setStat] = useState<{ xp: number; level: number; streak: number } | null>(null);

  // Parent: load children and default to the first. Child: load own XP/streak
  // for the top bar pill.
  useEffect(() => {
    let cancelled = false;
    if (isParentView) {
      fetchChildren()
        .then((list) => {
          if (cancelled) return;
          setKids(list);
          setChildId((prev) => prev ?? list[0]?.student_id);
        })
        .catch(() => {});
    } else if (isChild) {
      fetchAchievements()
        .then((a) => {
          if (!cancelled) setStat({ xp: a.xp, level: a.level, streak: a.streak_days });
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [isParentView, isChild]);

  const ctx = useMemo<PortalChildValue>(
    () => ({ childId, children: kids, isParentView }),
    [childId, kids, isParentView]
  );

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="portal">
      <header className="portal-topbar">
        <Link href="/dashboard" className="portal-brand">
          <span className="logo-circle">С</span>
          <span className="portal-brand-text">Сириус&nbsp;27</span>
        </Link>

        <nav className="portal-nav">
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`portal-nav-link${active ? " active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="portal-userbox">
          {isParentView && kids.length > 0 && (
            <label className="portal-child-switch">
              <span>Ребёнок</span>
              <select
                value={childId ?? ""}
                onChange={(e) => setChildId(e.target.value)}
                className="form-control"
              >
                {kids.map((k) => (
                  <option key={k.student_id} value={k.student_id}>
                    {k.student_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isChild && stat && (
            <div className="portal-stats">
              <span className="portal-stat-pill">🔥 {stat.streak}</span>
              <span className="portal-stat-pill">{stat.xp} XP</span>
              <span className="portal-stat-pill level">Ур. {stat.level}</span>
            </div>
          )}
          <div className="portal-avatar">{(user?.email?.[0] ?? "У").toUpperCase()}</div>
          <button type="button" className="portal-logout" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      <main className="portal-main">
        <PortalChildContext.Provider value={ctx}>{content}</PortalChildContext.Provider>
      </main>
    </div>
  );
}
