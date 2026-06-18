"use client";

import React, { useState } from "react";
import { StatusChip } from "@/shared/ui";
import { useAuth, type RoleName } from "@/entities/session";

const ROLE_LABEL: Record<RoleName, string> = {
  child: "Обучающийся",
  parent: "Родитель",
  teacher: "Преподаватель",
  admin: "Администратор",
};

export function ProfilePage() {
  const { user } = useAuth();
  const [consent, setConsent] = useState(true);

  if (!user) return <div className="panel muted">Загрузка…</div>;

  return (
    <>
      <h2 style={{ fontSize: "1.6rem", fontWeight: 800 }}>Профиль</h2>

      <section className="panel">
        <div className="panel-title">Учётная запись</div>
        <div className="transfer-row">
          <span className="muted">Электронная почта</span>
          <span style={{ fontWeight: 600 }}>{user.email}</span>
        </div>
        <div className="transfer-row">
          <span className="muted">Роли</span>
          <span style={{ display: "flex", gap: "8px" }}>
            {user.roles.map((r) => (
              <StatusChip key={r} label={ROLE_LABEL[r] ?? r} tone="blue" />
            ))}
          </span>
        </div>
        <div className="transfer-row">
          <span className="muted">Статус</span>
          <StatusChip
            label={user.is_active ? "Активен" : "Заблокирован"}
            tone={user.is_active ? "green" : "red"}
          />
        </div>
      </section>

      <section className="panel">
        <div>
          <div className="panel-title">Согласие на обработку персональных данных</div>
          <div className="panel-subtitle">В соответствии с Федеральным законом № 152-ФЗ</div>
        </div>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Я даю согласие региональному центру «Сириус 27» на обработку моих персональных данных
          (фамилия, имя, отчество, контактные данные, дата рождения) в целях оказания
          образовательных услуг, ведения учебного процесса и информирования о мероприятиях. Согласие
          может быть отозвано письменным заявлением.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Согласие предоставлено</span>
          <StatusChip
            label={consent ? "Действует" : "Отозвано"}
            tone={consent ? "green" : "yellow"}
          />
        </label>
      </section>
    </>
  );
}
