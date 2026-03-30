// ── STORAGE ──
const DB = {
  alunos:    () => JSON.parse(localStorage.getItem("smell_alunos")    || "[]"),
  registros: () => JSON.parse(localStorage.getItem("smell_registros") || "[]"),
  salvarAlunos:    a => localStorage.setItem("smell_alunos",    JSON.stringify(a)),
  salvarRegistros: r => localStorage.setItem("smell_registros", JSON.stringify(r))
};

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  // Data no header
  document.getElementById("header-data").textContent =
    new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });

  // Data padrão no cadastro
  document.getElementById("al-inicio").value = new Date().toISOString().split("T")[0];

  // Filtro mês padrão
  document.getElementById("filtro-mes").value = new Date().toISOString().slice(0,7);

  // Mostrar/ocultar obs ao mudar tipo
  document.querySelectorAll("input[name='ci-tipo']").forEach(r => {
    r.addEventListener("change", () => {
      const v = document.querySelector("input[name='ci-tipo']:checked").value;
      document.getElementById("campo-obs").style.display = (v !== "presente") ? "block" : "none";
    });
  });

  renderSelectAlunos();
  renderAlertasExclusao();
  renderListaHoje();
  renderAlunos();
  renderHistorico();
  popularFiltroAluno();
});

// ── ABAS ──
function trocarAba(aba) {
  document.querySelectorAll(".aba").forEach(b => b.classList.toggle("ativa", b.dataset.aba === aba));
  document.querySelectorAll(".painel").forEach(p => p.classList.toggle("ativa", p.id === `painel-${aba}`));
  if (aba === "historico") { renderHistorico(); popularFiltroAluno(); }
  if (aba === "alunos")    renderAlunos();
  if (aba === "checkin")   { renderListaHoje(); renderAlertasExclusao(); }
}

// ── CADASTRAR ALUNO ──
function cadastrarAluno() {
  const nome   = document.getElementById("al-nome").value.trim();
  const tel    = document.getElementById("al-tel").value.trim();
  const plano  = document.getElementById("al-plano").value;
  const inicio = document.getElementById("al-inicio").value;

  if (!nome) { alert("Informe o nome do aluno."); return; }

  const alunos = DB.alunos();
  if (alunos.find(a => a.nome.toLowerCase() === nome.toLowerCase())) {
    alert("Já existe um aluno com esse nome."); return;
  }

  alunos.push({ id: Date.now().toString(), nome, tel, plano, inicio });
  DB.salvarAlunos(alunos);

  document.getElementById("al-nome").value = "";
  document.getElementById("al-tel").value  = "";

  renderAlunos();
  renderSelectAlunos();
  popularFiltroAluno();
  toast("Aluno cadastrado com sucesso!");
}

// ── EXCLUIR ALUNO ──
function confirmarExclusao(id) {
  const aluno = DB.alunos().find(a => a.id === id);
  if (!aluno) return;
  document.getElementById("modal-texto").textContent =
    `Deseja excluir o aluno "${aluno.nome}"? Todos os registros de check-in também serão removidos.`;
  document.getElementById("modal-confirmar").onclick = () => excluirAluno(id);
  document.getElementById("modal-overlay").classList.add("aberto");
}

function excluirAluno(id) {
  DB.salvarAlunos(DB.alunos().filter(a => a.id !== id));
  DB.salvarRegistros(DB.registros().filter(r => r.alunoId !== id));
  fecharModal();
  renderAlunos();
  renderSelectAlunos();
  renderListaHoje();
  renderAlertasExclusao();
  renderHistorico();
  popularFiltroAluno();
  toast("Aluno excluído.");
}

function fecharModal() {
  document.getElementById("modal-overlay").classList.remove("aberto");
}

