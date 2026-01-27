//FUNÇÕES DE LICENCIAMENTO
const { ipcRenderer } = require('electron');
const { machineIdSync } = require('node-machine-id');
const fs = require('fs');
const path = require('path');
window.api = {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
};

// Localize o botão pelo ID que você definiu na sua view
document.getElementById('btn-activar').addEventListener('click', () => {
    const inputChave = document.getElementById('license-key-input');
    const chaveDigitada = inputChave.value.trim();

    // 1. Pegamos o ID da máquina novamente para comparar
    const idHardware = machineIdSync();
    const MEU_SEGREDO = "TORAS2026";

    // 2. Calculamos qual seria a chave correta para ESTE computador
    const chaveEsperada = btoa(idHardware + MEU_SEGREDO);

    if (chaveDigitada === chaveEsperada) {
        // 3. SE CORRETA: Definimos onde salvar
        const pastaLicenca = path.join(process.env.APPDATA, 'estoque-toras');
        const arquivoLicenca = path.join(pastaLicenca, 'license.dat');

        try {
            // Cria a pasta caso ela não exista (primeira instalação)
            if (!fs.existsSync(pastaLicenca)) {
                fs.mkdirSync(pastaLicenca, { recursive: true });
            }

            // Grava a chave no arquivo físico
            fs.writeFileSync(arquivoLicenca, chaveDigitada);

            alert("Sistema ativado com sucesso! Aproveite o controle de toras.");

            // 4. Recarrega o app para rodar o verificarProtecao() e liberar tudo
            location.reload();

        } catch (err) {
            alert("Erro ao gravar licença no sistema: " + err.message);
        }
    } else {
        // 5. SE INCORRETA: Feedback visual ao usuário
        alert("Chave de licença inválida para este computador.");
        inputChave.style.borderColor = "#f87171"; // Vermelho de erro
        inputChave.value = "";
    }
});


// Inicializar Ícones do Lucide
lucide.createIcons();

// --- CONFIGURAÇÃO SWEETALERT (TOAST) ---
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
});

function avisar(tipo, mensagem) {
    Toast.fire({ icon: tipo, title: mensagem });
}

// --- FUNÇÃO AUXILIAR PARA LIMPAR MENSAGENS DE ERRO ---
function tratarErroIpc(err) {
    if (!err || !err.message) return "Erro desconhecido.";

    // Remove o prefixo "Error invoking remote method '...':" 
    // e também o "Error:" que costuma vir antes da mensagem real
    return err.message
        .replace(/^Error invoking remote method '.*?':\s*/, '')
        .replace(/^Error:\s*/, '');
}


// --- NAVEGAÇÃO ENTRE VIEWS ---
let formularioSujo = false;
let telaAtual = 'home'; // Rastreia de onde o usuário está saindo

// Monitorar mudanças em qualquer formulário
document.addEventListener('input', (e) => {
    // 1. Verifica se o input está dentro da Home (Dashboard) ou se é a busca global
    const isHome = e.target.closest('#v-home');
    const isBuscaGlobal = e.target.id === 'busca-global-numero';

    // Só marca como sujo se NÃO for da home e NÃO for a busca global
    if (e.isTrusted && e.target.closest('.view') && !isHome && !isBuscaGlobal) {
        formularioSujo = true;
    }
});

async function carregarTela(viewName, element) {
    // 1. LISTA DE EXCEÇÕES: Telas que não disparam o aviso ao SAIR delas
    const viewsSemAviso = ['home', 'estoque', 'relatorios', 'logs', 'configuracoes'];

    // 2. TRAVA DE SEGURANÇA: Só pergunta se a tela de ORIGEM não for isenta
    if (formularioSujo && !viewsSemAviso.includes(telaAtual)) {
        const resultado = await Swal.fire({
            title: 'Alterações não salvas',
            text: "Você preencheu dados neste formulário. Deseja realmente sair e descartar as alterações?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, sair',
            cancelButtonText: 'Ficar aqui'
        });

        if (!resultado.isConfirmed) return; // Cancela a navegação
    }

    // --- 3. POWER RESET: LIMPEZA TOTAL DE INPUTS ---
    const todosOsInputs = document.querySelectorAll('input, select, textarea');
    todosOsInputs.forEach(campo => {
        if (campo.tagName === 'SELECT') {
            campo.selectedIndex = 0;
        } else {
            campo.value = '';
        }
    });

    // Resetamos a trava e atualizamos a tela atual para a próxima navegação
    formularioSujo = false;
    telaAtual = viewName;

    // --- 4. INTERFACE: TROCA DE VISIBILIDADE ---
    document.querySelectorAll('.components li').forEach(li => li.classList.remove('active'));
    if (element) element.classList.add('active');

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('v-' + viewName);
    if (target) target.classList.add('active');

    // Títulos conforme o layout definido [cite: 2026-01-16]
    const nomes = {
        'home': 'Dashboard',
        'especies': 'Cadastro de Espécies',
        'lotes': 'Cadastro de Lotes',
        'entradas': 'Entradas no Estoque',
        'baixas': 'Baixas de Estoque',
        'estoque': 'Controle de Estoque Geral',
        'relatorios': 'Relatórios Gerenciais',
        'logs': 'Log de Sistemas',
        'configuracoes': 'Configurações'
    };
    document.getElementById('view-title').innerText = nomes[viewName] || 'ToraControl';

    // --- 5. GATILHOS DE CARREGAMENTO (DATABASE) ---
    try {
        switch (viewName) {
            case 'home':
                if (typeof atualizarDashboard === 'function') atualizarDashboard();
                break;

            case 'especies':
                if (typeof carregarEspecies === 'function') await carregarEspecies();
                break;

            case 'lotes':
                if (typeof carregarLotes === 'function') await carregarLotes();
                break;

            case 'entradas':
                // Carregamento para novas toras [cite: 2026-01-20]
                if (typeof carregarEspecies === 'function') await carregarEspecies();
                if (typeof carregarLotes === 'function') await carregarLotes();
                if (typeof listarTorasRecentes === 'function') await listarTorasRecentes();
                break;

            case 'estoque':
                if (typeof carregarEstoque === 'function') await carregarEstoque(true);
                break;

            case 'relatorios':
                if (typeof carregarFiltrosRelatorio === 'function') await carregarFiltrosRelatorio();
                break;

            case 'logs':
                if (typeof carregarLogs === 'function') await carregarLogs();
                break;
        }
    } catch (err) {
        console.error(`Erro ao processar dados da view ${viewName}:`, err);
    }

    // Renderiza ícones Lucide
    if (window.lucide) {
        lucide.createIcons();
    }
}

function limparFormularioTora() {
    const form = document.getElementById('form-entrada-tora'); // Use seu ID real
    if (form) form.reset();

    // Limpar IDs ocultos de edição
    const inputId = document.getElementById('tora-id-edicao');
    if (inputId) inputId.value = '';

    // Resetar título para estado inicial
    const btnSalvar = document.getElementById('btn-salvar-tora');
    if (btnSalvar) btnSalvar.innerText = 'Cadastrar Tora';

    // RESETAR A TRAVA: Essencial para o carregarTela não perguntar nada na próxima vez
    formularioSujo = false;
}

// 1. MÁSCARAS E UTILITÁRIOS
function mascaraComprimento(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 2) {
        value = value.slice(0, -2) + ',' + value.slice(-2);
    }
    input.value = value;
}

function aplicarMascaraNumero(input) {
    if (input.value) {
        input.value = input.value.toString().padStart(3, '0');
    }
}
function obterValorLimpo(id) {
    const element = document.getElementById(id);
    if (!element) return 0;
    let valor = element.value.replace(/\./g, "").replace(",", ".");
    return parseFloat(valor) || 0;
}


