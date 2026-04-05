import React, { useState, useMemo } from 'react';

// ===== بيانات التقويم الأكاديمي لجامعة بيرزيت 2025/2026 =====
const EVENTS = [
  // أيلول 2025
  { date: '2025-09-04', title: 'عطلة بمناسبة المولد النبوي الشريف', type: 'holiday', semester: 1 },
  { date: '2025-09-06', title: 'تدريس عن بعد (برنامج الخميس)', type: 'remote', semester: 1 },
  { date: '2025-09-22', title: 'بدء دوام أعضاء الهيئة الأكاديمية - الفصل الأول', type: 'start', semester: 1 },
  { date: '2025-09-29', title: 'بدء التدريس للفصل الدراسي الأول 2025/2026', type: 'start', semester: 1 },
  // تشرين الأول 2025
  { date: '2025-10-02', title: 'آخر موعد للتسجيل المتأخر وتعديل التسجيل - الفصل الأول', type: 'deadline', semester: 1 },
  { date: '2025-10-04', title: 'بدء فترة الانسحاب بعلامة W - الفصل الأول', type: 'deadline', semester: 1 },
  { date: '2025-10-18', title: 'عطلة قطف الزيتون', type: 'holiday', semester: 1 },
  // تشرين الثاني 2025
  { date: '2025-11-01', title: 'تدريس عن بعد للمساقات النظرية', type: 'remote', semester: 1 },
  { date: '2025-11-04', title: 'برنامج تدريس يوم الخميس', type: 'remote', semester: 1 },
  { date: '2025-11-12', title: 'تدريس عن بعد للمساقات النظرية', type: 'remote', semester: 1 },
  { date: '2025-11-13', title: 'يوم امتحانات', type: 'exam', semester: 1 },
  { date: '2025-11-15', title: 'عطلة بمناسبة إعلان الاستقلال', type: 'holiday', semester: 1 },
  { date: '2025-11-24', title: 'تدريس عن بعد للمساقات النظرية', type: 'remote', semester: 1 },
  { date: '2025-11-25', title: 'يوم امتحانات', type: 'exam', semester: 1 },
  { date: '2025-11-29', title: 'تدريس عن بعد للمساقات النظرية', type: 'remote', semester: 1 },
  // كانون الأول 2025
  { date: '2025-12-01', title: 'يوم امتحانات', type: 'exam', semester: 1 },
  { date: '2025-12-11', title: 'يوم امتحانات', type: 'exam', semester: 1 },
  { date: '2025-12-13', title: 'تدريس عن بعد للمساقات النظرية', type: 'remote', semester: 1 },
  { date: '2025-12-22', title: 'يوم امتحانات', type: 'exam', semester: 1 },
  { date: '2025-12-23', title: 'برنامج تدريس يوم السبت + تدريس عن بعد', type: 'remote', semester: 1 },
  { date: '2025-12-24', title: 'بدء عطلة عيد الميلاد وعطلة الشتاء (8:00 ص)', type: 'holiday', semester: 1 },
  // كانون الثاني 2026
  { date: '2026-01-01', title: 'انتهاء عطلة عيد الميلاد وعطلة الشتاء (5:00 م)', type: 'holiday', semester: 1 },
  { date: '2026-01-07', title: 'عطلة عيد الميلاد المجيد (التقويم الشرقي)', type: 'holiday', semester: 1 },
  { date: '2026-01-08', title: 'تدريس عن بعد للمساقات النظرية', type: 'remote', semester: 1 },
  { date: '2026-01-12', title: 'يوم امتحانات', type: 'exam', semester: 1 },
  { date: '2026-01-13', title: 'برنامج تدريس يوم الخميس + تدريس عن بعد', type: 'remote', semester: 1 },
  { date: '2026-01-15', title: 'برنامج تدريس يوم الثلاثاء', type: 'remote', semester: 1 },
  { date: '2026-01-17', title: 'عطلة الإسراء والمعراج (متوقع)', type: 'holiday', semester: 1 },
  { date: '2026-01-19', title: 'آخر موعد للانسحاب بعلامة W - الفصل الأول', type: 'deadline', semester: 1 },
  { date: '2026-01-27', title: 'آخر يوم تدريس للفصل الدراسي الأول 2025/2026', type: 'end', semester: 1 },
  // شباط 2026
  { date: '2026-02-04', title: 'بدء الامتحانات النهائية - الفصل الأول', type: 'exam', semester: 1 },
  { date: '2026-02-28', title: 'انتهاء الامتحانات النهائية - الفصل الأول', type: 'exam', semester: 1 },
  // آذار 2026
  { date: '2026-03-03', title: 'آخر يوم لتسليم العلامات - الفصل الأول', type: 'deadline', semester: 1 },
  { date: '2026-03-08', title: 'عطلة يوم المرأة العالمي', type: 'holiday', semester: 2 },
  { date: '2026-03-09', title: 'بدء التدريس للفصل الدراسي الثاني 2025/2026', type: 'start', semester: 2 },
  { date: '2026-03-10', title: 'تدريس عن بعد', type: 'remote', semester: 2 },
  { date: '2026-03-11', title: 'تدريس عن بعد', type: 'remote', semester: 2 },
  { date: '2026-03-12', title: 'تدريس عن بعد', type: 'remote', semester: 2 },
  { date: '2026-03-14', title: 'تدريس عن بعد', type: 'remote', semester: 2 },
  { date: '2026-03-16', title: 'تدريس عن بعد', type: 'remote', semester: 2 },
  { date: '2026-03-17', title: 'تدريس عن بعد', type: 'remote', semester: 2 },
  { date: '2026-03-18', title: 'تدريس عن بعد + آخر موعد لاستكمال علامة غير مكتمل - الفصل الأول', type: 'remote', semester: 2 },
  { date: '2026-03-19', title: 'بدء عطلة عيد الفطر المبارك (8:00 ص)', type: 'holiday', semester: 2 },
  { date: '2026-03-22', title: 'انتهاء عطلة عيد الفطر المبارك (5:00 م)', type: 'holiday', semester: 2 },
  { date: '2026-03-23', title: 'آخر موعد للتسجيل المتأخر وتعديل التسجيل - الفصل الثاني', type: 'deadline', semester: 2 },
  { date: '2026-03-24', title: 'بدء فترة الانسحاب من مساقات الفصل الثاني', type: 'deadline', semester: 2 },
  { date: '2026-03-30', title: 'برنامج تدريس يوم السبت', type: 'remote', semester: 2 },
  // نيسان 2026
  { date: '2026-04-11', title: 'بدء عطلة عيد الفصح المجيد (8:00 ص)', type: 'holiday', semester: 2 },
  { date: '2026-04-13', title: 'انتهاء عطلة عيد الفصح المجيد (5:00 م)', type: 'holiday', semester: 2 },
  { date: '2026-04-28', title: 'برنامج تدريس يوم السبت', type: 'remote', semester: 2 },
  // أيار 2026
  { date: '2026-05-01', title: 'عطلة عيد العمال', type: 'holiday', semester: 2 },
  { date: '2026-05-26', title: 'بدء عطلة عيد الأضحى المبارك (متوقع) (8:00 ص)', type: 'holiday', semester: 2 },
  { date: '2026-05-30', title: 'انتهاء عطلة عيد الأضحى المبارك (متوقع) (5:00 م)', type: 'holiday', semester: 2 },
  // حزيران 2026
  { date: '2026-06-17', title: 'عطلة رأس السنة الهجرية (متوقع)', type: 'holiday', semester: 2 },
  { date: '2026-06-18', title: 'آخر موعد للانسحاب من مساقات الفصل الثاني', type: 'deadline', semester: 2 },
  { date: '2026-06-22', title: 'آخر يوم تدريس للفصل الدراسي الثاني 2025/2026', type: 'end', semester: 2 },
  { date: '2026-06-27', title: 'بدء الامتحانات النهائية - الفصل الثاني', type: 'exam', semester: 2 },
  // تموز 2026
  { date: '2026-07-12', title: 'انتهاء الامتحانات النهائية - الفصل الثاني', type: 'exam', semester: 2 },
  { date: '2026-07-15', title: 'آخر يوم لتسليم العلامات - الفصل الثاني', type: 'deadline', semester: 2 },
  { date: '2026-07-16', title: 'حفل التخرج الأول 🎓', type: 'graduation', semester: 2 },
  { date: '2026-07-17', title: 'حفل التخرج الثاني 🎓', type: 'graduation', semester: 2 },
  { date: '2026-07-18', title: 'حفل التخرج الثالث 🎓', type: 'graduation', semester: 2 },
  { date: '2026-07-19', title: 'حفل التخرج الرابع 🎓', type: 'graduation', semester: 2 },
  { date: '2026-07-20', title: 'بدء التدريس للدورة الصيفية 2025/2026', type: 'start', semester: 3 },
  { date: '2026-07-25', title: 'آخر موعد للتسجيل المتأخر - الدورة الصيفية', type: 'deadline', semester: 3 },
  { date: '2026-07-27', title: 'بدء فترة الانسحاب من مساقات الدورة الصيفية', type: 'deadline', semester: 3 },
  // آب 2026
  { date: '2026-08-01', title: 'تدريس عن بعد (برنامج الخميس)', type: 'remote', semester: 3 },
  { date: '2026-08-08', title: 'تدريس عن بعد (برنامج الاثنين)', type: 'remote', semester: 3 },
  { date: '2026-08-15', title: 'تدريس عن بعد (برنامج الثلاثاء)', type: 'remote', semester: 3 },
  { date: '2026-08-22', title: 'تدريس عن بعد (برنامج الأربعاء)', type: 'remote', semester: 3 },
  { date: '2026-08-26', title: 'عطلة المولد النبوي الشريف (متوقع)', type: 'holiday', semester: 3 },
  { date: '2026-08-29', title: 'تدريس عن بعد (برنامج الخميس)', type: 'remote', semester: 3 },
  // أيلول 2026
  { date: '2026-09-05', title: 'تدريس عن بعد (برنامج الاثنين)', type: 'remote', semester: 3 },
  { date: '2026-09-12', title: 'آخر موعد للانسحاب - الدورة الصيفية + تدريس عن بعد', type: 'deadline', semester: 3 },
  { date: '2026-09-19', title: 'آخر يوم تدريس للدورة الصيفية + بدء دوام الهيئة الأكاديمية للفصل الأول 2026/2027', type: 'end', semester: 3 },
  { date: '2026-09-20', title: 'بدء الامتحانات النهائية - الدورة الصيفية', type: 'exam', semester: 3 },
  { date: '2026-09-27', title: 'انتهاء الامتحانات النهائية - الدورة الصيفية', type: 'exam', semester: 3 },
  { date: '2026-09-29', title: 'آخر يوم لتسليم العلامات - الدورة الصيفية', type: 'deadline', semester: 3 },
  { date: '2026-09-30', title: 'بدء التدريس للفصل الدراسي الأول 2026/2027', type: 'start', semester: 3 },
];