// ── CHECK-IN ──
function registrarCheckin() {
  const alunoId = document.getElementById("ci-aluno").value;
  const tipo    = document.querySelector("input[name='ci-tipo']:checked").value;
  const obs     = document.getElementById("ci-obs").value.trim();

  if (!alunoId) { alert("Selecione um aluno."); return; }

  const aluno = DB.alunos().find(a => a.id === alunoId);
  const agora = new Date();
  const hoje  = agora.toISOString().split("T")[0];

  const registros = DB.registros();

  // Verificar duplicata no dia
  const jaRegistrado = registros.find(r => r.alunoId === alunoId && r.data === hoje);
  if (jaRegistrado) {
    alert(`${aluno.nome} já tem registro hoje (${tipoLabel(jaRegistrado.tipo)}).`);
    return;
  }

  registros.push({
    id:       Date.now().toString(),
    alunoId,
    nomeAluno: aluno.nome,
    tipo,
    obs,
    data:  hoje,
    hora:  agora.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })
  });

  DB.salvarRegistros(registros);

  // Reset
  document.getElementById("ci-aluno").value = "";
  document.getElementById("ci-busca").value  = "";
  document.getElementById("ci-busca").classList.remove("selecionado");
  document.getElementById("ci-obs").value   = "";
  document.querySelector("input[name='ci-tipo'][value='presente']").checked = true;
  document.getElementById("campo-obs").style.display = "none";

  renderListaHoje();
  renderAlertasExclusao();
  toast(`Check-in registrado: ${aluno.nome} — ${tipoLabel(tipo)}`);
}

// ── ALERTAS DE EXCLUSÃO ──
function renderAlertasExclusao() {
  const wrap = document.getElementById("alertas-exclusao");
  wrap.innerHTML = "";
  const alunos = DB.alunos();
  const registros = DB.registros();

  alunos.forEach(aluno => {
    const faltas = registros.filter(r => r.alunoId === aluno.id && r.tipo === "falta").length;
    if (faltas >= 3) {
      wrap.innerHTML += `
        <div class="alerta-exclusao">
          <div class="ae-icone">🚨</div>
          <div class="ae-info">
            <div class="ae-titulo">${aluno.nome} — Risco de Exclusão</div>
            <div class="ae-desc">${faltas} falta${faltas > 1 ? "s" : ""} sem justificativa registrada${faltas > 1 ? "s" : ""}. Considere contato ou exclusão do aluno.</div>
          </div>
        </div>`;
    }
  });
}

// ── LISTA HOJE ──
function renderListaHoje() {
  const hoje = new Date().toISOString().split("T")[0];
  const registros = DB.registros().filter(r => r.data === hoje)
    .sort((a,b) => b.hora.localeCompare(a.hora));
  const el = document.getElementById("lista-hoje");

  if (!registros.length) {
    el.innerHTML = `<div class="vazio">Nenhum registro hoje ainda.</div>`;
    return;
  }

  el.innerHTML = registros.map(r => `
    <div class="registro-item">
      <div class="reg-tipo reg-${r.tipo}">${tipoIcone(r.tipo)}</div>
      <div class="reg-info">
        <div class="reg-nome">${r.nomeAluno}</div>
        ${r.obs ? `<div class="reg-obs">${r.obs}</div>` : ""}
      </div>
      <div class="reg-hora">${r.hora}</div>
    </div>
  `).join("");
}

