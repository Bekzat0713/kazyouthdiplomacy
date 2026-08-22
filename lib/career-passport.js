"use strict";

const PRIVACY_LEVELS = new Set(["private", "university", "employers", "public"]);

function cleanText(value, maxLength = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanLongText(value, maxLength = 2000) {
  return String(value || "").trim().replace(/\r\n/g, "\n").slice(0, maxLength);
}

function cleanUrl(value) {
  const url = cleanText(value, 700);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch (_error) {
    return "";
  }
}

function cleanList(value, maxItems, mapper) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map(mapper).filter(Boolean);
}

function normalizeSkill(item) {
  const source = item && typeof item === "object" ? item : {};
  const name = cleanText(source.name, 80);
  if (!name) return null;
  return {
    id: cleanText(source.id, 80) || `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    level: cleanText(source.level, 40) || "Beginner",
  };
}

function normalizeLanguage(item) {
  const source = item && typeof item === "object" ? item : {};
  const name = cleanText(source.name, 80);
  if (!name) return null;
  return {
    id: cleanText(source.id, 80) || `language-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    level: cleanText(source.level, 40) || "A1",
  };
}

function normalizeExperience(item) {
  const source = item && typeof item === "object" ? item : {};
  const organization = cleanText(source.organization || source.company, 140);
  const position = cleanText(source.position, 120);
  if (!organization && !position) return null;
  return {
    id: cleanText(source.id, 80) || `experience-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: cleanText(source.type, 40) || "internship",
    organization,
    position,
    start_date: cleanText(source.start_date, 20),
    end_date: cleanText(source.end_date, 20),
    current: source.current === true,
    description: cleanLongText(source.description, 1600),
    skills: cleanList(source.skills, 12, (skill) => cleanText(skill, 80) || null),
  };
}

function normalizeProject(item) {
  const source = item && typeof item === "object" ? item : {};
  const title = cleanText(source.title, 140);
  if (!title) return null;
  return {
    id: cleanText(source.id, 80) || `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    role: cleanText(source.role, 120),
    description: cleanLongText(source.description, 1600),
    team: cleanText(source.team, 120),
    date: cleanText(source.date, 20),
    result: cleanLongText(source.result, 800),
    skills: cleanList(source.skills, 12, (skill) => cleanText(skill, 80) || null),
    link: cleanUrl(source.link),
  };
}

function defaultPassport(user = {}, survey = {}) {
  const fullName = [user.first_name, user.last_name].map((item) => cleanText(item, 80)).filter(Boolean).join(" ");
  return {
    identity: {
      full_name: fullName,
      university: cleanText(user.university, 160),
      specialty: "",
      course: "",
      city: "",
      headline: "",
      about: cleanLongText(user.bio, 1200),
    },
    career_goal: {
      profession: "",
      industries: [],
      directions: [],
      work_format: "",
      city: "",
      internship_ready: false,
      survey_goal: cleanText(survey.main_goal, 80),
    },
    skills: { hard: [], soft: [], languages: [] },
    experience: [],
    projects: [],
    education: [],
    achievements: [],
    portfolio_links: [],
    roadmap_completed: [],
  };
}