const TYPE_CONFIG = {
  holiday: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '🏖️', label: 'عطلة' },
  exam:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '📝', label: 'امتحانات' },
  start:   { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '🚀', label: 'بداية' },
  end:     { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: '🏁', label: 'نهاية' },
  deadline:{ color: '#fbab15', bg: 'rgba(251,171,21,0.12)', icon: '⏰', label: 'موعد نهائي' },
  remote:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: '💻', label: 'عن بعد' },
  graduation:{ color: '#a855f7', bg: 'rgba(168,85,247,0.12)', icon: '🎓', label: 'تخرج' },
};

const SEMESTER_NAMES = {
  1: 'الفصل الأول 2025/2026',
  2: 'الفصل الثاني 2025/2026',
  3: 'الدورة الصيفية 2025/2026',
};

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
};

export default function BirzeitCalendar() {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [activeSemester, setActiveSemester] = useState(() => {
    // Auto-detect current semester
    const todayStr = today.toISOString().split('T')[0];
    if (todayStr >= '2025-09-29' && todayStr <= '2026-03-08') return 1;
    if (todayStr >= '2026-03-09' && todayStr <= '2026-07-19') return 2;
    if (todayStr >= '2026-07-20') return 3;
    return 1;
  });

  const [filter, setFilter] = useState('all');

  const semesterEvents = useMemo(() =>
    EVENTS.filter(e => e.semester === activeSemester && (filter === 'all' || e.type === filter))
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [activeSemester, filter]
  );

  // Next upcoming event overall
  const nextEvent = useMemo(() =>
    EVENTS
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0],
    []
  );

  const daysUntil = nextEvent
    ? Math.round((new Date(nextEvent.date) - today) / (1000 * 60 * 60 * 24))
    : null;

  const getEventStatus = (dateStr) => {
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    if (d.getTime() === today.getTime()) return 'today';
    if (d < today) return 'past';
    return 'upcoming';
  };

  const filterTypes = ['all', 'holiday', 'exam', 'start', 'end', 'deadline', 'remote'];

  return (
    <div style={{ fontFamily: "'Tajawal', sans-serif", direction: 'rtl' }}>

      {/* Next Event Banner */}
      {nextEvent && (
        <div style={{
          background: `linear-gradient(135deg, ${TYPE_CONFIG[nextEvent.type].color}22, ${TYPE_CONFIG[nextEvent.type].color}11)`,
          border: `1px solid ${TYPE_CONFIG[nextEvent.type].color}44`,
          borderRadius: 16, padding: '14px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: TYPE_CONFIG[nextEvent.type].bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem'
          }}>
            {TYPE_CONFIG[nextEvent.type].icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', color: TYPE_CONFIG[nextEvent.type].color, fontWeight: 700, marginBottom: 2 }}>
              الحدث القادم — بعد {daysUntil === 0 ? 'اليوم!' : `${daysUntil} يوم`}
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {nextEvent.title}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {DAYS_AR[new Date(nextEvent.date).getDay()]}، {formatDate(nextEvent.date)}
            </div>
          </div>
        </div>
      )}

      {/* Semester Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {[1, 2, 3].map(s => (
          <button key={s} onClick={() => setActiveSemester(s)} style={{
            padding: '8px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700,
            background: activeSemester === s ? '#fbab15' : 'var(--bg-primary)',
            color: activeSemester === s ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            boxShadow: activeSemester === s ? '0 4px 12px rgba(251,171,21,0.35)' : 'none'
          }}>
            {s === 1 ? 'الفصل الأول' : s === 2 ? 'الفصل الثاني' : 'الدورة الصيفية'}
          </button>
        ))}
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {filterTypes.map(f => {
          const cfg = f === 'all' ? { color: '#94a3b8', icon: '📋', label: 'الكل' } : TYPE_CONFIG[f];
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', borderRadius: 20, border: `1px solid ${filter === f ? cfg.color : 'var(--bg-tertiary)'}`,
              background: filter === f ? cfg.bg : 'transparent', cursor: 'pointer',
              color: filter === f ? cfg.color : 'var(--text-muted)', fontFamily: 'inherit',
              fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4
            }}>
              <span style={{ fontSize: '0.9rem' }}>{cfg.icon}</span> {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Events Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical Line */}
        <div style={{
          position: 'absolute', right: 23, top: 0, bottom: 0,
          width: 2, background: 'var(--bg-tertiary)', borderRadius: 2
        }} />

        {semesterEvents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            لا توجد أحداث في هذه الفئة
          </div>
        )}

        {semesterEvents.map((event, idx) => {
          const status = getEventStatus(event.date);
          const cfg = TYPE_CONFIG[event.type];
          const isPast = status === 'past';
          const isToday = status === 'today';

          return (
            <div key={idx} style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'flex-start', position: 'relative' }}>
              {/* Dot */}
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: isPast ? 'var(--bg-tertiary)' : cfg.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', position: 'relative', zIndex: 2,
                border: isToday ? `2px solid ${cfg.color}` : '2px solid transparent',
                boxShadow: isToday ? `0 0 14px ${cfg.color}55` : 'none',
                opacity: isPast ? 0.5 : 1,
                transition: 'all 0.2s'
              }}>
                {isPast ? '✓' : cfg.icon}
              </div>

              {/* Card */}
              <div style={{
                flex: 1, background: 'var(--bg-primary)',
                borderRadius: 14, padding: '10px 14px',
                border: isToday ? `1px solid ${cfg.color}` : '1px solid var(--bg-tertiary)',
                opacity: isPast ? 0.6 : 1,
                boxShadow: isToday ? `0 4px 16px ${cfg.color}22` : 'none',
              }}>
                {isToday && (
                  <div style={{
                    fontSize: '0.68rem', color: cfg.color, fontWeight: 700,
                    marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, display: 'inline-block', animation: 'pulse 2s infinite' }} />
                    اليوم
                  </div>
                )}
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: isPast ? 'var(--text-muted)' : 'var(--text-primary)', lineHeight: 1.5 }}>
                  {event.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: 8,
                    background: cfg.bg, color: cfg.color, fontWeight: 700
                  }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {DAYS_AR[new Date(event.date).getDay()]}، {formatDate(event.date)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div style={{
        textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)',
        padding: '16px 0 8px', borderTop: '1px solid var(--bg-tertiary)', marginTop: 8
      }}>
        التقويم الأكاديمي لجامعة بيرزيت 2025/2026 • الدوام السبت–الخميس
      </div>
    </div>
  );
}
