'use strict';
const STORE_KEY = 'neurolutionary.support-topics.preview.v2';
const state = { section: 'offer', view: 'categories', category: null, group: null, query: '', offer: [], need: [], languages: ['Українська'], scope: '' };
let catalog, allTopics, topicMap, toastTimer;
const $ = id => document.getElementById(id);
const esc = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize = text => String(text).toLocaleLowerCase('uk').replace(/[’'`]/g, '').trim();
const sectionLabel = section => section === 'offer' ? 'Можу підтримати' : 'Шукаю підтримку';
function announce(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200); }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ offer:state.offer, need:state.need, languages:state.languages, scope:state.scope })); } catch { /* The catalog remains usable when browser storage is unavailable. */ } }
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    for (const section of ['offer','need']) state[section] = [...new Set(Array.isArray(saved[section]) ? saved[section] : [])].filter(id => topicMap.has(id)).slice(0,3);
    const languages = [...document.querySelectorAll('.language-options input')].map(input => input.value);
    if (Array.isArray(saved.languages)) { const selected = [...new Set(saved.languages)].filter(value => languages.includes(value)); if (selected.length) state.languages = selected; }
    if (typeof saved.scope === 'string') state.scope = saved.scope.slice(0,1600);
  } catch { /* Ignore malformed or obsolete demo state. */ }
}
function renderSelections(target, editable = true) {
  $(target).innerHTML = ['offer','need'].map(section => `<section class="selection-box"><div class="selection-box-header"><span>${sectionLabel(section)}</span><span>${state[section].length}/3</span></div><div class="chosen-chips">${state[section].length ? state[section].map(id => editable ? `<button class="chosen-chip" data-remove="${id}" data-from="${section}" aria-label="Прибрати тему ${esc(topicMap.get(id).title)} з розділу ${sectionLabel(section)}">${esc(topicMap.get(id).title)}<span aria-hidden="true">×</span></button>` : `<span class="chosen-chip">${esc(topicMap.get(id).title)}</span>`).join('') : `<p class="chosen-placeholder">${section === 'offer' ? 'Чим можеш поділитися з іншими?' : 'У чому зараз потрібна підтримка?'}</p>`}</div>${editable ? `<button class="edit-section" data-edit="${section}">${state[section].length ? 'Змінити теми' : 'Обрати теми'} →</button>` : ''}</section>`).join('');
}
function renderSummary() {
  for (const section of ['offer','need']) $(section+'Count').textContent = `${state[section].length}/3`;
  $('mobileSummary').textContent = `Можу ${state.offer.length}/3 · Шукаю ${state.need.length}/3`;
  renderSelections('desktopSelections'); renderSelections('mobileSelections'); renderSelections('cardSelections', false);
  const complete = state.offer.length >= 1 && state.need.length >= 1;
  document.querySelectorAll('.apply-button').forEach(button => button.disabled = !complete);
  document.querySelectorAll('.apply-hint').forEach(el => el.textContent = complete ? 'Теми готові. Можна переглянути картку.' : 'Щонайменше одна тема в кожному розділі.');
  $('selectionHint').textContent = state.section === 'offer' ? 'Обери 1–3 теми, у яких готовий поділитися власним досвідом.' : 'Обери 1–3 теми, у яких тобі зараз потрібна підтримка.';
  document.querySelectorAll('[data-section]').forEach(button => { const active = button.dataset.section === state.section; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
}
function renderNav() {
  $('categoryNav').innerHTML = `<button class="nav-button ${!state.category ? 'active' : ''}" data-category="all"><span class="nav-number">◇</span><span>Усі категорії</span><span class="nav-total">${allTopics.length}</span></button>` + catalog.categories.map((category,index) => `<button class="nav-button ${state.category === category.id ? 'active' : ''}" data-category="${category.id}"><span class="nav-number">${String(index+1).padStart(2,'0')}</span><span>${esc(category.title)}</span><span class="nav-total">${category.groups.reduce((count,group) => count+group.topics.length,0)}</span></button>`).join('');
}
function topicButton(topic) {
  const selected = state[state.section].includes(topic.id), other = state[state.section === 'offer' ? 'need' : 'offer'].includes(topic.id);
  return `<button class="topic-button ${selected ? 'selected' : ''}" data-topic="${topic.id}" aria-pressed="${selected}" aria-label="${esc(topic.title)} — ${sectionLabel(state.section)}"><span class="topic-check" aria-hidden="true">✓</span><span class="topic-text"><span class="topic-title">${esc(topic.title)}</span><span class="topic-description">${esc(topic.description)}</span></span>${other ? `<span class="other-section-label">Також ${state.section === 'offer' ? 'шукаю' : 'можу підтримати'}</span>` : ''}</button>`;
}
function groupHtml(group, topics) { return topics.length ? `<section class="topic-group"><h3>${esc(group.title)} <small>· ${topics.length}</small></h3><div class="topic-list">${topics.map(topicButton).join('')}</div></section>` : ''; }
function matches(topic) {
  const words = normalize(state.query).split(/\s+/).filter(Boolean);
  const haystack = normalize([topic.title, topic.description, topic.keywords.join(' '), topic.categoryTitle, topic.groupTitle].join(' '));
  return words.every(word => haystack.includes(word));
}
function renderCatalog() {
  renderNav();
  const searching = normalize(state.query).length > 0;
  $('categoriesView').classList.toggle('active', state.view === 'categories' && !searching);
  $('categoriesView').setAttribute('aria-pressed', String(state.view === 'categories' && !searching));
  $('topicsView').classList.toggle('active', state.view === 'topics' && !searching);
  $('topicsView').setAttribute('aria-pressed', String(state.view === 'topics' && !searching));
  if (!searching && !state.category && state.view === 'categories') {
    $('resultsMeta').textContent = `${catalog.categories.length} життєвих сфер`;
    $('catalog').innerHTML = `<div class="category-grid">${catalog.categories.map((category,index) => `<button class="category-card" data-category="${category.id}" aria-label="${esc(category.title)} — відкрити 12 тем"><div class="category-card-top"><span class="category-card-number">${String(index+1).padStart(2,'0')}</span><span>3 підрозділи · 12 тем</span></div><h2>${esc(category.title)}</h2><p>${esc(category.description)}</p><div class="sample"><span>${esc(category.groups[0].topics[0].title)}<br>${esc(category.groups[1].topics[0].title)}</span><span aria-hidden="true">↗</span></div></button>`).join('')}</div>`;
    return;
  }
  // Search is deliberately global: categories never silently hide relevant results.
  const categories = searching ? catalog.categories : state.category ? catalog.categories.filter(category => category.id === state.category) : catalog.categories;
  const relevantTopics = allTopics.filter(topic => (searching ? matches(topic) : !state.category || topic.categoryId === state.category) && (searching || !state.group || topic.groupId === state.group));
  $('resultsMeta').textContent = searching ? `Знайдено тем: ${relevantTopics.length}` : `Тем: ${relevantTopics.length}`;
  if (!relevantTopics.length) { $('catalog').innerHTML = `<div class="empty-state"><h2>Не знайшли такої теми</h2><p>Спробуй коротше слово або близьку назву.<br>Пошук охоплює весь каталог.</p><button data-clear-search>Показати категорії</button></div>`; return; }
  let header = '';
  if (!searching && state.category) {
    const category = categories[0];
    header = `<div class="catalog-title"><button class="back-button" data-category="all" aria-label="Усі категорії">←</button><h2>${esc(category.title)}</h2></div><p class="catalog-description">${esc(category.description)}</p><div class="subgroup-filter" role="group" aria-label="Підрозділи категорії"><button data-group="all" class="${!state.group ? 'active' : ''}" aria-pressed="${!state.group}">Усі 12 тем</button>${category.groups.map(group => `<button data-group="${group.id}" class="${state.group === group.id ? 'active' : ''}" aria-pressed="${state.group === group.id}">${esc(group.title)}</button>`).join('')}</div>`;
  }
  $('catalog').innerHTML = header + categories.map(category => {
    const content = category.groups.filter(group => searching || !state.group || group.id === state.group).map(group => groupHtml(group, group.topics.map(topic => topicMap.get(topic.id)).filter(topic => !searching || matches(topic)))).join('');
    return content ? `<section class="all-category">${searching || !state.category ? `<h2>${esc(category.title)}</h2>` : ''}${content}</section>` : '';
  }).join('');
}
function selectTopic(id) {
  if (!topicMap.has(id)) return;
  const selected = state[state.section], index = selected.indexOf(id);
  if (index >= 0) selected.splice(index,1);
  else if (selected.length < 3) selected.push(id);
  else { announce(`У розділі «${sectionLabel(state.section)}» можна обрати до 3 тем. Прибери одну, щоб додати іншу.`); return; }
  save(); renderSummary(); renderCatalog();
  document.querySelector(`[data-topic="${id}"]`)?.focus({preventScroll:true});
}
function setSection(section, scroll = false) {
  state.section = section; renderSummary(); renderCatalog();
  if (scroll) { $('selectionDialog').close(); document.querySelector('.finder').scrollIntoView({behavior:'smooth',block:'start'}); }
}
function setCategory(id) {
  state.category = id === 'all' ? null : id; state.group = null; state.query = ''; $('search').value = ''; state.view = 'categories'; renderCatalog();
  if (window.innerWidth <= 760) document.querySelector('.viewbar').scrollIntoView({behavior:'smooth',block:'start'});
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || !catalog) return;
  if (button.dataset.topic) selectTopic(button.dataset.topic);
  if (button.dataset.category) setCategory(button.dataset.category);
  if (button.dataset.group) { state.group = button.dataset.group === 'all' ? null : button.dataset.group; renderCatalog(); }
  if (button.dataset.section) setSection(button.dataset.section);
  if (button.dataset.edit) setSection(button.dataset.edit,true);
  if (button.dataset.remove) { state[button.dataset.from] = state[button.dataset.from].filter(id => id !== button.dataset.remove); save(); renderSummary(); renderCatalog(); }
  if (button.hasAttribute('data-clear-search')) { state.query = ''; state.category = null; state.group = null; state.view = 'categories'; $('search').value = ''; renderCatalog(); $('search').focus(); }
  if (button.classList.contains('apply-button')) {
    if (!state.offer.length || !state.need.length) return;
    $('selectionDialog').close(); renderSelections('cardSelections',false);
    document.querySelectorAll('.language-options input').forEach(input => input.checked = state.languages.includes(input.value)); $('demoScope').value = state.scope;
    $('cardDialog').showModal();
  }
  if (button.classList.contains('close-dialog')) button.closest('dialog').close();
});
$('search').addEventListener('input', event => { state.query = event.target.value; renderCatalog(); });
$('categoriesView').addEventListener('click', () => { state.view = 'categories'; state.category = null; state.group = null; state.query = ''; $('search').value = ''; renderCatalog(); });
$('topicsView').addEventListener('click', () => { state.view = 'topics'; state.category = null; state.group = null; state.query = ''; $('search').value = ''; renderCatalog(); });
$('openSelections').addEventListener('click', () => { if (catalog) $('selectionDialog').showModal(); });
$('helpButton').addEventListener('click', () => $('helpDialog').showModal());
$('resetButton').addEventListener('click', () => { state.offer = []; state.need = []; save(); renderSummary(); renderCatalog(); announce('Вибір тем очищено.'); });
$('demoScope').addEventListener('input', event => { state.scope = event.target.value; save(); });
document.querySelectorAll('.language-options input').forEach(input => input.addEventListener('change', () => {
  const selected = [...document.querySelectorAll('.language-options input:checked')].map(item => item.value);
  if (!selected.length) { input.checked = true; announce('Обери щонайменше одну мову спілкування.'); return; }
  state.languages = selected; save();
}));
document.addEventListener('keydown', event => { if (event.key === '/' && !event.ctrlKey && !event.metaKey && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); $('search').focus(); } });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } }));
async function init() {
  try {
    const response = await fetch('catalog.json'); if (!response.ok) throw new Error('Catalog unavailable');
    catalog = await response.json();
    allTopics = catalog.categories.flatMap(category => category.groups.flatMap(group => group.topics.map(topic => ({...topic, categoryId:category.id, categoryTitle:category.title, groupId:group.id, groupTitle:group.title}))));
    topicMap = new Map(allTopics.map(topic => [topic.id,topic]));
    restore(); $('topicTotal').textContent = String(allTopics.length); renderSummary(); renderCatalog();
  } catch {
    $('catalog').innerHTML = '<div class="empty-state"><h2>Каталог не завантажився</h2><p>Онови сторінку, щоб спробувати ще раз.</p></div>';
    $('search').disabled = true; $('categoriesView').disabled = true; $('topicsView').disabled = true; $('resetButton').disabled = true;
  }
}
init();
