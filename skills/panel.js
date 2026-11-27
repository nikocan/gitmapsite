function sectorSkillIds() {
  const ids = LS.get("sectorSkills", []);
  return Array.isArray(ids) ? ids.filter(id => GitmappSkills.bySkill.has(id)) : [];
}

function sectorSkillText(instructions, request) {
  const guidance = GitmappSkills.activeGuidance(sectorSkillIds(), request, 3000 - instructions.length);
  return [instructions, guidance].filter(Boolean).join("\n");
}

function SectorSkillsDialog({close, toast, onStudio, onAssistant, onManage}) {
  const {stages, sectors, sectorById, workflowById, featured, defaultPlans, findWorkflows, skills, skillsByWorkflow, bySkill,
    normalize, tokens, matchesSkill, skillPrompt, planPrompt, assistantPrompt} = GitmappSkills;
  const [enabled,setEnabled] = useState(() => [...skillsOn(), ...sectorSkillIds()]);
  const [progress,setProgress] = useState(() => LS.get("skillProgress", {}) || {});
  const [tab,setTab] = useState("plans");
  const [query,setQuery] = useState("");
  const [sector,setSector] = useState("");
  const [stage,setStage] = useState("");
  const [flowFilter,setFlowFilter] = useState("");
  const [detail,setDetail] = useState(null);
  const [limit,setLimit] = useState(12);
  const [allPlans,setAllPlans] = useState(false);
  const dialog = useRef(null);
  const scroll = useRef(null);
  const search = useRef(null);
  const detailTitle = useRef(null);
  const returnFocus = useRef(null);
  const titleId = "skills-dialog-title";

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);

  React.useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
    if (detail) detailTitle.current?.focus({preventScroll:true});
    else if (returnFocus.current) {
      (returnFocus.current.isConnected ? returnFocus.current : search.current)?.focus();
      returnFocus.current = null;
    }
  }, [detail]);

  function dismiss() {
    dialog.current.close();
    close();
  }

  function transfer(text, {toAssistant = false, kind = "app"} = {}) {
    dismiss();
    if (toAssistant) onAssistant(text);
    else onStudio(text, kind);
  }

  function openDetail(item, element) {
    returnFocus.current = element;
    setDetail(item);
  }

  function toggleSkill(id) {
    const wasEnabled = enabled.includes(id);
    const next = wasEnabled ? enabled.filter(current => current !== id) : [...enabled, id];
    const sectorSkill = bySkill.has(id);
    const key = sectorSkill ? "sectorSkills" : "skills";
    const values = sectorSkill ? sectorSkillIds() : skillsOn();
    const updated = wasEnabled ? values.filter(current => current !== id) : [...values, id];
    if (!LS.set(key, updated)) return toast("Beceri tercihi bu tarayıcıda kaydedilemedi.");
    setEnabled(next);
    if (!sectorSkill) dispatchEvent(new Event("gm:skills"));
  }

  function toggleStep(flowId, stepId, checked) {
    const current = Array.isArray(progress[flowId]) ? progress[flowId] : [];
    const next = {...progress, [flowId]: checked ? [...new Set([...current, stepId])] : current.filter(id => id !== stepId)};
    if (!LS.set("skillProgress", next)) return toast("İlerleme bu tarayıcıda kaydedilemedi.");
    setProgress(next);
  }

  const terms = useMemo(() => tokens(query), [query]);
  const counts = useMemo(() => {
    const known = new Set([...LEGACY_SKILLS.map(skill => skill.id), ...bySkill.keys()]);
    return new Set(enabled.filter(id => known.has(id))).size;
  }, [enabled]);
  const results = useMemo(() => {
    if (detail) return [];
    if (tab === "plans") {
      return !sector && !normalize(query) ? allPlans ? defaultPlans : defaultPlans.slice(0, featured.length) : findWorkflows(query, sector);
    }
    const sectorSkills = flowFilter ? skillsByWorkflow.get(flowFilter) : skills;
    const hasQuery = !!normalize(query);
    const catalog = sector === "ortak" || !sector ? LEGACY_SKILLS.filter(skill => !stage && !flowFilter &&
      (!hasQuery || (terms.length && terms.every(term => normalize(skill.label + " " + skill.n + " " + skill.d).includes(term))))) : [];
    const sectorEntries = sector === "ortak" ? [] : sectorSkills.filter(skill =>
      (!stage || stage === skill.stage) && (!sector || sector === skill.sector) &&
      (!hasQuery || (terms.length && matchesSkill(skill, terms))));
    const entries = [...catalog, ...sectorEntries];
    return tab === "enabled" ? entries.filter(skill => enabled.includes(skill.id)) : entries;
  }, [query, tab, sector, stage, flowFilter, terms, enabled, detail, allPlans]);

  const filtered = !!(normalize(query) || sector || stage || flowFilter);
  const common = tab !== "plans";
  const showingFeatured = !common && !filtered && !allPlans;
  const count = value => value.toLocaleString("tr-TR");
  const workflowsInSector = sectorById.get(sector)?.workflows;
  const stageById = id => stages.find(item => item.id === id);

  function switchTab(next) {
    setTab(next);
    if (next === "plans" && sector === "ortak") setSector("");
    setStage("");
    setFlowFilter("");
    setLimit(12);
  }

  function clearFilters() {
    setQuery("");
    setSector("");
    setStage("");
    setFlowFilter("");
    setLimit(12);
    search.current?.focus();
  }

  function planDetail(flow) {
    const currentSector = sectorById.get(flow.sector);
    const checked = Array.isArray(progress[flow.id]) ? progress[flow.id] : [];
    const done = stages.filter(step => checked.includes(step.id)).length;
    const next = stages.find(step => !checked.includes(step.id));

    return html`<div class="skills-detail">
      <div class="skills-actions"><button class="skills-button flat" onClick=${() => setDetail(null)}>← Planlara dön</button>
        <span class="skills-meta" role="status">${done} / ${stages.length} aşama tamamlandı</span></div>
      <div class="skills-detail-top">
        <span class="skills-meta skills-tag">${currentSector.name}</span>
        <h3 ref=${detailTitle} tabindex="-1">${flow.name}</h3>
        <p class="skills-muted">${flow.states}</p>
        <div class="skills-actions">
          <button class="skills-button primary" onClick=${() => transfer(planPrompt(flow, done ? next : undefined))}>
            ${!done ? "Planı Stüdyo’ya aktar" : next ? "Sıradaki aşamaya geç" : "Planı yeniden aktar"}</button>
          <button class="skills-button" onClick=${() => transfer(assistantPrompt(flow, done ? next : undefined), {toAssistant:true})}>Asistana danış</button>
          <button class="skills-button flat" onClick=${() => {
            switchTab("skills"); setSector(flow.sector); setFlowFilter(flow.id); setQuery(""); setDetail(null);
          }}>Bu akışın becerileri</button>
        </div>
      </div>
      <div class="skills-detail-bar">
        <p><b>Temel kayıtlar</b>${flow.inputs}</p>
        <p><b>Kabul koşulu</b>${flow.check}</p>
      </div>
      <div class="skills-steps-heading"><h4>Kurulum adımları</h4><p class="skills-meta">İlerleme bu tarayıcıda tutulur.</p></div>
      <ol class="skills-steps">${stages.map((step, index) => {
        const complete = checked.includes(step.id);
        return html`<li key=${step.id} class=${"skills-step" + (complete ? " is-complete" : "")}>
          <div><h4>${index + 1}. ${step.name}</h4><p class="skills-muted">${step.summary}</p></div>
          <label><input type="checkbox" checked=${complete} aria-label=${step.name + " aşamasını tamamlandı olarak işaretle"}
            onChange=${e => toggleStep(flow.id, step.id, e.target.checked)}/> Tamamlandı</label>
          <details><summary>Bu adımın becerileri ve Stüdyo aktarımı</summary>
            <ul>${step.tasks.map(task => html`<li key=${task[0]}><b>${task[1]}</b> · ${task[3]}</li>`)}</ul>
            <button class="skills-button" onClick=${() => transfer(planPrompt(flow, step))}>${step.name} adımını aktar</button>
          </details>
        </li>`;
      })}</ol>
      <div><a class="skills-link" href=${flow.source} target="_blank" rel="noopener noreferrer">${flow.sourceName} ↗</a></div>
    </div>`;
  }

  function skillDetail(skill) {
    const flow = workflowById.get(skill.workflow);
    const isOn = enabled.includes(skill.id);
    return html`<div class="skills-detail">
      <div class="skills-actions"><button class="skills-button flat" onClick=${() => setDetail(null)}>← Becerilere dön</button></div>
      <div class="skills-detail-top">
        <span class="skills-meta skills-tag">${flow ? flow.name + " · " + stageById(skill.stage).name : "Ortak beceri"}</span>
        <h3 ref=${detailTitle} tabindex="-1">${skill.label || skill.n}</h3>
        <p class="skills-muted">${flow ? skill.instruction : skill.d}</p>
      </div>
      ${flow && html`<div class="skills-detail-bar"><p><b>Temel kayıtlar</b>${flow.inputs}</p>
        <p><b>Kabul koşulu</b>${flow.check}</p><p><b>Çıktı kontrolü</b>${skill.d}</p></div>`}
      <div class="skills-actions">
        <div class="skills-actions">
          <button class="skills-button primary" onClick=${() => transfer(flow ? skillPrompt(skill) : skill.p, {kind:flow ? "app" : ""})}>Stüdyo’ya aktar</button>
          <button class="skills-button" aria-pressed=${isOn} onClick=${() => toggleSkill(skill.id)}>${isOn ? "Etkin" : "Etkinleştir"}</button>
        </div>
        ${flow && html`<a class="skills-link" href=${flow.source} target="_blank" rel="noopener noreferrer">${flow.sourceName} ↗</a>`}
      </div>
      <p class="skills-muted">${flow ? "Etkin beceriler, ilgili Stüdyo isteklerinde öneri olarak kullanılır." : "Etkinleştirildiğinde bu yönerge Stüdyo üretimlerine eklenir."}</p>
    </div>`;
  }

  function resultCard(item) {
    const flow = workflowById.get(item.workflow);
    const currentSector = sectorById.get(item.sector);
    const plan = tab === "plans";
    const enabledHere = !plan && enabled.includes(item.id);
    const name = plan ? item.name : item.label || item.n;
    return html`<article class="skills-card" key=${item.id}>
      <span class="skills-meta skills-tag">${plan ? currentSector.name : flow ? stageById(item.stage).name : "Ortak beceri"}</span>
      <h4>${name}</h4>
      <p class="skills-muted">${plan ? item.states : flow ? flow.name : item.d}</p>
      <div class="skills-actions">
        <button class="skills-button flat" aria-label=${(plan ? name + " planını aç" : name + (flow ? " · " + flow.name : "") + " ayrıntısını aç")}
          onClick=${e => openDetail({plan, item}, e.currentTarget)}>${plan ? "Planı aç" : "Ayrıntı"} <span aria-hidden="true">→</span></button>
        ${!plan && html`<button class="skills-button" aria-pressed=${enabledHere} onClick=${() => toggleSkill(item.id)}>${enabledHere ? "Etkin" : "Etkinleştir"}</button>`}
      </div>
    </article>`;
  }

  return html`<dialog class="sector-skills" ref=${dialog} aria-labelledby=${titleId}
    onCancel=${e => {e.preventDefault(); dismiss()}} onClick=${e => {if (e.target === dialog.current) dismiss()}}>
    <div class="skills-head">
      <div class="skills-title"><span class="skills-mark" aria-hidden="true"><${Icon} n="brain" s=${18}/></span><h2 id=${titleId}>Beceriler</h2></div>
      <div class="skills-actions skills-head-actions">
        <button class="skills-button flat" onClick=${() => {dialog.current.close(); onManage();}}>Becerileri yönet</button>
        <button class="skills-button icon flat" aria-label="Becerileri kapat" onClick=${dismiss}><${Icon} n="x" s=${17}/></button>
      </div>
    </div>
    <div ref=${scroll} class="skills-scroll">
      <div class="skills-content">
        ${detail ? detail.plan ? planDetail(detail.item) : skillDetail(detail.item) : html`
          <div class="skills-hero">
            <h3>Ne yapmak istiyorsun?</h3>
            <p>${sectors.length} sektörde ${count(skills.length + LEGACY_SKILLS.length)} beceriyle bir kurulum planı bul veya tek bir beceri seç.</p>
            <label class="skills-search">
              <${Icon} n="search" s=${19}/>
              <input ref=${search} type="search" aria-label="Beceri veya uygulama ara" placeholder="Ör. kuaför randevusu, stok"
                value=${query} onInput=${e => {setQuery(e.target.value); setLimit(12)}}/>
            </label>
          </div>
          <div class="skills-tabs" role="group" aria-label="Katalog görünümü">
            ${[["plans","Kurulum planları"],["skills","Tekil beceriler"],["enabled","Etkin beceriler (" + counts + ")"]].map(([id,label]) =>
              html`<button key=${id} aria-pressed=${tab === id} onClick=${() => switchTab(id)}>${label}</button>`)}
          </div>
          <div class="skills-filters">
            <select aria-label="Sektör" value=${sector} onChange=${e => {setSector(e.target.value); setFlowFilter(""); setLimit(12)}}>
              <option value="">Tüm sektörler</option>
              ${common && html`<option value="ortak">Ortak beceriler</option>`}
              ${sectors.map(entry => html`<option key=${entry.id} value=${entry.id}>${entry.name}</option>`)}
            </select>
            ${common && workflowsInSector && html`<select aria-label="İş akışı" value=${flowFilter} onChange=${e => {setFlowFilter(e.target.value); setLimit(12)}}>
              <option value="">Tüm iş akışları</option>
              ${workflowsInSector.map(entry => html`<option key=${entry.id} value=${entry.id}>${entry.name}</option>`)}
            </select>`}
            ${common && sector !== "ortak" && html`<select aria-label="Kurulum aşaması" value=${stage} onChange=${e => {setStage(e.target.value); setLimit(12)}}>
              <option value="">Tüm aşamalar</option>
              ${stages.map(entry => html`<option key=${entry.id} value=${entry.id}>${entry.name}</option>`)}
            </select>`}
            ${filtered && html`<button class="skills-button flat" onClick=${clearFilters}>Filtreleri temizle</button>`}
          </div>
          ${tab === "enabled" && html`<p class="skills-meta">Tercihler bu tarayıcıda saklanır.</p>`}
          <div class="skills-results">
            <h3>${showingFeatured ? "Öne çıkan planlar" : "Sonuçlar"}</h3>
            <span class="skills-meta" role="status">${count(results.length)} ${tab === "plans" ? "plan" : "beceri"}</span>
          </div>
          ${results.length ? html`<div class="skills-grid">${results.slice(0,limit).map(resultCard)}</div>` : html`
            <div class="skills-empty">
              <h4>${tab === "enabled" && !counts ? "Henüz etkin beceri yok" : "Eşleşme bulunamadı"}</h4>
              <p class="skills-muted">${tab === "enabled" && !counts ? "Tekil becerilerden seçim yapabilirsin." : "Daha kısa bir arama dene veya filtreleri temizle."}</p>
              ${tab === "enabled" && !counts && html`<button class="skills-button" onClick=${() => switchTab("skills")}>Tekil becerileri keşfet</button>`}
            </div>`}
          ${showingFeatured && html`<div class="skills-more"><button class="skills-button" onClick=${() => {
            setLimit(12); setAllPlans(true); requestAnimationFrame(() => search.current?.focus());
          }}>Tüm ${count(defaultPlans.length)} planı göster</button></div>`}
          ${results.length > limit && html`<div class="skills-more"><button class="skills-button" onClick=${() => setLimit(limit + 12)}>Daha fazla göster</button></div>`}
        `}
      </div>
    </div>
  </dialog>`;
}