// ── LISTA ALUNOS ──
function renderAlunos() {
  const busca = (document.getElementById("busca-aluno")?.value || "").toLowerCase();
  const alunos = DB.alunos().filter(a => a.nome.toLowerCase().includes(busca));
  const registros = DB.registros();
  const el = document.getElementById("lista-alunos");

  if (!alunos.length) {
    el.innerHTML = `<div class="vazio">${busca ? "Nenhum aluno encontrado." : "Nenhum aluno cadastrado."}</div>`;
    return;
  }

  el.innerHTML = alunos.map(a => {
    const regs = registros.filter(r => r.alunoId === a.id);
    const presentes   = regs.filter(r => r.tipo === "presente").length;
    const faltas      = regs.filter(r => r.tipo === "falta").length;
    const justificadas= regs.filter(r => r.tipo === "justificada").length;
    const iniciais    = a.nome.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
    const alerta      = faltas >= 3 ? ' style="border-color:rgba(239,68,68,.4)"' : "";

    return `
      <div class="aluno-item"${alerta}>
        <div class="aluno-avatar">${iniciais}</div>
        <div class="aluno-info">
          <div class="aluno-nome">${a.nome} ${faltas >= 3 ? "🚨" : ""}</div>
          <div class="aluno-meta">${planoLabel(a.plano)} • desde ${formatarData(a.inicio)} ${a.tel ? "• " + a.tel : ""}</div>
          <div class="aluno-stats">
            <span class="stat-badge stat-presente">✓ ${presentes} presença${presentes !== 1 ? "s" : ""}</span>
            <span class="stat-badge stat-falta">✗ ${faltas} falta${faltas !== 1 ? "s" : ""}</span>
            ${justificadas ? `<span class="stat-badge stat-justificada">📋 ${justificadas} justif.</span>` : ""}
          </div>
        </div>
        <div class="aluno-acoes">
          <button class="btn-sm btn-sm-info" onclick="verPerfil('${a.id}')">Ver</button>
          <button class="btn-sm btn-sm-danger" onclick="confirmarExclusao('${a.id}')">Excluir</button>
        </div>
      </div>`;
  }).join("");
}

// ── HISTÓRICO ──
function renderHistorico() {
  const filtroAluno = document.getElementById("filtro-aluno")?.value || "";
  const filtroTipo  = document.getElementById("filtro-tipo")?.value  || "";
  const filtroMes   = document.getElementById("filtro-mes")?.value   || "";

  let registros = DB.registros();
  if (filtroAluno) registros = registros.filter(r => r.alunoId === filtroAluno);
  if (filtroTipo)  registros = registros.filter(r => r.tipo === filtroTipo);
  if (filtroMes)   registros = registros.filter(r => r.data.startsWith(filtroMes));

  registros = registros.sort((a,b) => b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora));

  const el = document.getElementById("lista-historico");
  if (!registros.length) {
    el.innerHTML = `<div class="vazio">Nenhum registro encontrado.</div>`;
    return;
  }

  el.innerHTML = registros.map(r => `
    <div class="hist-item">
      <div class="reg-tipo reg-${r.tipo}" style="width:24px;height:24px;font-size:.7rem;flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center">${tipoIcone(r.tipo)}</div>
      <div class="hist-data">${formatarData(r.data)}</div>
      <div class="hist-info" style="flex:1">
        <div class="hist-nome">${r.nomeAluno}</div>
        ${r.obs ? `<div class="hist-obs">${r.obs}</div>` : ""}
      </div>
      <div class="reg-hora">${r.hora}</div>
    </div>
  `).join("");
}

function popularFiltroAluno() {
  const sel = document.getElementById("filtro-aluno");
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = `<option value="">Todos os alunos</option>` +
    DB.alunos().map(a => `<option value="${a.id}" ${a.id === atual ? "selected" : ""}>${a.nome}</option>`).join("");
}

// ── SELECT ALUNOS (CHECK-IN) ──
function renderSelectAlunos() {
  // mantido vazio — substituído pelo autocomplete
}

// ── AUTOCOMPLETE ──
let acFoco = -1;

function filtrarAlunos() {
  const busca = document.getElementById("ci-busca").value.toLowerCase().trim();
  const lista = document.getElementById("autocomplete-lista");
  const alunos = DB.alunos().filter(a => a.nome.toLowerCase().includes(busca));

  // Limpar seleção se o texto mudou
  document.getElementById("ci-aluno").value = "";
  document.getElementById("ci-busca").classList.remove("selecionado");
  acFoco = -1;

  if (!alunos.length) {
    lista.innerHTML = `<div class="ac-vazio">Nenhum aluno encontrado</div>`;
    lista.classList.add("aberta");
    return;
  }

  lista.innerHTML = alunos.map(a => {
    const iniciais = a.nome.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
    return `
      <div class="ac-item" data-id="${a.id}" data-nome="${a.nome}" onclick="selecionarAluno('${a.id}','${a.nome.replace(/'/g,"\\'")}')">
        <div class="ac-avatar">${iniciais}</div>
        <div>
          <div class="ac-nome">${destacar(a.nome, busca)}</div>
          <div class="ac-plano">${planoLabel(a.plano)}</div>
        </div>
      </div>`;
  }).join("");

  lista.classList.add("aberta");
}