// --- GESTÃO DE ESPÉCIES ---
async function carregarEspecies() {
    try {
        const especies = await window.api.invoke('listar-especies');
        const tbody = document.getElementById('lista-especies');
        if (tbody) {
            tbody.innerHTML = especies.map(esp => `
                <tr>
                    <td>${esp.nome}</td>
                    <td>${esp.cientifico || '-'}</td>
                    <td style="text-align: right;">
                        <button class="btn-icon-edit" onclick="prepararEdicaoEspecie('${encodeURIComponent(JSON.stringify(esp))}')"><i data-lucide="pencil"></i></button>
                        <button class="btn-icon-delete" onclick="excluirEspecie(${esp.id})"><i data-lucide="trash-2"></i></button>
                    </td>
                </tr>`).join('');
        }
        const select = document.getElementById('tora-especie');
        if (select) select.innerHTML = '<option value="">Selecione...</option>' + especies.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

// --- GESTÃO DE ESPÉCIES (Ajustado para Logs) ---
async function salvarEspecie() {
    const id = document.getElementById('esp-id').value;
    const nome = document.getElementById('esp-nome').value;
    const cientifico = document.getElementById('esp-cientifico').value;

    if (!nome) return Swal.fire('Atenção', 'O nome da espécie é obrigatório.', 'warning');

    try {
        const res = await window.api.invoke(id ? 'editar-especie' : 'salvar-especie', { id, nome, cientifico });

        // Verificação por success garante que o log foi gravado
        if (res && res.success) {
            avisar('success', id ? 'Espécie atualizada!' : 'Espécie cadastrada!');
            resetEspecieForm();
            carregarEspecies();
        } else {
            throw new Error(res.error || 'Erro ao processar espécie.');
        }
    } catch (err) {
        console.error("Erro no cadastro:", err);
        avisar('error', tratarErroIpc(err));
    }
}

// As funções abaixo estão ótimas, mantive a lógica de reset e edição
function prepararEdicaoEspecie(json) {
    const esp = JSON.parse(decodeURIComponent(json));

    document.getElementById('esp-id').value = esp.id;
    document.getElementById('esp-nome').value = esp.nome;
    document.getElementById('esp-cientifico').value = esp.cientifico || "";

    // Ajusta o botão de salvar
    const btnSalvar = document.getElementById('btn-salvar-especie');
    const spanSalvar = btnSalvar.querySelector('span');
    if (spanSalvar) spanSalvar.innerText = "Atualizar Espécie";

    // MOSTRAR O BOTÃO CANCELAR
    const btnCancelar = document.getElementById('btn-cancelar-esp');
    if (btnCancelar) {
        // Usamos 'flex' ou 'inline-flex' se você usa ícones, ou 'inline-block'
        btnCancelar.style.setProperty('display', 'inline-block', 'important');
    }

    // Rola para o formulário
    document.getElementById('esp-nome').focus();
}

function resetEspecieForm() {
    // 1. Limpa os campos
    const campos = ['esp-id', 'esp-nome', 'esp-cientifico'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 2. Volta o texto do botão salvar
    const btnSalvar = document.getElementById('btn-salvar-especie');
    if (btnSalvar) {
        const span = btnSalvar.querySelector('span');
        if (span) span.innerText = "Salvar Espécie";
    }

    // 3. ESCONDE O BOTÃO CANCELAR
    const btnCancelar = document.getElementById('btn-cancelar-esp');
    if (btnCancelar) {
        btnCancelar.style.display = "none";
    }
}

async function excluirEspecie(id) {
    const r = await Swal.fire({
        title: 'Excluir Espécie?',
        text: "Isso não pode ser desfeito.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#6366f1'
    });

    if (r.isConfirmed) {
        try {
            const res = await window.api.invoke('excluir-especie', id);
            if (res && res.success) {
                avisar('success', 'Espécie removida.');
                carregarEspecies();
            } else {
                throw new Error(res.error || 'Não foi possível excluir.');
            }
        } catch (err) {
            Swal.fire({
                title: 'Não permitido',
                text: (typeof tratarErroIpc === 'function') ? tratarErroIpc(err) : err.message,
                icon: 'error',
                confirmButtonColor: '#6366f1'
            });
        }
    }
}

// --- GESTÃO DE LOTES ---
// --- GESTÃO DE LOTES (Ajustado para Logs) ---
async function salvarLote() {
    const id = document.getElementById('lote-id').value;
    const numero = document.getElementById('lote-numero').value;
    const descricao = document.getElementById('lote-descricao').value;

    if (!numero) return Swal.fire('Atenção', 'Número do lote obrigatório.', 'warning');

    try {
        const res = await window.api.invoke(id ? 'editar-lote' : 'salvar-lote', { id, numero, descricao });

        if (res && res.success) {
            avisar('success', id ? 'Lote atualizado!' : 'Lote criado!');
            resetLoteForm();
            carregarLotes();
        } else {
            throw new Error(res.error || 'Erro ao salvar lote.');
        }
    } catch (err) {
        Swal.fire('Erro', 'Número de lote já existe ou erro na gravação.', 'error');
    }
}

async function carregarLotes() {
    const lotes = await window.api.invoke('listar-lotes');
    const tbody = document.getElementById('lista-lotes');
    if (tbody) {
        tbody.innerHTML = lotes.map(l => `
            <tr>
                <td><strong>${l.numero}</strong></td>
                <td>${l.descricao || '-'}</td>
                <td style="text-align: center;"><span class="badge-count">${l.total_toras} toras</span></td>
                <td style="text-align: center;"><span class="badge-volume">${(l.volume_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</span></td>
                <td style="text-align: right;">
                    <button class="btn-icon-edit" onclick="prepararEdicaoLote('${encodeURIComponent(JSON.stringify(l))}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-icon-delete" onclick="excluirLote(${l.id})"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`).join('');
    }
    const select = document.getElementById('tora-lote');
    if (select) select.innerHTML = '<option value="">Selecione...</option>' + lotes.map(l => `<option value="${l.id}">${l.numero}</option>`).join('');
    lucide.createIcons();
}

function prepararEdicaoLote(json) {
    const l = JSON.parse(decodeURIComponent(json));
    document.getElementById('lote-id').value = l.id;
    document.getElementById('lote-numero').value = l.numero;
    document.getElementById('lote-descricao').value = l.descricao || "";
    document.getElementById('btn-salvar-lote').querySelector('span').innerText = "Atualizar Lote";
    document.getElementById('btn-cancelar-edicao').style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetLoteForm() {
    document.getElementById('lote-id').value = "";
    document.getElementById('lote-numero').value = "";
    document.getElementById('lote-descricao').value = "";
    document.getElementById('btn-salvar-lote').querySelector('span').innerText = "Salvar Lote";
    document.getElementById('btn-cancelar-edicao').style.display = "none";
}

async function excluirLote(id) {
    const r = await Swal.fire({ title: 'Excluir Lote?', text: "Isso não pode ser desfeito.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#6366f1' });
    if (r.isConfirmed) {
        try {
            await window.api.invoke('excluir-lote', id);
            avisar('success', 'Lote removido.');
            carregarLotes();
        } catch (err) {
            Swal.fire({ title: 'Não permitido', text: tratarErroIpc(err), icon: 'error', confirmButtonColor: '#6366f1' });
        }
    }
}

// --- GESTÃO DE TORAS (ENTRADAS) ---
function calcularCubagem() {
    // Usando sua função padrão para garantir números limpos
    const rodo = obterValorLimpo('rodo');
    const d1 = obterValorLimpo('d1');
    const d2 = obterValorLimpo('d2');
    const comp = obterValorLimpo('comprimento');
    const detalheSmall = document.getElementById('detalhe-calculo');

    // 1. CÁLCULO DO OCO (Truncamento na 3ª casa)
    const volOcoRaw = (d1 * d2 * comp) / 10000;
    const volOcoTrunc = Math.floor(volOcoRaw * 1000) / 1000;

    document.getElementById('total-desconto-ver').value = volOcoTrunc.toFixed(3).replace('.', ',');

    // 2. CÁLCULO DA TORA (Quarto do Rodo) [cite: 2026-01-20]
    if (rodo > 0 && comp > 0) {
        const lado = Math.floor(rodo / 4);
        const volBrutoRaw = (lado * lado * comp) / 10000;
        const volBrutoTrunc = Math.floor(volBrutoRaw * 1000) / 1000;
        const volumeFinal = (volBrutoTrunc - volOcoTrunc).toFixed(3);

        document.getElementById('volume-result').innerText = volumeFinal.replace('.', ',') + " m³";
        detalheSmall.innerText = ` Bruto: ${volBrutoTrunc.toFixed(3)} m³ | Oco: ${volOcoTrunc.toFixed(3)} m³`;
        return { liquido: volumeFinal, oco: volOcoTrunc };
    } else {
        document.getElementById('volume-result').innerText = "0,000 m³";
        return { liquido: "0.000", oco: volOcoTrunc };
    }
}

// 3. FUNÇÃO SALVAR (INTEGRADA)
async function salvarTora() {
    // 1. Garante o cálculo mais recente antes de capturar os dados
    const calc = calcularCubagem();
    const idExistente = document.getElementById('tora-id').value;

    // 2. Monta o objeto usando obterValorLimpo para garantir a precisão numérica
    const tora = {
        id: idExistente || null,
        codigo: document.getElementById('tora-codigo').value, // Nosso "Número" [cite: 2026-01-17]
        especie_id: document.getElementById('tora-especie').value,
        lote_id: document.getElementById('tora-lote').value,
        rodo: obterValorLimpo('rodo'),
        desconto_1: obterValorLimpo('d1'),
        desconto_2: obterValorLimpo('d2'),
        total_desconto: parseFloat(calc.oco),
        comprimento: obterValorLimpo('comprimento'),
        volume: parseFloat(calc.liquido)
    };

    // 3. Validação de campos obrigatórios
    if (!tora.codigo || !tora.especie_id || !tora.lote_id || tora.rodo <= 0 || tora.comprimento <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Preencha o Número, Espécie, Lote, Rodo e Comprimento para continuar.',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    try {
        // 4. Define se é uma nova entrada ou edição
        const canal = idExistente ? 'editar-tora' : 'salvar-tora';
        const result = await window.api.invoke(canal, tora);

        if (result.success) {
            // --- AJUSTE DE SEGURANÇA ---
            // Como salvamos com sucesso, o formulário não está mais "sujo"
            formularioSujo = false;

            Swal.fire({
                icon: 'success',
                title: idExistente ? 'Tora Atualizada' : 'Tora Registrada',
                text: `Tora número ${tora.codigo} salva com sucesso!`,
                timer: 1500,
                showConfirmButton: false
            });

            // 5. Limpa o formulário e atualiza a listagem
            // Certifique-se que resetFormEntrada() também defina formularioSujo = false
            resetFormEntrada();
            listarTorasRecentes();
        }
    } catch (err) {
        console.error('Erro ao salvar:', err);
        Swal.fire('Erro no Sistema', err.message, 'error');
    }
}

async function listarTorasRecentes() {
    try {
        const toras = await window.api.invoke('listar-toras-recentes');
        const tbody = document.getElementById('lista-entradas-recentes');
        if (!tbody) return;

        tbody.innerHTML = '';

        toras.forEach(tora => {
            // Formatação do Oco: Medidas (D1 x D2) - Volume do Desconto
            // Só exibe o detalhamento se houver medidas cadastradas
            let ocoDisplay = "---";
            if (tora.desconto_1 > 0 || tora.desconto_2 > 0) {
                const volDesc = tora.total_desconto ? tora.total_desconto.toFixed(3).replace('.', ',') : "0,000";
                ocoDisplay = `${tora.desconto_1}x${tora.desconto_2} - ${volDesc} m³`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge-numero">${tora.codigo || '---'}</span></td>
                <td>${tora.especie_nome || '---'}</td>
                <td>${tora.lote_numero || '---'}</td>
                <td>R: ${tora.rodo} | C: ${tora.comprimento.toFixed(2)}</td>
                <td style="color: ${tora.total_desconto > 0 ? '#e11d48' : 'inherit'}; font-size: 0.9em;">
                    ${ocoDisplay}
                </td>
                <td style="font-weight: bold;">${tora.volume.toFixed(3).replace('.', ',')} m³</td>
                <td style="text-align: right;">
                    <button class="btn-icon-edit" onclick="prepararEdicaoTora('${encodeURIComponent(JSON.stringify(tora))}')">
                     <i data-lucide="pencil"></i>
                    </button>
                    <button class="btn-icon-delete" onclick="confirmarExclusaoTora(${tora.id})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        console.error("Erro ao listar toras:", err);
    }
}

function prepararEdicaoTora(json) {
    const t = JSON.parse(decodeURIComponent(json));

    // REGRA DE OURO: Bloqueio para toras já baixadas
    if (t.status === 'serrada') {
        Swal.fire('Bloqueado', 'Esta tora já foi serrada e não pode mais ser editada.', 'warning');
        return;
    }

    // Navega para a view de entradas mantendo o padrão do sistema
    carregarTela('entradas', document.querySelector('li[onclick*="entradas"]'));

    // Preenchimento dos IDs e Campos de Identificação
    document.getElementById('tora-id').value = t.id;
    document.getElementById('tora-codigo').value = t.codigo; // Número [cite: 2026-01-17]

    // Preenchimento das Novas Medidas de Cubagem e Desconto [cite: 2026-01-21]
    document.getElementById('rodo').value = t.rodo || 0;
    document.getElementById('d1').value = t.desconto_1 || 0;
    document.getElementById('d2').value = t.desconto_2 || 0;

    // Tratamento de decimais para o Comprimento
    document.getElementById('comprimento').value = t.comprimento ? t.comprimento.toFixed(2).replace('.', ',') : "0,00";

    // Popular espécie e lote com timeout para garantir o carregamento do DOM
    setTimeout(() => {
        if (document.getElementById('tora-especie')) document.getElementById('tora-especie').value = t.especie_id;
        if (document.getElementById('tora-lote')) document.getElementById('tora-lote').value = t.lote_id;

        // Recalcula o volume líquido e o total de desconto em tempo real
        calcularCubagem();
    }, 100);

    // Ajuste visual dos botões para modo Edição
    const btnSalvar = document.getElementById('btn-salvar-tora');
    if (btnSalvar) {
        btnSalvar.querySelector('span').innerText = "Atualizar Tora";
        const icone = btnSalvar.querySelector('i');
        if (icone) icone.setAttribute('data-lucide', 'save');
    }

    const btnCancelar = document.getElementById('btn-cancelar-tora');
    if (btnCancelar) btnCancelar.style.display = "block";

    // Refaz ícones do Lucide
    if (window.lucide) window.lucide.createIcons();

    // Ajuste: Aguarda um instante para a tela carregar antes de rolar
    setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Opcional: Coloca o foco no campo Número [cite: 2026-01-17]
        const input = document.getElementById('tora-codigo');
        if (input) input.focus();
    }, 100);
}

function resetFormEntrada() {
    // 1. Limpeza dos campos de entrada e ocultos
    const campos = [
        'tora-id',
        'tora-codigo',
        'rodo',
        'd1',
        'd2',
        'total-desconto-ver',
        'comprimento'
    ];

    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 2. Reseta os seletores de Espécie e Lote
    if (document.getElementById('tora-especie')) document.getElementById('tora-especie').selectedIndex = 0;
    if (document.getElementById('tora-lote')) document.getElementById('tora-lote').selectedIndex = 0;

    // 3. ZERA OS PAINÉIS DE RESULTADO (Volume e Detalhes)
    const volRes = document.getElementById('volume-result');
    if (volRes) volRes.innerText = "0,000 m³";

    // Reseta o detalhe do cálculo (Lado, Bruto, Oco)
    const detalheCalc = document.getElementById('detalhe-calculo');
    if (detalheCalc) detalheCalc.innerText = "";

    // 4. Restaura o estado original dos botões
    const btnSalvar = document.getElementById('btn-salvar-tora');
    if (btnSalvar) {
        const span = btnSalvar.querySelector('span');
        if (span) span.innerText = "Confirmar Entrada";

        const icone = btnSalvar.querySelector('i');
        if (icone) {
            icone.setAttribute('data-lucide', 'check');
        }
    }

    const btnCancelar = document.getElementById('btn-cancelar-tora');
    if (btnCancelar) btnCancelar.style.display = "none";

    // 5. Atualiza ícones e foca no campo Número [cite: 2026-01-17]
    if (window.lucide) window.lucide.createIcons();

    const inputCodigo = document.getElementById('tora-codigo');
    if (inputCodigo) inputCodigo.focus();
}

async function confirmarExclusaoTora(id, codigo, status) {
    // Validação preventiva no Front-end (evita até chamar o banco)
    if (status === 'serrada') {
        return Swal.fire({
            title: 'Operação Negada',
            text: `A tora Número ${codigo} já foi baixada (serrada) e não pode ser excluída.`,
            icon: 'error',
            confirmButtonColor: '#6366f1'
        });
    }

    const r = await Swal.fire({
        title: 'Excluir Tora?',
        text: `Deseja remover a tora Número ${codigo}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    });

    if (r.isConfirmed) {
        try {
            const res = await window.api.invoke('excluir-tora', id);
            if (res && res.success) {
                avisar('success', `Tora Número ${codigo} removida.`);
                resetFormEntrada();
                listarTorasRecentes();
                if (document.getElementById('v-estoque').classList.contains('active')) carregarEstoque();
            } else {
                // Se o backend retornar erro, tratamos aqui
                throw new Error(res.error || 'Erro ao excluir.');
            }
        } catch (err) {
            // Aqui a mágica acontece: a mensagem técnica some!
            const mensagemLimpa = tratarErroIpc(err);
            Swal.fire({
                title: 'Não foi possível excluir',
                text: mensagemLimpa,
                icon: 'error',
                confirmButtonColor: '#6366f1'
            });
        }
    }
}

// --- BAIXAS / ROMANEIO ---
let listaParaBaixa = [];

async function buscarEAdicionarALista() {
    const codigoInput = document.getElementById('buscar-tora-codigo');
    // Aplica a máscara para manter o padrão de 3 dígitos se necessário
    if (typeof aplicarMascaraNumero === 'function') aplicarMascaraNumero(codigoInput);

    const codigo = codigoInput.value.trim();
    if (!codigo) return;

    if (listaParaBaixa.some(t => t.codigo === codigo)) {
        codigoInput.value = '';
        return Swal.fire('Atenção', 'Esta tora já está na lista de saída.', 'warning');
    }

    try {
        const tora = await window.api.invoke('buscar-tora-por-codigo', codigo);
        // Só permite adicionar se a tora estiver 'pátio'
        if (tora && tora.status === 'pátio') {
            listaParaBaixa.push(tora);
            atualizarTabelaTemporaria();
            codigoInput.value = '';
            codigoInput.focus();
        } else if (tora && tora.status === 'serrada') {
            Swal.fire('Bloqueado', 'Esta tora já consta como serrada/baixada.', 'error');
        } else {
            Swal.fire('Não encontrada', 'Número de tora não localizado no pátio.', 'warning');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao localizar dados da tora.', 'error');
    }
}

function atualizarTabelaTemporaria() {
    const tbody = document.getElementById('lista-baixa-temporaria');
    if (!tbody) return;

    let totalVol = 0;

    tbody.innerHTML = listaParaBaixa.map((tora, index) => {
        totalVol += tora.volume;

        // Montagem da string de medidas
        // Padrão: R: 180 | C: 4,50
        let medidasDisplay = `R: ${tora.rodo} | C: ${tora.comprimento.toFixed(2)}`;

        // Se houver oco, adicionamos logo abaixo ou ao lado
        if (tora.desconto_1 > 0 || tora.desconto_2 > 0) {
            medidasDisplay += ` <br><small style="color: #e11d48;">Oco: ${tora.desconto_1}x${tora.desconto_2}</small>`;
        }

        return `
            <tr>
                <td><span class="badge-numero">${tora.codigo}</span></td>
                <td>${tora.especie_nome}</td>
                <td>${tora.lote_numero || '---'}</td>
                <td>${medidasDisplay}</td>
                <td style="font-weight: bold;">${tora.volume.toFixed(3).replace('.', ',')}</td>
                <td style="text-align: right;">
                    <button class="btn-icon-delete" onclick="removerDaLista(${index})">
                        <i data-lucide="x"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');

    // Atualiza os totais do painel lateral/inferior
    const elVol = document.getElementById('total-volume-baixa');
    const elQtd = document.getElementById('total-toras-baixa');

    if (elVol) elVol.innerText = totalVol.toFixed(3).replace('.', ',') + " m³";
    if (elQtd) elQtd.innerText = listaParaBaixa.length + " toras";

    // Reinicializa os ícones do Lucide (o "X" de remover)
    if (window.lucide) lucide.createIcons();
}

function removerDaLista(index) {
    listaParaBaixa.splice(index, 1);
    atualizarTabelaTemporaria();
}

function limparListaTemporaria() {
    listaParaBaixa = [];
    atualizarTabelaTemporaria();
}

async function processarBaixaEGerarPDF() {
    const dataSaida = document.getElementById('saida-data').value;

    if (!dataSaida || listaParaBaixa.length === 0) {
        return Swal.fire('Atenção', 'Selecione a data e adicione toras para o romaneio.', 'warning');
    }

    const confirmacao = await Swal.fire({
        title: 'Finalizar Romaneio?',
        text: `Deseja processar a baixa de ${listaParaBaixa.length} toras?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Sim, Finalizar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmacao.isConfirmed) return;

    try {
        const ids = listaParaBaixa.map(t => t.id);
        const totalVolumeGeral = listaParaBaixa.reduce((acc, t) => acc + t.volume, 0);

        // Agrupamento para o resumo
        const resumoEspecies = {};
        listaParaBaixa.forEach(tora => {
            const nome = tora.especie_nome;
            if (!resumoEspecies[nome]) resumoEspecies[nome] = { volume: 0, qtd: 0 };
            resumoEspecies[nome].volume += tora.volume;
            resumoEspecies[nome].qtd += 1;
        });

        // 1. Processa a baixa no Banco
        await window.api.invoke('processar-baixa-lote', { ids, dataSaida });

        // 2. Montagem do HTML para o PDF
        const htmlParaPDF = `
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #2c3e50; margin-bottom: 20px; padding-bottom: 10px; }
                    .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
                    
                    .info-topo { margin-bottom: 15px; font-size: 12px; display: flex; justify-content: space-between; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    thead th { 
                        background-color: #8faab7 !important; 
                        color: #ffffff !important; 
                        font-size: 10px; 
                        padding: 10px; 
                        border: 1px solid #d1d9e0;
                        -webkit-print-color-adjust: exact;
                    }
                    td { font-size: 10px; padding: 8px; border: 1px solid #e2e8f0; text-align: center; }
                    
                    .oco-info { color: #e11d48; font-size: 9px; display: block; margin-top: 2px; }
                    .bold { font-weight: bold; }
                    
                    .resumo-secao { margin-top: 25px; font-size: 10px; border: 1px solid #eee; padding: 15px; background: #fcfcfc; }
                    .total-final { text-align: right; font-size: 14px; font-weight: bold; margin-top: 15px; border-top: 2px solid #2c3e50; padding-top: 10px; }
                    
                    .assinaturas { margin-top: 60px; display: flex; justify-content: space-around; }
                    .sig-line { border-top: 1px solid #333; width: 220px; text-align: center; font-size: 10px; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header"><h1>Romaneio de Saída de Toras</h1></div>
                <div class="info-topo">
                    <span><strong>Data de Saída:</strong> ${dataSaida.split('-').reverse().join('/')}</span>
                    <span><strong>Quantidade:</strong> ${listaParaBaixa.length} toras</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Número</th>
                            <th>Espécie</th>
                            <th>Lote</th>
                            <th>Medidas (Rodo | Comp)</th>
                            <th>Volume Líquido (m³)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${listaParaBaixa.map(t => {
            // Lógica do Oco para o PDF
            let ocoHTML = "";
            if (t.desconto_1 > 0 || t.desconto_2 > 0) {
                const volDesc = t.total_desconto ? t.total_desconto.toFixed(3).replace('.', ',') : "0,000";
                ocoHTML = `<span class="oco-info">Oco: ${t.desconto_1}x${t.desconto_2} = ${volDesc}</span>`;
            }

            return `
                                <tr>
                                    <td class="bold">${t.codigo}</td>
                                    <td>${t.especie_nome}</td>
                                    <td>${t.lote_numero || '---'}</td>
                                    <td>
                                        R: ${t.rodo} | C: ${t.comprimento.toFixed(2)}
                                        ${ocoHTML}
                                    </td>
                                    <td class="bold">${t.volume.toFixed(3).replace('.', ',')}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>

                <div class="resumo-secao">
                    <strong>RESUMO POR ESPÉCIE:</strong><br><br>
                    ${Object.entries(resumoEspecies).map(([nome, dados]) => `
                        <div>${nome}: ${dados.volume.toFixed(3).replace('.', ',')} m³ (${dados.qtd} toras)</div>
                    `).join('')}
                </div>

                <div class="total-final">
                    VOLUME TOTAL DO ROMANEIO: ${totalVolumeGeral.toFixed(3).replace('.', ',')} m³
                </div>

                <div class="assinaturas">
                    <div class="sig-line">Responsável pelo Pátio</div>
                    <div class="sig-line">Conferência Serraria</div>
                </div>
            </body>
            </html>
        `;

        await window.api.invoke('gerar-pdf-logs', htmlParaPDF);
        Swal.fire('Sucesso', 'Baixa realizada e romaneio gerado com sucesso!', 'success');
        limparListaTemporaria();

    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao processar romaneio: ' + err.message, 'error');
    }
}

// --- FUNÇÕES DO ESTOQUE GERAL ---
let offsetEstoque = 0;
let estaCarregando = false;

async function carregarEstoque(resetarPaginacao = false) {
    if (estaCarregando) return;

    const corpo = document.getElementById('lista-estoque-corpo');
    const btnMais = document.getElementById('btn-carregar-mais');
    if (!corpo) return;

    try {
        estaCarregando = true;

        const status = document.getElementById('filtro-estoque-status').value;
        const loteId = document.getElementById('filtro-estoque-lote').value;
        const codigoInput = document.getElementById('filtro-estoque-codigo');
        const codigo = codigoInput ? codigoInput.value.trim() : '';

        if (resetarPaginacao) {
            offsetEstoque = 0;
            corpo.style.opacity = '0.5';
        }

        if (btnMais) {
            btnMais.disabled = true;
            btnMais.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Processando...';
            if (window.lucide) lucide.createIcons();
        }

        const [totais, toras] = await Promise.all([
            window.api.invoke('get-totais-estoque', { status, codigo, loteId }),
            window.api.invoke('get-estoque-detalhado', { status, codigo, loteId, limite: 50, pular: offsetEstoque })
        ]);

        const elQtd = document.getElementById('indicador-qtd-patio');
        const elVol = document.getElementById('indicador-vol-patio');
        if (elQtd) elQtd.innerText = (totais.total_qtd || 0).toLocaleString('pt-BR');
        if (elVol) elVol.innerText = (totais.total_vol || 0).toFixed(3).replace('.', ',');

        if (toras.length === 0 && offsetEstoque === 0) {
            corpo.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Nenhuma tora encontrada.</td></tr>';
            if (btnMais) btnMais.style.display = 'none';
            return;
        }

        const htmlLinhas = toras.map(t => {
            let medidasDisplay = `R: ${t.rodo} | C: ${t.comprimento.toFixed(2)}`;
            if (t.desconto_1 > 0 || t.desconto_2 > 0) {
                medidasDisplay += `<br><small style="color: #e11d48; font-weight: 600;">Oco: ${t.desconto_1}x${t.desconto_2}</small>`;
            }

            const statusClass = t.status === 'pátio' ? 'status-patio' : 'status-serrada';
            const statusTexto = t.status === 'pátio' ? 'NO PÁTIO' : 'SERRADA';

            // Recuperando seus botões e ícones originais [cite: 2026-01-16]
            return `
                <tr>
                    <td><span class="badge-numero">${t.codigo}</span></td>
                    <td>${t.especie_nome || '---'}</td>
                    <td><span class="badge-lote-">${t.lote_numero || '---'}</span></td>
                    <td>${medidasDisplay}</td>
                    <td style="font-weight: bold;">${(t.volume || 0).toFixed(3).replace('.', ',')}</td>
                    <td><span class="status-tag ${statusClass}">${statusTexto}</span></td>
                    <td>${new Date(t.data_entrada).toLocaleDateString('pt-BR')}</td>
                    <td style="text-align: right;">
                        <button class="btn-icon-edit" title="Editar" 
                                onclick="prepararEdicaoTora('${encodeURIComponent(JSON.stringify(t))}')">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="btn-icon-delete" title="Excluir" 
                                onclick="confirmarExclusaoTora(${t.id}, '${t.codigo}', '${t.status}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');

        if (offsetEstoque === 0) {
            corpo.innerHTML = htmlLinhas;
            corpo.style.opacity = '1'; // Volta ao normal
        } else {
            corpo.insertAdjacentHTML('beforeend', htmlLinhas);
        }

        offsetEstoque += toras.length;

        if (btnMais) {
            btnMais.disabled = false;
            btnMais.innerHTML = '<i data-lucide="refresh-cw"></i> Carregar mais toras...';
            btnMais.style.display = (toras.length < 50 || codigo !== '') ? 'none' : 'block';
        }

        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error("Erro ao carregar estoque:", err);
        if (corpo) corpo.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #e11d48;">Erro ao processar dados.</td></tr>';
    } finally {
        estaCarregando = false;
    }
}

// Função auxiliar para não repetir código
function atualizarIndicadores(qtd, vol) {
    document.getElementById('indicador-qtd-patio').innerText = qtd;
    document.getElementById('indicador-vol-patio').innerText = vol.toFixed(3).replace('.', ',');
}

async function atualizarFiltroLotes() {
    const selectLote = document.getElementById('filtro-estoque-lote');
    if (!selectLote) return;
    const lotes = await window.api.invoke('listar-lotes');
    selectLote.innerHTML = '<option value="todos">Todos os Lotes</option>' + lotes.map(l => `<option value="${l.id}">Lote: ${l.numero}</option>`).join('');
}

async function confirmarExclusaoTora(id, codigo) {
    // 1. Primeiro, buscamos os dados da tora para verificar o status
    // Se o objeto 'tora' já estiver disponível no contexto, podemos usar, 
    // mas buscar por código garante o dado mais recente do banco.
    try {
        // Filtramos nos filtros de estoque ou buscamos direto se necessário.
        // Aqui, para ser mais seguro, vamos validar o status.

        const confirmacao = await Swal.fire({
            title: 'Excluir Tora?',
            text: `Deseja remover a tora número ${codigo}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar'
        });

        if (confirmacao.isConfirmed) {
            const resultado = await window.api.invoke('excluir-tora', id);

            // Tratamento de erro caso o handler do main.js retorne a trava
            if (resultado && resultado.error) {
                Swal.fire('Não permitido', resultado.error, 'error');
            } else {
                avisar('success', 'Tora removida do sistema.');
                if (document.getElementById('v-estoque').classList.contains('active')) {
                    carregarEstoque(true);
                }
                listarTorasRecentes();
            }
        }
    } catch (err) {
        // Captura o erro vindo da trava que vem do Main.js
        const msg = tratarErroIpc(err);
        Swal.fire('Bloqueado', msg, 'error');
    }
}
// --- CONFIGURAÇÕES & BACKUP ---
async function resetarSistemaCompleto() {
    const r = await Swal.fire({ title: 'APAGAR TUDO?', text: "Ação irreversível!", icon: 'warning', showCancelButton: true });
    if (r.isConfirmed) {
        const { value: txt } = await Swal.fire({ title: 'Digite APAGAR para confirmar:', input: 'text' });
        if (txt === 'APAGAR') {
            const res = await window.api.invoke('limpar-banco-dados');
            if (res.success) location.reload();
        }
    }
}

async function fazerBackup() {
    const res = await window.api.invoke('exportar-backup');
    if (res.success) Swal.fire('Sucesso', 'Backup salvo com sucesso!', 'success');
}

// --- REGISTRO DE EVENTOS (LISTENERS) ---

// 1. Busca Automática ao digitar o número da Tora
const campoBusca = document.getElementById('filtro-estoque-codigo');
if (campoBusca) {
    campoBusca.addEventListener('input', () => {
        carregarEstoque(false); // Chama a função que você já tem
    });
}

// 2. Filtro Automático ao mudar o Status (Pátio/Serrada)
const campoStatus = document.getElementById('filtro-estoque-status');
if (campoStatus) {
    campoStatus.addEventListener('change', () => {
        carregarEstoque(false);
    });
}

// 3. Filtro Automático ao mudar o Lote
const campoLote = document.getElementById('filtro-estoque-lote');
if (campoLote) {
    campoLote.addEventListener('change', () => {
        carregarEstoque(false);
    });
}

// RELATORIOS GERENCIAIS

async function carregarFiltrosRelatorio() {
    try {
        // Busca espécies e lotes do banco através da API que você já tem
        const especies = await window.api.invoke('get-especies');
        const lotes = await window.api.invoke('get-lotes');

        const selectEspecie = document.getElementById('rel-especie');
        const selectLote = document.getElementById('rel-lote');

        // Popular Espécies
        selectEspecie.innerHTML = '<option value="todas">Todas as Espécies</option>';
        especies.forEach(esp => {
            selectEspecie.innerHTML += `<option value="${esp.id}">${esp.nome}</option>`;
        });

        // Popular Lotes
        selectLote.innerHTML = '<option value="todos">Todos os Lotes</option>';
        lotes.forEach(lote => {
            selectLote.innerHTML += `<option value="${lote.id}">${lote.numero}</option>`;
        });

    } catch (err) {
        console.error("Erro ao carregar filtros:", err);
    }
}

//OUVINTE PARA QUANDO SELECIONAR TIPO DE RELATÓRIO INVENTÁRIO
// Adicione isso dentro da sua função de inicialização ou no escopo global do renderer.js
document.getElementById('rel-tipo').addEventListener('change', function () {
    const dataInicio = document.getElementById('rel-data-inicio');
    const dataFim = document.getElementById('rel-data-fim');

    if (this.value === 'estoque') {
        dataInicio.value = "";
        dataFim.value = "";
        dataInicio.disabled = true;
        dataFim.disabled = true;
        dataInicio.style.backgroundColor = "#f1f5f9"; // Cor de fundo cinza
        dataFim.style.backgroundColor = "#f1f5f9";
    } else {
        dataInicio.disabled = false;
        dataFim.disabled = false;
        dataInicio.style.backgroundColor = "";
        dataFim.style.backgroundColor = "";
    }
});

let offsetRelatorio = 0;
let carregandoRelatorio = false;

async function gerarPreviaRelatorio(resetarPaginacao = true) {
    if (carregandoRelatorio) return;

    const tipoRel = document.getElementById('rel-tipo').value;
    const tbody = document.getElementById('rel-tabela-corpo');
    const btnMais = document.getElementById('btn-rel-carregar-mais');
    const containerResumos = document.getElementById('container-resumos');

    // 1. Captura os filtros
    const filtros = {
        tipo: tipoRel,
        dataInicio: document.getElementById('rel-data-inicio').value,
        dataFim: document.getElementById('rel-data-fim').value,
        especieId: document.getElementById('rel-especie').value,
        loteId: document.getElementById('rel-lote').value,
        limite: 50,
        pular: resetarPaginacao ? 0 : offsetRelatorio
    };

    // 2. Validação de Datas para relatórios que não são Inventário Total
    if (tipoRel !== 'estoque') {
        if ((filtros.dataInicio && !filtros.dataFim) || (!filtros.dataInicio && filtros.dataFim)) {
            Swal.fire('Atenção', 'Para relatórios históricos, preencha ambas as datas.', 'warning');
            return;
        }
    }

    try {
        carregandoRelatorio = true;

        // Feedback visual no botão (Padrão Estoque Geral)
        if (btnMais) {
            btnMais.disabled = true;
            btnMais.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Processando...';
            if (window.lucide) lucide.createIcons();
        }

        if (resetarPaginacao) {
            offsetRelatorio = 0;
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">Buscando dados...</td></tr>';
            if (containerResumos) containerResumos.innerHTML = '';
            
            // BUSCA RESUMOS (Calcula totais de todas as toras para os cards de espécie/lote)
            const resumoGeral = await window.api.invoke('get-resumo-gerencial', filtros);
            renderizarResumosDescritivos(resumoGeral);
            
            tbody.innerHTML = ''; // Limpa para carregar a tabela
        }

        // BUSCA TORAS PAGINADAS (Apenas 50 por vez)
        const toras = await window.api.invoke('buscar-dados-relatorio-paginado', filtros);

        if (toras.length === 0 && offsetRelatorio === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #94a3b8;">Nenhum registro encontrado para este filtro.</td></tr>`;
            if (btnMais) btnMais.style.display = 'none';
            return;
        }

        // 3. Renderiza as linhas na tabela (usando append para "Carregar mais")
        renderizarLinhasTabelaRelatorio(toras, !resetarPaginacao);

        // 4. Atualiza o offset e o estado do botão
        offsetRelatorio += toras.length;
        
        if (btnMais) {
            btnMais.disabled = false;
            // Se vieram menos que 50, significa que acabou o banco
            btnMais.style.display = toras.length < 50 ? 'none' : 'block';
            btnMais.innerHTML = '<i data-lucide="refresh-cw"></i> Carregar mais registros...';
            if (window.lucide) lucide.createIcons();
        }

    } catch (err) {
        console.error("Erro ao gerar relatório:", err);
        Swal.fire('Erro', 'Ocorreu um problema ao processar o relatório.', 'error');
    } finally {
        carregandoRelatorio = false;
    }
}

// Função auxiliar para montar o HTML das linhas
function renderizarLinhasTabelaRelatorio(dados, append = false) {
    const tbody = document.getElementById('rel-tabela-corpo');
    
    const html = dados.map(t => {
        const vol = Number(t.volume);
        const statusTag = t.status === 'serrada' ? '<b style="color:#ef4444">[S]</b>' : '<b style="color:#22c55e">[P]</b>';
        const dataEntrada = new Date(t.data_entrada).toLocaleDateString('pt-BR');
        const dataSaida = t.data_saida ? new Date(t.data_saida).toLocaleDateString('pt-BR') : '---';
        
        return `
            <tr>
                <td><span class="badge-numero">${t.codigo}</span></td> 
                <td>${t.especie_nome}</td>
                <td><span class="badge-lote">${t.lote_numero || '---'}</span></td>
                <td style="text-align: center;">R: ${t.rodo} | C: ${Number(t.comprimento).toFixed(2)}</td>
                <td style="text-align: center;"><b>${vol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</b></td>
                <td style="text-align: center;">${dataEntrada}</td>
                <td style="text-align: center; color: #ef4444;">${dataSaida}</td>
                <td style="text-align: right;"><small>${statusTag}</small></td>
            </tr>`;
    }).join('');

    if (append) {
        tbody.insertAdjacentHTML('beforeend', html);
    } else {
        tbody.innerHTML = html;
    }
}
// Apenas para desenhar as linhas (tr)
function renderizarLinhasTabelaRelatorio(dados, append = false) {
    const tbody = document.getElementById('rel-tabela-corpo');
    
    const html = dados.map(t => {
        const vol = Number(t.volume);
        const statusTag = t.status === 'serrada' ? '<b style="color:#ef4444">[S]</b>' : '<b style="color:#22c55e">[P]</b>';
        
        return `
            <tr>
                <td><span class="badge-numero">${t.codigo}</span></td> 
                <td>${t.especie_nome}</td>
                <td><span class="badge-lote">${t.lote_numero || '---'}</span></td>
                <td style="text-align: center;">R: ${t.rodo} | C: ${Number(t.comprimento).toFixed(2)}</td>
                <td style="text-align: center;"><b>${vol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</b></td>
                <td style="text-align: center;">${new Date(t.data_entrada).toLocaleDateString('pt-BR')}</td>
                <td style="text-align: center; color: #ef4444;">${t.data_saida ? new Date(t.data_saida).toLocaleDateString('pt-BR') : '---'}</td>
                <td style="text-align: right;"><small>${statusTag}</small></td>
            </tr>`;
    }).join('');

    if (append) {
        tbody.insertAdjacentHTML('beforeend', html);
    } else {
        tbody.innerHTML = html;
    }
}

// Para preencher os cards de resumo de todas as 1.400 toras
function renderizarResumosDescritivos(resumo) {
    const containerResumos = document.getElementById('container-resumos');
    if (!containerResumos) return;

    // Atualiza os indicadores de topo (Volume e Quantidade Totais)
    document.getElementById('rel-total-vol').innerText = `${resumo.volTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`;
    document.getElementById('rel-total-qtd').innerText = resumo.qtdTotalGeral;

    const criarFraseHtml = (qtd, vol, tipo) => {
        if (qtd === 0) return "";
        const termoTora = qtd === 1 ? "tora" : "toras";
        const termoAcao = tipo === 'patio' ? "no pátio" : "serrada";
        const dotColor = tipo === 'patio' ? "#22c55e" : "#ef4444";
        return `
            <div class="resumo-frase" style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="height: 8px; width: 8px; background: ${dotColor}; border-radius: 50%; display: inline-block;"></span>
                <span style="font-size: 0.9rem; color: #475569;">
                    ${qtd} ${termoTora} ${termoAcao} totalizando: <b>${vol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</b>
                </span>
            </div>`;
    };

    let htmlResumo = `
    <div class="resumo-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 30px;">
        <div class="resumo-card" style="background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; border-left: 6px solid #95afc0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <h4 class="resumo-titulo" style="color: #95afc0; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Totais por Espécie</h4>
            ${Object.entries(resumo.resumoEspecies).map(([nome, d]) => `
                <div class="resumo-item" style="margin-bottom: 16px;">
                    <strong style="color: #1e293b; display: block; margin-bottom: 4px;">${nome}</strong>
                    ${criarFraseHtml(d.pQtd, d.pVol, 'patio')}
                    ${criarFraseHtml(d.sQtd, d.sVol, 'serrada')}
                </div>
            `).join('')}
        </div>

        <div class="resumo-card" style="background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; border-left: 6px solid #95afc0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <h4 class="resumo-titulo" style="color: #95afc0; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Totais por Lote</h4>
            ${Object.entries(resumo.resumoLotes).map(([lote, d]) => `
                <div class="resumo-item" style="margin-bottom: 16px;">
                    <strong style="color: #1e293b; display: block; margin-bottom: 4px;">Lote ${lote}</strong>
                    ${criarFraseHtml(d.pQtd, d.pVol, 'patio')}
                    ${criarFraseHtml(d.sQtd, d.sVol, 'serrada')}
                </div>
            `).join('')}
        </div>
    </div>`;

    containerResumos.innerHTML = htmlResumo;
}

function atualizarIndicadoresRelatorio(dados) {
    const totalVol = dados.reduce((acc, t) => acc + t.volume, 0);

    document.getElementById('rel-total-vol').innerText = totalVol.toLocaleString('pt-BR', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }) + ' m³';

    document.getElementById('rel-total-qtd').innerText = `${dados.length} toras encontradas`;
}

async function exportarRelatorioPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    const filtros = {
        tipo: document.getElementById('rel-tipo').value,
        dataInicio: document.getElementById('rel-data-inicio').value,
        dataFim: document.getElementById('rel-data-fim').value,
        especieId: document.getElementById('rel-especie').value,
        loteId: document.getElementById('rel-lote').value
    };

    try {
        Swal.fire({ title: 'Gerando PDF...', didOpen: () => { Swal.showLoading(); } });

        const dados = await window.api.invoke('buscar-dados-relatorio', filtros);

        if (!dados || dados.length === 0) {
            Swal.fire('Aviso', 'Não há dados para exportar.', 'warning');
            return;
        }

        // --- CABEÇALHO ---
        doc.setFont("helvetica", "bold"); doc.setFontSize(16);
        doc.text("ToraControl - Relatório Gerencial Detalhado", 14, 15);
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 22);

        // --- CÁLCULO DOS RESUMOS (IGUAL AO QUE TEMOS NO RENDERER) ---
        const resumoEspecies = {};
        const resumoLotes = {};
        let volTotalGeral = 0;

        const linhas = dados.map(t => {
            const vol = Number(t.volume);
            volTotalGeral += vol;
            const esp = t.especie_nome;
            const lote = t.lote_numero || 'S/L';

            // Agrupamento para o Resumo do PDF
            if (!resumoEspecies[esp]) resumoEspecies[esp] = { pQtd: 0, pVol: 0, sQtd: 0, sVol: 0 };
            if (!resumoLotes[lote]) resumoLotes[lote] = { pQtd: 0, pVol: 0, sQtd: 0, sVol: 0 };

            if (t.status === 'serrada') {
                resumoEspecies[esp].sQtd++; resumoEspecies[esp].sVol += vol;
                resumoLotes[lote].sQtd++; resumoLotes[lote].sVol += vol;
            } else {
                resumoEspecies[esp].pQtd++; resumoEspecies[esp].pVol += vol;
                resumoLotes[lote].pQtd++; resumoLotes[lote].pVol += vol;
            }

            return [
                t.codigo, esp, lote, t.rodo, Number(t.comprimento).toFixed(2),
                t.desconto_1 || 0, t.desconto_2 || 0,
                vol.toFixed(3), new Date(t.data_entrada).toLocaleDateString('pt-BR'),
                t.data_saida ? new Date(t.data_saida).toLocaleDateString('pt-BR') : '---'
            ];
        });

        // --- TABELA PRINCIPAL ---
        doc.autoTable({
            startY: 28,
            head: [["Número", "Espécie", "Lote", "Rodo", "Comp", "D1", "D2", "Vol (m³)", "Entrada", "Saída"]],
            body: linhas,
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105], fontSize: 7, halign: 'center' },
            styles: { fontSize: 7, cellPadding: 1 },
            columnStyles: { 0: { fontStyle: 'bold' }, 7: { fontStyle: 'bold', halign: 'right' } }
        });

        // --- SEÇÃO DE RESUMOS NO FINAL ---
        let currentY = doc.lastAutoTable.finalY + 15;

        // Função para evitar que o resumo saia da página
        const checkPage = (y) => { if (y > 185) { doc.addPage(); return 20; } return y; };

        // 1. Resumo por Espécie
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text("RESUMO POR ESPÉCIE", 14, currentY);
        currentY += 7;
        doc.setFontSize(8); doc.setFont("helvetica", "normal");

        Object.entries(resumoEspecies).forEach(([nome, d]) => {
            currentY = checkPage(currentY);
            let txt = `${nome}: `;
            if (d.pQtd > 0) txt += `${d.pQtd} toras no pátio (${d.pVol.toFixed(3)} m³) | `;
            if (d.sQtd > 0) txt += `${d.sQtd} toras serradas (${d.sVol.toFixed(3)} m³)`;
            doc.text(txt, 18, currentY);
            currentY += 5;
        });

        // 2. Resumo por Lote
        currentY += 5;
        currentY = checkPage(currentY);
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text("RESUMO POR LOTE", 14, currentY);
        currentY += 7;
        doc.setFontSize(8); doc.setFont("helvetica", "normal");

        Object.entries(resumoLotes).forEach(([lote, d]) => {
            currentY = checkPage(currentY);
            let txt = `Lote ${lote}: `;
            if (d.pQtd > 0) txt += `${d.pQtd} toras no pátio (${d.pVol.toFixed(3)} m³) | `;
            if (d.sQtd > 0) txt += `${d.sQtd} toras serradas (${d.sVol.toFixed(3)} m³)`;
            doc.text(txt, 18, currentY);
            currentY += 5;
        });

        // Total Geral em destaque
        currentY += 5;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text(`VOLUME TOTAL GERAL: ${volTotalGeral.toFixed(3)} m³`, 14, currentY);

        doc.save(`Relatorio_Toras_${new Date().getTime()}.pdf`);
        Swal.close();

    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao gerar PDF.', 'error');
    }
}

async function exportarRelatorioExcel() {
    const workbook = new ExcelJS.Workbook();
    const sheetDetalhes = workbook.addWorksheet('Listagem Detalhada');

    // 1. Configuração de Colunas da Planilha Principal
    sheetDetalhes.columns = [
        { header: 'Número', key: 'numero', width: 12 },
        { header: 'Espécie', key: 'especie', width: 25 },
        { header: 'Lote', key: 'lote', width: 15 },
        { header: 'Rodo (cm)', key: 'rodo', width: 10 },
        { header: 'Comp (m)', key: 'comp', width: 10 },
        { header: 'Desc 1', key: 'd1', width: 8 },
        { header: 'Desc 2', key: 'd2', width: 8 },
        { header: 'Volume (m³)', key: 'vol', width: 15 },
        { header: 'Entrada', key: 'entrada', width: 15 },
        { header: 'Saída', key: 'saida', width: 15 }
    ];

    // Estilização do Cabeçalho (Padrão Cinza Escuro)
    sheetDetalhes.getRow(1).eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    });

    const filtros = {
        tipo: document.getElementById('rel-tipo').value,
        dataInicio: document.getElementById('rel-data-inicio').value,
        dataFim: document.getElementById('rel-data-fim').value,
        especieId: document.getElementById('rel-especie').value,
        loteId: document.getElementById('rel-lote').value
    };

    try {
        Swal.fire({ title: 'Gerando Excel...', didOpen: () => { Swal.showLoading(); } });

        // Busca TODOS os dados (ignorando paginação da tela)
        const dados = await window.api.invoke('buscar-dados-relatorio', filtros);
        
        const resumoEspecies = {}; 
        const resumoLotes = {};
        let volTotalGeral = 0;

        dados.forEach(t => {
            const vol = Number(t.volume);
            volTotalGeral += vol;
            const esp = t.especie_nome;
            const lote = t.lote_numero || 'S/L';

            // Adiciona Linha na Planilha Detalhada
            sheetDetalhes.addRow({
                numero: t.codigo, especie: esp, lote: lote,
                rodo: Number(t.rodo), comp: Number(t.comprimento),
                d1: Number(t.desconto_1 || 0), d2: Number(t.desconto_2 || 0),
                vol: vol,
                entrada: new Date(t.data_entrada).toLocaleDateString('pt-BR'),
                saida: t.data_saida ? new Date(t.data_saida).toLocaleDateString('pt-BR') : '---'
            });

            // Lógica de Acúmulo para o Resumo
            if (!resumoEspecies[esp]) resumoEspecies[esp] = { pQtd: 0, pVol: 0, sQtd: 0, sVol: 0 };
            if (!resumoLotes[lote]) resumoLotes[lote] = { pQtd: 0, pVol: 0, sQtd: 0, sVol: 0 };

            if (t.status === 'serrada') {
                resumoEspecies[esp].sQtd++; resumoEspecies[esp].sVol += vol;
                resumoLotes[lote].sQtd++; resumoLotes[lote].sVol += vol;
            } else {
                resumoEspecies[esp].pQtd++; resumoEspecies[esp].pVol += vol;
                resumoLotes[lote].pQtd++; resumoLotes[lote].pVol += vol;
            }
        });

        // --- ABA DE RESUMOS ---
        const sheetResumo = workbook.addWorksheet('Resumos Gerenciais');
        sheetResumo.getColumn(1).width = 80;

        const addSecao = (titulo, obj, labelPrefix = "") => {
            sheetResumo.addRow([titulo]).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
            sheetResumo.addRow([]);
            Object.entries(obj).forEach(([key, d]) => {
                sheetResumo.addRow([`${labelPrefix}${key}`]).font = { bold: true };
                if (d.pQtd > 0) sheetResumo.addRow([`  • ${d.pQtd} toras no pátio: ${d.pVol.toFixed(3).replace('.', ',')} m³`]);
                if (d.sQtd > 0) sheetResumo.addRow([`  • ${d.sQtd} toras serradas: ${d.sVol.toFixed(3).replace('.', ',')} m³`]);
                sheetResumo.addRow([]);
            });
        };

        addSecao("RESUMO POR ESPÉCIE", resumoEspecies);
        addSecao("RESUMO POR LOTE", resumoLotes, "Lote ");
        
        sheetResumo.addRow(["VOLUME TOTAL GERAL: " + volTotalGeral.toFixed(3).replace('.', ',') + " m³"]).font = { bold: true, size: 12 };

        // Formatação de Números na aba principal
        sheetDetalhes.getColumn('H').numFmt = '#,##0.000';

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `Relatorio_Geral_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();

        Swal.fire({ icon: 'success', title: 'Excel Gerado!', showConfirmButton: false, timer: 1500 });

    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao gerar planilha Excel.', 'error');
    }
}

function limparFiltrosRelatorio() {
    // 1. Resetar os Selects (Filtros)
    // Certifique-se de que os IDs batem com o seu HTML
    if (document.getElementById('rel-especie')) document.getElementById('rel-especie').selectedIndex = 0;
    if (document.getElementById('rel-lote')) document.getElementById('rel-lote').selectedIndex = 0;
    if (document.getElementById('rel-tipo')) document.getElementById('rel-tipo').selectedIndex = 0;

    // 2. Limpar a Tabela (Voltar ao estado inicial)
    const tbody = document.getElementById('rel-tabela-corpo');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">Aplique os filtros para visualizar os dados.</td></tr>`;
    }

    // 3. Resetar os Totais (Cards Superiores)
    if (document.getElementById('rel-total-vol')) document.getElementById('rel-total-vol').innerText = '0,000 m³';
    if (document.getElementById('rel-total-qtd')) document.getElementById('rel-total-qtd').innerText = '0';

    // 4. Limpar os Resumos por Espécie e Lote (Cards Inferiores)
    const containerResumos = document.getElementById('container-resumos');
    if (containerResumos) {
        containerResumos.innerHTML = '';
    }
}

//LOGS DOS SISTEMA
// --- GESTÃO DE LOGS ---

// Função chamada automaticamente ao abrir a tela ou iniciar o app
// --- GESTÃO DE LOGS (Carregamento Inteligente) ---

async function carregarLogs() {
    const vLogs = document.getElementById('v-logs');
    const tbody = document.getElementById('lista-logs');
    if (!tbody || !vLogs) return;

    // Localização dos filtros
    const inputInicio = document.getElementById('input-filtro-data-inicio-logs');
    const inputFim = document.getElementById('input-filtro-data-fim-logs');
    const selectAcao = document.getElementById('log-filtro-acao');

    const valorInicio = inputInicio ? inputInicio.value : '';
    const valorFim = inputFim ? inputFim.value : '';
    const valorAcao = selectAcao ? selectAcao.value : 'todos';

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Filtrando logs...</td></tr>';

    try {
        const resposta = await window.api.invoke('listar-logs', {
            acao: valorAcao,
            dataInicio: valorInicio,
            dataFim: valorFim,
            limiteInicial: (!valorInicio && !valorFim && valorAcao === 'todos') ? 50 : 500
        });

        if (!resposta.success) throw new Error(resposta.error);

        const logs = resposta.data;
        tbody.innerHTML = '';

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Nenhum registro encontrado.</td></tr>';
            return;
        }

        let html = '';
        logs.forEach(log => {
            // 1. Definição das Badges (Incluindo EXCLUSÃO)
            let badgeClass = "badge-log";
            const acaoUpper = log.acao.toUpperCase();

            if (acaoUpper.includes('ENTRADA')) {
                badgeClass += " badge-entrada";
            } else if (acaoUpper.includes('EDIÇÃO')) {
                badgeClass += " badge-edicao";
            } else if (acaoUpper.includes('BAIXA') || acaoUpper.includes('ROMANEIO')) {
                badgeClass += " badge-baixa";
            } else if (acaoUpper.includes('LOTE')) {
                badgeClass += " badge-lote";
            } else if (acaoUpper.includes('EXCLUSÃO') || acaoUpper.includes('EXCLUSAO')) {
                badgeClass += " badge-exclusao";
            } else {
                badgeClass += " badge-padrao";
            }

            // 2. Formatação Segura de Data/Hora
            let dataExibicao = "---";
            if (log.data_hora) {
                try {
                    const partes = log.data_hora.split(' ');
                    const dataBr = partes[0].split('-').reverse().join('/');
                    const horaBr = partes[1] ? partes[1].substring(0, 5) : '';
                    dataExibicao = `${dataBr} ${horaBr}`;
                } catch (e) {
                    dataExibicao = log.data_hora; // Fallback caso o split falhe
                }
            }

            html += `
                <tr>
                    <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #64748b; white-space: nowrap;">
                        <i data-lucide="calendar" style="width:12px; height:12px; display:inline; margin-right:4px;"></i>${dataExibicao}
                    </td>
                    <td style="font-weight: 500; color: #334155;">${log.usuario || 'Sistema'}</td>
                    <td><span class="${badgeClass}">${acaoUpper}</span></td>
                    <td style="color: #475569; font-size: 0.85rem; line-height: 1.4;">${log.descricao}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error("Erro na view de logs:", err);
        tbody.innerHTML = `<tr><td colspan="4" style="color:#ef4444; text-align:center; padding:20px;">Erro ao carregar: ${err.message}</td></tr>`;
    }
}

// Função auxiliar para o botão "Limpar Filtros" (refresh-cw)
function limparFiltrosLogs() {
    document.getElementById('input-filtro-data-inicio-logs').value = '';
    document.getElementById('input-filtro-data-fim-logs').value = '';
    document.getElementById('log-filtro-acao').value = 'todos';
    carregarLogs();
}

function limparFiltrosLogs() {
    const vLogs = document.getElementById('v-logs');
    if (!vLogs) return;

    // Localiza e limpa os campos especificamente na tela de logs
    const inputInicio = vLogs.querySelector('input[type="date"]:first-of-type');
    const inputFim = vLogs.querySelector('input[type="date"]:last-of-type');
    const selectAcao = vLogs.querySelector('select');

    if (inputInicio) inputInicio.value = '';
    if (inputFim) inputFim.value = '';
    if (selectAcao) selectAcao.value = 'todos';

    // Recarrega a lista original (os últimos 20 registros)
    carregarLogs();
}

async function exportarLogsPDF() {
    const tbody = document.getElementById('lista-logs');

    // 1. Verificação: Se a tabela estiver vazia ou com mensagem de "nenhum registro"
    if (!tbody || tbody.rows.length === 0 || tbody.innerText.includes('Nenhum')) {
        Swal.fire({
            icon: 'info',
            title: 'Sem dados',
            text: 'Não há registros na tabela para exportar. Tente realizar uma busca primeiro.',
            confirmButtonColor: '#0f172a'
        });
        return;
    }

    // 2. Captura de filtros para o cabeçalho do documento
    const dataInicio = document.getElementById('input-filtro-data-inicio-logs')?.value || '';
    const dataFim = document.getElementById('input-filtro-data-fim-logs')?.value || '';
    const periodo = (dataInicio && dataFim)
        ? `Período: ${dataInicio.split('-').reverse().join('/')} até ${dataFim.split('-').reverse().join('/')}`
        : 'Relatório Geral de Atividades';

    // 3. Montagem do HTML para o PDF (Estilizado)
    const htmlParaPDF = `
        <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; }
                    .header { border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; padding-bottom: 10px; }
                    h1 { margin: 0; font-size: 22px; color: #0f172a; }
                    .periodo { color: #64748b; font-size: 14px; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #f8fafc; color: #475569; text-align: left; padding: 12px; border: 1px solid #cbd5e1; font-size: 12px; text-transform: uppercase; }
                    td { padding: 10px; border: 1px solid #e2e8f0; font-size: 11px; vertical-align: top; }
                    .badge { font-weight: bold; font-size: 10px; }
                    .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório de Auditoria e Logs</h1>
                    <div class="periodo">${periodo}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 20%">Data/Hora</th>
                            <th style="width: 15%">Usuário</th>
                            <th style="width: 15%">Ação</th>
                            <th style="width: 50%">Descrição da Atividade (Ref: Número)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tbody.innerHTML}
                    </tbody>
                </table>
                <div class="footer">
                    Documento gerado pelo Sistema de Controle de Toras em: ${new Date().toLocaleString('pt-BR')}
                </div>
            </body>
        </html>
    `;

    try {
        // 4. Feedback visual de processamento
        Swal.fire({
            title: 'Gerando Relatório',
            text: 'Estamos preparando seu arquivo PDF...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // 5. Envia para o Main.js processar a gravação do arquivo
        const resultado = await window.api.invoke('gerar-pdf-logs', htmlParaPDF);

        if (resultado.success) {
            Swal.fire({
                icon: 'success',
                title: 'Exportação Concluída',
                text: 'O PDF foi salvo com sucesso na sua pasta Documentos.',
                confirmButtonColor: '#0f172a',
                confirmButtonText: 'Ótimo'
            });
        } else {
            throw new Error(resultado.error || 'Erro desconhecido ao gravar PDF.');
        }

    } catch (err) {
        console.error("Erro na exportação:", err);
        Swal.fire({
            icon: 'error',
            title: 'Falha na Exportação',
            text: 'Ocorreu um erro ao tentar salvar o arquivo: ' + err.message,
            confirmButtonColor: '#ef4444'
        });
    }
}
async function atualizarDashboard() {
    try {
        const dados = await window.api.invoke('get-dashboard-data');

        if (!dados) return;

        // Atualização dos Cards Superiores
        const elPecas = document.getElementById('dash-total-pecas');
        const elVolume = document.getElementById('dash-total-volume');
        const elAcoes = document.getElementById('dash-acoes-hoje');

        if (elPecas) elPecas.innerText = dados.totalPecas;

        if (elVolume) {
            elVolume.innerText = Number(dados.totalVolume || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3
            });
        }

        if (elAcoes) elAcoes.innerText = dados.logsHoje;

        // Preenchimento da Tabela com Badge de Status (Alinhado com seu print)
        const tbody = document.getElementById('dash-lista-recente');
        if (tbody) {
            if (dados.ultimasToras.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: #94a3b8;">Nenhum registro recente.</td></tr>`;
            } else {
                tbody.innerHTML = dados.ultimasToras.map(tora => {
                    const dataFormatada = tora.data_entrada
                        ? new Date(tora.data_entrada).toLocaleDateString('pt-BR')
                        : '---';

                    // Lógica do Badge: Verde para pátio [P], Vermelho para outros [S]
                    const isPatio = tora.status === 'pátio';
                    const badgeColor = isPatio ? '#10b981' : '#ef4444';
                    const badgeText = isPatio ? '[P]' : '[S]';

                    return `
                        <tr>
                        <td style="font-weight: 600; color: #0f172a;">${tora.codigo}</td>
                        <td>${tora.especie || 'Não informada'}</td>
                        <td style="font-weight: 600;">${Number(tora.volume || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                        <td class="text-right" style="color: #64748b; font-size: 0.85rem;"> <span style="color: ${badgeColor}; font-weight: bold; margin-right: 5px;">${badgeText}</span>
                            ${dataFormatada}
                        </td>
                         </tr>
                    `;
                }).join('');
            }
        }
        const listaLotes = document.getElementById('dash-lista-lotes');
        if (listaLotes && dados.resumoLotes) {
            // Pegamos o volume do maior lote para servir de base 100% para a barrinha
            const maxVolume = Math.max(...dados.resumoLotes.map(l => l.volumeTotal), 1);

            listaLotes.innerHTML = dados.resumoLotes.map(lote => {
                const percentual = (lote.volumeTotal / maxVolume) * 100;
                return `
            <div class="lote-item">
                <div class="lote-info">
                    <span style="font-weight: 600;">Lote: ${lote.lote}</span>
                    <span style="color: #64748b;">${Number(lote.volumeTotal).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</span>
                </div>
                <div class="lote-bar-bg">
                    <div class="lote-bar-fill" style="width: ${percentual}%"></div>
                </div>
                <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">
                    ${lote.totalToras} Toras
                </div>
            </div>
        `;
            }).join('');
        }

        const listaEspecies = document.getElementById('dash-ranking-especies');
        if (listaEspecies && dados.rankingEspecies) {
            const maxVol = Math.max(...dados.rankingEspecies.map(e => e.volumeTotal), 1);
            listaEspecies.innerHTML = dados.rankingEspecies.map(esp => {
                const perc = (esp.volumeTotal / maxVol) * 100;
                return `
            <div class="lote-item">
                <div class="lote-info">
                    <span style="font-weight: 600;">${esp.especie}</span>
                    <span>${Number(esp.volumeTotal).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</span>
                </div>
                <div class="lote-bar-bg"><div class="lote-bar-fill" style="width: ${perc}%; background: #10b981;"></div></div>
            </div>`;
            }).join('');
        }

        // --- LOG DE ATIVIDADES ---
        const listaLogs = document.getElementById('dash-logs-recentes');
        if (listaLogs && dados.logsRecentes) {
            listaLogs.innerHTML = dados.logsRecentes.map(log => {
                const hora = log.data_hora.split(' ')[1].substring(0, 5); // Pega apenas HH:MM
                return `
            <div style="font-size: 0.8rem; padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #475569;">
                <strong style="color: #6366f1;">${hora}</strong> - ${log.descricao}
            </div>`;
            }).join('');
        }

        // Renderiza os ícones do Lucide
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error("Erro na atualização visual do Dashboard:", err);
    }
}
async function buscarNumeroGlobal() {
    const inputBusca = document.getElementById('busca-global-numero');
    if (!inputBusca) return;

    const numeroOriginal = inputBusca.value.trim();
    if (!numeroOriginal) {
        inputBusca.style.borderColor = '#ef4444';
        setTimeout(() => inputBusca.style.borderColor = '#e2e8f0', 2000);
        return;
    }

    try {
        const resposta = await window.api.invoke('buscar-tora-por-numero', numeroOriginal);

        if (!resposta.success || !resposta.data) {
            Swal.fire({
                title: 'Não encontrado',
                text: `O Número ${numeroOriginal} não foi localizado.`,
                icon: 'info',
                confirmButtonColor: '#6366f1'
            });
            return;
        }

        const t = resposta.data;

        // --- FORMATAÇÕES DE VALORES ---
        const formatarComprimento = (val) => {
            let n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
            return (n || 0).toFixed(2).replace('.', ',');
        };

        const formatarVolume = (val) => {
            let n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
            return (n || 0).toFixed(3).replace('.', ',');
        };

        // --- LÓGICA DE DATA (LIMPEZA DE TIMESTAMP) ---
        const isPatio = ['pátio', 'estoque', 'patio'].includes(t.status?.toLowerCase());
        const rawData = isPatio ? t.data_entrada : t.data_saida;
        let dataExibicao = '---';

        if (rawData) {
            // Remove o horário (HH:MM:SS) e inverte para DD/MM/AAAA
            dataExibicao = rawData.substring(0, 10).split('-').reverse().join('/');
        }

        // --- LÓGICA DO OCO (FORMATO 50x50) ---
        let htmlOco = "";
        const oco1 = parseInt(t.desconto_1) || 0;
        const oco2 = parseInt(t.desconto_2) || 0;

        if (oco1 > 0 || oco2 > 0) {
            const volDesc = formatarVolume(t.total_desconto);
            htmlOco = `
                <div style="margin-top: 8px; color: #b91c1c; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
                    <p style="margin-bottom: 5px;"><b>Oco:</b> ${oco1}x${oco2}</p>
                    <p style="margin-bottom: 5px; font-size: 0.8rem; opacity: 0.8;"><b>Desc. Volume:</b> ${volDesc} m³</p>
                </div>
            `;
        }

        const statusLabel = isPatio
            ? '<span style="color: #10b981; font-weight: bold;">🟢 NO PÁTIO</span>'
            : '<span style="color: #ef4444; font-weight: bold;">🔴 SERRADA</span>';

        // --- EXIBIÇÃO DO MODAL ---
        Swal.fire({
            title: `Detalhes do Número: ${t.codigo}`,
            width: '600px',
            html: `
                <div style="text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 0.9rem; border-top: 1px solid #eee; padding-top: 15px;">
                    <div>
                        <p style="margin-bottom: 8px;"><b>Número:</b> ${t.codigo}</p>
                        <p style="margin-bottom: 8px;"><b>Espécie:</b> ${t.especie_nome || '---'}</p>
                        <p style="margin-bottom: 8px;"><b>Lote:</b> ${t.numero_lote || 'N/A'}</p>
                        <p style="margin-bottom: 8px;"><b>Status:</b> ${statusLabel}</p>
                        <p style="margin-bottom: 8px;"><b>Data ${isPatio ? 'Entrada' : 'Saída'}:</b> ${dataExibicao}</p>
                    </div>

                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <p style="margin-bottom: 5px;"><b>Rodo:</b> ${t.rodo || 0}</p>
                        <p style="margin-bottom: 5px;"><b>Comprimento:</b> ${formatarComprimento(t.comprimento)} m</p>
                        
                        ${htmlOco}

                        <hr style="margin: 8px 0; border: 0; border-top: 1px solid #cbd5e1;">
                        <p style="font-size: 1.2rem; color: #1e40af; font-weight: bold; margin: 0;">Vol. Final: ${formatarVolume(t.volume)} m³</p>
                    </div>
                </div>
            `,
            showCancelButton: !isPatio, // Só mostra botão de estorno se a tora estiver serrada
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#6366f1',
            cancelButtonText: 'Reverter Baixa',
            cancelButtonColor: '#f59e0b'
        }).then((result) => {
            if (result.dismiss === Swal.DismissReason.cancel) {
                // Aqui você chamaria sua função de estorno
                reverterBaixaTora(t.id, t.codigo);
            }
        });

        inputBusca.value = "";
        inputBusca.blur();

    } catch (err) {
        console.error("Erro na busca global:", err);
    }
}

async function reverterBaixaTora(id, codigo) {
    // 1. Confirmação de segurança
    const { value: confirmar } = await Swal.fire({
        title: 'Confirmar Estorno?',
        text: `Deseja realmente retornar o Número ${codigo} para o estoque (Pátio)?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Sim, Reverter',
        cancelButtonText: 'Cancelar'
    });

    if (confirmar) {
        try {
            // 2. Chama o banco para alterar o status
            const resultado = await window.api.invoke('reverter-status-tora', id, codigo);

            if (resultado.success) {
                Swal.fire({
                    title: 'Sucesso!',
                    text: `O Número ${codigo} está de volta ao pátio.`,
                    icon: 'success',
                    confirmButtonColor: '#6366f1'
                });
                atualizarDashboard();
                // Opcional: Recarregar tabelas se estiver em uma tela de listagem
                if (typeof carregarToras === 'function') carregarToras();

            } else {
                Swal.fire('Erro', 'Não foi possível reverter: ' + resultado.error, 'error');
            }
        } catch (err) {
            console.error("Erro ao estornar:", err);
            Swal.fire('Erro', 'Falha na comunicação com o banco.', 'error');
        }
    }
}

//dark mode
// ISSO DEVE FICAR NO RENDERER.JS
const toggleDarkMode = document.querySelector('.dark-mode-toggle');

if (toggleDarkMode) {
    // Aplica o tema salvo ao iniciar
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        updateToggleUI(true);
    }

    toggleDarkMode.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateToggleUI(isDark);
    });
}

function updateToggleUI(isDark) {
    const icon = document.querySelector('.dark-mode-toggle i');
    const span = document.querySelector('.dark-mode-toggle span');

    if (isDark) {
        if (icon) icon.setAttribute('data-lucide', 'sun');
        if (span) span.textContent = 'Modo Claro';
    } else {
        if (icon) icon.setAttribute('data-lucide', 'moon');
        if (span) span.textContent = 'Modo Escuro';
    }

    if (window.lucide) lucide.createIcons();
}

/**
 * Função Principal de Proteção
 * Verifica se a licença existe e se é válida para este hardware específico.
 */
function verificarProtecao() {
    // 1. Identifica o hardware único desta máquina
    const idHardware = machineIdSync();

    // 2. Define onde a licença deve estar salva (Pasta AppData/gestao_toras)
    const pastaLicenca = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share"), 'estoque-toras');
    const arquivoLicenca = path.join(pastaLicenca, 'license.dat');
    const MEU_SEGREDO = "TORAS2026";

    // 3. Verifica se o arquivo físico de licença existe
    if (!fs.existsSync(arquivoLicenca)) {
        console.warn("Licença não encontrada. Bloqueando acesso.");
        aplicarBloqueio(idHardware);
        return;
    }

    // 4. Se o arquivo existe, valida o conteúdo
    try {
        const chaveSalva = fs.readFileSync(arquivoLicenca, 'utf8').trim();
        // A regra: ID do PC + Segredo transformado em Base64
        const chaveValidaParaEstePC = btoa(idHardware + MEU_SEGREDO);

        if (chaveSalva === chaveValidaParaEstePC) {
            console.log("Sistema Autorizado.");
            liberarSistema();
        } else {
            console.error("Licença inválida ou copiada de outro PC.");
            aplicarBloqueio(idHardware);
        }
    } catch (err) {
        console.error("Erro na leitura da licença:", err);
        aplicarBloqueio(idHardware);
    }
}

/**
 * Esconde o sistema e mostra apenas a tela de ativação
 */
function aplicarBloqueio(id) {
    // 1. Esconde os elementos globais
    const sidebar = document.getElementById('sidebar');
    const mainHeader = document.querySelector('.main-header');

    if (sidebar) sidebar.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'none';

    // 2. Força a exibição da View de Ativação
    // Primeiro, removemos a classe 'active' de todas as outras views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    const viewAtivacao = document.getElementById('v-ativacao');
    if (viewAtivacao) {
        viewAtivacao.classList.add('active');
        viewAtivacao.style.display = 'block'; // Garante que o display não seja 'none'
    } else {
        console.error("ERRO: O elemento com ID 'v-ativacao' não foi encontrado no HTML.");
    }

    // 3. Preenche o ID da máquina para o cliente
    const inputID = document.getElementById('machine-id-display');
    if (inputID) inputID.value = id;
}

/**
 * Remove bloqueios e mostra o Dashboard
 */
function liberarSistema() {
    const sidebar = document.getElementById('sidebar');
    const mainHeader = document.querySelector('.main-header');
    const viewAtivacao = document.getElementById('v-ativacao');

    // 1. Mostra os elementos estruturais
    if (sidebar) sidebar.style.display = 'flex';
    if (mainHeader) mainHeader.style.display = 'flex';

    // 2. Esconde a tela de ativação
    if (viewAtivacao) {
        viewAtivacao.classList.remove('active');
        viewAtivacao.style.display = 'none';
    }

    // 3. Tenta mudar para a home de forma segura
    try {
        if (typeof mostrarView === "function") {
            mostrarView('v-home');
        } else {
            // Se a função ainda não existir, fazemos manualmente
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            const home = document.getElementById('v-home');
            if (home) home.classList.add('active');
        }
    } catch (e) {
        console.warn("Aviso: Falha ao trocar para v-home, mas sistema liberado.");
    }
}


// final do renderer.js
document.addEventListener('DOMContentLoaded', () => {
    // Outras inicializações...
    // 1. Primeiro rodamos a proteção
    verificarProtecao();

    // 2. Só rodamos o dashboard se não houver erro de licença
    // Vamos envolver em um try/catch para um erro não derrubar o outro
    try {
        if (typeof atualizarDashboard === "function") {
            atualizarDashboard();
        }
    } catch (err) {
        console.error("Erro ao carregar dados do dashboard:", err);
    }
    atualizarFiltroLotes();
    atualizarDashboard();
    lucide.createIcons();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const busca = document.getElementById('busca-global-numero');
        if (busca) busca.focus();
    }
});

function aplicarMascaraNumero(input) {
    let valor = input.value.trim();

    if (valor === "") return;

    // Remove qualquer caractere que não seja número
    valor = valor.replace(/\D/g, "");

    // Converte para número para remover zeros à esquerda desnecessários antes de reformatar
    let numeroLimpo = parseInt(valor, 10);

    if (isNaN(numeroLimpo)) {
        input.value = "";
        return;
    }

    // LÓGICA INTELIGENTE:
    // Se o número for menor que 1000, mantém o padrão visual de 3 dígitos (001, 010, 100).
    // Se for 1000 ou mais, ele apenas exibe o número real, sem limite de dígitos.
    if (numeroLimpo < 1000) {
        input.value = numeroLimpo.toString().padStart(3, '0');
    } else {
        input.value = numeroLimpo.toString();
    }
}
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.querySelector('.main-wrapper'); // Ajuste o nome da classe aqui
    const icon = document.getElementById('icon-toggle');
    
    // Alterna as classes de largura
    sidebar.classList.toggle('minimized');
    if (mainWrapper) {
        mainWrapper.classList.toggle('expanded');
    }
    
    // Atualiza o ícone da seta e re-renderiza o Lucide
    if (sidebar.classList.contains('minimized')) {
        icon.setAttribute('data-lucide', 'chevron-right');
    } else {
        icon.setAttribute('data-lucide', 'chevron-left');
    }
    
    lucide.createIcons();
}