'use strict';
const STORE_KEY='neurolutionary.support-topics.preview.v3', OLD_STORE_KEY='neurolutionary.support-topics.preview.v2';
const state={section:'offer',view:'categories',category:null,group:null,query:'',offer:[],need:[],legacy:{offer:[],need:[]},languages:['Українська'],about:'',conditions:{format:'Онлайн',duration:'30 хвилин',frequency:'Одноразово',time:'За домовленістю'},openTopics:new Set()};
let catalog,allTopics,topicMap,optionMap,toastTimer;
const $=id=>document.getElementById(id);
const esc=text=>String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=text=>String(text).toLocaleLowerCase('uk').replace(/[’'`]/g,'').trim();
const sectionLabel=section=>section==='offer'?'Можу підтримати':'Шукаю підтримку';
function announce(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify({offer:state.offer,need:state.need,legacy:state.legacy,languages:state.languages,about:state.about,conditions:state.conditions}));}catch{/* Browsing works without storage. */}}
function restore(){try{
  const raw=localStorage.getItem(STORE_KEY),old=JSON.parse(localStorage.getItem(OLD_STORE_KEY)||'{}'),saved=JSON.parse(raw||'{}');
  for(const section of ['offer','need']){
    state[section]=[...new Set(Array.isArray(saved[section])?saved[section]:[])].filter(id=>optionMap.has(id)).slice(0,3);
    const pending=raw?saved.legacy?.[section]:old[section];state.legacy[section]=[...new Set(Array.isArray(pending)?pending:[])].filter(id=>topicMap.has(id)&&!state[section].some(optionId=>optionMap.get(optionId).topicId===id)).slice(0,3);
  }
  const data=raw?saved:old,allowed=[...document.querySelectorAll('.language-options input')].map(input=>input.value);
  if(Array.isArray(data.languages)){const values=[...new Set(data.languages)].filter(value=>allowed.includes(value));if(values.length)state.languages=values;}
  if(typeof saved.about==='string')state.about=[...saved.about].slice(0,500).join('');
  for(const select of document.querySelectorAll('[data-condition]')){const value=saved.conditions?.[select.dataset.condition];if([...select.options].some(option=>option.value===value))state.conditions[select.dataset.condition]=value;}
}catch{/* Ignore malformed local demo data; never publish it. */}}
function renderSelections(target,editable=true){
  $(target).innerHTML=['offer','need'].map(section=>`<section class="selection-box"><div class="selection-box-header"><span>${sectionLabel(section)}</span><span>${state[section].length}/3</span></div><div class="chosen-chips">${state[section].length?state[section].map(id=>{const option=optionMap.get(id),content=`<span class="chosen-service-text">${esc(option.title)}<small>${esc(option.topicTitle)}</small></span>`;return editable?`<button class="chosen-chip service-chip" data-remove="${id}" data-from="${section}" aria-label="Прибрати ${esc(option.title)} з розділу ${sectionLabel(section)}">${content}<span aria-hidden="true">×</span></button>`:`<div class="chosen-chip service-chip">${content}</div>`;}).join(''):`<p class="chosen-placeholder">${section==='offer'?'Що саме можеш зробити для іншої людини?':'Яка саме допомога тобі потрібна?'}</p>`}</div>${editable?state.legacy[section].map(id=>`<div class="legacy-choice"><button data-resolve-legacy="${id}" data-from="${section}"><b>${esc(topicMap.get(id).title)}</b><span>Попередня тема · уточнити допомогу →</span></button><button data-remove-legacy="${id}" data-from="${section}" aria-label="Прибрати попередню тему ${esc(topicMap.get(id).title)}">×</button></div>`).join(''):''}${editable?`<button class="edit-section" data-edit="${section}">${state[section].length?'Змінити допомогу':'Обрати допомогу'} →</button>`:''}</section>`).join('');
}
function renderSummary(){
  for(const section of ['offer','need'])$(section+'Count').textContent=`${state[section].length}/3`;
  $('mobileSummary').textContent=`Можу ${state.offer.length}/3 · Шукаю ${state.need.length}/3`;
  renderSelections('desktopSelections');renderSelections('mobileSelections');renderSelections('cardSelections',false);
  const complete=state.offer.length>0&&state.need.length>0;document.querySelectorAll('.apply-button').forEach(button=>button.disabled=false);
  document.querySelectorAll('.apply-hint').forEach(el=>el.textContent=complete?'Допомогу обрано. Можна переглянути картку.':'Можна переглянути чернетку. Для публікації — по 1–3 варіанти в обох розділах.');
  $('selectionHint').textContent=state.section==='offer'?'Відкрий тему й обери 1–3 конкретні варіанти допомоги на весь розділ.':'Відкрий тему й обери 1–3 конкретні потреби на весь розділ.';
  document.querySelectorAll('[data-section]').forEach(button=>{const active=button.dataset.section===state.section;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
function renderNav(){
  $('categoryNav').innerHTML=`<button class="nav-button ${!state.category?'active':''}" data-category="all"><span class="nav-number">◇</span><span>Усі категорії</span><span class="nav-total">${allTopics.length}</span></button>`+catalog.categories.map((category,index)=>`<button class="nav-button ${state.category===category.id?'active':''}" data-category="${category.id}"><span class="nav-number">${String(index+1).padStart(2,'0')}</span><span>${esc(category.title)}</span><span class="nav-total">${category.groups.reduce((n,group)=>n+group.topics.length,0)}</span></button>`).join('');
}
function topicHtml(topic){
  const count=topic.supportOptions.filter(option=>state[state.section].includes(option.id)).length,open=state.openTopics.has(topic.id)||normalize(state.query).length>0;
  return `<details class="topic-card ${count?'has-selection':''}" data-topic="${topic.id}" ${open?'open':''}><summary><span class="topic-text"><span class="topic-title">${esc(topic.title)}</span><span class="topic-description">${esc(topic.description)}</span><span class="support-count">${topic.supportOptions.length} варіанти допомоги${count?` · обрано ${count}`:''}</span></span><span class="disclosure-arrow" aria-hidden="true">⌄</span></summary><div class="support-options" role="group" aria-label="${esc(topic.title)} — ${sectionLabel(state.section)}"><p class="options-label">${state.section==='offer'?'Що можу зробити':'Якої допомоги потребую'}</p>${topic.supportOptions.map(option=>{const selected=state[state.section].includes(option.id),other=state[state.section==='offer'?'need':'offer'].includes(option.id);return `<button class="support-option ${selected?'selected':''}" data-option="${option.id}" aria-pressed="${selected}"><span class="option-check" aria-hidden="true">✓</span><span>${esc(option.title)}${other?`<small>Також у розділі «${sectionLabel(state.section==='offer'?'need':'offer')}»</small>`:''}</span></button>`;}).join('')}</div></details>`;
}
function groupHtml(group,topics){return topics.length?`<section class="topic-group"><h3>${esc(group.title)} <small>· ${topics.length}</small></h3><div class="topic-list">${topics.map(topicHtml).join('')}</div></section>`:'';}
function matches(topic){
  const words=normalize(state.query).split(/\s+/).filter(Boolean),haystack=normalize([topic.title,topic.description,topic.keywords.join(' '),topic.categoryTitle,topic.groupTitle,...topic.supportOptions.map(option=>option.title)].join(' '));
  return words.every(word=>{const stem=word.length>=5?word.replace(/[аеиіоуяю]$/,''):word;return haystack.includes(word)||(stem!==word&&haystack.includes(stem));});
}
function visibleTopics(){const searching=normalize(state.query).length>0;return allTopics.filter(topic=>(searching?matches(topic):!state.category||topic.categoryId===state.category)&&(searching||!state.group||topic.groupId===state.group));}
function renderCatalog(){
  renderNav();const searching=normalize(state.query).length>0;
  for(const[id,view]of[['categoriesView','categories'],['topicsView','topics']]){const active=state.view===view&&!searching;$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}
  if(!searching&&!state.category&&state.view==='categories'){
    $('resultsMeta').textContent=`${catalog.categories.length} життєвих сфер`;$('expandOptions').hidden=true;
    $('catalog').innerHTML=`<div class="category-grid">${catalog.categories.map((category,index)=>{const topics=category.groups.flatMap(group=>group.topics),options=topics.reduce((sum,topic)=>sum+topic.supportOptions.length,0);return `<button class="category-card" data-category="${category.id}" aria-label="${esc(category.title)} — ${topics.length} тем, ${options} варіантів допомоги"><div class="category-card-top"><span class="category-card-number">${String(index+1).padStart(2,'0')}</span><span>${category.groups.length} підрозділи · ${topics.length} тем</span></div><h2>${esc(category.title)}</h2><p>${esc(category.description)}</p><div class="sample"><span>${options} варіантів допомоги<br>${esc(topics[0].supportOptions[0].title)}</span><span aria-hidden="true">↗</span></div></button>`;}).join('')}</div>`;return;
  }
  $('expandOptions').hidden=false;
  const categories=searching?catalog.categories:state.category?catalog.categories.filter(category=>category.id===state.category):catalog.categories,relevant=visibleTopics(),options=relevant.reduce((sum,topic)=>sum+topic.supportOptions.length,0);
  $('resultsMeta').textContent=`${relevant.length} тем · ${options} варіантів`;
  const expanded=relevant.length>0&&relevant.every(topic=>state.openTopics.has(topic.id));$('expandOptions').textContent=expanded?'Згорнути допомогу':'Розгорнути допомогу';$('expandOptions').disabled=searching||!relevant.length;
  if(!relevant.length){$('catalog').innerHTML='<div class="empty-state"><h2>Не знайшли такої допомоги</h2><p>Спробуй коротше слово або близьку назву.<br>Пошук охоплює теми й усі варіанти допомоги.</p><button data-clear-search>Показати категорії</button></div>';return;}
  let header='';if(!searching&&state.category){const category=categories[0];header=`<div class="catalog-title"><button class="back-button" data-category="all" aria-label="Усі категорії">←</button><h2>${esc(category.title)}</h2></div><p class="catalog-description">${esc(category.description)}</p><div class="subgroup-filter" role="group" aria-label="Підрозділи категорії"><button data-group="all" class="${!state.group?'active':''}" aria-pressed="${!state.group}">Усі теми</button>${category.groups.map(group=>`<button data-group="${group.id}" class="${state.group===group.id?'active':''}" aria-pressed="${state.group===group.id}">${esc(group.title)}</button>`).join('')}</div>`;}
  $('catalog').innerHTML=header+categories.map(category=>{const content=category.groups.filter(group=>searching||!state.group||group.id===state.group).map(group=>groupHtml(group,group.topics.map(topic=>topicMap.get(topic.id)).filter(topic=>!searching||matches(topic)))).join('');return content?`<section class="all-category">${searching||!state.category?`<h2>${esc(category.title)}</h2>`:''}${content}</section>`:'';}).join('');
}
function selectOption(id){
  if(!optionMap.has(id))return;const selected=state[state.section],index=selected.indexOf(id),option=optionMap.get(id);
  if(index>=0)selected.splice(index,1);else if(selected.length<3)selected.push(id);else{announce(`У розділі «${sectionLabel(state.section)}» можна обрати до 3 варіантів допомоги. Прибери один, щоб додати інший.`);return;}
  state.legacy[state.section]=state.legacy[state.section].filter(topicId=>topicId!==option.topicId);state.openTopics.add(option.topicId);save();renderSummary();renderCatalog();document.querySelector(`[data-option="${id}"]`)?.focus({preventScroll:true});
}
function setSection(section,scroll=false){if(!['offer','need'].includes(section))return;state.section=section;renderSummary();renderCatalog();if(scroll){$('selectionDialog').close();document.querySelector('.finder').scrollIntoView({behavior:'smooth',block:'start'});}}
function setCategory(id){state.category=id==='all'?null:id;state.group=null;state.query='';$('search').value='';state.view='categories';renderCatalog();if(window.innerWidth<=760)document.querySelector('.viewbar').scrollIntoView({behavior:'smooth',block:'start'});}
document.addEventListener('toggle',event=>{const details=event.target;if(details.isConnected&&details.matches?.('.topic-card')){if(details.open)state.openTopics.add(details.dataset.topic);else state.openTopics.delete(details.dataset.topic);}},true);
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||!catalog)return;
  if(button.dataset.option)selectOption(button.dataset.option);if(button.dataset.category)setCategory(button.dataset.category);
  if(button.dataset.group){state.group=button.dataset.group==='all'?null:button.dataset.group;renderCatalog();}
  if(button.dataset.section)setSection(button.dataset.section);if(button.dataset.edit)setSection(button.dataset.edit,true);
  if(button.dataset.remove){state[button.dataset.from]=state[button.dataset.from].filter(id=>id!==button.dataset.remove);save();renderSummary();renderCatalog();}
  if(button.dataset.removeLegacy){state.legacy[button.dataset.from]=state.legacy[button.dataset.from].filter(id=>id!==button.dataset.removeLegacy);save();renderSummary();}
  if(button.dataset.resolveLegacy){const topic=topicMap.get(button.dataset.resolveLegacy);state.section=button.dataset.from;state.openTopics.add(topic.id);$('selectionDialog').close();setCategory(topic.categoryId);renderSummary();document.querySelector(`[data-topic="${topic.id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});}
  if(button.hasAttribute('data-clear-search')){state.query='';state.category=null;state.group=null;state.view='categories';$('search').value='';renderCatalog();$('search').focus();}
  if(button.classList.contains('apply-button')){$('selectionDialog').close();renderSelections('cardSelections',false);document.querySelectorAll('.language-options input').forEach(input=>input.checked=state.languages.includes(input.value));$('demoAbout').value=state.about;document.querySelectorAll('[data-condition]').forEach(select=>select.value=state.conditions[select.dataset.condition]);$('cardDialog').showModal();}
  if(button.classList.contains('close-dialog'))button.closest('dialog').close();
});
$('search').addEventListener('input',event=>{state.query=event.target.value;renderCatalog();});
for(const[id,view]of[['categoriesView','categories'],['topicsView','topics']])$(id).addEventListener('click',()=>{state.view=view;state.category=null;state.group=null;state.query='';$('search').value='';renderCatalog();});
$('expandOptions').addEventListener('click',()=>{const topics=visibleTopics(),allOpen=topics.every(topic=>state.openTopics.has(topic.id));for(const topic of topics){if(allOpen)state.openTopics.delete(topic.id);else state.openTopics.add(topic.id);}renderCatalog();});
$('openSelections').addEventListener('click',()=>{if(catalog)$('selectionDialog').showModal();});$('helpButton').addEventListener('click',()=>$('helpDialog').showModal());
$('resetButton').addEventListener('click',()=>{state.offer=[];state.need=[];state.legacy={offer:[],need:[]};save();renderSummary();renderCatalog();announce('Вибір допомоги очищено.');});
$('demoAbout').addEventListener('input',event=>{state.about=[...event.target.value].slice(0,500).join('');event.target.value=state.about;save();});
document.querySelectorAll('[data-condition]').forEach(select=>select.addEventListener('change',()=>{state.conditions[select.dataset.condition]=select.value;save();}));
document.querySelectorAll('.language-options input').forEach(input=>input.addEventListener('change',()=>{const selected=[...document.querySelectorAll('.language-options input:checked')].map(item=>item.value);if(!selected.length){input.checked=true;announce('Обери щонайменше одну мову спілкування.');return;}state.languages=selected;save();}));
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();$('search').focus();}});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}}));
async function init(){try{
  const response=await fetch('catalog.json');if(!response.ok)throw new Error('Catalog unavailable');catalog=await response.json();
  allTopics=catalog.categories.flatMap(category=>category.groups.flatMap(group=>group.topics.map(topic=>({...topic,categoryId:category.id,categoryTitle:category.title,groupId:group.id,groupTitle:group.title}))));topicMap=new Map(allTopics.map(topic=>[topic.id,topic]));optionMap=new Map();
  for(const topic of allTopics){if(!Array.isArray(topic.supportOptions)||!topic.supportOptions.length)throw new Error('Missing support options');for(const option of topic.supportOptions){if(optionMap.has(option.id)||!option.title)throw new Error('Invalid support option');optionMap.set(option.id,{...option,topicId:topic.id,topicTitle:topic.title});}}
  restore();$('topicTotal').textContent=String(allTopics.length);$('supportTotal').textContent=String(optionMap.size);renderSummary();renderCatalog();
}catch{$('catalog').innerHTML='<div class="empty-state"><h2>Каталог не завантажився</h2><p>Онови сторінку, щоб спробувати ще раз.</p></div>';for(const id of ['search','categoriesView','topicsView','resetButton','expandOptions'])$(id).disabled=true;}}
init();
