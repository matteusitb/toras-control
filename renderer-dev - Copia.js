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
        const pastaLicenca = path.join(process.env.APPDATA, 'gestao-toras');
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
function carregarTela(viewName, element) {
    document.querySelectorAll('.components li').forEach(li => li.classList.remove('active'));
    if (element) element.classList.add('active');

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('v-' + viewName);
    if (target) target.classList.add('active');

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

    // Gatilhos específicos por tela
    if (viewName === 'home') {
        atualizarDashboard(); // Chamada para preencher os cards
    } else if (viewName === 'estoque') {
        carregarEstoque(true);
    } else if (viewName === 'especies') {
        carregarEspecies();
    } else if (viewName === 'lotes') {
        carregarLotes();
    } else if (viewName === 'entradas') {
        carregarEspecies();
        carregarLotes();
        carregarTorasRecentes();
    } else if (viewName === 'relatorios') {
        carregarFiltrosRelatorio();
    } else if (viewName === 'logs') {
        carregarLogs();
    }

    lucide.createIcons();
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
    // Captura os elementos
    const rodoInput = document.getElementById('rodo');
    const d1Input = document.getElementById('d1');
    const d2Input = document.getElementById('d2');
    const compInput = document.getElementById('comprimento');
    const descVerInput = document.getElementById('total-desconto-ver');
    const resH2 = document.getElementById('volume-result');
    const detalheSmall = document.getElementById('detalhe-calculo');

    // Converte valores (Tratando vazio como 0 e vírgula como ponto)
    const rodo = parseFloat(rodoInput.value) || 0;
    const d1 = parseFloat(d1Input.value) || 0;
    const d2 = parseFloat(d2Input.value) || 0;
    const comp = parseFloat(compInput.value.replace(',', '.')) || 0;

    // A. CÁLCULO DO OCO (Sempre calcula se houver medidas de desconto e comprimento)
    // Regra: (D1 * D2 * Comprimento) / 10.000 -> Truncado na 3ª casa
    const volOcoRaw = (d1 * d2 * comp) / 10000;
    const volOcoTrunc = Math.floor(volOcoRaw * 1000) / 1000;

    // Atualiza campo Tot. Desconto (Visual)
    descVerInput.value = volOcoTrunc.toFixed(3).replace('.', ',');

    // B. CÁLCULO DA TORA (QUARTO DO RODO)
    if (rodo > 0 && comp > 0) {
        // Lado = Parte inteira da divisão por 4
        const lado = Math.floor(rodo / 4);

        // Volume Bruto = (Lado² * Comp) / 10.000 -> Truncado na 3ª casa
        const volBrutoRaw = (lado * lado * comp) / 10000;
        const volBrutoTrunc = Math.floor(volBrutoRaw * 1000) / 1000;

        // Volume Líquido = Bruto - Oco
        const volumeFinal = (volBrutoTrunc - volOcoTrunc).toFixed(3);

        // Atualiza a tela
        resH2.innerText = volumeFinal.replace('.', ',') + " m³";
        detalheSmall.innerText = `Lado: ${lado}cm | Bruto: ${volBrutoTrunc.toFixed(3)} m³ | Oco: ${volOcoTrunc.toFixed(3)} m³`;

        return { liquido: volumeFinal, oco: volOcoTrunc };
    } else {
        resH2.innerText = "0,000 m³";
        detalheSmall.innerText = "";
        return { liquido: "0.000", oco: volOcoTrunc };
    }
}

// 3. FUNÇÃO SALVAR (INTEGRADA)
async function salvarTora() {
    const calc = calcularCubagem();
    const id = document.getElementById('tora-id').value;

    const dados = {
        id: id || null,
        codigo: document.getElementById('tora-codigo').value, // Número [cite: 2026-01-17]
        especie_id: document.getElementById('tora-especie').value,
        lote_id: document.getElementById('tora-lote').value,
        rodo: parseInt(document.getElementById('rodo').value) || 0,
        desconto_1: parseInt(document.getElementById('d1').value) || 0,
        desconto_2: parseInt(document.getElementById('d2').value) || 0,
        total_desconto: parseFloat(calc.oco),
        comprimento: parseFloat(document.getElementById('comprimento').value.replace(',', '.')) || 0,
        volume: parseFloat(calc.liquido)
    };

    if (!dados.codigo || !dados.rodo || !dados.comprimento) {
        return Swal.fire('Atenção', 'Preencha os campos obrigatórios da tora.', 'warning');
    }

    try {
        const canal = id ? 'editar-tora' : 'nova-tora';
        const res = await window.api.invoke(canal, dados);
        if (res.success) {
            Swal.fire('Sucesso!', 'Tora salva com sucesso.', 'success');
            resetFormEntrada();
            // carregarUltimasEntradas(); // Chamar sua função de atualizar tabela
        }
    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    }
}