function selecionarAluno(id, nome) {
  document.getElementById("ci-aluno").value = id;
  document.getElementById("ci-busca").value = nome;
  document.getElementById("ci-busca").classList.add("selecionado");
  document.getElementById("autocomplete-lista").classList.remove("aberta");
  acFoco = -1;
}

function destacar(nome, busca) {
  if (!busca) return nome;
  const re = new RegExp(`(${busca.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`, "gi");
  return nome.replace(re, `<mark style="background:rgba(99,102,241,.3);color:#a5b4fc;border-radius:2px">$1</mark>`);
}

// Fechar ao clicar fora
document.addEventListener("click", e => {
  if (!e.target.closest(".autocomplete-wrap")) {
    document.getElementById("autocomplete-lista").classList.remove("aberta");
  }
});

// Navegação por teclado
document.addEventListener("keydown", e => {
  const lista = document.getElementById("autocomplete-lista");
  const itens = lista.querySelectorAll(".ac-item");
  if (!lista.classList.contains("aberta") || !itens.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    acFoco = Math.min(acFoco + 1, itens.length - 1);
    itens.forEach((it, i) => it.classList.toggle("focado", i === acFoco));
    itens[acFoco]?.scrollIntoView({ block:"nearest" });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    acFoco = Math.max(acFoco - 1, 0);
    itens.forEach((it, i) => it.classList.toggle("focado", i === acFoco));
    itens[acFoco]?.scrollIntoView({ block:"nearest" });
  } else if (e.key === "Enter" && acFoco >= 0) {
    e.preventDefault();
    itens[acFoco]?.click();
  } else if (e.key === "Escape") {
    lista.classList.remove("aberta");
  }
});

// ── HELPERS ──
function tipoLabel(t) { return { presente:"Presente", falta:"Falta", justificada:"Justificada" }[t] || t; }
function tipoIcone(t) { return { presente:"✓", falta:"✗", justificada:"📋" }[t] || "?"; }
function planoLabel(p){ return { "2x":"2x/semana", "3x":"3x/semana", "5x":"5x/semana", "online":"Online" }[p] || p; }
function formatarData(d) {
  if (!d) return "—";
  const [y,m,dia] = d.split("-");
  return `${dia}/${m}/${y}`;
}

// ── TOAST ──
function toast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position:"fixed", bottom:"1.5rem", left:"50%", transform:"translateX(-50%)",
    background:"#6366f1", color:"#fff", padding:".65rem 1.25rem",
    borderRadius:"8px", fontSize:".82rem", fontWeight:"700",
    boxShadow:"0 0 20px rgba(99,102,241,.5)", zIndex:"999",
    whiteSpace:"nowrap", transition:"opacity .3s"
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2500);
}