function normalizePassport(input, user = {}, survey = {}) {
  const source = input && typeof input === "object" ? input : {};
  const defaults = defaultPassport(user, survey);
  const identity = source.identity && typeof source.identity === "object" ? source.identity : {};
  const goal = source.career_goal && typeof source.career_goal === "object" ? source.career_goal : {};
  const skills = source.skills && typeof source.skills === "object" ? source.skills : {};

  return {
    identity: {
      full_name: cleanText(identity.full_name, 160) || defaults.identity.full_name,
      university: cleanText(identity.university, 160) || defaults.identity.university,
      specialty: cleanText(identity.specialty, 160),
      course: cleanText(identity.course, 40),
      city: cleanText(identity.city, 100),
      headline: cleanText(identity.headline, 180),
      about: cleanLongText(identity.about, 1400),
    },
    career_goal: {
      profession: cleanText(goal.profession, 140),
      industries: cleanList(goal.industries, 8, (item) => cleanText(item, 100) || null),
      directions: cleanList(goal.directions, 8, (item) => cleanText(item, 100) || null),
      work_format: cleanText(goal.work_format, 40),
      city: cleanText(goal.city, 100),
      internship_ready: goal.internship_ready === true,
      survey_goal: cleanText(goal.survey_goal || defaults.career_goal.survey_goal, 80),
    },
    skills: {
      hard: cleanList(skills.hard, 30, normalizeSkill),
      soft: cleanList(skills.soft, 30, normalizeSkill),
      languages: cleanList(skills.languages, 15, normalizeLanguage),
    },
    experience: cleanList(source.experience, 30, normalizeExperience),
    projects: cleanList(source.projects, 30, normalizeProject),
    education: cleanList(source.education, 20, (item) => item && typeof item === "object" ? item : null),
    achievements: cleanList(source.achievements, 30, (item) => item && typeof item === "object" ? item : null),
    portfolio_links: cleanList(source.portfolio_links, 12, (item) => cleanUrl(item) || null),
    roadmap_completed: cleanList(source.roadmap_completed, 5, (item) => {
      const id = cleanText(item, 40);
      return ["career-goal", "skills", "project", "web-cv", "applications"].includes(id) ? id : null;
    }),
  };
}

function normalizePrivacy(input) {
  const source = input && typeof input === "object" ? input : {};
  const sections = source.sections && typeof source.sections === "object" ? source.sections : {};
  const result = { public_profile: source.public_profile === true, sections: {} };
  ["identity", "career_goal", "skills", "experience", "projects", "education", "achievements", "portfolio_links"].forEach((key) => {
    result.sections[key] = PRIVACY_LEVELS.has(sections[key]) ? sections[key] : "private";
  });
  return result;
}

function scoreRatio(points, total) {
  return total > 0 ? Math.round((points / total) * 100) : 0;
}

function calculateReadiness(passport, context = {}) {
  const identity = passport.identity || {};
  const goal = passport.career_goal || {};
  const skills = passport.skills || {};
  const hardSoft = [...(skills.hard || []), ...(skills.soft || [])];
  const experiences = passport.experience || [];
  const projects = passport.projects || [];
  const appliedCount = Number(context.appliedCount || 0);
  const manualCompleted = new Set(Array.isArray(passport.roadmap_completed) ? passport.roadmap_completed : []);

  let webCvPoints = 0;
  if (identity.full_name && identity.university && identity.specialty) webCvPoints += 30;
  if (identity.headline && identity.about) webCvPoints += 20;
  if (context.webCvExists) webCvPoints += 30;
  if (context.webCvPublic) webCvPoints += 20;

  let skillsPoints = 0;
  if (hardSoft.length >= 1) skillsPoints += 25;
  if (hardSoft.length >= 5) skillsPoints += 25;
  if ((skills.languages || []).length >= 1) skillsPoints += 20;
  if (hardSoft.some((item) => item.level)) skillsPoints += 15;
  if (projects.some((project) => (project.skills || []).length > 0) || experiences.some((item) => (item.skills || []).length > 0)) skillsPoints += 15;

  let experiencePoints = 0;
  if (projects.length >= 1) experiencePoints += 35;
  if (projects.some((project) => project.result || project.link)) experiencePoints += 15;
  if (experiences.length >= 1) experiencePoints += 35;
  if (experiences.some((item) => item.description && (item.skills || []).length > 0)) experiencePoints += 15;

  let activityPoints = 0;
  if (goal.profession) activityPoints += 25;
  if (goal.industries.length || goal.directions.length) activityPoints += 15;
  if (context.diagnosticsComplete) activityPoints += 10;
  if (context.savedCount >= 1) activityPoints += 15;
  if (appliedCount >= 1) activityPoints += 20;
  if (appliedCount >= 3) activityPoints += 15;

  const categories = {
    web_cv: Math.min(100, webCvPoints),
    skills: Math.min(100, skillsPoints),
    experience: Math.min(100, experiencePoints),
    career_activity: Math.min(100, activityPoints),
  };
  const weights = { web_cv: 0.25, skills: 0.25, experience: 0.3, career_activity: 0.2 };
  const total = Math.round(Object.keys(categories).reduce((sum, key) => sum + categories[key] * weights[key], 0));

  const stepDefinitions = [
    { id: "career-goal", title: "Выбрать карьерную цель", description: "Укажите профессию и интересующие индустрии.", automatic: Boolean(goal.profession), href: "#career-goal" },
    { id: "skills", title: "Добавить минимум 5 навыков", description: "Разделите hard и soft skills и укажите уровень.", automatic: hardSoft.length >= 5, href: "#skills" },
    { id: "project", title: "Добавить проект с результатом", description: "Даже учебный или волонтёрский проект считается опытом.", automatic: projects.some((item) => item.result || item.link), href: "#projects" },
    { id: "web-cv", title: "Создать Web CV", description: "Соберите публичную версию только из разрешённых данных.", automatic: Boolean(context.webCvExists), href: "/career-profile" },
    { id: "applications", title: "Подать минимум 3 заявки", description: "Практическая активность напрямую повышает readiness.", automatic: appliedCount >= 3, href: "/opportunities" },
  ];
  const steps = stepDefinitions.map((step) => ({
    ...step,
    completed: step.automatic || manualCompleted.has(step.id),
  }));

  return { total, categories, steps, completed_steps: steps.filter((step) => step.completed).length };
}

