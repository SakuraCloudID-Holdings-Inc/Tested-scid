const state = {
  dataLoaded: false,
  jobs: [],
  candidates: [],
  users: [],
  applications: {},
  currentUser: null,
  storedProfiles: JSON.parse(localStorage.getItem('sci_candidate_profiles') || '{}'),
  storedApplications: JSON.parse(localStorage.getItem('sci_applications') || '{}'),
  extraJobs: JSON.parse(localStorage.getItem('sci_jobs') || '[]'),
};

const elements = {
  jobSearch: document.getElementById('jobSearch'),
  jobTeamFilter: document.getElementById('jobTeamFilter'),
  jobCategoryFilter: document.getElementById('jobCategoryFilter'),
  jobTypeFilter: document.getElementById('jobTypeFilter'),
  jobDateFilter: document.getElementById('jobDateFilter'),
  jobResults: document.getElementById('jobResults'),
  candidateSearch: document.getElementById('candidateSearch'),
  candidateSkillFilter: document.getElementById('candidateSkillFilter'),
  candidateLocationFilter: document.getElementById('candidateLocationFilter'),
  candidateExperienceFilter: document.getElementById('candidateExperienceFilter'),
  candidateResults: document.getElementById('candidateResults'),
  dashboard: document.getElementById('dashboard'),
  dashboardToggle: document.getElementById('dashboardToggle'),
  authToggle: document.getElementById('authToggle'),
  authDialog: document.getElementById('authDialog'),
  authForm: document.getElementById('authForm'),
  applyDialog: document.getElementById('applyDialog'),
  applyForm: document.getElementById('applyForm'),
  applyJobTitle: document.getElementById('applyJobTitle'),
  dashboardJobs: document.getElementById('dashboardJobs'),
  applicationsList: document.getElementById('applicationsList'),
  candidateApplications: document.getElementById('candidateApplications'),
  newJobForm: document.getElementById('newJobForm'),
  recruiterPanel: document.getElementById('recruiterPanel'),
  applicationsPanel: document.getElementById('applicationsPanel'),
  candidatePanel: document.getElementById('candidatePanel'),
  candidateProfileForm: document.getElementById('candidateProfileForm'),
  logoutBtn: document.getElementById('logoutBtn'),
};

async function loadData() {
  try {
    const response = await fetch('data/data.json');
    const data = await response.json();
    state.jobs = [...data.job_postings, ...state.extraJobs];
    state.candidates = data.candidates;
    state.users = data.users;
    state.applications = { ...data.applications, ...state.storedApplications };
    state.dataLoaded = true;
    populateFilters();
    renderJobs();
    renderCandidates();
    hydrateCurrentUser();
  } catch (error) {
    console.error('Failed to load data', error);
    elements.jobResults.innerHTML = '<div class="empty-state">Unable to load job postings. Please refresh.</div>';
    elements.candidateResults.innerHTML = '<div class="empty-state">Unable to load candidate profiles. Please refresh.</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  bindEvents();
});

function populateFilters() {
  const teams = new Set(state.jobs.map((job) => job.team));
  const categories = new Set(state.jobs.map((job) => job.category));
  const types = new Set(state.jobs.map((job) => job.work_type));
  const skills = new Set(state.candidates.flatMap((candidate) => candidate.skills || []));
  const locations = new Set(state.candidates.map((candidate) => candidate.location));

  fillSelect(elements.jobTeamFilter, teams);
  fillSelect(elements.jobCategoryFilter, categories);
  fillSelect(elements.jobTypeFilter, types);
  fillSelect(elements.candidateSkillFilter, skills);
  fillSelect(elements.candidateLocationFilter, locations);
}

function fillSelect(selectEl, values) {
  const current = selectEl.value;
  selectEl.innerHTML = `<option value="">${selectEl.options[0]?.textContent || 'All'}</option>`;
  Array.from(values)
    .filter(Boolean)
    .sort()
    .forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      selectEl.appendChild(option);
    });
  if (Array.from(selectEl.options).some((opt) => opt.value === current)) {
    selectEl.value = current;
  }
}