async function carregarTorasRecentes() {
    const toras = await window.api.invoke('listar-toras-recentes');
    const tbody = document.getElementById('lista-entradas-recentes');
    if (tbody) {
        tbody.innerHTML = toras.map(t => `
            <tr>
                <td><strong>${t.codigo}</strong></td>
                <td>${t.especie_nome}</td>
                <td><span class="badge-count">${t.lote_numero}</span></td>
                <td>${t.m1}x${t.m2} - ${t.comprimento.toFixed(2)}m</td>
                <td><span class="badge-volume">${t.volume.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</span></td>
                <td style="text-align: right;">
                    <button class="btn-icon-edit" onclick="prepararEdicaoTora('${encodeURIComponent(JSON.stringify(t))}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-icon-delete" onclick="confirmarExclusaoTora(${t.id}, '${t.codigo}')"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`).join('');
        lucide.createIcons();
    }
}

function prepararEdicaoTora(json) {
    const t = JSON.parse(decodeURIComponent(json));

    // REGRA DE OURO: Bloqueio para toras já baixadas (Ponto 1 do Estoque Geral)
    if (t.status === 'serrada') {
        Swal.fire('Bloqueado', 'Esta tora já foi serrada e não pode mais ser editada.', 'warning');
        return;
    }

    carregarTela('entradas', document.querySelector('li[onclick*="entradas"]'));

    // Preenchimento de IDs e Textos
    document.getElementById('tora-id').value = t.id;
    document.getElementById('tora-codigo').value = t.codigo;
    document.getElementById('m1').value = t.m1;
    document.getElementById('m2').value = t.m2;
    document.getElementById('comprimento').value = t.comprimento.toFixed(2).replace('.', ',');

    // CORREÇÃO (Ponto 1 e 2): Popular espécie e lote
    // Usamos um pequeno timeout para garantir que os selects existam na tela de entrada
    setTimeout(() => {
        if (document.getElementById('tora-especie')) document.getElementById('tora-especie').value = t.especie_id;
        if (document.getElementById('tora-lote')) document.getElementById('tora-lote').value = t.lote_id;
        calcularCubagem();
    }, 50);

    document.getElementById('btn-salvar-tora').querySelector('span').innerText = "Atualizar Tora";
    document.getElementById('btn-cancelar-tora').style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormEntrada() {
    // CORREÇÃO (Ponto 3): Limpeza total incluindo espécie e lote
    ['tora-id', 'tora-codigo', 'm1', 'm2', 'comprimento'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // Reseta os seletores para o primeiro item (Selecione...)
    if (document.getElementById('tora-especie')) document.getElementById('tora-especie').selectedIndex = 0;
    if (document.getElementById('tora-lote')) document.getElementById('tora-lote').selectedIndex = 0;

    document.getElementById('volume-result').innerText = "0,000 m³";
    document.getElementById('btn-salvar-tora').querySelector('span').innerText = "Confirmar Entrada";
    document.getElementById('btn-cancelar-tora').style.display = "none";
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
                carregarTorasRecentes();
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
    aplicarMascaraNumero(codigoInput);
    const codigo = codigoInput.value.trim();
    if (!codigo) return;
    if (listaParaBaixa.some(t => t.codigo === codigo)) {
        codigoInput.value = '';
        return avisar('warning', 'Esta tora já está na lista de saída.');
    }
    try {
        const tora = await window.api.invoke('buscar-tora-por-codigo', codigo);
        if (tora) {
            listaParaBaixa.push(tora);
            atualizarTabelaTemporaria();
            codigoInput.value = '';
            codigoInput.focus();
        } else {
            Swal.fire('Não encontrada', 'Tora não existe no pátio.', 'warning');
        }
    } catch (err) { avisar('error', 'Erro ao localizar tora.'); }
}

function atualizarTabelaTemporaria() {
    const tbody = document.getElementById('lista-baixa-temporaria');
    let totalVol = 0;
    tbody.innerHTML = listaParaBaixa.map((t, index) => {
        totalVol += t.volume;
        return `<tr>
            <td><strong>${t.codigo}</strong></td>
            <td>${t.especie_nome}</td>
            <td>${t.lote_numero}</td>
            <td>${t.m1}x${t.m2} - ${t.comprimento.toFixed(2)}m</td>
            <td>${t.volume.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
            <td style="text-align: right;">
                <button class="btn-icon-delete" onclick="removerDaLista(${index})"><i data-lucide="x"></i></button>
            </td>
        </tr>`;
    }).join('');
    document.getElementById('total-volume-baixa').innerText = totalVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + " m³";
    document.getElementById('total-toras-baixa').innerText = listaParaBaixa.length + " toras";
    lucide.createIcons();
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

    // Validação de segurança
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

        // --- LÓGICA DE AGRUPAMENTO POR ESPÉCIE ---
        const resumoEspecies = {};
        listaParaBaixa.forEach(tora => {
            const nome = tora.especie_nome;
            if (!resumoEspecies[nome]) {
                resumoEspecies[nome] = { volume: 0, qtd: 0 };
            }
            resumoEspecies[nome].volume += tora.volume;
            resumoEspecies[nome].qtd += 1;
        });

        // 1. Processa a baixa no Banco de Dados via IPC
        await window.api.invoke('processar-baixa-lote', { ids, dataSaida });

        // 2. Montagem do HTML com layout consolidado [cite: 2026-01-16]
        const htmlParaPDF = `
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; }
                    .header { text-align: center; border-bottom: 1.5px solid #2c3e50; margin-bottom: 20px; padding-bottom: 10px; }
                    .header h1 { margin: 0; font-size: 18px; color: #2c3e50; text-transform: uppercase; }
                    
                    .info-topo { margin-bottom: 15px; font-size: 11px; display: flex; justify-content: space-between; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                    
                    /* Cabeçalho padrão azul acinzentado */
                    thead th { 
                        background-color: #8faab7 !important; 
                        color: #ffffff !important; 
                        font-size: 10px; 
                        padding: 10px; 
                        border: 1px solid #d1d9e0;
                        -webkit-print-color-adjust: exact;
                    }
                    
                    /* Bordas finas conforme solicitado */
                    td { 
                        font-size: 10px; 
                        padding: 8px; 
                        border: 1px solid #e2e8f0; 
                        text-align: center; 
                    }

                    .bold { font-weight: bold; }
                    .text-left { text-align: left; padding-left: 10px; }

                    /* SEÇÃO DO RESUMO - FONTE TAMANHO 8 */
                    .resumo-especies { 
                        margin-top: 20px; 
                        font-size: 8px; /* Tamanho solicitado */
                        color: #444;
                        line-height: 1.4;
                        border-top: 1px solid #eee;
                        padding-top: 10px;
                    }
                    .resumo-titulo { font-weight: bold; margin-bottom: 5px; text-decoration: underline; }

                    .total-geral { 
                        margin-top: 15px; 
                        text-align: right; 
                        font-size: 12px; 
                        font-weight: bold; 
                        border-top: 2px solid #2c3e50;
                        padding-top: 5px;
                    }

                    .assinaturas { margin-top: 60px; display: flex; justify-content: space-around; }
                    .sig-line { border-top: 0.5px solid #333; width: 180px; text-align: center; font-size: 9px; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Romaneio de Saída de Estoque</h1>
                </div>

                <div class="info-topo">
                    <span><strong>Data de Saída:</strong> ${dataSaida.split('-').reverse().join('/')}</span>
                    <span><strong>Total de Toras:</strong> ${listaParaBaixa.length}</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Número</th> <th class="text-left">Espécie</th>
                            <th>Lote</th>
                            <th>Medidas (cm x m)</th>
                            <th>Vol (m³)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${listaParaBaixa.map(t => `
                            <tr>
                                <td class="bold">${t.codigo}</td>
                                <td class="text-left">${t.especie_nome}</td>
                                <td>${t.lote_numero}</td>
                                <td>${t.m1} x ${t.m2} x ${t.comprimento}</td>
                                <td class="bold">${t.volume.toFixed(3)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="resumo-especies">
                    <div class="resumo-titulo">RESUMO POR ESPÉCIE:</div>
                    ${Object.entries(resumoEspecies).map(([nome, dados]) => `
                        <div>${nome}: ${dados.volume.toFixed(3)} m³ (${dados.qtd} toras)</div>
                    `).join('')}
                </div>

                <div class="total-geral">
                    VOLUME TOTAL GERAL: ${totalVolumeGeral.toFixed(3)} m³
                </div>

                <div class="assinaturas">
                    <div class="sig-line">Responsável Pátio</div>
                    <div class="sig-line">Responsável Serraria</div>
                </div>
            </body>
            </html>
        `;

        // 3. Envia para o processo Main gerar o arquivo PDF
        await window.api.invoke('gerar-pdf-logs', htmlParaPDF);

        Swal.fire('Sucesso', 'Baixa realizada e romaneio gerado!', 'success');

        // Limpa a tela após o sucesso
        limparListaTemporaria();
        if (typeof carregarEstoque === 'function') carregarEstoque();

    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao processar: ' + err.message, 'error');
    }
}

// --- FUNÇÕES DO ESTOQUE GERAL ---
async function carregarEstoque(limparFiltros = false) {
    const corpo = document.getElementById('lista-estoque-corpo');
    if (!corpo) return;

    try {
        corpo.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;"><div class="spinner"></div></td></tr>';

        if (limparFiltros) {
            document.getElementById('filtro-estoque-status').value = 'pátio';
            document.getElementById('filtro-estoque-codigo').value = '';
            await atualizarFiltroLotes();
            document.getElementById('filtro-estoque-lote').value = 'todos';
        }

        const status = document.getElementById('filtro-estoque-status').value;
        const loteId = document.getElementById('filtro-estoque-lote').value;
        const codigo = document.getElementById('filtro-estoque-codigo').value;

        const toras = await window.api.invoke('get-estoque-detalhado', { status, codigo, loteId });

        corpo.innerHTML = '';
        if (toras.length === 0) {
            corpo.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhuma tora encontrada.</td></tr>';
            document.getElementById('indicador-qtd-patio').innerText = '0';
            document.getElementById('indicador-vol-patio').innerText = '0.000';
            return;
        }

        let totalVol = 0;
        corpo.innerHTML = toras.map(t => {
            totalVol += t.volume;

            // Define a classe e o texto amigável baseando-se no status
            const statusClass = t.status === 'pátio' ? 'status-patio' : 'status-serrada';
            const statusTexto = t.status === 'pátio' ? 'NO PÁTIO' : 'SERRADA';

            return `
                <tr>
                <td><b>${t.codigo}</b></td>
                <td>${t.especie_nome}</td>
                <td><span class="badge-lote">${t.lote_numero}</span></td>
                <td>${t.volume.toFixed(3)} m³</td>
                <td><span class="status-tag ${statusClass}">${statusTexto}</span></td>
                <td>${new Date(t.data_entrada).toLocaleDateString('pt-BR')}</td>
                <td style="text-align: right;">
                    <button class="btn-icon-edit" onclick="prepararEdicaoTora('${encodeURIComponent(JSON.stringify(t))}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-icon-delete" onclick="confirmarExclusaoTora(${t.id}, '${t.codigo}', '${t.status}')"><i data-lucide="trash-2"></i></button>
                </td>
                </tr>`;
        }).join('');

        document.getElementById('indicador-qtd-patio').innerText = toras.length;
        document.getElementById('indicador-vol-patio').innerText = totalVol.toFixed(3);
        lucide.createIcons();
    } catch (err) { console.error(err); }
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
                if (document.getElementById('v-estoque').classList.contains('active')) carregarEstoque();
                carregarTorasRecentes();
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

async function gerarPreviaRelatorio() {
    // 1. Captura os valores dos filtros
    const filtros = {
        tipo: document.getElementById('rel-tipo').value,
        dataInicio: document.getElementById('rel-data-inicio').value,
        dataFim: document.getElementById('rel-data-fim').value,
        especieId: document.getElementById('rel-especie').value,
        loteId: document.getElementById('rel-lote').value
    };

    // Validação simples: Se escolher datas, ambas devem estar preenchidas
    if ((filtros.dataInicio && !filtros.dataFim) || (!filtros.dataInicio && filtros.dataFim)) {
        Swal.fire('Atenção', 'Para filtrar por data, preencha o início e o fim.', 'warning');
        return;
    }

    try {
        // 2. Chama o Main.js para buscar os dados filtrados
        const dados = await window.api.invoke('buscar-dados-relatorio', filtros);

        // 3. Renderiza os resultados na tabela e nos indicadores
        renderizarTabelaRelatorio(dados);
        atualizarIndicadoresRelatorio(dados);

    } catch (err) {
        console.error("Erro ao gerar relatório:", err);
        Swal.fire('Erro', 'Não foi possível buscar os dados do relatório.', 'error');
    }

    const tbody = document.getElementById('rel-tabela-corpo');
    const containerResumos = document.getElementById('container-resumos');

    // 1. Reset e Verificação de Dados
    if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">Nenhum registro encontrado para estes filtros.</td></tr>`;
        if (containerResumos) containerResumos.innerHTML = '';
        document.getElementById('rel-total-vol').innerText = '0,000 m³';
        document.getElementById('rel-total-qtd').innerText = '0';
        return;
    }

    let volTotalGeral = 0;
    const resumoEspecies = {};
    const resumoLotes = {};

    // 2. Processamento dos Dados e Construção da Tabela
    tbody.innerHTML = dados.map(t => {
        const vol = Number(t.volume);
        volTotalGeral += vol;

        // Acumular totais para os objetos de resumo
        resumoEspecies[t.especie_nome] = (resumoEspecies[t.especie_nome] || 0) + vol;
        resumoLotes[t.lote_numero] = (resumoLotes[t.lote_numero] || 0) + vol;

        // Formatação do Comprimento (ex: 6,00 ou 5,50) e Volume
        const compFormatado = Number(t.comprimento).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const volFormatado = vol.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

        // Identificador visual de Status (Útil para o relatório Geral)
        const statusTag = t.status === 'serrada'
            ? '<span style="color: #ef4444; font-weight: bold;">[S]</span>'
            : '<span style="color: #22c55e; font-weight: bold;">[P]</span>';

        return `
            <tr>
                <td><b>${t.codigo}</b></td>
                <td>${t.especie_nome}</td>
                <td><span class="badge-lote">${t.lote_numero}</span></td>
                <td style="text-align: center;">${t.m1} x ${t.m2} x ${compFormatado}</td>
                <td style="text-align: center;"><b>${volFormatado}</b></td>
                <td style="text-align: right; padding-right: 20px;">
                    <small style="margin-right: 5px;">${statusTag}</small>
                    ${new Date(t.data_entrada).toLocaleDateString('pt-BR')}
                </td>
            </tr>
        `;
    }).join('');

    // 3. Atualizar Indicadores Globais (Topo da tela)
    document.getElementById('rel-total-vol').innerText = `${volTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`;
    document.getElementById('rel-total-qtd').innerText = dados.length;

    // 4. Renderizar Resumos Consolidados (Cards de Rodapé)
    if (containerResumos) {
        containerResumos.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 25px; border-top: 2px solid #f1f5f9; padding-top: 20px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px;">
                    <h4 style="color: #95afc0; margin-bottom: 12px; border-bottom: 2px solid #95afc0; padding-bottom: 5px;">
                        Resumo por Espécie
                    </h4>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${Object.entries(resumoEspecies).sort((a, b) => b[1] - a[1]).map(([nome, vol]) => `
                            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
                                <span>${nome}</span>
                                <b>${vol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</b>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px;">
                    <h4 style="color: #95afc0; margin-bottom: 12px; border-bottom: 2px solid #95afc0; padding-bottom: 5px;">
                        Resumo por Lote
                    </h4>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${Object.entries(resumoLotes).sort((a, b) => b[1] - a[1]).map(([nro, vol]) => `
                            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
                                <span>Lote ${nro}</span>
                                <b>${vol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</b>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
}
function renderizarTabelaRelatorio(dados) {
    const tbody = document.getElementById('rel-tabela-corpo');
    const containerResumos = document.getElementById('container-resumos');

    // Limpeza obrigatória para não acumular resumos de buscas anteriores
    if (containerResumos) containerResumos.innerHTML = '';

    if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: #94a3b8;">Nenhum registro encontrado.</td></tr>`;
        document.getElementById('rel-total-vol').innerText = '0,000 m³';
        document.getElementById('rel-total-qtd').innerText = '0';
        return;
    }

    let volTotalGeral = 0;
    const resumoEspecies = {};
    const resumoLotes = {};

    // --- PROCESSAMENTO DOS DADOS ---
    let htmlLinhas = "";
    dados.forEach(t => {
        const vol = Number(t.volume);
        volTotalGeral += vol;

        // Inicialização dos objetos de resumo
        if (!resumoEspecies[t.especie_nome]) resumoEspecies[t.especie_nome] = { pQtd: 0, pVol: 0, sQtd: 0, sVol: 0 };
        if (!resumoLotes[t.lote_numero]) resumoLotes[t.lote_numero] = { pQtd: 0, pVol: 0, sQtd: 0, sVol: 0 };

        if (t.status === 'serrada') {
            resumoEspecies[t.especie_nome].sQtd++;
            resumoEspecies[t.especie_nome].sVol += vol;
            resumoLotes[t.lote_numero].sQtd++;
            resumoLotes[t.lote_numero].sVol += vol;
        } else {
            resumoEspecies[t.especie_nome].pQtd++;
            resumoEspecies[t.especie_nome].pVol += vol;
            resumoLotes[t.lote_numero].pQtd++;
            resumoLotes[t.lote_numero].pVol += vol;
        }

        const compFormatado = Number(t.comprimento).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const volFormatado = vol.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

        // Tags e Datas
        const statusTag = t.status === 'serrada' ? '<b style="color:#ef4444">[S]</b>' : '<b style="color:#22c55e">[P]</b>';
        const dataEntrada = new Date(t.data_entrada).toLocaleDateString('pt-BR');
        const dataSaida = t.data_saida ? new Date(t.data_saida).toLocaleDateString('pt-BR') : '---';

        htmlLinhas += `
            <tr>
                <td><b>${t.codigo}</b></td>
                <td>${t.especie_nome}</td>
                <td><span class="badge-lote">${t.lote_numero}</span></td>
                <td style="text-align: center;">${t.m1} x ${t.m2} x ${compFormatado}</td>
                <td style="text-align: center;"><b>${volFormatado}</b></td>
                <td style="text-align: center;">${dataEntrada}</td>
                <td style="text-align: center; color: #ef4444;">
                    ${t.status === 'serrada' ? `<b>${dataSaida}</b>` : '<span style="color: #cbd5e1">---</span>'}
                </td>
                <td style="text-align: right; padding-right: 10px;">
                    <small>${statusTag}</small>
                </td>
            </tr>`;
    });

    // Injeta as linhas na tabela
    tbody.innerHTML = htmlLinhas;

    // Atualiza indicadores de topo
    document.getElementById('rel-total-vol').innerText = `${volTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`;
    document.getElementById('rel-total-qtd').innerText = dados.length;

    // --- RENDERIZAÇÃO DOS RESUMOS DESCRITIVOS ---
    if (containerResumos) {
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
                ${Object.entries(resumoEspecies).map(([nome, d]) => `
                    <div class="resumo-item" style="margin-bottom: 16px;">
                        <strong style="color: #1e293b; display: block; margin-bottom: 4px;">${nome}</strong>
                        ${criarFraseHtml(d.pQtd, d.pVol, 'patio')}
                        ${criarFraseHtml(d.sQtd, d.sVol, 'serrada')}
                    </div>
                `).join('')}
            </div>

            <div class="resumo-card" style="background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; border-left: 6px solid #95afc0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <h4 class="resumo-titulo" style="color: #95afc0; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Totais por Lote</h4>
                ${Object.entries(resumoLotes).map(([lote, d]) => `
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
    const linhasTabela = document.querySelectorAll('#rel-tabela-corpo tr');
    if (linhasTabela.length === 0 || linhasTabela[0].innerText.includes("Nenhum registro")) {
        Swal.fire('Aviso', 'Não há dados para exportar.', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf;
    // Orientação 'l' (Landscape) para caber a nova coluna de Saída confortavelmente
    const doc = new jsPDF('l', 'mm', 'a4');

    const tipoTexto = document.getElementById('rel-tipo').options[document.getElementById('rel-tipo').selectedIndex].text;
    const totalVolHeader = document.getElementById('rel-total-vol').innerText;
    const totalQtdHeader = document.getElementById('rel-total-qtd').innerText;

    // --- CABEÇALHO ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text("ToraControl - Relatório Operacional", 14, 20);
    doc.setDrawColor(149, 175, 192); // Cor #95afc0
    doc.line(14, 23, 280, 23); // Linha estendida para o modo paisagem

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório: ${tipoTexto} | Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
    doc.text(`Resumo Geral: ${totalQtdHeader} toras | Vol. Total: ${totalVolHeader}`, 14, 35);

    // --- TABELA PRINCIPAL (Agora com 7 Colunas) ---
    const colunas = ["Número", "Espécie", "Lote", "Medidas (cm x m)", "Vol (m³)", "Entrada", "Saída"];
    const linhasParaPDF = [];

    linhasTabela.forEach((tr) => {
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 7) {
            linhasParaPDF.push([
                tds[0].innerText, // Número
                tds[1].innerText, // Espécie
                tds[2].innerText, // Lote
                tds[3].innerText, // Medidas
                tds[4].innerText, // Volume
                tds[5].innerText, // Entrada
                tds[6].innerText  // Saída (Nova)
            ]);
        }
    });

    doc.autoTable({
        startY: 42,
        head: [colunas],
        body: linhasParaPDF,
        theme: 'grid',
        headStyles: { fillColor: [149, 175, 192], halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold' },
            4: { halign: 'center', fontStyle: 'bold' },
            5: { halign: 'center' },
            6: { halign: 'center', textColor: [239, 68, 68] } // Vermelho para a Saída
        }
    });

    // --- LÓGICA DE CÁLCULO PARA RESUMOS ---
    const resumoLotes = {};
    const resumoEspecies = {};

    linhasParaPDF.forEach((linha) => {
        const especie = linha[1];
        const lote = linha[2];
        const vol = parseFloat(linha[4].replace(/[^\d,.-]/g, '').replace(',', '.'));
        // Verifica se há uma data na coluna saída (não é '---') para definir como serrada
        const isSerrada = !linha[6].includes('---');

        if (!resumoLotes[lote]) resumoLotes[lote] = { patioQtd: 0, patioVol: 0, serradaQtd: 0, serradaVol: 0 };
        if (!resumoEspecies[especie]) resumoEspecies[especie] = { patioQtd: 0, patioVol: 0, serradaQtd: 0, serradaVol: 0 };

        if (isSerrada) {
            resumoLotes[lote].serradaQtd++;
            resumoLotes[lote].serradaVol += vol;
            resumoEspecies[especie].serradaQtd++;
            resumoEspecies[especie].serradaVol += vol;
        } else {
            resumoLotes[lote].patioQtd++;
            resumoLotes[lote].patioVol += vol;
            resumoEspecies[especie].patioQtd++;
            resumoEspecies[especie].patioVol += vol;
        }
    });

    let currentY = doc.lastAutoTable.finalY + 15;

    // --- SEÇÃO: RESUMO POR ESPÉCIE ---
    if (currentY > 180) { doc.addPage(); currentY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("RESUMO POR ESPÉCIE", 14, currentY);
    currentY += 8;
    doc.setFontSize(10);

    Object.entries(resumoEspecies).forEach(([nomeEsp, d]) => {
        if (currentY > 185) { doc.addPage(); currentY = 20; }
        doc.setFont("helvetica", "bold");
        doc.text(`${nomeEsp}:`, 14, currentY);
        currentY += 5;
        doc.setFont("helvetica", "normal");

        if (d.patioQtd > 0) {
            doc.text(`- ${d.patioQtd} ${d.patioQtd > 1 ? 'toras' : 'tora'} no pátio totalizando: ${d.patioVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`, 20, currentY);
            currentY += 5;
        }
        if (d.serradaQtd > 0) {
            doc.text(`- ${d.serradaQtd} ${d.serradaQtd > 1 ? 'toras' : 'tora'} serrada totalizando: ${d.serradaVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`, 20, currentY);
            currentY += 5;
        }
        currentY += 2;
    });

    currentY += 5;

    // --- SEÇÃO: RESUMO POR LOTE ---
    if (currentY > 180) { doc.addPage(); currentY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("RESUMO POR LOTE", 14, currentY);
    currentY += 8;
    doc.setFontSize(10);

    Object.entries(resumoLotes).forEach(([nomeLote, d]) => {
        if (currentY > 185) { doc.addPage(); currentY = 20; }
        doc.setFont("helvetica", "bold");
        doc.text(`Lote ${nomeLote}:`, 14, currentY);
        currentY += 5;
        doc.setFont("helvetica", "normal");

        if (d.patioQtd > 0) {
            doc.text(`- ${d.patioQtd} ${d.patioQtd > 1 ? 'toras' : 'tora'} no pátio totalizando: ${d.patioVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`, 20, currentY);
            currentY += 5;
        }
        if (d.serradaQtd > 0) {
            doc.text(`- ${d.serradaQtd} ${d.serradaQtd > 1 ? 'toras' : 'tora'} serrada totalizando: ${d.serradaVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`, 20, currentY);
            currentY += 5;
        }
        currentY += 2;
    });

    const dataRef = new Date().toISOString().split('T')[0];
    doc.save(`Relatorio_ToraControl_${dataRef}.pdf`);
    Swal.fire({ icon: 'success', title: 'PDF Gerado!', showConfirmButton: false, timer: 1500 });
}

async function exportarRelatorioExcel() {
    const workbook = new ExcelJS.Workbook();
    const sheetDetalhada = workbook.addWorksheet('Listagem Detalhada');

    // 1. Configurar Cabeçalhos (Incluindo a nova coluna de Saída)
    sheetDetalhada.columns = [
        { header: 'Número', key: 'numero', width: 12 },
        { header: 'Espécie', key: 'especie', width: 25 },
        { header: 'Lote', key: 'lote', width: 20 },
        { header: 'Medidas (cm x m)', key: 'medidas', width: 20 },
        { header: 'Volume (m³)', key: 'volume', width: 15 },
        { header: 'Data Entrada', key: 'entrada', width: 15 },
        { header: 'Data Saída', key: 'saida', width: 15 }
    ];

    // Estilizar o cabeçalho com a cor padrão #95afc0
    sheetDetalhada.getRow(1).eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF95AFC0' }
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // 2. Coletar dados da tabela HTML e processar resumos
    const linhasTabela = document.querySelectorAll('#rel-tabela-corpo tr');
    const resumoLotes = {};
    const resumoEspecies = {};

    linhasTabela.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        // Agora verificamos se existem as 7 colunas (contando a nova de Saída)
        if (tds.length >= 7) {
            const numero = tds[0].innerText;
            const especie = tds[1].innerText;
            const lote = tds[2].innerText;
            const medidas = tds[3].innerText;
            const volStr = tds[4].innerText.replace(/[^\d,.-]/g, '').replace(',', '.');
            const vol = parseFloat(volStr);
            const entrada = tds[5].innerText;
            const saida = tds[6].innerText;

            // Determina o status baseado na coluna de Saída
            const isSerrada = !saida.includes('---');

            // Adiciona linha na planilha detalhada
            const row = sheetDetalhada.addRow({
                numero: numero,
                especie: especie,
                lote: lote,
                medidas: medidas,
                volume: vol,
                entrada: entrada,
                saida: saida
            });

            // Formatação condicional para a data de saída (vermelho se serrada)
            if (isSerrada) {
                row.getCell('saida').font = { color: { argb: 'FFFF0000' }, bold: true };
            }

            // Acumuladores para a aba de resumo
            if (!resumoLotes[lote]) resumoLotes[lote] = { pQtd: 0, pVol: 0, sQtd: 0, sVol: 0 };
            if (!resumoEspecies[especie]) resumoEspecies[especie] = { pQtd: 0, pVol: 0, sQtd: 0, sVol: 0 };

            if (isSerrada) {
                resumoLotes[lote].sQtd++; resumoLotes[lote].sVol += vol;
                resumoEspecies[especie].sQtd++; resumoEspecies[especie].sVol += vol;
            } else {
                resumoLotes[lote].pQtd++; resumoLotes[lote].pVol += vol;
                resumoEspecies[especie].pQtd++; resumoEspecies[especie].pVol += vol;
            }
        }
    });

    // Formatar coluna de volume como número no Excel para permitir somas
    sheetDetalhada.getColumn('volume').numFmt = '#,##0.000';

    // 3. Criar Aba de Resumos (Narrativo)
    const sheetResumo = workbook.addWorksheet('Resumos Gerenciais');

    // Estilo para títulos de seção
    const estiloTitulo = { font: { bold: true, size: 12, color: { argb: 'FF1E293B' } } };

    sheetResumo.addRow(['RESUMO POR ESPÉCIE']).font = { bold: true, size: 14 };
    sheetResumo.addRow([]);

    Object.entries(resumoEspecies).forEach(([nome, d]) => {
        sheetResumo.addRow([nome]).style = estiloTitulo;
        if (d.pQtd > 0) sheetResumo.addRow([`• ${d.pQtd} ${d.pQtd > 1 ? 'toras' : 'tora'} no pátio totalizando: ${d.pVol.toFixed(3).replace('.', ',')} m³`]);
        if (d.sQtd > 0) sheetResumo.addRow([`• ${d.sQtd} ${d.sQtd > 1 ? 'toras' : 'tora'} serrada totalizando: ${d.sVol.toFixed(3).replace('.', ',')} m³`]);
        sheetResumo.addRow([]);
    });

    sheetResumo.addRow(['RESUMO POR LOTE']).font = { bold: true, size: 14 };
    sheetResumo.addRow([]);

    Object.entries(resumoLotes).forEach(([lote, d]) => {
        sheetResumo.addRow([`Lote ${lote}`]).style = estiloTitulo;
        if (d.pQtd > 0) sheetResumo.addRow([`• ${d.pQtd} ${d.pQtd > 1 ? 'toras' : 'tora'} no pátio totalizando: ${d.pVol.toFixed(3).replace('.', ',')} m³`]);
        if (d.sQtd > 0) sheetResumo.addRow([`• ${d.sQtd} ${d.sQtd > 1 ? 'toras' : 'tora'} serrada totalizando: ${d.sVol.toFixed(3).replace('.', ',')} m³`]);
        sheetResumo.addRow([]);
    });

    // Ajustar larguras da aba de resumo
    sheetResumo.getColumn(1).width = 60;

    // 4. Gerar arquivo e disparar download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatorio_Excel_ToraControl_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();

    Swal.fire({ icon: 'success', title: 'Excel Gerado com Sucesso!', timer: 1500, showConfirmButton: false });
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
    // 1. Localiza a View de Logs e a Tabela
    const vLogs = document.getElementById('v-logs');
    const tbody = document.getElementById('lista-logs');
    if (!tbody || !vLogs) return;

    // 2. Busca os inputs especificamente dentro da div #v-logs (evita pegar de outras abas)
    const inputInicio = vLogs.querySelector('input[type="date"]:first-of-type') || document.getElementById('input-filtro-data-inicio-logs');
    const inputFim = vLogs.querySelector('input[type="date"]:last-of-type') || document.getElementById('input-filtro-data-fim-logs');
    const selectAcao = vLogs.querySelector('select') || document.getElementById('log-filtro-acao');

    const valorInicio = inputInicio ? inputInicio.value : '';
    const valorFim = inputFim ? inputFim.value : '';
    const valorAcao = selectAcao ? selectAcao.value : 'todos';

    // Log no console do navegador para você ver se ele pegou a data certa
    // console.log("Valores que o Renderer está lendo:", { valorInicio, valorFim, valorAcao });

    // 3. Limpa a tabela e mostra carregando
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Filtrando...</td></tr>';

    try {
        const logs = await window.api.invoke('listar-logs', {
            acao: valorAcao,
            dataInicio: valorInicio,
            dataFim: valorFim,
            limiteInicial: (!valorInicio && !valorFim && valorAcao === 'todos') ? 20 : null
        });

        // 4. Limpa novamente para inserir os novos
        tbody.innerHTML = '';

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Nenhum log encontrado para este filtro.</td></tr>';
            return;
        }

        // 5. Gera as linhas
        let html = '';
        logs.forEach(log => {
            let cor = "#64748b"; // Padrão
            if (log.acao === 'exclusao') cor = "#ef4444";
            if (log.acao === 'insercao') cor = "#22c55e";
            if (log.acao === 'edicao') cor = "#eab308";

            // Formata data YYYY-MM-DD HH:MM:SS para DD/MM/YYYY HH:MM:SS
            const partes = log.data_hora.split(' ');
            const dataBr = partes[0].split('-').reverse().join('/');
            const horaBr = partes[1] || '';

            html += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="font-family: monospace; font-size: 0.85rem; padding: 10px;">${dataBr} ${horaBr}</td>
                    <td style="padding: 10px;">${log.usuario}</td>
                    <td style="padding: 10px;"><b style="color: ${cor}; font-size: 0.7rem;">${log.acao.toUpperCase()}</b></td>
                    <td style="padding: 10px; font-size: 0.9rem;">${log.descricao}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center;">Erro ao filtrar.</td></tr>';
    }
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
    const numero = inputBusca.value.trim();

    if (!numero) {
        inputBusca.style.borderColor = '#ef4444';
        setTimeout(() => inputBusca.style.borderColor = '#e2e8f0', 2000);
        return;
    }

    try {
        const tora = await window.api.invoke('buscar-tora-por-numero', numero);

        if (!tora) {
            Swal.fire({
                title: 'Não encontrado',
                text: `O Número ${numero} não foi localizado.`,
                icon: 'error',
                confirmButtonColor: '#6366f1'
            });
            return;
        }

        const isPatio = tora.status === 'pátio';
        const badgeColor = isPatio ? '#10b981' : '#ef4444';
        const statusTexto = isPatio ? '[P] NO PÁTIO' : '[S] SERRADA';

        // LÓGICA DE DATA: Altera o rótulo conforme o status
        const rotuloData = isPatio ? 'Data de Entrada' : 'Data de Saída';

        Swal.fire({
            title: `Detalhes do Número: ${tora.codigo}`, // [cite: 2026-01-17]
            html: `
                <div style="text-align: left; padding: 15px; border-radius: 8px; background: #f8fafc; line-height: 2;">
                    <p><strong>Status:</strong> <span style="color: ${badgeColor}; font-weight: bold;">${statusTexto}</span></p>
                    <p><strong>Espécie:</strong> ${tora.especie_nome || '---'}</p>
                    <p><strong>Lote:</strong> ${tora.lote_nome || '---'}</p>
                    <p><strong>Volume:</strong> ${Number(tora.volume).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</p>
                    <p><strong>${rotuloData}:</strong> ${new Date(tora.data_entrada).toLocaleDateString('pt-BR')}</p>
                </div>
            `,
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#6366f1'
        });

        inputBusca.value = "";
        inputBusca.blur();

    } catch (err) {
        console.error("Erro na busca:", err);
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
    const pastaLicenca = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share"), 'gestao-toras');
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

    // Se estiver vazio, não faz nada
    if (valor === "") return;

    // Remove qualquer caractere que não seja número
    valor = valor.replace(/\D/g, "");

    // Aplica o preenchimento de zeros (01 -> 001)
    input.value = valor.padStart(3, '0');
}