// ── PERFIL DO ALUNO ──
function verPerfil(id) {
  const aluno = DB.alunos().find(a => a.id === id);
  if (!aluno) return;

  const registros = DB.registros().filter(r => r.alunoId === id);
  const presentes    = registros.filter(r => r.tipo === "presente").length;
  const faltas       = registros.filter(r => r.tipo === "falta").length;
  const justificadas = registros.filter(r => r.tipo === "justificada").length;
  const total        = registros.length;
  const taxaPresenca = total ? Math.round((presentes / total) * 100) : 0;
  const iniciais     = aluno.nome.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
  const alertaFaltas = faltas >= 3;

  // Frequência dos últimos 6 meses
  const meses = ultimos6Meses();
  const freqMeses = meses.map(m => {
    const regs = registros.filter(r => r.data.startsWith(m.chave));
    return {
      label: m.label,
      presentes:    regs.filter(r => r.tipo === "presente").length,
      faltas:       regs.filter(r => r.tipo === "falta").length,
      justificadas: regs.filter(r => r.tipo === "justificada").length,
      total:        regs.length
    };
  });

  const maxTotal = Math.max(...freqMeses.map(m => m.total), 1);

  // Últimos 10 registros
  const ultimos = [...registros].sort((a,b) => b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora)).slice(0,10);

  document.getElementById("perfil-conteudo").innerHTML = `
    <div class="perfil-header">
      <div class="perfil-avatar">${iniciais}</div>
      <div class="perfil-info">
        <div class="perfil-nome">${aluno.nome} ${alertaFaltas ? "🚨" : ""}</div>
        <div class="perfil-meta">${planoLabel(aluno.plano)} • desde ${formatarData(aluno.inicio)}</div>
        ${aluno.tel ? `<div class="perfil-tel">📲 ${aluno.tel}</div>` : ""}
      </div>
    </div>

    ${alertaFaltas ? `
    <div class="perfil-alerta">
      🚨 <strong>${faltas} faltas sem justificativa</strong> — Sinal de exclusão ativo.
    </div>` : ""}

    <div class="perfil-stats">
      <div class="ps-item ps-verde">
        <div class="ps-num">${presentes}</div>
        <div class="ps-label">Presenças</div>
      </div>
      <div class="ps-item ps-vermelho">
        <div class="ps-num">${faltas}</div>
        <div class="ps-label">Faltas</div>
      </div>
      <div class="ps-item ps-amarelo">
        <div class="ps-num">${justificadas}</div>
        <div class="ps-label">Justificadas</div>
      </div>
      <div class="ps-item ps-roxo">
        <div class="ps-num">${taxaPresenca}%</div>
        <div class="ps-label">Frequência</div>
      </div>
    </div>

    <div class="perfil-secao-titulo">Frequência — Últimos 6 meses</div>
    <div class="grafico-barras">
      ${freqMeses.map(m => `
        <div class="gb-col">
          <div class="gb-barras">
            ${m.presentes ? `<div class="gb-barra gb-verde" style="height:${Math.round((m.presentes/maxTotal)*100)}%" title="${m.presentes} presença(s)"></div>` : ""}
            ${m.faltas    ? `<div class="gb-barra gb-vermelho" style="height:${Math.round((m.faltas/maxTotal)*100)}%" title="${m.faltas} falta(s)"></div>` : ""}
            ${m.justificadas ? `<div class="gb-barra gb-amarelo" style="height:${Math.round((m.justificadas/maxTotal)*100)}%" title="${m.justificadas} justif."></div>` : ""}
          </div>
          <div class="gb-label">${m.label}</div>
          <div class="gb-total">${m.total}</div>
        </div>
      `).join("")}
    </div>
    <div class="grafico-legenda">
      <span class="gl-item gl-verde">Presença</span>
      <span class="gl-item gl-vermelho">Falta</span>
      <span class="gl-item gl-amarelo">Justificada</span>
    </div>

    <div class="perfil-secao-titulo">Últimos registros</div>
    <div class="perfil-registros">
      ${ultimos.length ? ultimos.map(r => `
        <div class="pr-item">
          <div class="reg-tipo reg-${r.tipo}" style="width:24px;height:24px;font-size:.7rem;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">${tipoIcone(r.tipo)}</div>
          <div style="flex:1">
            <div style="font-size:.82rem;font-weight:700;color:#f8fafc">${formatarData(r.data)}</div>
            ${r.obs ? `<div style="font-size:.72rem;color:#64748b">${r.obs}</div>` : ""}
          </div>
          <div style="font-size:.72rem;color:#475569">${r.hora}</div>
        </div>
      `).join("") : `<div class="vazio">Nenhum registro ainda.</div>`}
    </div>
  `;

  document.getElementById("modal-perfil").classList.add("aberto");
}

function fecharPerfil() {
  document.getElementById("modal-perfil").classList.remove("aberto");
}

function ultimos6Meses() {
  const meses = [];
  const agora = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    meses.push({
      chave: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
      label: d.toLocaleDateString("pt-BR", { month:"short" }).replace(".","")
    });
  }
  return meses;
}