function bindEvents() {
  elements.jobSearch?.addEventListener('input', debounce(renderJobs, 200));
  elements.jobTeamFilter?.addEventListener('change', renderJobs);
  elements.jobCategoryFilter?.addEventListener('change', renderJobs);
  elements.jobTypeFilter?.addEventListener('change', renderJobs);
  elements.jobDateFilter?.addEventListener('change', renderJobs);

  elements.candidateSearch?.addEventListener('input', debounce(renderCandidates, 200));
  elements.candidateSkillFilter?.addEventListener('change', renderCandidates);
  elements.candidateLocationFilter?.addEventListener('change', renderCandidates);
  elements.candidateExperienceFilter?.addEventListener('change', renderCandidates);

  elements.authToggle?.addEventListener('click', () => openDialog(elements.authDialog));
  elements.dashboardToggle?.addEventListener('click', toggleDashboard);

  elements.authDialog?.addEventListener('click', handleDialogBackdrop);
  elements.applyDialog?.addEventListener('click', handleDialogBackdrop);
  document.querySelectorAll('[data-close]').forEach((btn) =>
    btn.addEventListener('click', (event) => {
      const dialog = event.target.closest('dialog');
      dialog?.close();
    })
  );

  elements.authForm?.addEventListener('submit', authenticateUser);
  elements.applyForm?.addEventListener('submit', submitApplication);
  elements.newJobForm?.addEventListener('submit', handleNewJob);
  elements.logoutBtn?.addEventListener('click', logout);
  elements.candidateProfileForm?.addEventListener('submit', saveCandidateProfile);
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

function renderJobs() {
  if (!state.dataLoaded) return;
  const query = elements.jobSearch.value.trim().toLowerCase();
  const team = elements.jobTeamFilter.value;
  const category = elements.jobCategoryFilter.value;
  const type = elements.jobTypeFilter.value;
  const dateWindow = elements.jobDateFilter.value;

  const now = new Date();
  const jobs = state.jobs.filter((job) => {
    const matchesQuery = [job.job_title, job.description, job.qualifications, job.team, job.location]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(query));
    const matchesTeam = !team || job.team === team;
    const matchesCategory = !category || job.category === category;
    const matchesType = !type || job.work_type === type;
    const matchesDate = !dateWindow || withinDateRange(job.posting_date, Number(dateWindow), now);
    return matchesQuery && matchesTeam && matchesCategory && matchesType && matchesDate;
  });

  if (!jobs.length) {
    elements.jobResults.innerHTML = '<div class="empty-state">No roles match your filters yet. Try adjusting your search.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  jobs.forEach((job) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div>
        <h3 class="card__title">${job.job_title}</h3>
        <div class="card__meta">
          <span class="badge badge--accent">${job.work_type}</span>
          <span class="badge">${job.team}</span>
          <span>${job.location || 'Multiple locations'}</span>
        </div>
      </div>
      <p class="card__description">${job.description}</p>
      <div class="badge-group">
        ${(job.qualifications || '')
          .split(',')
          .map((q) => q.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((q) => `<span class="tag">${q}</span>`)
          .join('')}
      </div>
      <div class="card__footer">
        <span>REQ: ${job.job_requisition_id}</span>
        <button class="btn btn--ghost" type="button" data-job="${job.job_requisition_id}">Apply Now</button>
      </div>
      <span class="card__meta">Posted ${formatRelativeDate(job.posting_date)}</span>
    `;
    fragment.appendChild(card);
  });
  elements.jobResults.innerHTML = '';
  elements.jobResults.appendChild(fragment);
  elements.jobResults.querySelectorAll('[data-job]').forEach((button) =>
    button.addEventListener('click', () => openApplication(button.dataset.job))
  );
}

function renderCandidates() {
  if (!state.dataLoaded) return;
  const query = elements.candidateSearch.value.trim().toLowerCase();
  const skill = elements.candidateSkillFilter.value;
  const location = elements.candidateLocationFilter.value;
  const experienceFilter = elements.candidateExperienceFilter.value;

  const candidates = state.candidates.filter((candidate) => {
    const matchesQuery = [candidate.name, candidate.experience, candidate.education, candidate.location, ...(candidate.skills || [])]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(query));
    const matchesSkill = !skill || (candidate.skills || []).includes(skill);
    const matchesLocation = !location || candidate.location === location;
    const matchesExperience = !experienceFilter || experienceInRange(candidate.experience_years, experienceFilter);
    return matchesQuery && matchesSkill && matchesLocation && matchesExperience;
  });

  if (!candidates.length) {
    elements.candidateResults.innerHTML = '<div class="empty-state">No candidates found for the selected filters.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  candidates.forEach((candidate) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div>
        <h3 class="card__title">${candidate.name}</h3>
        <div class="card__meta">
          <span class="badge">${candidate.location}</span>
          <span>${candidate.education}</span>
          ${candidate.email ? `<span>${candidate.email}</span>` : ''}
        </div>
      </div>
      <p class="card__description">${candidate.summary || candidate.experience}</p>
      <div class="badge-group">
        ${(candidate.skills || []).map((skill) => `<span class="tag">${skill}</span>`).join('')}
      </div>
      <div class="card__footer">
        <span>${candidate.experience}</span>
        <span class="badge">${candidate.availability}</span>
      </div>
    `;
    fragment.appendChild(card);
  });
  elements.candidateResults.innerHTML = '';
  elements.candidateResults.appendChild(fragment);
}

