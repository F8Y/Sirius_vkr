"use client";

import React, { useState, useEffect, useRef } from "react";
import { fetchJob, JobProgressCard, type JobResponse } from "@/entities/job";
import { CreateJobForm } from "@/features/create-job/ui/CreateJobForm";
import { MascotGreeting } from "@/widgets/mascot-greeting/ui/MascotGreeting";
import { SystemHealth } from "@/widgets/system-health/ui/SystemHealth";

export function DashboardPage() {
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const jobsRef = useRef<JobResponse[]>([]);

  // Keep ref up to date so intervals can access the latest state
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // Handle adding a newly created job
  const handleJobCreated = (newJob: JobResponse) => {
    setJobs((prevJobs) => [newJob, ...prevJobs]);
  };

  // Poll status of all active (pending or processing) jobs
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      const activeJobs = jobsRef.current.filter(
        (job) => job.status === "pending" || job.status === "processing"
      );

      if (activeJobs.length === 0) return;

      for (const activeJob of activeJobs) {
        try {
          const updatedJob = await fetchJob(activeJob.id);
          
          setJobs((prevJobs) =>
            prevJobs.map((job) => (job.id === updatedJob.id ? updatedJob : job))
          );
        } catch (err) {
          console.error(`Error polling status for job ${activeJob.id}:`, err);
        }
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, []);

  return (
    <div className="layout-container">
      {/* Sidebar Navigation - Admin Style */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-circle">С</div>
          <div>
            <div className="logo-text">Сириус 27</div>
            <div className="logo-subtext">образовательная платформа</div>
          </div>
        </div>

        <nav className="nav-menu">
          <div className="nav-section-title">Обзор</div>
          <div className="nav-item active">
            <span>📊</span> Дашборд
          </div>
          <div className="nav-item">
            <span>📈</span> Аналитика
          </div>

          <div className="nav-section-title">Обучение</div>
          <div className="nav-item">
            <span>👨‍🎓</span> Успеваемость
          </div>
          <div className="nav-item">
            <span>📚</span> Мои курсы
          </div>
          <div className="nav-item">
            <span>👥</span> Группы
          </div>
          <div className="nav-item">
            <span>📅</span> Расписание
          </div>

          <div className="nav-section-title">Администрирование</div>
          <div className="nav-item">
            <span>🔑</span> Пользователи и роли
          </div>
          <div className="nav-item">
            <span>📥</span> Импорт данных
          </div>

          <div className="nav-section-title" style={{ color: "var(--color-brand-teal)" }}>
            🛡️ Защита данных · 152-ФЗ
          </div>
          <div className="nav-item">
            <span>🔏</span> Анонимизация
          </div>
          <div className="nav-item">
            <span>🔒</span> Приватность данных
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Контур администратора безопасности</span>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Панель управления задачами</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Администратор</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>admin@sirius27.ru</div>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "var(--color-primary-blue)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
              }}
            >
              А
            </div>
          </div>
        </header>

        {/* Bento Grid */}
        <div className="bento-grid">
          
          {/* Top row: Greeting and Health Indicators */}
          <MascotGreeting />
          <SystemHealth />

          {/* Bottom row: Create task form and active jobs monitoring */}
          <CreateJobForm onJobCreated={handleJobCreated} />

          <div className="bento-card col-6" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="section-title">Мониторинг фоновых задач ({jobs.length})</h2>
            
            <div className="jobs-list">
              {jobs.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "200px",
                    color: "var(--text-secondary)",
                    textAlign: "center",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "3rem" }}>🐻</span>
                  <div>
                    <strong>Нет активных задач</strong>
                    <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                      Запустите импорт данных или анонимизацию выше, чтобы увидеть процесс выполнения
                    </div>
                  </div>
                </div>
              ) : (
                jobs.map((job) => <JobProgressCard key={job.id} job={job} />)
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
