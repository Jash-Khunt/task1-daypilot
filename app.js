/* ================================================================
   DayPilot — Application Logic
   ================================================================ */
(function () {
  'use strict';

  // ─── Constants ───
  const STORAGE_KEY = 'daypilot-tasks';
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  // ─── State ───
  let tasks = [];
  let filter = 'all';      // 'all' | 'active' | 'completed'
  let sort = 'priority';   // 'priority' | 'newest'
  let pendingDeleteId = null;

  // ─── DOM References ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    headerDate:     $('#header-date'),
    statTotal:      $('#stat-total .stat-value'),
    statCompleted:  $('#stat-completed .stat-value'),
    statPending:    $('#stat-pending .stat-value'),
    statPercent:    $('#stat-percent .stat-value'),
    progressFill:   $('#progress-fill'),
    taskForm:       $('#task-form'),
    inputTitle:     $('#input-title'),
    inputPriority:  $('#input-priority'),
    inputNote:      $('#input-note'),
    errorTitle:     $('#error-title'),
    taskList:       $('#task-list'),
    emptyState:     $('#empty-state'),
    filterBtns:     $$('.filter-btn'),
    sortSelect:     $('#sort-select'),
    // AI Modal
    btnAiPlan:      $('#btn-ai-plan'),
    aiModal:        $('#ai-modal'),
    aiModalClose:   $('#ai-modal-close'),
    aiStepInput:    $('#ai-step-input'),
    aiStepResults:  $('#ai-step-results'),
    aiGoal:         $('#ai-goal'),
    errorAiGoal:    $('#error-ai-goal'),
    btnAiGenerate:  $('#btn-ai-generate'),
    aiSuggestionsList: $('#ai-suggestions-list'),
    btnAiBack:      $('#btn-ai-back'),
    btnAiAddSelected: $('#btn-ai-add-selected'),
    btnAiAddAll:    $('#btn-ai-add-all'),
    // Confirm Modal
    confirmModal:   $('#confirm-modal'),
    confirmMessage: $('#confirm-message'),
    btnConfirmCancel: $('#btn-confirm-cancel'),
    btnConfirmDelete: $('#btn-confirm-delete'),
  };

  // ─── Init ───
  function init() {
    setHeaderDate();
    loadTasks();
    render();
    bindEvents();
  }

  function setHeaderDate() {
    const now = new Date();
    dom.headerDate.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  // ─── Persistence ───
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      tasks = raw ? JSON.parse(raw) : [];
    } catch {
      tasks = [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  // ─── Rendering ───
  function render() {
    renderDashboard();
    renderTasks();
  }

  function renderDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    dom.statTotal.textContent = total;
    dom.statCompleted.textContent = completed;
    dom.statPending.textContent = pending;
    dom.statPercent.textContent = pct + '%';
    dom.progressFill.style.width = pct + '%';
  }

  function renderTasks() {
    // Filter
    let filtered = tasks;
    if (filter === 'active')    filtered = tasks.filter(t => !t.completed);
    if (filter === 'completed') filtered = tasks.filter(t => t.completed);

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sort === 'priority') {
        // uncompleted first, then by priority, then newest
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority])
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return b.createdAt - a.createdAt;
      }
      // newest
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    // Empty state
    if (filtered.length === 0) {
      dom.taskList.innerHTML = '';
      dom.emptyState.style.display = 'block';
      // Customize empty-state message based on filter
      const msg = dom.emptyState.querySelector('p');
      if (filter === 'active') msg.textContent = 'All tasks are completed! 🎉';
      else if (filter === 'completed') msg.textContent = 'No completed tasks yet.';
      else msg.textContent = 'No tasks yet — start planning your day!';
      return;
    }

    dom.emptyState.style.display = 'none';

    // Group by priority if sorting by priority
    let html = '';
    if (sort === 'priority') {
      const groups = { high: [], medium: [], low: [] };
      filtered.forEach(t => groups[t.priority].push(t));

      for (const [pri, list] of Object.entries(groups)) {
        if (list.length === 0) continue;
        html += `<div class="priority-group-header">${pri} priority</div>`;
        list.forEach(t => { html += taskCardHTML(t); });
      }
    } else {
      filtered.forEach(t => { html += taskCardHTML(t); });
    }

    dom.taskList.innerHTML = html;
  }

  function taskCardHTML(t) {
    const checkedClass = t.completed ? 'checked' : '';
    const completedClass = t.completed ? 'completed' : '';
    const checkSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    const deleteSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    const noteHTML = t.note ? `<p class="task-note">${escapeHTML(t.note)}</p>` : '';
    return `
    <div class="task-card ${completedClass}" data-id="${t.id}">
      <button class="task-checkbox ${checkedClass}" data-action="toggle" data-id="${t.id}" aria-label="Toggle complete">
        ${checkSVG}
      </button>
      <div class="task-body">
        <div class="task-title-row">
          <span class="task-title">${escapeHTML(t.title)}</span>
          <span class="badge badge-${t.priority}">${t.priority}</span>
        </div>
        ${noteHTML}
      </div>
      <button class="task-delete" data-action="delete" data-id="${t.id}" aria-label="Delete task">
        ${deleteSVG}
      </button>
    </div>`;
  }

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Task CRUD ───
  function addTask(title, priority, note) {
    const task = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: title.trim(),
      note: note.trim(),
      priority,
      completed: false,
      createdAt: Date.now(),
    };
    tasks.unshift(task);
    saveTasks();
    render();
  }

  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      saveTasks();
      render();
    }
  }

  function deleteTask(id) {
    const card = dom.taskList.querySelector(`.task-card[data-id="${id}"]`);
    if (card) {
      card.classList.add('fade-out');
      card.addEventListener('animationend', () => {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        render();
      }, { once: true });
    } else {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      render();
    }
  }

  // ─── Confirm Modal ───
  function showConfirm(message, onConfirm) {
    dom.confirmMessage.textContent = message;
    dom.confirmModal.classList.add('open');
    dom.confirmModal.setAttribute('aria-hidden', 'false');

    const handleDelete = () => {
      onConfirm();
      closeConfirm();
    };
    const handleCancel = () => closeConfirm();

    dom.btnConfirmDelete.onclick = handleDelete;
    dom.btnConfirmCancel.onclick = handleCancel;
  }

  function closeConfirm() {
    dom.confirmModal.classList.remove('open');
    dom.confirmModal.setAttribute('aria-hidden', 'true');
  }

  // ─── AI Plan Feature ───
  const TASK_TEMPLATES = {
    study: [
      { title: 'Review notes and key concepts', note: 'Focus on summarizing main ideas', priority: 'high' },
      { title: 'Create flashcards for key terms', note: 'Use active recall technique', priority: 'high' },
      { title: 'Practice problems or past papers', note: 'Time yourself to simulate real conditions', priority: 'high' },
      { title: 'Summarize each chapter in your own words', note: 'Write brief paragraphs', priority: 'medium' },
      { title: 'Teach concepts to someone or out loud', note: 'Explaining helps consolidate memory', priority: 'medium' },
      { title: 'Organize study materials', note: 'Keep everything in one place', priority: 'low' },
      { title: 'Join a study group or forum', note: 'Discuss difficult topics', priority: 'low' },
      { title: 'Take short breaks between sessions', note: 'Use the Pomodoro technique', priority: 'low' },
      { title: 'Review mistakes and weak areas', note: 'Turn weaknesses into strengths', priority: 'medium' },
    ],
    work: [
      { title: 'Check and respond to priority emails', note: 'Handle urgent messages first', priority: 'high' },
      { title: 'Plan today\'s key deliverables', note: 'Identify your top 3 tasks', priority: 'high' },
      { title: 'Complete the most important task', note: 'Do deep work before meetings', priority: 'high' },
      { title: 'Attend scheduled meetings', note: 'Prepare notes in advance', priority: 'medium' },
      { title: 'Follow up on pending items', note: 'Send reminders if needed', priority: 'medium' },
      { title: 'Update project tracker or board', note: 'Keep stakeholders informed', priority: 'medium' },
      { title: 'Review code or documents', note: 'Provide thoughtful feedback', priority: 'low' },
      { title: 'Clean up workspace and files', note: 'Organize documents and folders', priority: 'low' },
      { title: 'Plan tomorrow\'s tasks', note: 'End the day with a clear plan', priority: 'low' },
    ],
    fitness: [
      { title: 'Warm up with dynamic stretches', note: '5-10 minutes of mobility work', priority: 'high' },
      { title: 'Complete main workout', note: 'Follow your training program', priority: 'high' },
      { title: 'Cool down and stretch', note: 'Focus on worked muscle groups', priority: 'high' },
      { title: 'Prepare healthy meals for the day', note: 'High protein, balanced macros', priority: 'medium' },
      { title: 'Track workout and progress', note: 'Log sets, reps, and weights', priority: 'medium' },
      { title: 'Stay hydrated (8 glasses)', note: 'Carry a water bottle', priority: 'medium' },
      { title: 'Get 10,000 steps', note: 'Walk during breaks', priority: 'low' },
      { title: 'Foam roll tight muscles', note: 'Aids recovery and reduces soreness', priority: 'low' },
      { title: 'Plan tomorrow\'s workout', note: 'Prepare gear the night before', priority: 'low' },
    ],
    clean: [
      { title: 'Declutter main living area', note: 'Put away items that are out of place', priority: 'high' },
      { title: 'Deep clean kitchen', note: 'Counters, sink, appliances, and floor', priority: 'high' },
      { title: 'Clean bathrooms', note: 'Toilet, sink, mirror, and floor', priority: 'high' },
      { title: 'Do laundry', note: 'Wash, dry, fold, and put away', priority: 'medium' },
      { title: 'Vacuum or mop floors', note: 'All main rooms and hallways', priority: 'medium' },
      { title: 'Dust furniture and shelves', note: 'Use microfiber cloth', priority: 'medium' },
      { title: 'Organize closets or drawers', note: 'Donate items you no longer need', priority: 'low' },
      { title: 'Take out trash and recycling', note: 'Check all rooms', priority: 'low' },
      { title: 'Wipe windows and mirrors', note: 'Use streak-free cleaner', priority: 'low' },
    ],
    project: [
      { title: 'Define project scope and goals', note: 'Clarify what success looks like', priority: 'high' },
      { title: 'Break project into milestones', note: 'Create a timeline with deadlines', priority: 'high' },
      { title: 'Research and gather resources', note: 'Collect tools, references, and data', priority: 'high' },
      { title: 'Create initial prototype or draft', note: 'Start with a rough version', priority: 'medium' },
      { title: 'Get feedback from peers or users', note: 'Iterate based on input', priority: 'medium' },
      { title: 'Refine and improve the work', note: 'Polish details and fix issues', priority: 'medium' },
      { title: 'Document your progress', note: 'Keep notes for future reference', priority: 'low' },
      { title: 'Test or review the final output', note: 'Ensure quality standards are met', priority: 'low' },
      { title: 'Present or deliver the project', note: 'Share with stakeholders', priority: 'low' },
    ],
    learn: [
      { title: 'Watch tutorial or read introductory content', note: 'Get an overview of the topic', priority: 'high' },
      { title: 'Take structured notes', note: 'Summarize key points', priority: 'high' },
      { title: 'Practice with hands-on exercises', note: 'Apply what you learned', priority: 'high' },
      { title: 'Review and revise notes', note: 'Reinforce memory retention', priority: 'medium' },
      { title: 'Build a mini-project using new skills', note: 'Real application solidifies learning', priority: 'medium' },
      { title: 'Join online community or forum', note: 'Ask questions and share insights', priority: 'low' },
      { title: 'Teach what you learned to someone', note: 'Best way to deepen understanding', priority: 'low' },
      { title: 'Set goals for tomorrow\'s learning', note: 'Stay consistent and motivated', priority: 'low' },
      { title: 'Explore advanced resources', note: 'Books, courses, or documentation', priority: 'medium' },
    ],
    personal: [
      { title: 'Morning routine and self-care', note: 'Meditation, journaling, or skincare', priority: 'high' },
      { title: 'Plan meals for the day', note: 'Prep ingredients in advance', priority: 'medium' },
      { title: 'Call or message a friend/family', note: 'Maintain important relationships', priority: 'medium' },
      { title: 'Read for 30 minutes', note: 'A book, article, or blog', priority: 'low' },
      { title: 'Manage finances and bills', note: 'Review spending and upcoming payments', priority: 'high' },
      { title: 'Schedule medical or personal appointments', note: 'Don\'t postpone important check-ups', priority: 'medium' },
      { title: 'Declutter your digital life', note: 'Clean inbox, organize files', priority: 'low' },
      { title: 'Gratitude journaling', note: 'Write 3 things you\'re grateful for', priority: 'low' },
      { title: 'Evening wind-down routine', note: 'Limit screens, prepare for restful sleep', priority: 'medium' },
    ],
    // Fallback / general
    general: [
      { title: 'Set today\'s top 3 priorities', note: 'Focus on what matters most', priority: 'high' },
      { title: 'Complete your most important task', note: 'Tackle it first while energy is high', priority: 'high' },
      { title: 'Organize your workspace', note: 'A clean space boosts productivity', priority: 'medium' },
      { title: 'Review progress at midday', note: 'Adjust plan if needed', priority: 'medium' },
      { title: 'Take a proper lunch break', note: 'Step away from your desk', priority: 'medium' },
      { title: 'Handle communications', note: 'Batch emails and messages', priority: 'low' },
      { title: 'Work on a secondary goal', note: 'Make incremental progress', priority: 'low' },
      { title: 'Reflect on today\'s achievements', note: 'Celebrate small wins', priority: 'low' },
      { title: 'Plan tomorrow\'s schedule', note: 'End the day with clarity', priority: 'low' },
    ],
  };

  const KEYWORD_MAP = {
    study: ['study', 'exam', 'test', 'quiz', 'homework', 'assignment', 'revision', 'math', 'science', 'history', 'literature', 'course', 'class', 'lecture', 'school', 'university', 'college', 'gre', 'sat', 'gmat'],
    work: ['work', 'office', 'meeting', 'email', 'deadline', 'project', 'report', 'client', 'presentation', 'deliverable', 'sprint', 'standup', 'boss', 'manager', 'colleague'],
    fitness: ['fitness', 'workout', 'gym', 'exercise', 'run', 'running', 'yoga', 'diet', 'health', 'muscle', 'weight', 'cardio', 'training', 'sport', 'walk', 'swim'],
    clean: ['clean', 'cleaning', 'organize', 'declutter', 'tidy', 'laundry', 'dishes', 'house', 'apartment', 'room', 'kitchen', 'bathroom'],
    project: ['project', 'build', 'create', 'develop', 'design', 'app', 'website', 'prototype', 'launch', 'startup', 'product', 'mvp', 'code', 'coding', 'program'],
    learn: ['learn', 'tutorial', 'course', 'skill', 'practice', 'beginner', 'intermediate', 'advanced', 'language', 'programming', 'piano', 'guitar', 'draw', 'paint', 'cooking'],
    personal: ['personal', 'self', 'routine', 'morning', 'evening', 'relax', 'journal', 'read', 'meditate', 'budget', 'finance', 'family', 'friend', 'hobby'],
  };

  const TIME_BUDGET_MAP = { short: 4, medium: 6, long: 9 };

  function detectCategory(goalText) {
    const words = goalText.toLowerCase().split(/\W+/);
    const scores = {};
    for (const [cat, keywords] of Object.entries(KEYWORD_MAP)) {
      scores[cat] = 0;
      for (const w of words) {
        if (keywords.includes(w)) scores[cat]++;
      }
    }
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'general';
  }

  function generatePlan(goalText, timeBudget) {
    const category = detectCategory(goalText);
    const templates = TASK_TEMPLATES[category] || TASK_TEMPLATES.general;
    const count = TIME_BUDGET_MAP[timeBudget] || 6;
    return templates.slice(0, count).map(t => ({ ...t }));
  }

  function renderAiSuggestions(suggestions) {
    dom.aiSuggestionsList.innerHTML = suggestions.map((s, i) => `
      <label class="ai-suggestion">
        <input type="checkbox" checked data-index="${i}">
        <div class="ai-suggestion-body">
          <div class="ai-suggestion-title">${escapeHTML(s.title)}</div>
          ${s.note ? `<div class="ai-suggestion-note">${escapeHTML(s.note)}</div>` : ''}
        </div>
        <span class="badge badge-${s.priority}">${s.priority}</span>
      </label>
    `).join('');
  }

  function openAiModal() {
    dom.aiModal.classList.add('open');
    dom.aiModal.setAttribute('aria-hidden', 'false');
    dom.aiStepInput.style.display = '';
    dom.aiStepResults.style.display = 'none';
    dom.aiGoal.value = '';
    dom.errorAiGoal.textContent = '';
    dom.aiGoal.focus();
  }

  function closeAiModal() {
    dom.aiModal.classList.remove('open');
    dom.aiModal.setAttribute('aria-hidden', 'true');
  }

  // ─── Event Bindings ───
  function bindEvents() {
    // Task form submit
    dom.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = dom.inputTitle.value.trim();
      if (!title) {
        dom.errorTitle.textContent = 'Please enter a task title.';
        dom.inputTitle.classList.add('input-error');
        dom.inputTitle.focus();
        return;
      }
      dom.errorTitle.textContent = '';
      dom.inputTitle.classList.remove('input-error');

      addTask(title, dom.inputPriority.value, dom.inputNote.value);
      dom.taskForm.reset();
      dom.inputPriority.value = 'medium';
      dom.inputTitle.focus();
    });

    // Clear error on input
    dom.inputTitle.addEventListener('input', () => {
      if (dom.inputTitle.value.trim()) {
        dom.errorTitle.textContent = '';
        dom.inputTitle.classList.remove('input-error');
      }
    });

    // Task list actions (delegation)
    dom.taskList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'toggle') toggleTask(id);
      if (btn.dataset.action === 'delete') {
        const task = tasks.find(t => t.id === id);
        showConfirm(
          task ? `Delete "${task.title}"?` : 'Delete this task?',
          () => deleteTask(id)
        );
      }
    });

    // Filter buttons
    dom.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filter = btn.dataset.filter;
        renderTasks();
      });
    });

    // Sort select
    dom.sortSelect.addEventListener('change', () => {
      sort = dom.sortSelect.value;
      renderTasks();
    });

    // AI Modal
    dom.btnAiPlan.addEventListener('click', openAiModal);
    dom.aiModalClose.addEventListener('click', closeAiModal);
    dom.aiModal.addEventListener('click', (e) => {
      if (e.target === dom.aiModal) closeAiModal();
    });

    let currentSuggestions = [];

    dom.btnAiGenerate.addEventListener('click', () => {
      const goal = dom.aiGoal.value.trim();
      if (!goal) {
        dom.errorAiGoal.textContent = 'Please describe your goal.';
        dom.aiGoal.focus();
        return;
      }
      dom.errorAiGoal.textContent = '';
      const timeRadio = document.querySelector('input[name="ai-time"]:checked');
      const timeBudget = timeRadio ? timeRadio.value : 'medium';

      currentSuggestions = generatePlan(goal, timeBudget);
      renderAiSuggestions(currentSuggestions);

      dom.aiStepInput.style.display = 'none';
      dom.aiStepResults.style.display = '';
    });

    dom.btnAiBack.addEventListener('click', () => {
      dom.aiStepInput.style.display = '';
      dom.aiStepResults.style.display = 'none';
    });

    dom.btnAiAddAll.addEventListener('click', () => {
      currentSuggestions.forEach(s => addTask(s.title, s.priority, s.note || ''));
      closeAiModal();
    });

    dom.btnAiAddSelected.addEventListener('click', () => {
      const checkboxes = dom.aiSuggestionsList.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => {
        if (cb.checked) {
          const s = currentSuggestions[parseInt(cb.dataset.index)];
          if (s) addTask(s.title, s.priority, s.note || '');
        }
      });
      closeAiModal();
    });

    // Confirm modal – close on overlay click
    dom.confirmModal.addEventListener('click', (e) => {
      if (e.target === dom.confirmModal) closeConfirm();
    });

    // Close modals with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.aiModal.classList.contains('open')) closeAiModal();
        if (dom.confirmModal.classList.contains('open')) closeConfirm();
      }
    });
  }

  // ─── Boot ───
  document.addEventListener('DOMContentLoaded', init);
})();