function withinDateRange(dateString, days, referenceDate) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return true;
  const diff = (referenceDate - date) / (1000 * 60 * 60 * 24);
  return diff <= days;
}

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'recently';
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return 'today';
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
}

function experienceInRange(years, filter) {
  if (!filter) return true;
  if (!Number.isFinite(years)) return false;
  const [min, max] = filter.split('-');
  if (filter.endsWith('+')) {
    return years >= parseInt(filter, 10);
  }
  return years >= Number(min) && years <= Number(max);
}

function openDialog(dialog) {
  if (!dialog.open) {
    dialog.showModal();
  }
}

function handleDialogBackdrop(event) {
  const dialog = event.currentTarget;
  const rect = dialog.getBoundingClientRect();
  const clickedInDialog =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;
  if (!clickedInDialog) {
    dialog.close();
  }
}

function toggleDashboard() {
  if (!state.currentUser) {
    openDialog(elements.authDialog);
    return;
  }
  elements.dashboard.hidden = !elements.dashboard.hidden;
}

function authenticateUser(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const username = formData.get('username').trim().toLowerCase();
  const password = formData.get('password');
  const role = formData.get('role');

  const user = state.users.find((u) => u.username === username && u.role === role);
  if (!user || user.password !== password) {
    alert('Invalid credentials. Try the provided demo accounts.');
    return;
  }
  state.currentUser = { ...user };
  localStorage.setItem('sci_current_user', JSON.stringify(state.currentUser));
  elements.authDialog.close();
  updateDashboardView();
  elements.dashboard.hidden = false;
}

function hydrateCurrentUser() {
  const stored = localStorage.getItem('sci_current_user');
  if (!stored) return;
  try {
    state.currentUser = JSON.parse(stored);
    if (state.currentUser) {
      updateDashboardView();
      elements.dashboard.hidden = false;
    }
  } catch (error) {
    console.warn('Unable to hydrate user', error);
  }
}