function buildPublicProjection(passport, privacy) {
  const projection = {};
  if (!privacy.public_profile) return projection;
  Object.keys(privacy.sections).forEach((key) => {
    if (privacy.sections[key] === "public" && Object.prototype.hasOwnProperty.call(passport, key)) {
      projection[key] = passport[key];
    }
  });
  return projection;
}

function passportToCareerProfile(passport, privacy, existing = {}) {
  const visible = buildPublicProjection(passport, privacy);
  const identity = visible.identity || {};
  const goal = visible.career_goal || {};
  const skills = visible.skills || {};
  const education = Array.isArray(visible.education) ? visible.education : [];
  const achievements = Array.isArray(visible.achievements) ? visible.achievements : [];
  return {
    template_key: existing.template_key || "professional",
    photo_url: existing.photo_url || "",
    full_name: identity.full_name || "",
    specialization: goal.profession || identity.headline || "",
    city: identity.city || goal.city || "",
    university: identity.university || "",
    about: identity.about || "",
    skills: [...(skills.hard || []), ...(skills.soft || [])].map((item) => item.name),
    skill_proofs: [],
    languages: (skills.languages || []).map((item) => ({ name: item.name, level: item.level })),
    experience: (visible.experience || []).map((item) => ({
      role: item.position,
      company: item.organization,
      period: [item.start_date, item.current ? "Present" : item.end_date].filter(Boolean).join(" — "),
      details: item.description,
    })),
    projects: (visible.projects || []).map((item) => ({
      title: item.title,
      summary: [item.description, item.result].filter(Boolean).join("\n\n"),
      stack: [item.role, ...(item.skills || [])].filter(Boolean).join(" · "),
      link_url: item.link,
    })),
    education: education.map((item) => ({
      institution: cleanText(item.university || item.institution, 140),
      degree: cleanText(item.degree || item.specialization, 140),
      period: cleanText(item.years || item.period, 80),
      details: cleanLongText(item.details || item.faculty, 320),
    })),
    certificates: achievements
      .filter((item) => item && ["certificate", "course"].includes(String(item.type || "").toLowerCase()))
      .map((item) => ({ title: item.title || item.name, issuer: item.issuer || item.organization, year: item.year, link_url: item.link })),
    links: (visible.portfolio_links || []).map((url) => ({ label: "Portfolio", url })),
  };
}

module.exports = {
  calculateReadiness,
  defaultPassport,
  normalizePassport,
  normalizePrivacy,
  buildPublicProjection,
  passportToCareerProfile,
};