function updateDashboardView() {
  if (!state.currentUser) return;
  const isRecruiter = state.currentUser.role === 'recruiter';
  elements.recruiterPanel.hidden = !isRecruiter;
  elements.applicationsPanel.hidden = !isRecruiter;
  elements.candidatePanel.hidden = isRecruiter;
  elements.dashboardToggle.textContent = 'Dashboard';
  elements.authToggle.textContent = 'Account';
  if (isRecruiter) {
    renderDashboardJobs();
    renderApplications();
  } else {
    populateCandidateProfile();
    renderCandidateApplications();
  }
}

function logout() {
  state.currentUser = null;
  elements.dashboard.hidden = true;
  elements.recruiterPanel.hidden = true;
  elements.applicationsPanel.hidden = true;
  elements.candidatePanel.hidden = true;
  elements.dashboardToggle.textContent = 'Dashboard';
  elements.authToggle.textContent = 'Sign In';
  localStorage.removeItem('sci_current_user');
}

function handleNewJob(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const newJob = Object.fromEntries(formData.entries());
  newJob.posting_date = newJob.posting_date || new Date().toISOString().slice(0, 10);
  state.jobs = [newJob, ...state.jobs];
  state.extraJobs = [newJob, ...state.extraJobs.filter((job) => job.job_requisition_id !== newJob.job_requisition_id)];
  localStorage.setItem('sci_jobs', JSON.stringify(state.extraJobs));
  populateFilters();
  renderJobs();
  renderDashboardJobs();
  event.target.reset();
  alert('Job published successfully.');
}

function renderDashboardJobs() {
  elements.dashboardJobs.innerHTML = '';
  state.jobs.forEach((job) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <div class="list__item">
        <strong>${job.job_title}</strong><br />
        <small>${job.job_requisition_id} • ${job.work_type} • ${job.team}</small>
      </div>
    `;
    elements.dashboardJobs.appendChild(item);
  });
}

function submitApplication(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const jobId = formData.get('job_requisition_id');

  Promise.all([
    readFile(formData.get('resume')),
    readFile(formData.get('cover_letter')),
  ]).then(([resume, coverLetter]) => {
    const application = {
      job_requisition_id: jobId,
      name: formData.get('name'),
      email: formData.get('email'),
      message: formData.get('message') || '',
      resume,
      cover_letter: coverLetter,
      submitted_at: new Date().toISOString(),
    };

    state.applications[jobId] = state.applications[jobId] || [];
    state.applications[jobId].push(application);
    persistApplications();
    elements.applyDialog.close();
    event.target.reset();
    alert('Application submitted successfully!');
    if (state.currentUser?.role === 'candidate') {
      state.storedProfiles[state.currentUser.username] = state.storedProfiles[state.currentUser.username] || {};
      state.storedProfiles[state.currentUser.username].applications = state.storedProfiles[state.currentUser.username].applications || [];
      state.storedProfiles[state.currentUser.username].applications.push(application);
      localStorage.setItem('sci_candidate_profiles', JSON.stringify(state.storedProfiles));
      renderCandidateApplications();
    }
    renderApplications();
  });
}

function renderApplications() {
  if (elements.applicationsPanel.hidden) return;
  elements.applicationsList.innerHTML = '';
  const jobIds = Object.keys(state.applications);
  if (!jobIds.length) {
    elements.applicationsList.innerHTML = '<div class="empty-state">No applications received yet.</div>';
    return;
  }
  jobIds.forEach((jobId) => {
    const job = state.jobs.find((j) => j.job_requisition_id === jobId);
    const container = document.createElement('div');
    container.innerHTML = `<strong>${job?.job_title || jobId}</strong><br /><small>${jobId}</small>`;
    const list = document.createElement('ul');
    list.className = 'list';
    state.applications[jobId].forEach((app) => {
      const item = document.createElement('li');
      item.innerHTML = `
        <div class="list__item">
          <strong>${app.name}</strong> • ${app.email}<br />
          <small>${new Date(app.submitted_at).toLocaleString()}</small>
          ${app.message ? `<p>${app.message}</p>` : ''}
        </div>
      `;
      list.appendChild(item);
    });
    container.appendChild(list);
    elements.applicationsList.appendChild(container);
  });
}

function openApplication(jobId) {
  const job = state.jobs.find((j) => j.job_requisition_id === jobId);
  if (!job) return;
  elements.applyJobTitle.textContent = `Apply for ${job.job_title}`;
  elements.applyForm.querySelector('[name="job_requisition_id"]').value = jobId;
  if (state.currentUser?.role === 'candidate') {
    const profile = state.storedProfiles[state.currentUser.username]?.profile;
    if (profile) {
      elements.applyForm.querySelector('[name="name"]').value = profile.name;
      elements.applyForm.querySelector('[name="email"]').value = state.currentUser.username;
    }
  }
  openDialog(elements.applyDialog);
}

function readFile(file) {
  if (!file) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, content: reader.result });
    reader.readAsDataURL(file);
  });
}

function persistApplications() {
  localStorage.setItem('sci_applications', JSON.stringify(state.applications));
}

function populateCandidateProfile() {
  const profile = state.storedProfiles[state.currentUser.username]?.profile || state.currentUser.profile || {};
  const form = elements.candidateProfileForm;
  form.name.value = profile.name || '';
  form.skills.value = profile.skills ? profile.skills.join(', ') : '';
  form.experience.value = profile.experience || '';
  form.experience_years.value = profile.experience_years || '';
  form.education.value = profile.education || '';
  form.location.value = profile.location || '';
  form.availability.value = profile.availability || 'Open to full-time';
  if (profile.name) {
    syncCandidateDirectory(profile);
  }
}

function saveCandidateProfile(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  Promise.all([
    readFile(formData.get('resume')),
    readFile(formData.get('cover_letter')),
  ]).then(([resume, coverLetter]) => {
    const profile = {
      name: formData.get('name'),
      skills: formData
        .get('skills')
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
      experience: formData.get('experience'),
      experience_years: Number(formData.get('experience_years') || 0),
      education: formData.get('education'),
      location: formData.get('location'),
      availability: formData.get('availability'),
      resume,
      cover_letter: coverLetter,
    };

    state.storedProfiles[state.currentUser.username] = state.storedProfiles[state.currentUser.username] || {};
    state.storedProfiles[state.currentUser.username].profile = profile;
    localStorage.setItem('sci_candidate_profiles', JSON.stringify(state.storedProfiles));
    syncCandidateDirectory(profile);
    alert('Profile saved successfully!');
  });
}

function renderCandidateApplications() {
  if (!state.currentUser || state.currentUser.role !== 'candidate') return;
  const apps = state.storedProfiles[state.currentUser.username]?.applications || [];
  elements.candidateApplications.innerHTML = '';
  if (!apps.length) {
    elements.candidateApplications.innerHTML = '<li class="empty-state">No applications submitted yet.</li>';
    return;
  }
  apps.forEach((app) => {
    const job = state.jobs.find((j) => j.job_requisition_id === app.job_requisition_id);
    const item = document.createElement('li');
    item.innerHTML = `
      <div class="list__item">
        <strong>${job?.job_title || app.job_requisition_id}</strong><br />
        <small>Submitted ${new Date(app.submitted_at).toLocaleString()}</small>
      </div>
    `;
    elements.candidateApplications.appendChild(item);
  });
}

function syncCandidateDirectory(profile) {
  const record = {
    name: profile.name,
    skills: profile.skills,
    experience: profile.experience,
    experience_years: profile.experience_years,
    education: profile.education,
    location: profile.location,
    summary: profile.experience,
    availability: profile.availability,
    email: state.currentUser.username,
  };
  const index = state.candidates.findIndex((candidate) => candidate.email === record.email);
  if (index >= 0) {
    state.candidates[index] = { ...state.candidates[index], ...record };
  } else {
    state.candidates.push(record);
  }
  populateFilters();
  renderCandidates();
}

