// --- ATIVAÇÃO DE SISTEMA (VIA IPC SEGURO) ---
document.getElementById('btn-activar').addEventListener('click', async () => {
    const inputChave = document.getElementById('license-key-input');
    const chaveDigitada = inputChave.value.trim();

    if (!chaveDigitada) {
        return Swal.fire('Atenção', 'Por favor, insira uma chave de licença.', 'warning');
    }

    try {
        // Envia para o processo principal (onde o segredo está protegido)
        const res = await window.api.invoke('ativar-sistema', chaveDigitada);

        if (res.success) {
            await Swal.fire('Sucesso', "Sistema ativado com sucesso! Aproveite o controle de toras.", 'success');
            location.reload();
        } else {
            Swal.fire('Erro de Ativação', tratarErroIpc(res.error), 'error');
            inputChave.style.borderColor = "#f87171";
            inputChave.value = "";
        }
    } catch (err) {
        Swal.fire('Erro Crítico', tratarErroIpc(err), 'error');
    }
});


// Inicializar Ícones do Lucide
lucide.createIcons();

// Inicializar listeners de atualização do sistema
iniciarListenersAutoUpdater();

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
    if (!err) return "Erro desconhecido.";
    const originalMsg = (typeof err === 'string' ? err : (err.message || "Erro desconhecido"));
    const msg = originalMsg.toLowerCase();

    // Mapeamento de Erros de Banco de Dados (SQLite)
    if (msg.includes("unique constraint failed: toras.codigo")) {
        return "Este número de tora já está cadastrado no sistema.";
    }
    if (msg.includes("unique constraint failed: lotes.numero")) {
        return "Este número de lote já existe.";
    }
    if (msg.includes("unique constraint failed")) {
        return "Este registro já existe e não pode ser duplicado.";
    }
    if (msg.includes("foreign key constraint failed")) {
        return "Não é possível excluir: este registro está sendo usado em outra parte do sistema.";
    }

    // Mapeamento de Erros de Autenticação (Supabase)
    if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
        return "E-mail ou senha incorretos.";
    }
    if (msg.includes("email not confirmed")) {
        return "Este e-mail ainda não foi confirmado. Verifique seu e-mail.";
    }

    // Mapeamento de Erros de Rede/Conexão
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("load failed") || msg.includes("connection")) {
        return "Falha de conexão. Verifique sua internet.";
    }

    // Mapeamento de Erros Genéricos de IPC/Banco
    if (msg.includes("sqliteerror") || msg.includes("database") || msg.includes("sql")) {
        return "Erro de comunicação com o banco de dados.";
    }
    if (msg.includes("remote method") || msg.includes("invoke")) {
        return "Ocorreu um erro ao processar a operação. Tente novamente.";
    }

    // Se for uma mensagem curta e sem termos técnicos, podemos manter
    if (originalMsg.length < 100 && !msg.includes("error") && !msg.includes("fail") && !msg.includes("invoke")) {
        return originalMsg;
    }

    return "Ocorreu um erro inesperado no sistema.";
}

// --- AUXILIAR PARA GERAR NOME DE ARQUIVO COM DATA/HORA ---
function gerarNomeArquivoDataHora(prefixo, identificador = '') {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const hora = String(agora.getHours()).padStart(2, '0');
    const min = String(agora.getMinutes()).padStart(2, '0');
    const seg = String(agora.getSeconds()).padStart(2, '0');
    const dataHoraFmt = `${dia}-${mes}-${ano}_${hora}h${min}m${seg}`;

    const idLimpo = identificador ? `_${String(identificador).replace(/[\/\\:*?"<>|]/g, '-').trim()}` : '';
    return `${prefixo}${idLimpo}_${dataHoraFmt}.pdf`;
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
    const viewsSemAviso = ['home', 'estoque', 'relatorios', 'logs', 'configuracoes', 'romaneios'];

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
    // Exceção: campos de configuração de backup são persistentes e não devem ser limpos
    const idsExcluidos = ['cfg-backup-horarios', 'cfg-backup-pasta', 'cfg-backup-ativo'];
    const todosOsInputs = document.querySelectorAll('input, select, textarea');
    todosOsInputs.forEach(campo => {
        if (idsExcluidos.includes(campo.id)) return; // ← pula campos de backup
        if (campo.tagName === 'SELECT') {
            campo.selectedIndex = 0;
        } else if (campo.type === 'checkbox') {
            // não reseta checkboxes fora da lista de exceção para evitar outros efeitos colaterais
        } else {
            campo.value = '';
        }
    });

    // --- 3.1 LIMPEZA ESPECÍFICA PARA RELATÓRIOS (Elementos que não são inputs) ---
    if (viewName === 'relatorios') {
        // Reseta os textos de resumo de volume e quantidade
        const volTotal = document.getElementById('rel-total-vol');
        const qtdTotal = document.getElementById('rel-total-qtd');
        if (volTotal) volTotal.innerText = '0,000 m³';
        if (qtdTotal) qtdTotal.innerText = '0 toras encontradas';

        // Reseta a tabela para o estado de instrução inicial
        const tabelaCorpo = document.getElementById('rel-tabela-corpo');
        if (tabelaCorpo) {
            tabelaCorpo.innerHTML = `
                <tr>
                    <td colspan="6" class="text-muted" style="text-align: center; padding: 40px;">
                        <i data-lucide="info" style="display: inline-block; vertical-align: middle; margin-right: 8px;"></i>
                        Ajuste os filtros e clique em "Visualizar" para carregar os dados.
                    </td>
                </tr>
            `;
        }

        // Limpa resumos dinâmicos e esconde botões de paginação
        const containerResumos = document.getElementById('container-resumos');
        if (containerResumos) containerResumos.innerHTML = '';

        const btnMais = document.getElementById('btn-rel-carregar-mais');
        if (btnMais) btnMais.style.display = 'none';
    }

    // Resetamos a trava e atualizamos a tela atual para a próxima navegação
    formularioSujo = false;
    telaAtual = viewName;

    // --- 4. INTERFACE: TROCA DE VISIBILIDADE ---
    document.querySelectorAll('.components li').forEach(li => li.classList.remove('active'));
    if (element) element.classList.add('active');

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('v-' + viewName);
    if (target) target.classList.add('active');

    // Títulos conforme o layout definido
    const nomes = {
        'home': 'Dashboard',
        'especies': 'Cadastro de Espécies',
        'lotes': 'Cadastro de Lotes',
        'romaneios': 'Romaneios de Entrada',
        'entradas': 'Entradas no Estoque',
        'baixas': 'Baixas de Estoque',
        'estoque': 'Controle de Estoque Geral',
        'relatorios': 'Relatórios Gerenciais',
        'logs': 'Log de Sistemas',
        'configuracoes': 'Configurações'
    };
    const tituloElemento = document.getElementById('view-title');
    if (tituloElemento) {
        tituloElemento.innerText = nomes[viewName] || 'ToraControl';
    }

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

            case 'fornecedores':
                if (typeof carregarFornecedores === 'function') await carregarFornecedores();
                break;

            case 'motoristas':
                if (typeof carregarMotoristas === 'function') await carregarMotoristas();
                break;

            case 'fechamentos':
                if (typeof carregarSelectsFechamentos === 'function') await carregarSelectsFechamentos();
                if (typeof switchFechamentoTab === 'function') switchFechamentoTab('novo');
                break;

            case 'romaneios':
                if (typeof carregarEspecies === 'function') await carregarEspecies();
                if (typeof carregarLotes === 'function') await carregarLotes();
                if (typeof carregarFornecedores === 'function') await carregarFornecedores();
                if (typeof carregarMotoristas === 'function') await carregarMotoristas();
                if (typeof carregarRomaneios === 'function') await carregarRomaneios(true);
                // Busca o próximo número automático ao abrir a tela
                if (typeof carregarProximoNumeroRomaneio === 'function') await carregarProximoNumeroRomaneio();
                // Fecha o painel de detalhes ao trocar de tela
                fecharDetalhesRomaneio();
                break;

            case 'entradas':
                if (typeof carregarEspecies === 'function') await carregarEspecies();
                if (typeof carregarLotes === 'function') await carregarLotes();
                if (typeof carregarSelectRomaneios === 'function') await carregarSelectRomaneios();
                if (typeof listarTorasRecentes === 'function') await listarTorasRecentes();
                break;

            case 'estoque':
                if (typeof carregarEstoque === 'function') await carregarEstoque(true);
                break;

            case 'relatorios':
                // Carrega as opções de Espécie e Lote nos Selects do relatório
                if (typeof carregarFiltrosRelatorio === 'function') await carregarFiltrosRelatorio();
                break;

            case 'logs':
                if (typeof carregarLogs === 'function') await carregarLogs();
                break;

            case 'configuracoes':
                // Sempre relê as configurações de backup do disco ao entrar nesta tela
                if (typeof carregarConfigsBackup === 'function') await carregarConfigsBackup();
                if (typeof atualizarInfoVersaoConfiguracoes === 'function') await atualizarInfoVersaoConfiguracoes();
                break;
        }
    } catch (err) {
        console.error(`Erro ao processar dados da view ${viewName}:`, err);
    }

    // Renderiza ícones Lucide (Essencial para os ícones inseridos via innerHTML)
    if (window.lucide) {
        window.lucide.createIcons();
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
// 1. Formatação em tempo real (Máscara)
function mascaraComprimento(input) {
    let value = input.value.replace(/\D/g, '');

    // Se o usuário apagar tudo, limpa o campo
    if (value === "") {
        input.value = "";
        return;
    }

    // Aplica a vírgula conforme o usuário digita
    if (value.length > 2) {
        value = value.slice(0, -2) + ',' + value.slice(-2);
    }

    input.value = value;
}

// 2. Ajuste Final (Garante as duas casas decimais ao sair do campo)
function finalizarComprimento(input) {
    let value = input.value.replace(/\D/g, '');

    if (value === "") return;

    // Se digitou apenas '5', vira '500' -> '5,00'
    // Se digitou '55', vira '550' -> '5,50'
    if (value.length === 1) value = value + "00";
    if (value.length === 2) value = value + "0";

    // Re-aplica a vírgula para garantir o formato final
    if (value.length >= 3) {
        value = value.slice(0, -2) + ',' + value.slice(-2);
    } else {
        // Caso de segurança para valores muito pequenos
        value = "0," + value.padStart(2, '0');
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

function mascaraFrete(input) {
    let value = input.value.replace(/\D/g, '');
    if (value === "") {
        input.value = "";
        calcularFreteRomaneio();
        return;
    }
    if (value.length > 2) {
        value = value.slice(0, -2) + ',' + value.slice(-2);
    }
    input.value = value;
    calcularFreteRomaneio();
}

function calcularFreteRomaneio() {
    const inputFreteValor = document.getElementById('rom-frete-valor');
    const inputFreteTotal = document.getElementById('rom-frete-total');
    if (!inputFreteValor || !inputFreteTotal) return;

    let valorTexto = inputFreteValor.value.replace(/\./g, "").replace(",", ".");
    let freteValor = parseFloat(valorTexto) || 0;

    let totalBruto = 0;
    if (Array.isArray(torasRomaneioAtual)) {
        torasRomaneioAtual.forEach(t => {
            totalBruto += Number(t.volume_bruto) || 0;
        });
    }

    let freteTotal = freteValor * totalBruto;
    inputFreteTotal.value = freteTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


// --- GESTÃO DE ESPÉCIES (Somente Leitura/Sincronização) ---
async function carregarEspecies() {
    try {
        const especies = await window.api.invoke('listar-especies');
        const tbody = document.getElementById('lista-especies');
        if (tbody) {
            tbody.innerHTML = especies.map(esp => `
                <tr>
                    <td>${esp.nome}</td>
                    <td>${esp.cientifico || '-'}</td>
                </tr>`).join('');
        }
        const select = document.getElementById('tora-especie');
        if (select) select.innerHTML = '<option value="">Selecione...</option>' + especies.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
        const selectRom = document.getElementById('rom-tora-especie');
        if (selectRom) selectRom.innerHTML = '<option value="">Selecione...</option>' + especies.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
        lucide.createIcons();
    } catch (err) { console.error(err); }
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
        Swal.fire('Erro', tratarErroIpc(err), 'error');
    }
}

async function carregarLotes() {
    try {
        // Busca a lista atualizada do banco de dados via IPC
        const lotes = await window.api.invoke('listar-lotes');

        // 1. ATUALIZA A TABELA (View de Gerenciamento de Lotes)
        const tbody = document.getElementById('lista-lotes');
        if (tbody) {
            if (lotes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum lote cadastrado.</td></tr>';
            } else {
                tbody.innerHTML = lotes.map(l => `
                    <tr>
                        <td><strong>${l.numero}</strong></td>
                        <td>${l.descricao || '-'}</td>
                        <td style="text-align: center;"><span class="badge-count">${l.total_toras} toras</span></td>
                        <td style="text-align: center;"><span class="badge-volume">${(l.volume_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</span></td>
                        <td style="text-align: right;">
                            <button class="btn-icon-edit" title="Editar Lote" onclick="prepararEdicaoLote('${encodeURIComponent(JSON.stringify(l))}')">
                                <i data-lucide="pencil"></i>
                            </button>
                            <button class="btn-icon-delete" title="Excluir Lote" onclick="excluirLote(${l.id})">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </td>
                    </tr>`).join('');
            }
        }

        // 2. ATUALIZA O SELECT DE CADASTRO (View de Entradas)
        const selectCadastro = document.getElementById('tora-lote');
        if (selectCadastro) {
            const optionsCadastro = lotes.map(l => `<option value="${l.id}">${l.numero}</option>`).join('');
            selectCadastro.innerHTML = '<option value="">Selecione...</option>' + optionsCadastro;
        }

        // NOVO SUBFORM ROMANEIO
        const selectRomLote = document.getElementById('rom-tora-lote');
        if (selectRomLote) {
            const optionsCadastro = lotes.map(l => `<option value="${l.id}">${l.numero}</option>`).join('');
            selectRomLote.innerHTML = '<option value="">Selecione...</option>' + optionsCadastro;
        }

        // 3. ATUALIZA O FILTRO DE BUSCA (View v-estoque) [cite: 2026-01-16]
        const selectFiltro = document.getElementById('filtro-estoque-lote');
        if (selectFiltro) {
            const optionsFiltro = lotes.map(l => `<option value="${l.id}">${l.numero}</option>`).join('');
            // Mantém "todos" como valor padrão conforme seu HTML
            selectFiltro.innerHTML = '<option value="todos">Todos os Lotes</option>' + optionsFiltro;
        }

        // Renderiza os ícones do Lucide em todos os novos elementos
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

    } catch (err) {
        console.error("Erro ao carregar lotes:", err);
        avisar('error', 'Falha ao sincronizar lista de lotes.');
    }
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

// --- GESTÃO DE FORNECEDORES ---

async function carregarFornecedores() {
    try {
        const fornecedores = await window.api.invoke('listar-fornecedores');

        // 1. ATUALIZA A TABELA (View de Gerenciamento de Fornecedores)
        const tbody = document.getElementById('lista-fornecedores');
        if (tbody) {
            if (fornecedores.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum fornecedor cadastrado ainda.</td></tr>';
            } else {
                tbody.innerHTML = fornecedores.map(f => {
                    const json = encodeURIComponent(JSON.stringify(f));
                    return `
                        <tr>
                            <td><strong>${f.nome}</strong></td>
                            <td style="text-align: right; padding-right: 25px;">
                                <button class="btn-icon-edit" onclick="prepararEdicaoFornecedor('${json}')">
                                    <i data-lucide="pencil"></i>
                                </button>
                                <button class="btn-icon-delete" onclick="excluirFornecedor(${f.id})">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 2. ATUALIZA O SELECT DE ROMANEIOS
        const selectRomFornecedor = document.getElementById('rom-fornecedor-id');
        if (selectRomFornecedor) {
            const options = fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
            selectRomFornecedor.innerHTML = '<option value="">Selecione...</option>' + options;
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

    } catch (err) {
        console.error("Erro ao carregar fornecedores:", err);
        avisar('error', 'Falha ao sincronizar lista de fornecedores.');
    }
}

async function salvarFornecedor() {
    const id = document.getElementById('fornecedor-id').value;
    const nome = document.getElementById('fornecedor-nome').value.trim();

    if (!nome) {
        return Swal.fire('Atenção', 'O nome do fornecedor é obrigatório.', 'warning');
    }

    try {
        const res = await window.api.invoke('salvar-fornecedor', { id: id || null, nome });
        if (res && res.success) {
            avisar('success', id ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!');
            resetFornecedorForm();
            carregarFornecedores();
        } else {
            Swal.fire('Erro', tratarErroIpc(res.error), 'error');
        }
    } catch (err) {
        Swal.fire('Erro', tratarErroIpc(err), 'error');
    }
}

function prepararEdicaoFornecedor(json) {
    const f = JSON.parse(decodeURIComponent(json));
    document.getElementById('fornecedor-id').value = f.id;
    document.getElementById('fornecedor-nome').value = f.nome;
    document.getElementById('btn-salvar-fornecedor').querySelector('span').innerText = "Atualizar Fornecedor";
    document.getElementById('btn-cancelar-fornecedor').style.display = "block";
    document.getElementById('forn-form-titulo').innerText = "Editar Fornecedor";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFornecedorForm() {
    document.getElementById('fornecedor-id').value = "";
    document.getElementById('fornecedor-nome').value = "";
    document.getElementById('btn-salvar-fornecedor').querySelector('span').innerText = "Salvar Fornecedor";
    document.getElementById('btn-cancelar-fornecedor').style.display = "none";
    document.getElementById('forn-form-titulo').innerText = "Novo Fornecedor";
}

async function excluirFornecedor(id) {
    const r = await Swal.fire({ title: 'Excluir Fornecedor?', text: "Isso não pode ser desfeito.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#6366f1' });
    if (r.isConfirmed) {
        try {
            const res = await window.api.invoke('excluir-fornecedor', id);
            if (res && res.success) {
                avisar('success', 'Fornecedor removido.');
                carregarFornecedores();
            } else {
                Swal.fire({ title: 'Não permitido', text: res.error, icon: 'error', confirmButtonColor: '#6366f1' });
            }
        } catch (err) {
            Swal.fire({ title: 'Erro', text: tratarErroIpc(err), icon: 'error', confirmButtonColor: '#6366f1' });
        }
    }
}

// --- GESTÃO DE MOTORISTAS ---

async function carregarMotoristas() {
    try {
        const motoristas = await window.api.invoke('listar-motoristas');

        // 1. ATUALIZA A TABELA (View de Gerenciamento de Motoristas)
        const tbody = document.getElementById('lista-motoristas');
        if (tbody) {
            if (motoristas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum motorista cadastrado ainda.</td></tr>';
            } else {
                tbody.innerHTML = motoristas.map(m => {
                    const json = encodeURIComponent(JSON.stringify(m));
                    const comissaoText = m.comissao ? `${m.comissao.toLocaleString('pt-BR')}%` : '0%';
                    const salarioText = m.salario ? `R$ ${m.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00';
                    return `
                        <tr>
                            <td><strong>${m.nome}</strong></td>
                            <td>${m.placa_veiculo || '---'}</td>
                            <td>${m.telefone || '---'}</td>
                            <td style="text-align: center;">${comissaoText}</td>
                            <td style="text-align: center;">${salarioText}</td>
                            <td style="text-align: right; padding-right: 25px;">
                                <button class="btn-icon-edit" onclick="prepararEdicaoMotorista('${json}')">
                                    <i data-lucide="pencil"></i>
                                </button>
                                <button class="btn-icon-delete" onclick="excluirMotorista(${m.id})">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 2. ATUALIZA O SELECT DE ROMANEIOS
        const selectRomMotorista = document.getElementById('rom-motorista-id');
        if (selectRomMotorista) {
            const options = motoristas.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
            selectRomMotorista.innerHTML = '<option value="">Selecione...</option>' + options;
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

    } catch (err) {
        console.error("Erro ao carregar motoristas:", err);
        avisar('error', 'Falha ao sincronizar lista de motoristas.');
    }
}

async function salvarMotorista() {
    const id = document.getElementById('motorista-id').value;
    const nome = document.getElementById('motorista-nome').value.trim();
    const cpf = document.getElementById('motorista-cpf').value.trim();
    const cnh = document.getElementById('motorista-cnh').value.trim();
    const placa_veiculo = document.getElementById('motorista-placa').value.trim();
    const telefone = document.getElementById('motorista-telefone').value.trim();
    const comissaoRaw = document.getElementById('motorista-comissao').value;
    const salarioRaw = document.getElementById('motorista-salario').value;

    if (!nome) {
        return Swal.fire('Atenção', 'O nome do motorista é obrigatório.', 'warning');
    }

    const comissao = parseFloat(comissaoRaw) || 0;
    
    let salario = 0;
    if (salarioRaw) {
        const valorLimpo = salarioRaw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
        salario = parseFloat(valorLimpo) || 0;
    }

    try {
        const res = await window.api.invoke('salvar-motorista', {
            id: id || null,
            nome,
            cpf,
            cnh,
            placa_veiculo,
            telefone,
            comissao,
            salario
        });
        if (res && res.success) {
            avisar('success', id ? 'Motorista atualizado!' : 'Motorista cadastrado!');
            resetMotoristaForm();
            carregarMotoristas();
        } else {
            Swal.fire('Erro', tratarErroIpc(res.error), 'error');
        }
    } catch (err) {
        Swal.fire('Erro', tratarErroIpc(err), 'error');
    }
}

function prepararEdicaoMotorista(json) {
    const m = JSON.parse(decodeURIComponent(json));
    document.getElementById('motorista-id').value = m.id;
    document.getElementById('motorista-nome').value = m.nome;
    document.getElementById('motorista-cpf').value = m.cpf || '';
    document.getElementById('motorista-cnh').value = m.cnh || '';
    document.getElementById('motorista-placa').value = m.placa_veiculo || '';
    document.getElementById('motorista-telefone').value = m.telefone || '';
    document.getElementById('motorista-comissao').value = m.comissao || '';
    document.getElementById('motorista-salario').value = m.salario ? m.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';

    document.getElementById('btn-salvar-motorista').querySelector('span').innerText = "Atualizar Motorista";
    document.getElementById('btn-cancelar-motorista').style.display = "block";
    document.getElementById('mot-form-titulo').innerText = "Editar Motorista";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetMotoristaForm() {
    document.getElementById('motorista-id').value = "";
    document.getElementById('motorista-nome').value = "";
    document.getElementById('motorista-cpf').value = "";
    document.getElementById('motorista-cnh').value = "";
    document.getElementById('motorista-placa').value = "";
    document.getElementById('motorista-telefone').value = "";
    document.getElementById('motorista-comissao').value = "";
    document.getElementById('motorista-salario').value = "";

    document.getElementById('btn-salvar-motorista').querySelector('span').innerText = "Salvar Motorista";
    document.getElementById('btn-cancelar-motorista').style.display = "none";
    document.getElementById('mot-form-titulo').innerText = "Novo Motorista";
}

async function excluirMotorista(id) {
    const r = await Swal.fire({ title: 'Excluir Motorista?', text: "Isso não pode ser desfeito.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#6366f1' });
    if (r.isConfirmed) {
        try {
            const res = await window.api.invoke('excluir-motorista', id);
            if (res && res.success) {
                avisar('success', 'Motorista removido.');
                carregarMotoristas();
            } else {
                Swal.fire({ title: 'Não permitido', text: res.error, icon: 'error', confirmButtonColor: '#6366f1' });
            }
        } catch (err) {
            Swal.fire({ title: 'Erro', text: tratarErroIpc(err), icon: 'error', confirmButtonColor: '#6366f1' });
        }
    }
}

// --- GESTÃO DE TORAS (ENTRADAS) ---

/**
 * Calcula o volume bruto de uma tora conforme a espécie.
 * Jatobá e Muiracatiara ganham +20cm no rodo; demais espécies ganham +10cm.
 * Todas as espécies ganham +10cm (0,10m) no comprimento.
 * Fórmula: ((rodo + X) / 4)² × (comp + 0,10) / 10.000  — truncado em 3 casas
 */
function calcularVolumeBruto(rodo, comp, especieNome) {
    const nome = (especieNome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isEspecial = nome.includes('jatob') || nome.includes('muiracatiara');
    const ajusteRodo = isEspecial ? 20 : 10;
    const rodoAjustado = rodo + ajusteRodo;
    const compAjustado = comp + 0.10;
    const lado = rodoAjustado / 4;
    const volRaw = (lado * lado * compAjustado) / 10000;
    return Math.floor(volRaw * 1000) / 1000;
}

function calcularCubagem() {
    const rodo = obterValorLimpo('rodo');
    const d1 = obterValorLimpo('d1');
    const d2 = obterValorLimpo('d2');
    const comp = obterValorLimpo('comprimento');
    
    const rodoBruto = obterValorLimpo('rodo-bruto');
    const compBruto = obterValorLimpo('comprimento-bruto');
    const detalheSmall = document.getElementById('detalhe-calculo');

    // 1. CÁLCULO DO OCO (Truncamento na 3ª casa)
    const volOcoRaw = (d1 * d2 * comp) / 10000;
    const volOcoTrunc = Math.floor(volOcoRaw * 1000) / 1000;

    const descVer = document.getElementById('total-desconto-ver');
    if (descVer) descVer.value = volOcoTrunc.toFixed(3).replace('.', ',');

    // 2. CÁLCULO DA TORA (Quarto do Rodo)
    let volumeFinal = "0,000";
    let volBrutoAdjusted = 0;

    if (rodo > 0 && comp > 0) {
        const lado = Math.floor(rodo / 4);
        const volBrutoRaw = (lado * lado * comp) / 10000;
        const volBrutoTrunc = Math.floor(volBrutoRaw * 1000) / 1000;
        volumeFinal = (volBrutoTrunc - volOcoTrunc).toFixed(3);
    }

    if (rodoBruto > 0 && compBruto > 0) {
        const ladoBruto = rodoBruto / 4;
        const volBrutoRaw = (ladoBruto * ladoBruto * compBruto) / 10000;
        volBrutoAdjusted = Math.floor(volBrutoRaw * 1000) / 1000;
    }

    if (rodo > 0 && comp > 0) {
        const volRes = document.getElementById('volume-result');
        if (volRes) volRes.innerText = volumeFinal.replace('.', ',') + " m³";
        if (detalheSmall) {
            detalheSmall.innerText = ` Bruto: ${volBrutoAdjusted.toFixed(3)} m³ | Oco: ${volOcoTrunc.toFixed(3)} m³`;
        }
        return { liquido: volumeFinal, oco: volOcoTrunc, bruto: volBrutoAdjusted };
    } else {
        const volRes = document.getElementById('volume-result');
        if (volRes) volRes.innerText = "0,000 m³";
        return { liquido: "0.000", oco: volOcoTrunc, bruto: volBrutoAdjusted };
    }
}

// 3. FUNÇÃO SALVAR (INTEGRADA)
async function salvarTora() {
    const calc = calcularCubagem();
    const idExistente = document.getElementById('tora-id').value;

    const tora = {
        id: idExistente || null,
        codigo: document.getElementById('tora-codigo').value, // Nosso "Número" [cite: 2026-01-17]
        especie_id: document.getElementById('tora-especie').value,
        lote_id: document.getElementById('tora-lote').value,
        romaneio_id: document.getElementById('tora-romaneio')?.value || null,
        rodo: obterValorLimpo('rodo'),
        desconto_1: obterValorLimpo('d1'),
        desconto_2: obterValorLimpo('d2'),
        total_desconto: parseFloat(calc.oco),
        comprimento: obterValorLimpo('comprimento'),
        volume: parseFloat(calc.liquido),
        volume_bruto: parseFloat(calc.bruto),
        rodo_bruto: obterValorLimpo('rodo-bruto'),
        comprimento_bruto: obterValorLimpo('comprimento-bruto')
    };

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
        const canal = idExistente ? 'editar-tora' : 'salvar-tora';
        const result = await window.api.invoke(canal, tora);

        if (result.success) {
            formularioSujo = false;

            Swal.fire({
                icon: 'success',
                title: idExistente ? 'Tora Atualizada' : 'Tora Registrada',
                text: `Tora número ${tora.codigo} salva com sucesso!`,
                timer: 1500,
                showConfirmButton: false
            });

            resetFormEntrada();
            listarTorasRecentes();
        }
    } catch (err) {
        console.error('Erro ao salvar:', err);
        Swal.fire('Erro no Sistema', tratarErroIpc(err), 'error');
    }
}

async function listarTorasRecentes() {
    try {
        const toras = await window.api.invoke('listar-toras-recentes');
        const tbody = document.getElementById('lista-entradas-recentes');
        if (!tbody) return;

        tbody.innerHTML = '';

        toras.forEach(tora => {
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

async function prepararEdicaoTora(json) {
    const t = JSON.parse(decodeURIComponent(json));

    if (t.status === 'serrada') {
        Swal.fire('Bloqueado', 'Esta tora já foi serrada e não pode mais ser editada.', 'warning');
        return;
    }

    await carregarTela('entradas', document.querySelector('li[onclick*="entradas"]'));

    document.getElementById('tora-id').value = t.id;
    document.getElementById('tora-codigo').value = t.codigo;

    document.getElementById('rodo').value = t.rodo || 0;
    document.getElementById('rodo-bruto').value = t.rodo_bruto || 0;
    document.getElementById('d1').value = t.desconto_1 || 0;
    document.getElementById('d2').value = t.desconto_2 || 0;

    document.getElementById('comprimento').value = t.comprimento ? t.comprimento.toFixed(2).replace('.', ',') : "0,00";
    document.getElementById('comprimento-bruto').value = t.comprimento_bruto ? t.comprimento_bruto.toFixed(2).replace('.', ',') : "0,00";

    if (document.getElementById('tora-especie')) document.getElementById('tora-especie').value = t.especie_id;
    if (document.getElementById('tora-lote')) document.getElementById('tora-lote').value = t.lote_id;
    const selRom = document.getElementById('tora-romaneio');
    if (selRom && t.romaneio_id) selRom.value = t.romaneio_id;

    calcularCubagem();

    const btnSalvar = document.getElementById('btn-salvar-tora');
    if (btnSalvar) {
        btnSalvar.querySelector('span').innerText = "Atualizar Tora";
        const icone = btnSalvar.querySelector('i');
        if (icone) icone.setAttribute('data-lucide', 'save');
    }

    const btnCancelar = document.getElementById('btn-cancelar-tora');
    if (btnCancelar) btnCancelar.style.display = "block";

    if (window.lucide) window.lucide.createIcons();
    if (typeof relockAllBrutoFields === 'function') relockAllBrutoFields();

    setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const input = document.getElementById('tora-codigo');
        if (input) input.focus();
    }, 100);
}

function resetFormEntrada() {
    const campos = [
        'tora-id',
        'tora-codigo',
        'rodo',
        'rodo-bruto',
        'd1',
        'd2',
        'total-desconto-ver',
        'comprimento',
        'comprimento-bruto'
    ];

    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    if (document.getElementById('tora-especie')) document.getElementById('tora-especie').selectedIndex = 0;
    if (document.getElementById('tora-lote')) document.getElementById('tora-lote').selectedIndex = 0;
    if (document.getElementById('tora-romaneio')) document.getElementById('tora-romaneio').selectedIndex = 0;

    const volRes = document.getElementById('volume-result');
    if (volRes) volRes.innerText = "0,000 m³";

    const detalheCalc = document.getElementById('detalhe-calculo');
    if (detalheCalc) detalheCalc.innerText = "";

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

    if (window.lucide) window.lucide.createIcons();
    if (typeof relockAllBrutoFields === 'function') relockAllBrutoFields();

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
            const dataFmt = tora.data_saida ? tora.data_saida.split('-').reverse().join('/') : '---';
            const medidasDisplay = `Rodo: ${tora.rodo} | Comp: ${tora.comprimento.toFixed(2)}`;
            Swal.fire({
                title: 'Tora já Serrada',
                text: `A tora de n. ${tora.codigo} com medidas ${medidasDisplay} já foi serrada no dia ${dataFmt}.`,
                icon: 'warning',
                confirmButtonColor: '#6366f1'
            });
            codigoInput.value = '';
            codigoInput.focus();
        } else {
            Swal.fire('Não encontrada', 'Número de tora não localizado no pátio ou não cadastrado.', 'warning');
            codigoInput.value = '';
            codigoInput.focus();
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', tratarErroIpc(err), 'error');
    }
}

function atualizarTabelaTemporaria() {
    const tbody = document.getElementById('lista-baixa-temporaria');
    if (!tbody) return;

    let totalVol = 0;

    // Cria uma cópia com os índices originais para mapear de trás para frente (mais recente primeiro)
    const itensReversos = listaParaBaixa.map((tora, index) => ({ tora, index })).reverse();

    tbody.innerHTML = itensReversos.map(({ tora, index }) => {
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
        const logoBase64 = window.LOGO_PADRAO_BASE64 || '';
        const htmlParaPDF = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px 30px; color: #1e293b; }
                    .header-wrapper { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
                    .header-left { display: flex; align-items: center; gap: 14px; }
                    .header-logo { width: 50px; height: 50px; object-fit: contain; }
                    .header-info h1 { margin: 0; font-size: 17px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
                    .header-info .system-name { font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
                    .header-info p { margin: 2px 0 0; font-size: 10px; color: #64748b; }
                    .header-badge { background: #0f172a; color: #fff; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 6px; text-align: right; }
                    
                    .info-topo { margin-bottom: 15px; font-size: 11px; display: flex; justify-content: space-between; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    thead th { 
                        background-color: #0f172a !important; 
                        color: #ffffff !important; 
                        font-size: 10px; 
                        padding: 8px; 
                        border: 1px solid #0f172a;
                        -webkit-print-color-adjust: exact;
                        text-transform: uppercase;
                    }
                    td { font-size: 10px; padding: 7px; border: 1px solid #e2e8f0; text-align: center; }
                    tbody tr:nth-child(even) { background-color: #f8fafc; }
                    
                    .oco-info { color: #e11d48; font-size: 9px; display: block; margin-top: 2px; font-weight: 600; }
                    .bold { font-weight: bold; }
                    
                    .resumo-secao { margin-top: 20px; font-size: 10px; border: 1px solid #e2e8f0; padding: 12px; background: #f8fafc; border-radius: 6px; }
                    .total-final { text-align: right; font-size: 13px; font-weight: bold; margin-top: 15px; border-top: 2px solid #0f172a; padding-top: 8px; }
                    
                    .assinaturas { margin-top: 50px; display: flex; justify-content: space-around; }
                    .sig-line { border-top: 1px solid #475569; width: 200px; text-align: center; font-size: 9.5px; font-weight: 600; color: #475569; padding-top: 5px; }
                    .footer { margin-top: 30px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header-wrapper">
                    <div class="header-left">
                        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" />` : ''}
                        <div class="header-info">
                            <div class="system-name">MT-PRO - Controle de Estoque de Toras</div>
                            <h1>Romaneio de Saída de Toras</h1>
                            <p>Documento de Baixa e Controle de Pátio</p>
                        </div>
                    </div>
                    <div class="header-badge">
                        ${listaParaBaixa.length} TORAS
                    </div>
                </div>

                <div class="info-topo">
                    <span><strong>Data de Saída:</strong> ${dataSaida.split('-').reverse().join('/')}</span>
                    <span><strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</span>
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

                <div class="footer">
                    Documento gerado pelo sistema MT-PRO - Controle de Estoque de Toras em ${new Date().toLocaleString('pt-BR')}
                </div>
            </body>
            </html>
        `;

        const nomeArquivoPDF = gerarNomeArquivoDataHora('Romaneio_Saida');
        await window.api.invoke('gerar-pdf-logs', { html: htmlParaPDF, nomeArquivo: nomeArquivoPDF });
        Swal.fire('Sucesso', 'Baixa realizada e romaneio gerado com sucesso!', 'success');
        limparListaTemporaria();

    } catch (err) {
        console.error(err);
        Swal.fire('Erro', tratarErroIpc(err), 'error');
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
        const especieSelect = document.getElementById('filtro-estoque-especie');
        const especieId = especieSelect ? especieSelect.value : 'todos';
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
            window.api.invoke('get-totais-estoque', { status, codigo, loteId, especieId }),
            window.api.invoke('get-estoque-detalhado', { status, codigo, loteId, especieId, limite: 50, pular: offsetEstoque })
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
            let medidasDisplay = `R: ${t.rodo} | C: ${Number(t.comprimento || 0).toFixed(2)}`;
            if (t.desconto_1 > 0 || t.desconto_2 > 0) {
                const volDesc = (t.total_desconto !== undefined && t.total_desconto !== null && t.total_desconto > 0)
                    ? Number(t.total_desconto)
                    : Math.floor(((Number(t.desconto_1 || 0) * Number(t.desconto_2 || 0) * Number(t.comprimento || 0)) / 10000) * 1000) / 1000;
                const volDescFmt = volDesc.toFixed(3).replace('.', ',');
                medidasDisplay += `<br><small style="color: #e11d48; font-weight: 600;">Oco: ${t.desconto_1}×${t.desconto_2} (-${volDescFmt} m³)</small>`;
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
    if (!Array.isArray(lotes)) {
        console.error("Erro ao carregar lotes para o filtro:", lotes);
        return;
    }
    selectLote.innerHTML = '<option value="todos">Todos os Lotes</option>' + lotes.map(l => `<option value="${l.id}">Lote: ${l.numero}</option>`).join('');
}

async function atualizarFiltroEspecies() {
    const selectEspecie = document.getElementById('filtro-estoque-especie');
    if (!selectEspecie) return;
    const especies = await window.api.invoke('get-especies');
    if (!Array.isArray(especies)) {
        console.error("Erro ao carregar espécies para o filtro:", especies);
        return;
    }
    selectEspecie.innerHTML = '<option value="todos">Todas as Espécies</option>' + especies.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
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
                Swal.fire('Não permitido', tratarErroIpc(resultado.error), 'error');
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
        // Busca espécies, lotes, fornecedores e motoristas do banco
        const especies = await window.api.invoke('get-especies');
        const lotes = await window.api.invoke('get-lotes');
        const fornecedores = await window.api.invoke('listar-fornecedores');
        const motoristas = await window.api.invoke('listar-motoristas');

        const selectEspecie = document.getElementById('rel-especie');
        const selectLote = document.getElementById('rel-lote');
        const selectForn = document.getElementById('rel-forn-id');
        const selectMoto = document.getElementById('rel-moto-id');

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

        // Popular Fornecedores
        if (selectForn) {
            selectForn.innerHTML = '<option value="todos">Todos os Fornecedores</option>';
            fornecedores.forEach(forn => {
                selectForn.innerHTML += `<option value="${forn.id}">${forn.nome}</option>`;
            });
        }

        // Popular Motoristas
        if (selectMoto) {
            selectMoto.innerHTML = '<option value="todos">Todos os Motoristas</option>';
            motoristas.forEach(moto => {
                selectMoto.innerHTML += `<option value="${moto.id}">${moto.nome}</option>`;
            });
        }

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
        Swal.fire('Erro', tratarErroIpc(err), 'error');
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

        // --- CABEÇALHO COM LOGO E NOME DO SISTEMA ---
        const logoBase64 = window.LOGO_PADRAO_BASE64 || '';
        let headerTextX = 14;
        if (logoBase64) {
            try {
                doc.addImage(logoBase64, 'PNG', 14, 8, 16, 16);
                headerTextX = 33;
            } catch (e) {
                console.warn('Falha ao adicionar logo no jsPDF:', e);
            }
        }
        doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(15, 23, 42);
        doc.text("MT-PRO - Controle de Estoque de Toras", headerTextX, 13);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(71, 85, 105);
        doc.text("Relatório Gerencial Detalhado de Toras", headerTextX, 18);
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
        doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, headerTextX, 23);
        doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.line(14, 26, 283, 26);

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
            startY: 29,
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

        const nomeArquivoPDF = gerarNomeArquivoDataHora('Relatorio_Toras');
        doc.save(nomeArquivoPDF);
        Swal.close();

    } catch (err) {
        console.error(err);
        Swal.fire('Erro', tratarErroIpc(err), 'error');
    }
}

function limparFiltrosRelatorio() {
    // 1. Resetar Campos de Filtro (Inputs e Selects)
    document.getElementById('rel-tipo').value = 'geral';
    document.getElementById('rel-data-inicio').value = '';
    document.getElementById('rel-data-fim').value = '';
    document.getElementById('rel-especie').value = 'todas';
    document.getElementById('rel-lote').value = 'todos';

    // 2. Resetar Painel de Resultados (Volume e Quantidade)
    document.getElementById('rel-total-vol').innerText = '0,000 m³';
    document.getElementById('rel-total-qtd').innerText = '0 toras encontradas';

    // 3. Limpar Resumos Extras (se houver)
    const containerResumos = document.getElementById('container-resumos');
    if (containerResumos) containerResumos.innerHTML = '';

    // 4. Resetar a Tabela para o estado inicial
    const tabelaCorpo = document.getElementById('rel-tabela-corpo');
    tabelaCorpo.innerHTML = `
        <tr>
            <td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">
                <i data-lucide="info" style="display: inline-block; vertical-align: middle; margin-right: 8px;"></i>
                Ajuste os filtros e clique em "Visualizar" para carregar os dados.
            </td>
        </tr>
    `;

    // 5. Esconder botão "Carregar mais"
    const btnCarregarMais = document.getElementById('btn-rel-carregar-mais');
    if (btnCarregarMais) btnCarregarMais.style.display = 'none';

    // Re-renderiza os ícones do Lucide na tabela resetada
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
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
        Swal.fire('Erro', tratarErroIpc(err), 'error');
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
            tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center; padding:20px;">Nenhum registro encontrado.</td></tr>';
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
                    <td class="text-muted" style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; white-space: nowrap;">
                        <i data-lucide="calendar" style="width:12px; height:12px; display:inline; margin-right:4px;"></i>${dataExibicao}
                    </td>
                    <td class="text-title" style="font-weight: 500;">${log.usuario || 'Sistema'}</td>
                    <td><span class="${badgeClass}">${acaoUpper}</span></td>
                    <td class="text-muted" style="font-size: 0.85rem; line-height: 1.4;">${log.descricao}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error("Erro na view de logs:", err);
        tbody.innerHTML = `<tr><td colspan="4" style="color:#ef4444; text-align:center; padding:20px;">Erro ao carregar: ${tratarErroIpc(err)}</td></tr>`;
    }
}

// Função auxiliar para o botão "Limpar Filtros" (refresh-cw)
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
    const logoBase64 = window.LOGO_PADRAO_BASE64 || '';
    const htmlParaPDF = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 35px; color: #1e293b; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; margin-bottom: 20px; padding-bottom: 12px; }
                    .header-left { display: flex; align-items: center; gap: 14px; }
                    .header-logo { width: 48px; height: 48px; object-fit: contain; }
                    .system-name { font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
                    h1 { margin: 0; font-size: 18px; color: #0f172a; font-weight: 800; }
                    .periodo { color: #64748b; font-size: 11px; margin-top: 3px; }
                    .emissao { font-size: 10px; color: #64748b; text-align: right; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px; border: 1px solid #0f172a; font-size: 10.5px; text-transform: uppercase; -webkit-print-color-adjust: exact; }
                    td { padding: 9px; border: 1px solid #e2e8f0; font-size: 10.5px; vertical-align: top; }
                    tbody tr:nth-child(even) { background-color: #f8fafc; }
                    .badge { font-weight: bold; font-size: 10px; }
                    .footer { margin-top: 30px; font-size: 9.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-left">
                        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" />` : ''}
                        <div>
                            <div class="system-name">MT-PRO - Controle de Estoque de Toras</div>
                            <h1>Relatório de Auditoria e Logs</h1>
                            <div class="periodo">${periodo}</div>
                        </div>
                    </div>
                    <div class="emissao">
                        <strong>Emissão:</strong><br>${new Date().toLocaleString('pt-BR')}
                    </div>
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
                    Documento gerado pelo sistema MT-PRO - Controle de Estoque de Toras em: ${new Date().toLocaleString('pt-BR')}
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
        const nomeArquivoPDF = gerarNomeArquivoDataHora('Relatorio_Logs');
        const resultado = await window.api.invoke('gerar-pdf-logs', { html: htmlParaPDF, nomeArquivo: nomeArquivoPDF });

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
            text: tratarErroIpc(err),
            confirmButtonColor: '#ef4444'
        });
    }
}
// --- FUNÇÃO PARA RENDERIZAR OS GRÁFICOS EM SVG NATIVO ---
function renderizarGraficosDashboard(dados) {
    // 1. GRÁFICO DE BARRAS (Movimentação Mensal)
    const containerBarras = document.getElementById('chart-volume-movimentacao');
    if (containerBarras) {
        const hist = dados.historicoMovimentacao || [];
        if (hist.length === 0) {
            containerBarras.innerHTML = `<span class="text-muted" style="margin: auto;">Sem dados de movimentação recente</span>`;
        } else {
            // Acha o valor máximo para dimensionar a escala
            let maxVol = 0;
            hist.forEach(h => {
                if (h.entradas > maxVol) maxVol = h.entradas;
                if (h.saidas > maxVol) maxVol = h.saidas;
            });
            maxVol = Math.max(maxVol, 1.0); // evita divisões por zero e dá margem visual

            // Desenha o SVG
            const width = 500;
            const height = 200;
            const paddingLeft = 35;
            const paddingRight = 15;
            const paddingTop = 20;
            const paddingBottom = 25;
            
            const graphWidth = width - paddingLeft - paddingRight;
            const graphHeight = height - paddingTop - paddingBottom;
            const numMonths = hist.length;
            const colWidth = graphWidth / numMonths;

            // Linhas de Grade e Eixo Y
            let svgGrid = '';
            for (let i = 0; i <= 4; i++) {
                const yVal = maxVol * (i / 4);
                const yPos = height - paddingBottom - (graphHeight * (i / 4));
                svgGrid += `
                    <line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" class="svg-chart-grid"></line>
                    <text x="${paddingLeft - 8}" y="${yPos + 3}" text-anchor="end" class="svg-chart-label" style="font-size: 8px;">${yVal.toFixed(1)}</text>
                `;
            }

            // Barras e Eixos X
            let svgBars = '';
            hist.forEach((h, index) => {
                const xCenter = paddingLeft + (colWidth * index) + (colWidth / 2);
                
                // Dimensões das duas colunas (entrada e saída)
                const barW = Math.max(colWidth * 0.28, 8);
                const space = 4;
                const entX = xCenter - barW - (space / 2);
                const saiX = xCenter + (space / 2);

                const entHeight = (h.entradas / maxVol) * graphHeight;
                const saiHeight = (h.saidas / maxVol) * graphHeight;

                const entY = height - paddingBottom - entHeight;
                const saiY = height - paddingBottom - saiHeight;

                svgBars += `
                    <!-- Grupo da barra do mês -->
                    <g class="chart-bar-group">
                        <!-- Barra Entrada (Azul/Índigo) -->
                        <rect x="${entX}" y="${entY}" width="${barW}" height="${entHeight}" class="svg-chart-bar-ent"></rect>
                        <text x="${entX + barW/2}" y="${entY - 5}" class="svg-chart-value">${h.entradas.toFixed(2)}</text>
                    </g>
                    <g class="chart-bar-group">
                        <!-- Barra Saída (Rosa/Vermelho) -->
                        <rect x="${saiX}" y="${saiY}" width="${barW}" height="${saiHeight}" class="svg-chart-bar-sai"></rect>
                        <text x="${saiX + barW/2}" y="${saiY - 5}" class="svg-chart-value">${h.saidas.toFixed(2)}</text>
                    </g>
                    <!-- Nome do Mês -->
                    <text x="${xCenter}" y="${height - 8}" class="svg-chart-label">${h.label}</text>
                `;
            });

            containerBarras.innerHTML = `
                <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
                    ${svgGrid}
                    <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" class="svg-chart-axis"></line>
                    ${svgBars}
                </svg>
            `;
        }
    }

    // 2. GRÁFICO DONUT (Espécies)
    const containerDonut = document.getElementById('chart-especies-donut');
    if (containerDonut) {
        const ranking = dados.rankingEspecies || [];
        if (ranking.length === 0) {
            containerDonut.innerHTML = `<span class="text-muted" style="margin: auto;">Nenhuma tora em estoque no pátio</span>`;
        } else {
            const totalEstoqueVol = dados.totalVolume || 1.0;
            const cores = ['#6366f1', '#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#94a3b8'];

            // Desenha o círculo
            const radius = 50;
            const circ = 2 * Math.PI * radius; // ~314.16
            let currentOffset = 0;

            let svgSegments = '';
            let legendHtml = '<div class="donut-legend">';

            ranking.forEach((item, index) => {
                const vol = Number(item.volumeTotal);
                const percent = (vol / totalEstoqueVol) * 100;
                const strokeLength = (vol / totalEstoqueVol) * circ;
                const strokeOffset = circ - currentOffset;
                currentOffset += strokeLength;

                const cor = cores[index % cores.length];

                // Segmento do arco
                svgSegments += `
                    <circle cx="70" cy="70" r="${radius}" 
                            fill="transparent" 
                            stroke="${cor}" 
                            stroke-width="12" 
                            stroke-dasharray="${strokeLength} ${circ - strokeLength}" 
                            stroke-dashoffset="${strokeOffset}" 
                            class="donut-segment" 
                            transform="rotate(-90 70 70)">
                    </circle>
                `;

                // Item da Legenda
                legendHtml += `
                    <div class="donut-legend-item">
                        <div class="donut-legend-left">
                            <span class="donut-legend-color" style="background: ${cor}"></span>
                            <span style="font-weight: 500;">${item.especie}</span>
                        </div>
                        <div>
                            <span>${vol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³</span>
                            <span class="donut-legend-percent">${percent.toFixed(0)}%</span>
                        </div>
                    </div>
                `;
            });

            legendHtml += '</div>';

            containerDonut.innerHTML = `
                <div style="position: relative; width: 140px; height: 140px; flex-shrink: 0;">
                    <svg width="100%" height="100%" viewBox="0 0 140 140">
                        <!-- Círculo Base Cinza -->
                        <circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="var(--border-color)" stroke-width="12"></circle>
                        ${svgSegments}
                    </svg>
                    <!-- Texto no Centro do Donut -->
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
                        <span style="font-size: 1.1rem; font-weight: 800; color: var(--text-dark);">${dados.totalPecas}</span>
                        <span style="font-size: 0.6rem; color: var(--text-main); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Toras</span>
                    </div>
                </div>
                ${legendHtml}
            `;
        }
    }
}

// --- FUNÇÃO PARA VERIFICAR E ATUALIZAR STATUS DE SINCRONIZAÇÃO EM NUVEM ---
async function atualizarSyncStatus() {
    try {
        const elIndicator = document.getElementById('cloud-sync-indicator');
        const elIcon = document.getElementById('cloud-sync-icon');
        const elText = document.getElementById('cloud-sync-text');
        const elCount = document.getElementById('cloud-sync-pending-count');

        if (!elIndicator) return;

        const res = await window.api.invoke('get-sync-status');
        
        // Remove classes antigas
        elIndicator.classList.remove('pending', 'synced', 'syncing', 'offline');

        if (res && res.success) {
            if (res.pending > 0) {
                elIndicator.classList.add('pending');
                elIndicator.title = `${res.pending} registros locais aguardando envio para a nuvem. Clique para forçar sincronização.`;
                if (elText) elText.innerText = "Pendente";
                if (elCount) {
                    elCount.innerText = res.pending;
                    elCount.style.display = 'inline-block';
                }
            } else {
                elIndicator.classList.add('synced');
                elIndicator.title = "Todos os dados locais estão sincronizados com o Supabase. Clique para atualizar.";
                if (elText) elText.innerText = "Sincronizado";
                if (elCount) elCount.style.display = 'none';
            }
        } else {
            // Em caso de erro (ex: offline total ou licença inativa)
            elIndicator.classList.add('offline');
            elIndicator.title = "Modo Offline ou sem rede. Clique para re-tentar.";
            if (elText) elText.innerText = "Offline";
            if (elCount) elCount.style.display = 'none';
        }
    } catch (err) {
        console.warn("Erro ao ler status de sync:", err);
    }
}

// --- FORÇAR SINCRONIZAÇÃO MANUAL AO CLICAR NA NUVEM ---
async function forcarSincronizacaoManual() {
    const elIndicator = document.getElementById('cloud-sync-indicator');
    if (!elIndicator) return;

    elIndicator.classList.remove('pending', 'synced', 'offline');
    elIndicator.classList.add('syncing');
    
    const elText = document.getElementById('cloud-sync-text');
    if (elText) elText.innerText = "Enviando...";

    try {
        const res = await window.api.invoke('sincronizar-nuvem-manual');
        if (res && res.success) {
            avisar('success', 'Sincronização em nuvem concluída!');
        } else {
            Swal.fire('Aviso', 'Alguns registros podem não ter sido sincronizados por problemas de rede.', 'warning');
        }
    } catch (e) {
        console.error("Erro sync manual:", e);
    } finally {
        await atualizarSyncStatus();
    }
}

async function atualizarDashboard() {
    try {
        const dados = await window.api.invoke('get-dashboard-data');

        if (!dados || dados.success === false || !dados.ultimasToras) {
            console.warn("Dados do dashboard indisponíveis ou erro retornado:", dados);
            return;
        }

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
                tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center; padding: 20px;">Nenhum registro recente.</td></tr>`;
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
                        <td class="text-title" style="font-weight: 600;">${tora.codigo}</td>
                        <td class="text-muted">${tora.especie || 'Não informada'}</td>
                        <td class="text-title" style="font-weight: 600;">${Number(tora.volume || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                        <td class="text-right text-muted" style="font-size: 0.85rem;"> <span style="color: ${badgeColor}; font-weight: bold; margin-right: 5px;">${badgeText}</span>
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
                    <span style="font-weight: 600;">${lote.lote}</span>
                    <span class="text-muted">${Number(lote.volumeTotal).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</span>
                </div>
                <div class="lote-bar-bg border-subtle">
                    <div class="lote-bar-fill" style="width: ${percentual}%"></div>
                </div>
                <div class="text-muted" style="font-size: 0.7rem; margin-top: 2px; opacity: 0.7;">
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
            <div class="border-subtle text-muted" style="font-size: 0.8rem; padding: 8px 0; border-bottom: 1px solid;">
                <strong style="color: var(--accent-color);">${hora}</strong> - ${log.descricao}
            </div>`;
            }).join('');
        }

        // Renderiza os novos gráficos em SVG
        renderizarGraficosDashboard(dados);

        // Atualiza o estado de sincronização em nuvem
        atualizarSyncStatus();

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
        setTimeout(() => inputBusca.style.borderColor = '', 2000);
        return;
    }

    try {
        const resposta = await window.api.invoke('buscar-tora-por-numero', numeroOriginal);

        if (!resposta.success || !resposta.data) {
            Swal.fire({
                title: 'Tora Não Localizada',
                text: `O Número "${numeroOriginal}" não foi encontrado no estoque.`,
                icon: 'info',
                confirmButtonColor: 'var(--accent-color, #6366f1)',
                confirmButtonText: 'Entendido'
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

        // --- LÓGICA DE STATUS E DATAS ---
        const isPatio = ['pátio', 'estoque', 'patio'].includes(t.status?.toLowerCase());
        const rawDataEntrada = t.data_entrada;
        const rawDataSaida = t.data_saida;
        const dataEntradaFormatada = rawDataEntrada ? rawDataEntrada.substring(0, 10).split('-').reverse().join('/') : '---';
        const dataSaidaFormatada = rawDataSaida ? rawDataSaida.substring(0, 10).split('-').reverse().join('/') : '---';

        // --- LÓGICA DO OCO E MEDIDAS BRUTAS ---
        const oco1 = parseInt(t.desconto_1) || 0;
        const oco2 = parseInt(t.desconto_2) || 0;
        const temOco = (oco1 > 0 || oco2 > 0);
        const volDesc = formatarVolume(t.total_desconto);
        const temBruto = (t.volume_bruto && Number(t.volume_bruto) > 0 && Number(t.volume_bruto) !== Number(t.volume));

        const statusPill = isPatio
            ? `<span class="modal-tora-status patio"><i data-lucide="check-circle-2"></i> No Pátio</span>`
            : `<span class="modal-tora-status serrada"><i data-lucide="scissors"></i> Serrada</span>`;

        const loteDisplay = t.lote_numero || t.numero ? `Lote ${t.lote_numero || t.numero}` : 'Sem Lote';
        const romaneioDisplay = t.romaneio_numero ? `Romaneio Nº ${t.romaneio_numero}` : (t.romaneio_id ? `Romaneio #${t.romaneio_id}` : 'Sem Romaneio');

        let htmlOco = "";
        if (temOco) {
            htmlOco = `
                <div class="modal-tora-oco-box">
                    <div class="modal-tora-oco-header">
                        <i data-lucide="alert-triangle"></i>
                        <span>Oco: ${oco1} × ${oco2} cm</span>
                    </div>
                    <div class="modal-tora-oco-detail">
                        Abatimento no volume: <b>-${volDesc} m³</b>
                    </div>
                </div>
            `;
        }

        let metricCardsHtml = `
            <div class="modal-tora-card-metric highlight">
                <div class="modal-tora-metric-icon">
                    <i data-lucide="box"></i>
                </div>
                <div class="modal-tora-metric-info">
                    <span class="modal-tora-metric-label">Volume Líquido Final</span>
                    <span class="modal-tora-metric-value">${formatarVolume(t.volume)} <small style="font-size:0.8rem; font-weight:600;">m³</small></span>
                </div>
            </div>
        `;

        if (temBruto) {
            metricCardsHtml += `
                <div class="modal-tora-card-metric">
                    <div class="modal-tora-metric-icon" style="background: rgba(3, 105, 161, 0.15); color:#0284c7;">
                        <i data-lucide="layers"></i>
                    </div>
                    <div class="modal-tora-metric-info">
                        <span class="modal-tora-metric-label">Volume Bruto</span>
                        <span class="modal-tora-metric-value" style="color:#0284c7;">${formatarVolume(t.volume_bruto)} <small style="font-size:0.8rem; font-weight:600;">m³</small></span>
                    </div>
                </div>
            `;
        }

        const modalHtml = `
            <div class="modal-tora-header">
                <div class="modal-tora-title-group">
                    <span class="modal-tora-badge-num">
                        <i data-lucide="tag"></i> Tora #${t.codigo}
                    </span>
                    <h3 class="modal-tora-title">
                        <i data-lucide="trees" style="color:var(--accent-color); width:24px; height:24px; flex-shrink:0;"></i>
                        <span>${t.especie_nome || 'Espécie não identificada'}</span>
                    </h3>
                </div>
                <div>
                    ${statusPill}
                </div>
            </div>

            <div class="modal-tora-body">
                <div class="modal-tora-hero-cards">
                    ${metricCardsHtml}
                </div>

                <div class="modal-tora-grid-details">
                    <!-- PAINEL DE MEDIDAS -->
                    <div class="modal-tora-panel">
                        <h4 class="modal-tora-panel-title">
                            <i data-lucide="ruler"></i> Medidas & Dimensões
                        </h4>
                        <div class="modal-tora-item">
                            <span class="modal-tora-item-label"><i data-lucide="disc"></i> Rodo:</span>
                            <span class="modal-tora-item-val">${t.rodo || 0} cm</span>
                        </div>
                        <div class="modal-tora-item">
                            <span class="modal-tora-item-label"><i data-lucide="move-horizontal"></i> Comprimento:</span>
                            <span class="modal-tora-item-val">${formatarComprimento(t.comprimento)} m</span>
                        </div>
                        ${(t.rodo_bruto || t.comprimento_bruto) ? `
                            <div class="modal-tora-item" style="border-top: 1px dashed var(--border-color); padding-top: 6px;">
                                <span class="modal-tora-item-label" style="font-size:0.8rem;"><i data-lucide="maximize-2"></i> Rodo/Comp. Bruto:</span>
                                <span class="modal-tora-item-val" style="font-size:0.83rem; color:var(--text-main);">${t.rodo_bruto || t.rodo} cm | ${formatarComprimento(t.comprimento_bruto || t.comprimento)} m</span>
                            </div>
                        ` : ''}
                        ${htmlOco}
                    </div>

                    <!-- PAINEL DE RASTREABILIDADE -->
                    <div class="modal-tora-panel">
                        <h4 class="modal-tora-panel-title">
                            <i data-lucide="info"></i> Rastreabilidade
                        </h4>
                        <div class="modal-tora-item">
                            <span class="modal-tora-item-label"><i data-lucide="boxes"></i> Lote:</span>
                            <span class="modal-tora-item-val">${loteDisplay}</span>
                        </div>
                        <div class="modal-tora-item">
                            <span class="modal-tora-item-label"><i data-lucide="clipboard-list"></i> Romaneio:</span>
                            <span class="modal-tora-item-val">${romaneioDisplay}</span>
                        </div>
                        <div class="modal-tora-item">
                            <span class="modal-tora-item-label"><i data-lucide="calendar"></i> Entrada:</span>
                            <span class="modal-tora-item-val">${dataEntradaFormatada}</span>
                        </div>
                        ${!isPatio ? `
                            <div class="modal-tora-item" style="border-top: 1px dashed var(--border-color); padding-top: 6px;">
                                <span class="modal-tora-item-label"><i data-lucide="scissors"></i> Saída/Serrada:</span>
                                <span class="modal-tora-item-val" style="color:#ef4444;">${dataSaidaFormatada}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        Swal.fire({
            html: modalHtml,
            width: '620px',
            customClass: {
                popup: 'modal-tora-popup',
                htmlContainer: 'modal-tora-body-wrapper'
            },
            padding: 0,
            showCloseButton: true,
            showCancelButton: !isPatio,
            confirmButtonText: '<i data-lucide="check" style="width:16px;height:16px;margin-right:6px;vertical-align:middle;"></i> Fechar',
            confirmButtonColor: 'var(--accent-color, #6366f1)',
            cancelButtonText: '<i data-lucide="rotate-ccw" style="width:16px;height:16px;margin-right:6px;vertical-align:middle;"></i> Reverter Baixa (Pátio)',
            cancelButtonColor: '#f59e0b',
            didOpen: () => {
                if (window.lucide) lucide.createIcons();
            }
        }).then((result) => {
            if (result.dismiss === Swal.DismissReason.cancel) {
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
        text: `Deseja realmente retornar a Tora Nº ${codigo} para o estoque ativo (Pátio)?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Sim, Reverter ao Pátio',
        cancelButtonText: 'Cancelar'
    });

    if (confirmar) {
        try {
            // 2. Chama o banco para alterar o status
            const resultado = await window.api.invoke('reverter-status-tora', id, codigo);

            if (resultado.success) {
                Swal.fire({
                    title: 'Estorno Realizado!',
                    text: `A Tora Nº ${codigo} retornou ao pátio com sucesso.`,
                    icon: 'success',
                    confirmButtonColor: 'var(--accent-color, #6366f1)'
                });
                atualizarDashboard();
                if (typeof carregarEstoque === 'function') carregarEstoque(true);

            } else {
                Swal.fire('Erro', tratarErroIpc(resultado.error), 'error');
            }
        } catch (err) {
            console.error("Erro ao estornar:", err);
            Swal.fire('Erro', tratarErroIpc(err), 'error');
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
/**
 * Função Principal de Proteção (Refatorada para Suporte a Mensalidade)
 */
async function verificarProtecao() {
    try {
        const res = await window.utils.checkActivationStatus();
        const idHardware = await window.utils.getMachineId();

        if (res.ativado) {
            console.log("Sistema Autorizado via Main.");
            liberarSistema();
        } else {
            if (res.motivo === 'expired') {
                console.warn("Assinatura Vencida.");
                mostrarTelaExpirada(idHardware);
            } else if (res.motivo === 'fraud') {
                alert("SISTEMA BLOQUEADO: Relógio do sistema retrocedido detectedo.");
                aplicarBloqueio(idHardware);
            } else {
                console.warn("Sistema não ativado. Solicitando chave.");
                aplicarBloqueio(idHardware);
            }
        }
    } catch (err) {
        console.error("Erro na verificação de proteção:", err);
        const idHardware = await window.utils.getMachineId();
        aplicarBloqueio(idHardware);
    }
}

/**
 * Esconde o sistema e mostra apenas a tela de ativação
 */
function aplicarBloqueio(id) {
    const sidebar = document.getElementById('sidebar');
    const mainHeader = document.querySelector('.main-header');
    if (sidebar) sidebar.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'none';

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('v-expired-screen').style.display = 'none';

    const viewAtivacao = document.getElementById('v-ativacao');
    if (viewAtivacao) {
        viewAtivacao.classList.add('active');
        viewAtivacao.style.display = 'block';
    }

    const inputID = document.getElementById('machine-id-display');
    if (inputID) inputID.value = id;
}

/**
 * Esconde o sistema e mostra a tela de assinatura vencida
 */
function mostrarTelaExpirada(id) {
    const sidebar = document.getElementById('sidebar');
    const mainHeader = document.querySelector('.main-header');
    if (sidebar) sidebar.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'none';

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('v-ativacao').style.display = 'none';

    const viewExpirado = document.getElementById('v-expired-screen');
    if (viewExpirado) {
        viewExpirado.style.display = 'flex';
    }

    const elId = document.getElementById('expired-machine-id');
    if (elId) elId.innerText = id;
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

    // 2. Esconde as telas de bloqueio
    if (viewAtivacao) {
        viewAtivacao.classList.remove('active');
        viewAtivacao.style.display = 'none';
    }
    document.getElementById('v-expired-screen').style.display = 'none';

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

/**
 * Listener para o botão de ativação
 */
async function realizarAtivacao() {
    const inputChave = document.getElementById('license-key-input');
    const chave = inputChave ? inputChave.value.trim() : '';

    if (!chave) {
        avisar('error', 'Por favor, insira a chave de ativação.');
        return;
    }

    try {
        const res = await window.utils.ativarSistema(chave);
        if (res.success) {
            avisar('success', 'Sistema ativado com sucesso!');
            liberarSistema();
            // Recarrega o dashboard
            if (typeof atualizarDashboard === 'function') atualizarDashboard();
        } else {
            avisar('error', tratarErroIpc(res.error) || 'Chave inválida.');
        }
    } catch (err) {
        avisar('error', 'Erro ao processar ativação.');
    }
}


function configurarNavegacaoEnter(arrayDeIds, callbackSucesso) {
    arrayDeIds.forEach((id, index) => {
        const el = document.getElementById(id);
        if (!el) return;

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evita comportamento padrão (como submeter formulários)

                // Procurar o próximo elemento na lista que seja válido e visível
                let nextIndex = index + 1;
                let nextEl = null;

                while (nextIndex < arrayDeIds.length) {
                    const candidate = document.getElementById(arrayDeIds[nextIndex]);
                    // Condição para focar: o elemento existe, não está desabilitado, não é readonly, e está visível
                    if (candidate && !candidate.disabled && !candidate.readOnly && candidate.offsetParent !== null) {
                        nextEl = candidate;
                        break;
                    }
                    nextIndex++;
                }

                if (nextEl) {
                    nextEl.focus();
                    if (typeof nextEl.select === 'function') {
                        try {
                            nextEl.select(); // Seleciona o texto para facilitar a digitação
                        } catch (err) {
                            // Ignora se o tipo de input não suportar seleção
                        }
                    }
                } else {
                    // Executa a ação caso não existam mais campos válidos após este
                    if (typeof callbackSucesso === 'function') {
                        callbackSucesso();
                    }
                }
            }
        });
    });
}


// final do renderer.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. Configura o listener do botão de ativação
    const btnAtivar = document.getElementById('btn-activar');
    if (btnAtivar) {
        btnAtivar.addEventListener('click', realizarAtivacao);
    }

    // 2. Rodamos a proteção vinda do Main
    verificarProtecao();

    // 3. Demais inicializações...
    try {
        if (typeof atualizarDashboard === "function") {
            atualizarDashboard();
        }
    } catch (err) {
        console.error("Erro ao carregar dados do dashboard:", err);
    }
    // Auto-preenchimento de valores brutos
    document.getElementById('rodo')?.addEventListener('input', () => {
        const rodo = obterValorLimpo('rodo');
        const especieSelect = document.getElementById('tora-especie');
        const especieNome = especieSelect ? especieSelect.options[especieSelect.selectedIndex]?.text || '' : '';
        const nomeNorm = especieNome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isEspecial = nomeNorm.includes('jatob') || nomeNorm.includes('muiracatiara');
        const ajusteRodo = isEspecial ? 20 : 10;
        if (rodo > 0) {
            document.getElementById('rodo-bruto').value = rodo + ajusteRodo;
        } else {
            document.getElementById('rodo-bruto').value = '';
        }
        calcularCubagem();
    });

    document.getElementById('comprimento')?.addEventListener('input', () => {
        const comp = obterValorLimpo('comprimento');
        if (comp > 0) {
            document.getElementById('comprimento-bruto').value = (comp + 0.10).toFixed(2).replace('.', ',');
        } else {
            document.getElementById('comprimento-bruto').value = '';
        }
        calcularCubagem();
    });

    document.getElementById('rom-tora-rodo')?.addEventListener('input', () => {
        const rodo = obterValorLimpo('rom-tora-rodo');
        const especieSelect = document.getElementById('rom-tora-especie');
        const especieNome = especieSelect ? especieSelect.options[especieSelect.selectedIndex]?.text || '' : '';
        const nomeNorm = especieNome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isEspecial = nomeNorm.includes('jatob') || nomeNorm.includes('muiracatiara');
        const ajusteRodo = isEspecial ? 20 : 10;
        if (rodo > 0) {
            document.getElementById('rom-tora-rodo-bruto').value = rodo + ajusteRodo;
        } else {
            document.getElementById('rom-tora-rodo-bruto').value = '';
        }
        calcularCubagemSubForm();
    });

    document.getElementById('rom-tora-comprimento')?.addEventListener('input', () => {
        const comp = obterValorLimpo('rom-tora-comprimento');
        if (comp > 0) {
            document.getElementById('rom-tora-comprimento-bruto').value = (comp + 0.10).toFixed(2).replace('.', ',');
        } else {
            document.getElementById('rom-tora-comprimento-bruto').value = '';
        }
        calcularCubagemSubForm();
    });

    document.getElementById('tora-especie')?.addEventListener('change', () => {
        const event = new Event('input');
        document.getElementById('rodo')?.dispatchEvent(event);
    });

    document.getElementById('rom-tora-especie')?.addEventListener('change', () => {
        const event = new Event('input');
        document.getElementById('rom-tora-rodo')?.dispatchEvent(event);
    });

    atualizarFiltroLotes();
    atualizarFiltroEspecies();

    // Configuração de Navegação por Tecla Enter e Salvamento Automático
    configurarNavegacaoEnter([
        'tora-codigo',
        'tora-especie',
        'tora-lote',
        'tora-romaneio',
        'rodo',
        'comprimento',
        'rodo-bruto',
        'comprimento-bruto',
        'd1',
        'd2'
    ], salvarTora);

    configurarNavegacaoEnter([
        'rom-data',
        'rom-fornecedor-id',
        'rom-motorista-id',
        'rom-observacoes',
        'rom-frete-valor',
        'rom-tora-codigo',
        'rom-tora-especie',
        'rom-tora-lote',
        'rom-tora-rodo',
        'rom-tora-comprimento',
        'rom-tora-rodo-bruto',
        'rom-tora-comprimento-bruto',
        'rom-tora-d1',
        'rom-tora-d2'
    ], adicionarToraTempList);

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
// --- INTEGRAÇÃO NUVEM E BACKUP ---

async function realizarLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-senha').value;
    const erroEl = document.getElementById('login-erro');
    const btn = document.getElementById('btn-entrar');
    const btnTexto = document.getElementById('btn-entrar-texto');
    const btnIcon = document.getElementById('btn-entrar-icon');

    // Limpa erro anterior
    erroEl.style.display = 'none';
    erroEl.innerText = '';

    if (!email || !password) {
        erroEl.innerText = "Preencha todos os campos.";
        erroEl.style.display = "block";
        return;
    }

    // --- ESTADO: CARREGANDO ---
    btn.disabled = true;
    btn.style.opacity = '0.8';
    btn.style.cursor = 'not-allowed';
    btnTexto.innerText = 'Entrando...';
    btnIcon.setAttribute('data-lucide', 'loader-2');
    btnIcon.style.animation = 'spin 1s linear infinite';
    if (window.lucide) lucide.createIcons();

    try {
        const res = await window.api.invoke('supabase-login', { email, password });

        if (res.success) {
            // --- ESTADO: SUCESSO ---
            btnTexto.innerText = 'Bem-vindo!';
            btnIcon.setAttribute('data-lucide', 'check-circle');
            btnIcon.style.animation = '';
            btn.style.background = '#10b981';
            if (window.lucide) lucide.createIcons();

            const mensagem = res.offline
                ? `Bem-vindo (Modo Offline), ${res.user.email}`
                : `Bem-vindo, ${res.user.email}`;
            avisar('success', mensagem);



            setTimeout(() => {
                document.getElementById('v-login-screen').style.display = "none";
                document.querySelector('.wrapper').style.display = "flex";
                carregarTela('home');
                carregarConfigsBackup();
            }, 400);

        } else {
            // --- ESTADO: ERRO ---
            erroEl.innerText = tratarErroIpc(res.error);
            erroEl.style.display = "block";
            _resetarBtnLogin(btn, btnTexto, btnIcon);
        }
    } catch (err) {
        erroEl.innerText = "Erro ao conectar com o servidor.";
        erroEl.style.display = "block";
        _resetarBtnLogin(btn, btnTexto, btnIcon);
    }
}

function _resetarBtnLogin(btn, btnTexto, btnIcon) {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.style.background = '';
    btnTexto.innerText = 'Entrar no Sistema';
    btnIcon.setAttribute('data-lucide', 'log-in');
    btnIcon.style.animation = '';
    if (window.lucide) lucide.createIcons();
}

async function sincronizarEspecies() {
    Swal.fire({
        title: 'Sincronizando...',
        text: 'Buscando espécies na nuvem...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await window.api.invoke('supabase-fetch-especies');
        if (res.success && res.data) {
            const syncRes = await window.api.invoke('sync-especies-local', res.data);
            if (syncRes.success) {
                if (res.data.length === 0) {
                    Swal.fire({
                        title: 'Sincronização Concluída',
                        text: 'A busca foi bem-sucedida, mas 0 espécies foram encontradas na Nuvem. Verifique se existem dados na tabela da Nuvem.',
                        icon: 'info',
                        confirmButtonColor: '#6366f1'
                    });
                } else {
                    Swal.fire('Sucesso', `Sincronizadas ${res.data.length} espécies com sucesso.`, 'success');
                }
                carregarEspecies();
            } else {
                throw new Error(syncRes.error);
            }
        } else {
            throw new Error(res.error || "Nenhum dado recebido.");
        }
    } catch (err) {
        Swal.fire('Erro', tratarErroIpc(err), 'error');
    }
}

async function selecionarPastaBackup() {
    const path = await window.api.invoke('selecionar-pasta-backup');
    if (path) {
        document.getElementById('cfg-backup-pasta').value = path;
    }
}

async function salvarConfigsBackup() {
    const config = {
        ativo: document.getElementById('cfg-backup-ativo').checked,
        horarios: document.getElementById('cfg-backup-horarios').value.split(',').map(h => h.trim()).filter(h => h),
        pasta: document.getElementById('cfg-backup-pasta').value
    };

    if (config.ativo && (!config.pasta || config.horarios.length === 0)) {
        return Swal.fire('Atenção', 'Para ativar o backup, selecione uma pasta e defina ao menos um horário.', 'warning');
    }

    const res = await window.api.invoke('set-backup-config', config);
    if (res && res.success) {
        avisar('success', 'Configurações de backup salvas!');
    } else {
        const msg = (res && res.error) ? tratarErroIpc(res.error) : "Verifique se o sistema está ativado.";
        Swal.fire('Erro ao Salvar', msg, 'error');
    }
}

async function carregarConfigsBackup() {
    const config = await window.api.invoke('get-backup-config');
    // Verifica se recebemos um objeto de configuração válido e não um erro do protectedHandle
    if (config && config.horarios !== undefined) {
        document.getElementById('cfg-backup-ativo').checked = config.ativo || false;
        document.getElementById('cfg-backup-horarios').value = Array.isArray(config.horarios) ? config.horarios.join(', ') : '';
        document.getElementById('cfg-backup-pasta').value = config.pasta || '';
    }
}

async function verificarSessao() {
    // 1. Antes de mais nada, verifica se o sistema está liberado
    const status = await window.api.invoke('check-activation-status');
    if (!status.ativado) {
        console.warn("Bloqueio ativo. Abortando carregamento de sessão.");
        return;
    }

    const session = await window.api.invoke('supabase-get-session');
    if (session) {
        document.getElementById('v-login-screen').style.display = "none";
        document.querySelector('.wrapper').style.display = "flex";
        carregarTela('home');


    } else {
        document.getElementById('v-login-screen').style.display = "flex";
        document.querySelector('.wrapper').style.display = "none";
    }
    carregarConfigsBackup();
}

// Inicialização automática
document.addEventListener('DOMContentLoaded', async () => {
    // Primeiro a proteção
    await verificarProtecao();
    // Depois a sessão (que agora também checa a proteção internamente)
    await verificarSessao();

    // Inicializa o indicador de sincronização e agenda a atualização periódica
    atualizarSyncStatus();
    setInterval(atualizarSyncStatus, 30000);

    // --- TOOLTIPS DINÂMICOS PARA SIDEBAR MINIMIZADA (EVITA CLIPPING DE SCROLL EM RES. MENORES) ---
    document.addEventListener('mouseover', (e) => {
        const li = e.target.closest('#sidebar.minimized li[data-tooltip]');
        if (!li) return;

        // Se já tiver uma tooltip ativa para este elemento, não faz nada
        if (li.classList.contains('has-tooltip-open')) return;
        li.classList.add('has-tooltip-open');

        const texto = li.getAttribute('data-tooltip');
        if (!texto) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'sidebar-tooltip-active';
        tooltip.innerText = texto;
        document.body.appendChild(tooltip);

        // Posiciona a tooltip
        const rect = li.getBoundingClientRect();
        tooltip.style.position = 'fixed';
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top + rect.height / 2}px`;
        tooltip.style.transform = 'translateY(-50%)';
        tooltip.style.zIndex = '99999';

        // Remove no mouseleave
        const remover = () => {
            tooltip.remove();
            li.classList.remove('has-tooltip-open');
            li.removeEventListener('mouseleave', remover);
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.removeEventListener('scroll', remover);
        };
        li.addEventListener('mouseleave', remover);
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.addEventListener('scroll', remover);
    });
});

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

// ============================================================
// MÓDULO: ROMANEIOS DE ENTRADA
// ============================================================

// Estado global para o romaneio atualmente aberto no painel de detalhes
let romaneioAtualDetalhes = null;
let torasRomaneioAtual = [];
let torasRomaneioDeletadas = [];
let indexToraRomaneioEdicao = -1;

function calcularCubagemSubForm() {
    const rodo = obterValorLimpo('rom-tora-rodo');
    const d1 = obterValorLimpo('rom-tora-d1');
    const d2 = obterValorLimpo('rom-tora-d2');
    const comp = obterValorLimpo('rom-tora-comprimento');
    
    const rodoBruto = obterValorLimpo('rom-tora-rodo-bruto');
    const compBruto = obterValorLimpo('rom-tora-comprimento-bruto');
    
    const detalheSmall = document.getElementById('rom-tora-detalhe-calculo');

    // 1. CÁLCULO DO OCO (Truncamento na 3ª casa)
    const volOcoRaw = (d1 * d2 * comp) / 10000;
    const volOcoTrunc = Math.floor(volOcoRaw * 1000) / 1000;

    const descVer = document.getElementById('rom-tora-desconto-ver');
    if (descVer) descVer.value = volOcoTrunc.toFixed(3).replace('.', ',');

    // 2. CÁLCULO DA TORA LÍQUIDA (Quarto do Rodo)
    let volumeFinal = "0,000";
    let volBrutoAdjusted = 0;

    if (rodo > 0 && comp > 0) {
        const lado = Math.floor(rodo / 4);
        const volBrutoRaw = (lado * lado * comp) / 10000;
        const volBrutoTrunc = Math.floor(volBrutoRaw * 1000) / 1000;
        volumeFinal = (volBrutoTrunc - volOcoTrunc).toFixed(3);
    }

    // 3. CÁLCULO DO VOLUME BRUTO
    if (rodoBruto > 0 && compBruto > 0) {
        const ladoBruto = rodoBruto / 4;
        const volBrutoRaw = (ladoBruto * ladoBruto * compBruto) / 10000;
        volBrutoAdjusted = Math.floor(volBrutoRaw * 1000) / 1000;
    }

    if (rodo > 0 && comp > 0) {
        document.getElementById('rom-tora-volume-result').innerText = volumeFinal.replace('.', ',') + " m³";
        if (detalheSmall) {
            detalheSmall.innerText = ` Bruto: ${volBrutoAdjusted.toFixed(3)} m³ | Oco: ${volOcoTrunc.toFixed(3)} m³`;
        }
        return { liquido: volumeFinal, oco: volOcoTrunc, bruto: volBrutoAdjusted };
    } else {
        document.getElementById('rom-tora-volume-result').innerText = "0,000 m³";
        return { liquido: "0.000", oco: volOcoTrunc, bruto: volBrutoAdjusted };
    }
}

function resetFormSubToraRomaneio() {
    const fields = [
        'rom-tora-codigo',
        'rom-tora-rodo',
        'rom-tora-comprimento',
        'rom-tora-rodo-bruto',
        'rom-tora-comprimento-bruto',
        'rom-tora-d1',
        'rom-tora-d2',
        'rom-tora-desconto-ver'
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    if (document.getElementById('rom-tora-especie')) document.getElementById('rom-tora-especie').selectedIndex = 0;
    if (document.getElementById('rom-tora-lote')) document.getElementById('rom-tora-lote').selectedIndex = 0;

    document.getElementById('rom-tora-volume-result').innerText = '0,000 m³';
    const detalhe = document.getElementById('rom-tora-detalhe-calculo');
    if (detalhe) detalhe.innerText = '';

    if (typeof relockAllBrutoFields === 'function') relockAllBrutoFields();
}

async function adicionarToraTempList() {
    const codigo = document.getElementById('rom-tora-codigo').value.trim();
    const especieId = document.getElementById('rom-tora-especie').value;
    const loteId = document.getElementById('rom-tora-lote').value;
    const rodo = obterValorLimpo('rom-tora-rodo');
    const comp = obterValorLimpo('rom-tora-comprimento');
    const rodoBruto = obterValorLimpo('rom-tora-rodo-bruto');
    const compBruto = obterValorLimpo('rom-tora-comprimento-bruto');

    if (!codigo || !especieId || !loteId || rodo <= 0 || comp <= 0 || rodoBruto <= 0 || compBruto <= 0) {
        return Swal.fire('Atenção', 'Preencha o Número, Espécie, Lote, Medidas Líquidas e Brutas para continuar.', 'warning');
    }

    if (torasRomaneioAtual.some((t, idx) => t.codigo === codigo && idx !== indexToraRomaneioEdicao)) {
        return Swal.fire('Atenção', 'Este número de tora já foi adicionado a este romaneio.', 'warning');
    }

    try {
        const res = await window.api.invoke('buscar-tora-por-numero', codigo);
        if (res && res.success && res.data) {
            const romIdAtual = document.getElementById('rom-id').value;
            const toraExistenteId = indexToraRomaneioEdicao !== -1 ? torasRomaneioAtual[indexToraRomaneioEdicao].id : null;
            if (res.data.id !== toraExistenteId && (!romIdAtual || res.data.romaneio_id != romIdAtual)) {
                return Swal.fire('Erro', 'Este número de tora já está cadastrado no estoque do sistema.', 'error');
            }
        }
    } catch (err) {
        console.error('Erro ao verificar código da tora:', err);
    }

    const calc = calcularCubagemSubForm();
    const especieSelect = document.getElementById('rom-tora-especie');
    const loteSelect = document.getElementById('rom-tora-lote');

    const tora = {
        id: indexToraRomaneioEdicao !== -1 ? torasRomaneioAtual[indexToraRomaneioEdicao].id : undefined,
        codigo,
        especie_id: parseInt(especieId),
        especie_name: especieSelect.options[especieSelect.selectedIndex].text,
        lote_id: parseInt(loteId),
        lote_numero: loteSelect.options[loteSelect.selectedIndex].text,
        rodo,
        comprimento: comp,
        rodo_bruto: rodoBruto,
        comprimento_bruto: compBruto,
        desconto_1: obterValorLimpo('rom-tora-d1'),
        desconto_2: obterValorLimpo('rom-tora-d2'),
        total_desconto: calc.oco,
        volume: parseFloat(calc.liquido),
        volume_bruto: calc.bruto,
        status: indexToraRomaneioEdicao !== -1 ? torasRomaneioAtual[indexToraRomaneioEdicao].status : 'pátio'
    };

    if (indexToraRomaneioEdicao !== -1) {
        torasRomaneioAtual[indexToraRomaneioEdicao] = tora;
        cancelarEdicaoToraTempList();
    } else {
        torasRomaneioAtual.push(tora);
        resetFormSubToraRomaneio();
    }
    atualizarTabelaTorasRomaneioTemp();

    const inputCodigo = document.getElementById('rom-tora-codigo');
    if (inputCodigo) inputCodigo.focus();
}

function prepararEdicaoToraTempList(index) {
    const t = torasRomaneioAtual[index];
    if (!t) return;

    if (t.status === 'serrada') {
        Swal.fire('Bloqueado', 'Esta tora já foi serrada e não pode mais ser editada.', 'warning');
        return;
    }

    indexToraRomaneioEdicao = index;

    document.getElementById('rom-tora-codigo').value = t.codigo;
    document.getElementById('rom-tora-especie').value = t.especie_id || '';
    document.getElementById('rom-tora-lote').value = t.lote_id || '';
    
    document.getElementById('rom-tora-rodo').value = t.rodo || 0;
    document.getElementById('rom-tora-comprimento').value = t.comprimento ? t.comprimento.toFixed(2).replace('.', ',') : '0,00';
    
    document.getElementById('rom-tora-rodo-bruto').value = t.rodo_bruto || 0;
    document.getElementById('rom-tora-comprimento-bruto').value = t.comprimento_bruto ? t.comprimento_bruto.toFixed(2).replace('.', ',') : '0,00';
    
    document.getElementById('rom-tora-d1').value = t.desconto_1 || 0;
    document.getElementById('rom-tora-d2').value = t.desconto_2 || 0;

    calcularCubagemSubForm();

    const btn = document.getElementById('btn-adicionar-tora-romaneio');
    if (btn) {
        btn.innerHTML = '<i data-lucide="check-circle"></i> Atualizar Tora';
        btn.style.background = '#10b981';
        if (window.lucide) lucide.createIcons();
    }

    const btnCancel = document.getElementById('btn-cancelar-tora-romaneio');
    if (btnCancel) {
        btnCancel.style.display = 'inline-flex';
    }

    document.getElementById('sub-form-tora-romaneio').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicaoToraTempList() {
    indexToraRomaneioEdicao = -1;
    resetFormSubToraRomaneio();

    const btn = document.getElementById('btn-adicionar-tora-romaneio');
    if (btn) {
        btn.innerHTML = '<i data-lucide="plus-circle"></i> Adicionar Tora';
        btn.style.background = '#6366f1';
        if (window.lucide) lucide.createIcons();
    }

    const btnCancel = document.getElementById('btn-cancelar-tora-romaneio');
    if (btnCancel) {
        btnCancel.style.display = 'none';
    }
}

function removerToraTempList(index) {
    const tora = torasRomaneioAtual[index];
    if (tora.status === 'serrada') {
        return Swal.fire('Bloqueado', 'Esta tora já foi serrada e não pode ser removida.', 'warning');
    }
    if (tora.id) {
        torasRomaneioDeletadas.push(tora);
    }
    torasRomaneioAtual.splice(index, 1);
    cancelarEdicaoToraTempList();
    atualizarTabelaTorasRomaneioTemp();
}

function atualizarTabelaTorasRomaneioTemp() {
    const tbody = document.getElementById('lista-toras-romaneio-temp');
    if (!tbody) return;

    if (torasRomaneioAtual.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #94a3b8; padding: 25px;">Nenhuma tora vinculada a este romaneio ainda.</td>
            </tr>`;
        document.getElementById('tot-pecas-temp').innerText = '0';
        document.getElementById('tot-liq-temp').innerText = '0,000 m³';
        document.getElementById('tot-bruto-temp').innerText = '0,000 m³';
        const elTotOco = document.getElementById('tot-oco-temp');
        if (elTotOco) elTotOco.innerText = '0,000 m³';
        calcularFreteRomaneio();
        return;
    }

    let totLiq = 0;
    let totBruto = 0;
    let totOco = 0;

    // Cria uma cópia com os índices originais para mapear de trás para frente (mais recente primeiro)
    const itensReversos = torasRomaneioAtual.map((t, index) => ({ t, index })).reverse();

    tbody.innerHTML = itensReversos.map(({ t, index }) => {
        totLiq += t.volume;
        totBruto += t.volume_bruto;

        const volOco = (t.total_desconto !== undefined && t.total_desconto !== null && t.total_desconto > 0)
            ? Number(t.total_desconto)
            : ((t.desconto_1 > 0 || t.desconto_2 > 0) && t.comprimento > 0
                ? Math.floor(((Number(t.desconto_1 || 0) * Number(t.desconto_2 || 0) * Number(t.comprimento || 0)) / 10000) * 1000) / 1000
                : 0);

        totOco += volOco;

        const compLiqFmt = Number(t.comprimento || 0).toFixed(2).replace('.', ',');
        const compBrutoFmt = Number(t.comprimento_bruto || (t.comprimento + 0.10)).toFixed(2).replace('.', ',');

        let ocoDisplay = '';
        if (t.desconto_1 > 0 || t.desconto_2 > 0) {
            const volOcoFmt = volOco.toFixed(3).replace('.', ',');
            ocoDisplay = `<div style="color:#e11d48; font-size:0.78rem; font-weight:700; margin-top:3px;">Oco: ${t.desconto_1}×${t.desconto_2} (-${volOcoFmt} m³)</div>`;
        }

        return `
            <tr>
                <td><strong class="badge-numero">${t.codigo}</strong></td>
                <td><strong>${t.especie_name}</strong></td>
                <td><span class="badge-count" style="background:#e0f2fe; color:#0369a1;">${t.lote_numero}</span></td>
                <td style="text-align:left; padding-left:15px;">
                    <div style="font-weight:600; color:var(--text-dark, #0f172a);">Líq: ${t.rodo} cm × ${compLiqFmt} m</div>
                    <div style="font-size:0.8rem; color:#64748b;">Bruto: ${t.rodo_bruto} cm × ${compBrutoFmt} m</div>
                    ${ocoDisplay}
                </td>
                <td style="text-align:center; font-weight:bold; color:#10b981;">${t.volume.toFixed(3).replace('.', ',')}</td>
                <td style="text-align:center; font-weight:bold; color:#0284c7;">${t.volume_bruto.toFixed(3).replace('.', ',')}</td>
                <td style="text-align:right; padding-right:20px;">
                    <div style="display:inline-flex; gap:8px;">
                        <button type="button" class="btn-icon-edit" title="Editar Tora" onclick="prepararEdicaoToraTempList(${index})">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button type="button" class="btn-icon-delete" title="Remover Tora" onclick="removerToraTempList(${index})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    document.getElementById('tot-pecas-temp').innerText = torasRomaneioAtual.length;
    document.getElementById('tot-liq-temp').innerText = totLiq.toFixed(3).replace('.', ',') + ' m³';
    document.getElementById('tot-bruto-temp').innerText = totBruto.toFixed(3).replace('.', ',') + ' m³';
    const elTotOco = document.getElementById('tot-oco-temp');
    if (elTotOco) elTotOco.innerText = (totOco > 0 ? `-${totOco.toFixed(3).replace('.', ',')}` : '0,000') + ' m³';

    calcularFreteRomaneio();
    if (window.lucide) lucide.createIcons();
}

// --- CONTROLE DE PAGINAÇÃO DE ROMANEIOS ---
let offsetRomaneios = 0;
let estaCarregandoRomaneios = false;

/**
 * Carrega a lista de romaneios na tabela da view v-romaneios com paginação.
 */
async function carregarRomaneios(resetarPaginacao = false) {
    if (estaCarregandoRomaneios) return;

    const tbody = document.getElementById('lista-romaneios-corpo');
    const btnMais = document.getElementById('btn-carregar-mais-romaneios');
    if (!tbody) return;

    try {
        estaCarregandoRomaneios = true;

        if (resetarPaginacao) {
            offsetRomaneios = 0;
            tbody.style.opacity = '0.5';
        }

        if (btnMais) {
            btnMais.disabled = true;
            btnMais.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Processando...';
            if (window.lucide) lucide.createIcons();
        }

        const romaneios = await window.api.invoke('listar-romaneios', { limite: 50, pular: offsetRomaneios });

        if ((!romaneios || romaneios.length === 0) && offsetRomaneios === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">Nenhum romaneio cadastrado ainda.</td></tr>';
            tbody.style.opacity = '1';
            if (btnMais) btnMais.style.display = 'none';
            return;
        }

        const htmlLinhas = (romaneios || []).map(r => {
            const dataFormatada = r.data ? r.data.split('-').reverse().join('/') : '---';
            const volLiq = (r.volume_total_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            const volBruto = (r.volume_total_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

            return `
                <tr>
                    <td><strong class="badge-numero">${r.numero}</strong></td>
                    <td>${dataFormatada}</td>
                    <td>${r.fornecedor_nome || r.fornecedor || '---'}</td>
                    <td>${r.motorista_nome || r.motorista || '---'}</td>
                    <td style="text-align:center;"><span class="badge-count">${r.total_toras} toras</span></td>
                    <td style="text-align:center;"><span class="badge-volume">${volLiq} m³</span></td>
                    <td style="text-align:center;"><span class="badge-volume" style="background:#e0f2fe; color:#0284c7;">${volBruto} m³</span></td>
                    <td style="text-align:right;">
                        <button class="btn-icon-edit" title="Ver Detalhes" onclick="abrirDetalhesRomaneio(${r.id})">
                            <i data-lucide="eye"></i>
                        </button>
                        <button class="btn-icon-edit" title="Editar" onclick="prepararEdicaoRomaneio('${encodeURIComponent(JSON.stringify(r))}')" style="background:#e0f2fe; color:#0284c7;">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="btn-icon-delete" title="Excluir" onclick="excluirRomaneio(${r.id}, '${r.numero}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');

        if (offsetRomaneios === 0) {
            tbody.innerHTML = htmlLinhas;
            tbody.style.opacity = '1';
        } else {
            tbody.insertAdjacentHTML('beforeend', htmlLinhas);
        }

        offsetRomaneios += (romaneios ? romaneios.length : 0);

        if (btnMais) {
            btnMais.disabled = false;
            btnMais.innerHTML = '<i data-lucide="refresh-cw"></i> Carregar mais romaneios...';
            btnMais.style.display = (!romaneios || romaneios.length < 50) ? 'none' : 'block';
        }

        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error('Erro ao carregar romaneios:', err);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:20px;">Erro ao carregar romaneios.</td></tr>';
            tbody.style.opacity = '1';
        }
        if (btnMais) btnMais.style.display = 'none';
    } finally {
        estaCarregandoRomaneios = false;
    }
}

/**
 * Salva ou edita um romaneio via IPC.
 */
async function salvarRomaneio() {
    const id = document.getElementById('rom-id').value;
    const numero = document.getElementById('rom-numero').value.trim();
    const data = document.getElementById('rom-data').value;
    
    const fornSel = document.getElementById('rom-fornecedor-id');
    const fornecedorId = fornSel ? fornSel.value : '';
    const fornecedor = (fornecedorId && fornSel.selectedIndex >= 0) ? fornSel.options[fornSel.selectedIndex].text : '';

    const motSel = document.getElementById('rom-motorista-id');
    const motoristaId = motSel ? motSel.value : '';
    const motorista = (motoristaId && motSel.selectedIndex >= 0) ? motSel.options[motSel.selectedIndex].text : '';

    const observacoes = document.getElementById('rom-observacoes').value.trim();
    const freteValor = obterValorLimpo('rom-frete-valor');
    const freteTotal = obterValorLimpo('rom-frete-total');

    if (!numero || !data) {
        return Swal.fire('Atenção', 'Data de entrada é obrigatória para o romaneio.', 'warning');
    }

    const dados = { 
        id, 
        numero, 
        data, 
        fornecedor, 
        motorista, 
        fornecedor_id: fornecedorId ? parseInt(fornecedorId) : null,
        motorista_id: motoristaId ? parseInt(motoristaId) : null,
        observacoes,
        frete_valor: freteValor,
        frete_total: freteTotal,
        toras: torasRomaneioAtual,
        torasDeletadas: torasRomaneioDeletadas
    };

    try {
        const canal = id ? 'editar-romaneio' : 'salvar-romaneio';
        const res = await window.api.invoke(canal, dados);

        if (res && res.success) {
            avisar('success', id ? 'Romaneio atualizado!' : `Romaneio ${numero} criado com sucesso!`);
            resetFormRomaneio(); // já recarrega o próximo número internamente
            carregarRomaneios(true);
            carregarSelectRomaneios();
        } else {
            Swal.fire('Erro', tratarErroIpc(res.error), 'error');
        }
    } catch (err) {
        Swal.fire('Erro', tratarErroIpc(err), 'error');
    }
}

/**
 * Preenche o formulário de romaneio para edição.
 */
async function prepararEdicaoRomaneio(json) {
    const r = JSON.parse(decodeURIComponent(json));
    document.getElementById('rom-id').value = r.id;

    const inputNumero = document.getElementById('rom-numero');
    inputNumero.value = r.numero;
    inputNumero.removeAttribute('readonly');
    inputNumero.style.color = '';
    inputNumero.style.fontFamily = '';

    document.getElementById('rom-data').value = r.data;
    document.getElementById('rom-observacoes').value = r.observacoes || '';
    
    if (document.getElementById('rom-frete-valor')) {
        document.getElementById('rom-frete-valor').value = r.frete_valor ? r.frete_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    }
    if (document.getElementById('rom-frete-total')) {
        document.getElementById('rom-frete-total').value = r.frete_total ? r.frete_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
    }

    document.getElementById('rom-form-titulo').innerText = 'Editar Romaneio';
    document.getElementById('btn-cancelar-romaneio').style.display = 'block';

    // Garante que espécies, lotes, fornecedores e motoristas estão carregados nos selects
    if (typeof carregarEspecies === 'function') await carregarEspecies();
    if (typeof carregarLotes === 'function') await carregarLotes();
    if (typeof carregarFornecedores === 'function') await carregarFornecedores();
    if (typeof carregarMotoristas === 'function') await carregarMotoristas();

    // Seleciona nos selects
    if (document.getElementById('rom-fornecedor-id')) {
        document.getElementById('rom-fornecedor-id').value = r.fornecedor_id || '';
    }
    if (document.getElementById('rom-motorista-id')) {
        document.getElementById('rom-motorista-id').value = r.motorista_id || '';
    }

    // Carrega as toras do romaneio para edição
    try {
        const res = await window.api.invoke('get-romaneio-detalhado', r.id);
        if (res && res.success) {
            torasRomaneioAtual = res.toras.map(t => ({
                id: t.id,
                codigo: t.codigo,
                especie_id: t.especie_id,
                especie_name: t.especie_nome,
                lote_id: t.lote_id,
                lote_numero: t.lote_numero,
                rodo: t.rodo,
                comprimento: t.comprimento,
                rodo_bruto: t.rodo_bruto || t.rodo,
                comprimento_bruto: t.comprimento_bruto || t.comprimento,
                desconto_1: t.desconto_1,
                desconto_2: t.desconto_2,
                total_desconto: (t.total_desconto !== undefined && t.total_desconto !== null && t.total_desconto > 0)
                    ? Number(t.total_desconto)
                    : ((t.desconto_1 > 0 || t.desconto_2 > 0) && t.comprimento > 0
                        ? Math.floor(((Number(t.desconto_1 || 0) * Number(t.desconto_2 || 0) * Number(t.comprimento || 0)) / 10000) * 1000) / 1000
                        : 0),
                volume: t.volume,
                volume_bruto: t.volume_bruto || calcularVolumeBruto(t.rodo, t.comprimento, t.especie_nome),
                status: t.status
            }));
            torasRomaneioDeletadas = [];
            atualizarTabelaTorasRomaneioTemp();
            if (typeof relockAllBrutoFields === 'function') relockAllBrutoFields();
        }
    } catch (err) {
        console.error("Erro ao obter toras para edição:", err);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Reseta o formulário de romaneio para criação.
 */
function resetFormRomaneio() {
    document.getElementById('rom-id').value = '';
    document.getElementById('rom-data').value = '';
    
    if (document.getElementById('rom-fornecedor-id')) document.getElementById('rom-fornecedor-id').selectedIndex = 0;
    if (document.getElementById('rom-motorista-id')) document.getElementById('rom-motorista-id').selectedIndex = 0;

    document.getElementById('rom-observacoes').value = '';
    if (document.getElementById('rom-frete-valor')) document.getElementById('rom-frete-valor').value = '';
    if (document.getElementById('rom-frete-total')) document.getElementById('rom-frete-total').value = '';

    // Restaura o campo de número como readonly (modo criação)
    const inputNumero = document.getElementById('rom-numero');
    if (inputNumero) {
        inputNumero.setAttribute('readonly', 'readonly');
        inputNumero.style.color = '#0284c7';
        inputNumero.style.fontFamily = 'monospace';
        inputNumero.value = 'Carregando...';
    }

    document.getElementById('rom-form-titulo').innerText = 'Novo Romaneio de Entrada';
    document.getElementById('btn-cancelar-romaneio').style.display = 'none';

    // Limpa o sub-formulário de toras e tabelas temporárias
    resetFormSubToraRomaneio();
    torasRomaneioAtual = [];
    torasRomaneioDeletadas = [];
    atualizarTabelaTorasRomaneioTemp();
    if (typeof relockAllBrutoFields === 'function') relockAllBrutoFields();

    carregarProximoNumeroRomaneio();
}

/**
 * Busca e exibe o próximo número de romaneio gerado automaticamente.
 */
async function carregarProximoNumeroRomaneio() {
    const input = document.getElementById('rom-numero');
    if (!input) return;
    const idAtual = document.getElementById('rom-id')?.value;
    if (idAtual) return;

    try {
        const res = await window.api.invoke('get-proximo-numero-romaneio');
        if (res && res.success) {
            input.value = res.numero;
        } else {
            input.value = '';
            input.placeholder = 'Não foi possível gerar';
        }
    } catch (err) {
        console.error('Erro ao gerar número:', err);
        input.value = '';
    }
}

/**
 * Confirma e exclui um romaneio.
 */
async function excluirRomaneio(id, numero) {
    const r = await Swal.fire({
        title: `Excluir Romaneio ${numero}?`,
        text: 'O romaneio só pode ser excluído se não tiver toras vinculadas.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    });

    if (!r.isConfirmed) return;

    try {
        const res = await window.api.invoke('excluir-romaneio', id);
        if (res && res.success) {
            avisar('success', 'Romaneio excluído.');
            carregarRomaneios(true);
            fecharDetalhesRomaneio();
        } else {
            Swal.fire('Não permitido', tratarErroIpc(res.error), 'error');
        }
    } catch (err) {
        Swal.fire('Erro', tratarErroIpc(err), 'error');
    }
}

/**
 * Abre o painel de detalhes de um romaneio, mostrando toras com vol. líquido e bruto.
 */
async function abrirDetalhesRomaneio(romaneioId) {
    const painel = document.getElementById('painel-detalhes-romaneio');
    const tbodyToras = document.getElementById('detalhe-rom-toras');
    const divResumo = document.getElementById('detalhe-rom-resumo');
    const divTotais = document.getElementById('detalhe-rom-totais');

    if (!painel) return;

    painel.style.display = 'block';
    tbodyToras.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Carregando...</td></tr>';
    painel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const res = await window.api.invoke('get-romaneio-detalhado', romaneioId);
        if (!res || !res.success) {
            tbodyToras.innerHTML = '<tr><td colspan="7" style="color:#ef4444; text-align:center; padding:20px;">Erro ao carregar dados.</td></tr>';
            return;
        }

        const { romaneio, toras } = res;
        romaneioAtualDetalhes = res;

        // Cabeçalho do painel
        document.getElementById('detalhe-rom-titulo').innerText = `Romaneio Nº ${romaneio.numero}`;
        const dataFmt = romaneio.data ? romaneio.data.split('-').reverse().join('/') : '---';
        document.getElementById('detalhe-rom-info').innerText =
            `Data: ${dataFmt}  |  Fornecedor: ${romaneio.fornecedor || '---'}  |  Motorista: ${romaneio.motorista || '---'}`;

        // ---- TABELA DE TORAS ----
        let totalLiquido = 0;
        let totalBruto = 0;
        let totalOco = 0;
        let qtdComOco = 0;
        const resumoPorEspecie = {};

        tbodyToras.innerHTML = toras.map(t => {
            const volLiq = Number(t.volume) || 0;
            const volBruto = t.volume_bruto || calcularVolumeBruto(Number(t.rodo) || 0, Number(t.comprimento) || 0, t.especie_nome);
            const volOco = (t.total_desconto !== undefined && t.total_desconto !== null && t.total_desconto > 0)
                ? Number(t.total_desconto)
                : ((t.desconto_1 > 0 || t.desconto_2 > 0) && t.comprimento > 0
                    ? Math.floor(((Number(t.desconto_1 || 0) * Number(t.desconto_2 || 0) * Number(t.comprimento || 0)) / 10000) * 1000) / 1000
                    : 0);

            totalLiquido += volLiq;
            totalBruto += volBruto;
            totalOco += volOco;
            if (t.desconto_1 > 0 || t.desconto_2 > 0) qtdComOco++;

            // Acumula resumo por espécie
            const esp = t.especie_nome || 'Indefinida';
            if (!resumoPorEspecie[esp]) resumoPorEspecie[esp] = { qtd: 0, liquido: 0, bruto: 0, oco: 0, isEspecial: false };
            resumoPorEspecie[esp].qtd++;
            resumoPorEspecie[esp].liquido += volLiq;
            resumoPorEspecie[esp].bruto += volBruto;
            resumoPorEspecie[esp].oco += volOco;

            // Verifica se é espécie especial para exibir nota
            const nomeNorm = (t.especie_nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (nomeNorm.includes('jatob') || nomeNorm.includes('muiracatiara')) {
                resumoPorEspecie[esp].isEspecial = true;
            }

            const rodoBruto = t.rodo_bruto || (t.rodo + (resumoPorEspecie[esp].isEspecial ? 20 : 10));
            const compBruto = t.comprimento_bruto || (t.comprimento + 0.10);

            const compLiqFmt = Number(t.comprimento || 0).toFixed(2).replace('.', ',');
            const compBrutoFmt = Number(compBruto || 0).toFixed(2).replace('.', ',');

            let ocoDisplay = '';
            if (t.desconto_1 > 0 || t.desconto_2 > 0) {
                const volOcoFmt = volOco.toFixed(3).replace('.', ',');
                ocoDisplay = `<div style="color:#e11d48; font-size:0.78rem; font-weight:700; margin-top:3px;">Oco: ${t.desconto_1}×${t.desconto_2} (-${volOcoFmt} m³)</div>`;
            }

            const statusClass = t.status === 'pátio' ? 'status-patio' : 'status-serrada';
            const statusTexto = t.status === 'pátio' ? 'PÁTIO' : 'SERRADA';

            return `
                <tr>
                    <td><span class="badge-numero">${t.codigo}</span></td>
                    <td><strong>${t.especie_nome || '---'}</strong></td>
                    <td><span class="badge-count" style="background:#e0f2fe; color:#0369a1;">${t.lote_numero || '---'}</span></td>
                    <td style="text-align:left; padding-left:15px;">
                        <div style="font-weight:600; color:var(--text-dark, #0f172a);">Líq: ${t.rodo} cm × ${compLiqFmt} m</div>
                        <div style="font-size:0.8rem; color:#64748b;">Bruto: ${rodoBruto} cm × ${compBrutoFmt} m</div>
                        ${ocoDisplay}
                    </td>
                    <td style="text-align:center; font-weight:bold; color:#10b981;">${volLiq.toFixed(3).replace('.', ',')}</td>
                    <td style="text-align:center; font-weight:bold; color:#0284c7;">${volBruto.toFixed(3).replace('.', ',')}</td>
                    <td style="text-align:center;"><span class="status-tag ${statusClass}">${statusTexto}</span></td>
                </tr>`;
        }).join('');

        // ---- RESUMO POR ESPÉCIE ----
        divResumo.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top:10px;">
                ${Object.entries(resumoPorEspecie).map(([nome, d]) => `
                    <div style="background: var(--bg-card, #f8fafc); border:1px solid #e2e8f0; border-left: 5px solid #0284c7; border-radius:10px; padding:16px;">
                        <div style="font-weight:700; color:#0f172a; margin-bottom:8px;">${nome} ${d.isEspecial ? '<span style="font-size:0.7rem; background:#fef9c3; color:#854d0e; padding:2px 6px; border-radius:4px; margin-left:4px;">+20cm rodo</span>' : ''}</div>
                        <div style="font-size:0.85rem; color:#475569;">${d.qtd} tora${d.qtd !== 1 ? 's' : ''}</div>
                        <div style="display:flex; gap:16px; margin-top:8px; font-size:0.9rem; flex-wrap: wrap;">
                            <div><span style="color:#64748b;">Líquido:</span> <strong>${d.liquido.toFixed(3).replace('.', ',')} m³</strong></div>
                            <div><span style="color:#0284c7;">Bruto:</span> <strong style="color:#0284c7;">${d.bruto.toFixed(3).replace('.', ',')} m³</strong></div>
                            ${d.oco > 0 ? `<div><span style="color:#e11d48;">Oco:</span> <strong style="color:#e11d48;">-${d.oco.toFixed(3).replace('.', ',')} m³</strong></div>` : ''}
                        </div>
                    </div>`).join('')}
            </div>`;

        // ---- TOTAIS RODAPÉ ----
        divTotais.innerHTML = `
            <div style="display:flex; gap:30px; justify-content:flex-end; padding: 15px 0; border-top: 2px solid #e2e8f0; flex-wrap: wrap;">
                <div style="text-align:right;">
                    <div style="font-size:0.8rem; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Total Líquido</div>
                    <div style="font-size:1.4rem; font-weight:800; color:#10b981;">${totalLiquido.toFixed(3).replace('.', ',')} m³</div>
                    <div style="font-size:0.8rem; color:#94a3b8;">${toras.length} toras</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.8rem; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Total Bruto</div>
                    <div style="font-size:1.4rem; font-weight:800; color:#0284c7;">${totalBruto.toFixed(3).replace('.', ',')} m³</div>
                    <div style="font-size:0.8rem; color:#94a3b8;">${toras.filter(t => {
                        const n = (t.especie_nome||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                        return n.includes('jatob')||n.includes('muiracatiara');
                    }).length} toras c/ +20cm</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.8rem; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Total Desconto (Oco)</div>
                    <div style="font-size:1.4rem; font-weight:800; color:#e11d48;">${totalOco > 0 ? `-${totalOco.toFixed(3).replace('.', ',')}` : '0,000'} m³</div>
                    <div style="font-size:0.8rem; color:#94a3b8;">${qtdComOco} ${qtdComOco === 1 ? 'tora com oco' : 'toras com oco'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.8rem; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Valor do Frete</div>
                    <div style="font-size:1.4rem; font-weight:800; color:#6366f1;">R$ ${(romaneio.frete_valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / m³</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.8rem; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Total do Frete (Bruto)</div>
                    <div style="font-size:1.4rem; font-weight:800; color:#8b5cf6;">R$ ${(romaneio.frete_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
            </div>`;

        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error('Erro ao abrir detalhes do romaneio:', err);
        tbodyToras.innerHTML = `<tr><td colspan="7" style="color:#ef4444; text-align:center; padding:20px;">Erro: ${tratarErroIpc(err)}</td></tr>`;
    }
}

/**
 * Fecha o painel de detalhes.
 */
function fecharDetalhesRomaneio() {
    const painel = document.getElementById('painel-detalhes-romaneio');
    if (painel) painel.style.display = 'none';
    romaneioAtualDetalhes = null;
}

/**
 * Gera e imprime o PDF do romaneio atualmente aberto no painel de detalhes.
 */
async function imprimirRomaneio() {
    if (!romaneioAtualDetalhes || !romaneioAtualDetalhes.romaneio) {
        return Swal.fire('Atenção', 'Abra os detalhes de um romaneio antes de imprimir.', 'warning');
    }

    const { romaneio, toras } = romaneioAtualDetalhes;
    const dataFmt = romaneio.data ? romaneio.data.split('-').reverse().join('/') : '---';

    // Acumula resumos
    let totalLiquido = 0;
    let totalBruto = 0;
    let totalOco = 0;
    let qtdComOco = 0;
    const resumoPorEspecie = {};

    const linhasToras = toras.map(t => {
        const volLiq = Number(t.volume) || 0;
        const volBruto = t.volume_bruto || calcularVolumeBruto(Number(t.rodo) || 0, Number(t.comprimento) || 0, t.especie_nome);
        const volOco = (t.total_desconto !== undefined && t.total_desconto !== null && t.total_desconto > 0)
            ? Number(t.total_desconto)
            : ((t.desconto_1 > 0 || t.desconto_2 > 0) && t.comprimento > 0
                ? Math.floor(((Number(t.desconto_1 || 0) * Number(t.desconto_2 || 0) * Number(t.comprimento || 0)) / 10000) * 1000) / 1000
                : 0);

        totalLiquido += volLiq;
        totalBruto += volBruto;
        totalOco += volOco;
        if (t.desconto_1 > 0 || t.desconto_2 > 0) qtdComOco++;

        const esp = t.especie_nome || 'Indefinida';
        if (!resumoPorEspecie[esp]) resumoPorEspecie[esp] = { qtd: 0, liquido: 0, bruto: 0, oco: 0, isEspecial: false };
        resumoPorEspecie[esp].qtd++;
        resumoPorEspecie[esp].liquido += volLiq;
        resumoPorEspecie[esp].bruto += volBruto;
        resumoPorEspecie[esp].oco += volOco;

        const nomeNorm = (t.especie_nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isEspecial = nomeNorm.includes('jatob') || nomeNorm.includes('muiracatiara');
        if (isEspecial) resumoPorEspecie[esp].isEspecial = true;

        const rodoBruto = t.rodo_bruto || (t.rodo + (isEspecial ? 20 : 10));
        const compBruto = t.comprimento_bruto || (t.comprimento + 0.10);

        const compLiqFmt = Number(t.comprimento || 0).toFixed(2).replace('.', ',');
        const compBrutoFmt = Number(compBruto || 0).toFixed(2).replace('.', ',');

        let ocoHTML = '';
        if (t.desconto_1 > 0 || t.desconto_2 > 0) {
            const volDesc = volOco.toFixed(3).replace('.', ',');
            ocoHTML = `<div class="med-oco">Oco: ${t.desconto_1}×${t.desconto_2} = -${volDesc} m³</div>`;
        }

        return `
            <tr>
                <td class="bold"><span class="badge-num">${t.codigo}</span></td>
                <td style="text-align: left; padding-left: 10px; font-weight: 600;">${t.especie_nome || '---'}</td>
                <td><span class="badge-lote">${t.lote_numero || '---'}</span></td>
                <td style="text-align: left; padding-left: 10px;">
                    <div class="med-row"><strong>Líq:</strong> ${t.rodo} cm × ${compLiqFmt} m</div>
                    <div class="med-row med-bruto"><strong>Bruto:</strong> ${rodoBruto} cm × ${compBrutoFmt} m</div>
                    ${ocoHTML}
                </td>
                <td class="bold" style="text-align: right; padding-right: 10px; color: #10b981;">${volLiq.toFixed(3).replace('.', ',')}</td>
                <td class="bold" style="text-align: right; padding-right: 10px; color: #0284c7;">${volBruto.toFixed(3).replace('.', ',')}</td>
            </tr>`;
    }).join('');

    const resumoEspecieHTML = Object.entries(resumoPorEspecie).map(([nome, d]) => `
        <div class="resumo-item">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 3px;">
                ${nome} ${d.isEspecial ? '<span style="font-size: 8.5px; background: #fef9c3; color: #854d0e; padding: 1px 4px; border-radius: 3px;">+20cm</span>' : ''}
                <span style="font-weight: 400; color: #64748b; font-size: 9px;">(${d.qtd} tora${d.qtd !== 1 ? 's' : ''})</span>
            </div>
            <div style="display: flex; gap: 10px; font-size: 9.5px; flex-wrap: wrap;">
                <div>Líq: <strong>${d.liquido.toFixed(3).replace('.', ',')} m³</strong></div>
                <div style="color: #0284c7;">Bruto: <strong>${d.bruto.toFixed(3).replace('.', ',')} m³</strong></div>
                ${d.oco > 0 ? `<div style="color: #e11d48; font-weight: 600;">Oco: -${d.oco.toFixed(3).replace('.', ',')} m³</div>` : ''}
            </div>
        </div>`).join('');

    const logoBase64 = window.LOGO_PADRAO_BASE64 || '';
    const htmlPDF = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Romaneio Nº ${romaneio.numero}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 12mm 10mm 15mm 10mm;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    color: #1e293b;
                    margin: 0;
                    padding: 0;
                    font-size: 11px;
                    background: #ffffff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .header-wrapper {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #0284c7;
                    padding-bottom: 10px;
                    margin-bottom: 14px;
                }
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .header-logo {
                    width: 52px;
                    height: 52px;
                    object-fit: contain;
                }
                .system-name {
                    font-size: 11px;
                    font-weight: 700;
                    color: #0284c7;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }
                .header-title h1 {
                    margin: 0;
                    font-size: 17px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #0f172a;
                    letter-spacing: 0.5px;
                }
                .header-title p {
                    margin: 2px 0 0;
                    font-size: 10px;
                    color: #64748b;
                }
                .rom-badge-pill {
                    background: #0284c7;
                    color: #ffffff;
                    font-size: 13px;
                    font-weight: 800;
                    padding: 6px 14px;
                    border-radius: 6px;
                    text-align: right;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    margin-bottom: 14px;
                }
                .info-item {
                    background: #f8fafc;
                    padding: 7px 10px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                }
                .info-item strong {
                    display: block;
                    color: #64748b;
                    font-size: 8.5px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin-bottom: 2px;
                }
                .info-item span {
                    font-size: 11px;
                    font-weight: 700;
                    color: #0f172a;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 6px;
                }
                thead {
                    display: table-header-group;
                }
                thead th {
                    background-color: #0284c7 !important;
                    color: #ffffff !important;
                    font-size: 10px;
                    font-weight: 700;
                    padding: 8px 6px;
                    border: 1px solid #0284c7;
                    text-align: center;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                tbody tr {
                    page-break-inside: avoid;
                }
                tbody tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                td {
                    font-size: 10px;
                    padding: 6px 6px;
                    border: 1px solid #e2e8f0;
                    text-align: center;
                    vertical-align: middle;
                }
                .bold { font-weight: bold; }
                .badge-num {
                    font-weight: 800;
                    color: #0f172a;
                    font-size: 10.5px;
                }
                .badge-lote {
                    background: #e0f2fe;
                    color: #0369a1;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 9.5px;
                    font-weight: 700;
                    display: inline-block;
                }
                .med-row {
                    font-size: 10px;
                    color: #1e293b;
                    line-height: 1.3;
                }
                .med-row.med-bruto {
                    color: #64748b;
                    font-size: 9px;
                }
                .med-oco {
                    color: #e11d48;
                    font-size: 9px;
                    font-weight: 700;
                    margin-top: 2px;
                }
                .resumo {
                    margin-top: 14px;
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    padding: 10px 12px;
                    border-radius: 6px;
                    page-break-inside: avoid;
                }
                .resumo h3 {
                    margin: 0 0 8px;
                    color: #0284c7;
                    font-size: 10.5px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .resumo-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 6px;
                }
                .resumo-item {
                    background: #ffffff;
                    border: 1px solid #e0f2fe;
                    padding: 6px 8px;
                    border-radius: 4px;
                }
                .totais {
                    margin-top: 14px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 14px;
                    flex-wrap: wrap;
                    page-break-inside: avoid;
                }
                .total-box {
                    text-align: right;
                    border-top: 2px solid #0284c7;
                    padding-top: 6px;
                    min-width: 105px;
                }
                .total-box .label {
                    font-size: 8.5px;
                    color: #64748b;
                    text-transform: uppercase;
                    font-weight: 700;
                }
                .total-box .valor {
                    font-size: 13.5px;
                    font-weight: 800;
                    margin-top: 2px;
                }
                .assinaturas {
                    margin-top: 36px;
                    display: flex;
                    justify-content: space-around;
                    page-break-inside: avoid;
                }
                .sig-line {
                    border-top: 1px solid #475569;
                    width: 200px;
                    text-align: center;
                    font-size: 9.5px;
                    font-weight: 600;
                    color: #475569;
                    padding-top: 5px;
                }
                .footer {
                    margin-top: 25px;
                    font-size: 8.5px;
                    color: #94a3b8;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 6px;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="header-wrapper">
                <div class="header-left">
                    ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" />` : ''}
                    <div class="header-title">
                        <div class="system-name">MT-PRO - Controle de Estoque de Toras</div>
                        <h1>Romaneio de Entrada de Toras</h1>
                        <p>Documento de Conferência e Entrada no Estoque</p>
                    </div>
                </div>
                <div class="rom-badge-pill">
                    Nº ${romaneio.numero}
                </div>
            </div>

            <div class="info-grid">
                <div class="info-item"><strong>Data de Entrada</strong><span>${dataFmt}</span></div>
                <div class="info-item"><strong>Nº Romaneio</strong><span>${romaneio.numero}</span></div>
                <div class="info-item"><strong>Fornecedor</strong><span>${romaneio.fornecedor || '---'}</span></div>
                <div class="info-item"><strong>Motorista</strong><span>${romaneio.motorista || '---'}</span></div>
                ${romaneio.observacoes ? `<div class="info-item" style="grid-column: span 4;"><strong>Observações</strong><span>${romaneio.observacoes}</span></div>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 10%;">Nº</th>
                        <th style="width: 26%; text-align: left; padding-left: 10px;">Espécie</th>
                        <th style="width: 11%;">Lote</th>
                        <th style="width: 29%; text-align: left; padding-left: 10px;">Medidas (Líq. / Bruto)</th>
                        <th style="width: 12%; text-align: right; padding-right: 10px;">Vol. Líq. (m³)</th>
                        <th style="width: 12%; text-align: right; padding-right: 10px;">Vol. Bruto (m³)</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasToras}
                </tbody>
            </table>

            <div class="resumo">
                <h3>Resumo por Espécie</h3>
                <div class="resumo-grid">
                    ${resumoEspecieHTML}
                </div>
            </div>

            <div class="totais">
                <div class="total-box">
                    <div class="label">Volume Líquido Total</div>
                    <div class="valor" style="color:#10b981;">${totalLiquido.toFixed(3).replace('.', ',')} m³</div>
                    <div style="font-size:8.5px; color:#94a3b8;">${toras.length} toras</div>
                </div>
                <div class="total-box">
                    <div class="label">Volume Bruto Total</div>
                    <div class="valor" style="color:#0284c7;">${totalBruto.toFixed(3).replace('.', ',')} m³</div>
                </div>
                <div class="total-box">
                    <div class="label">Total Desconto (Oco)</div>
                    <div class="valor" style="color:#e11d48;">${totalOco > 0 ? `-${totalOco.toFixed(3).replace('.', ',')}` : '0,000'} m³</div>
                    <div style="font-size:8.5px; color:#94a3b8;">${qtdComOco} ${qtdComOco === 1 ? 'tora c/ oco' : 'toras c/ oco'}</div>
                </div>
                <div class="total-box">
                    <div class="label">Valor do Frete</div>
                    <div class="valor" style="color:#6366f1; font-size: 12.5px;">R$ ${(romaneio.frete_valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / m³</div>
                </div>
                <div class="total-box">
                    <div class="label">Total do Frete (Bruto)</div>
                    <div class="valor" style="color:#8b5cf6; font-size: 12.5px;">R$ ${(romaneio.frete_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
            </div>

            <div class="assinaturas">
                <div class="sig-line">Fornecedor / Responsável</div>
                <div class="sig-line">Responsável pelo Pátio</div>
            </div>

            <div class="footer">
                Documento gerado pelo sistema MT-PRO - Controle de Estoque de Toras em ${new Date().toLocaleString('pt-BR')}
            </div>
        </body>
        </html>`;

    // Gera nome de arquivo com número do romaneio e data-hora atual
    const nomeArquivoPDF = gerarNomeArquivoDataHora('Romaneio', romaneio.numero || 'ROM');

    try {
        Swal.fire({ title: 'Gerando PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const resPdf = await window.api.invoke('gerar-pdf-logs', { html: htmlPDF, nomeArquivo: nomeArquivoPDF });
        if (resPdf && resPdf.success) {
            Swal.fire({
                icon: 'success',
                title: 'PDF Gerado!',
                text: `Arquivo "${nomeArquivoPDF}" salvo na pasta Documentos.`,
                timer: 3000,
                showConfirmButton: false
            });
        } else {
            throw new Error(resPdf?.error || 'Erro ao gerar PDF.');
        }
    } catch (err) {
        Swal.fire('Erro', tratarErroIpc(err), 'error');
    }
}

/**
 * Carrega o select de romaneios no formulário de entradas de toras.
 */
async function carregarSelectRomaneios() {
    const select = document.getElementById('tora-romaneio');
    if (!select) return;

    try {
        const romaneios = await window.api.invoke('get-romaneios-select');
        const valorAtual = select.value; // preserva seleção

        select.innerHTML = '<option value="">Sem Romaneio</option>' +
            (romaneios || []).map(r => {
                const dataFmt = r.data ? r.data.split('-').reverse().join('/') : '';
                return `<option value="${r.id}">${r.numero}${dataFmt ? ' — ' + dataFmt : ''}</option>`;
            }).join('');

        // Restaura seleção se ainda existir
        if (valorAtual) select.value = valorAtual;

    } catch (err) {
        console.error('Erro ao carregar select de romaneios:', err);
    }
}

// FIM DO MÓDULO DE ROMANEIOS
// ============================================================

async function verificarPagamentoAgora() { // atualizado
    const btn = document.querySelector('#v-expired-screen .btn-save');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Verificando...';
    btn.disabled = true;

    try {
        const res = await window.api.invoke('sincronizar-assinatura-forced');
        if (res.success) {
            location.reload();
        } else {
            alert("Ainda não detectamos: " + tratarErroIpc(res.error));
        }
    } catch (err) {
        alert('Erro ao conectar ao servidor.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function toggleLockField(fieldId, button) {
    const input = document.getElementById(fieldId);
    if (!input) return;

    const isReadonly = input.hasAttribute('readonly');
    const icon = button.querySelector('i');

    if (isReadonly) {
        // Desbloqueia o campo
        input.removeAttribute('readonly');
        input.classList.remove('readonly-field');
        input.style.background = '#ffffff';
        if (icon) {
            icon.setAttribute('data-lucide', 'lock-open');
            button.style.color = '#10b981'; // green for unlocked
        }
        input.focus();
    } else {
        // Bloqueia o campo
        input.setAttribute('readonly', 'readonly');
        input.classList.add('readonly-field');
        input.style.background = 'var(--bg-input, #f8fafc)';
        if (icon) {
            icon.setAttribute('data-lucide', 'lock');
            button.style.color = '#94a3b8'; // grey for locked
        }
    }

    if (window.lucide) window.lucide.createIcons();
}

function relockAllBrutoFields() {
    const fields = [
        'rodo-bruto',
        'comprimento-bruto',
        'rom-tora-rodo-bruto',
        'rom-tora-comprimento-bruto'
    ];

    fields.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;

        input.setAttribute('readonly', 'readonly');
        input.classList.add('readonly-field');
        input.style.background = 'var(--bg-input, #f8fafc)';

        // Encontra o botão irmão
        const button = input.nextElementSibling;
        if (button && button.classList.contains('btn-lock-toggle')) {
            const icon = button.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'lock');
                button.style.color = '#94a3b8';
            }
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

// ============================================================
// NOVOS RELATÓRIOS: FORNECEDOR E MOTORISTA
// ============================================================

async function gerarRelatorioFornecedor() {
    const fornId = document.getElementById('rel-forn-id').value;
    const dataInicio = document.getElementById('rel-forn-inicio').value;
    const dataFim = document.getElementById('rel-forn-fim').value;
    const romaneioInicio = document.getElementById('rel-forn-rom-inicio').value.trim();
    const romaneioFim = document.getElementById('rel-forn-rom-fim').value.trim();

    if ((dataInicio && !dataFim) || (!dataInicio && dataFim)) {
        Swal.fire('Atenção', 'Preencha ambas as datas para filtrar por período.', 'warning');
        return;
    }

    try {
        const filtros = { fornecedorId: fornId, dataInicio, dataFim, romaneioInicio, romaneioFim };
        const dados = await window.api.invoke('relatorio-entradas-fornecedor', filtros);

        const tbody = document.getElementById('rel-forn-tabela-corpo');
        const container = document.getElementById('rel-forn-tabela-container');
        const resumo = document.getElementById('rel-forn-resumo');

        if (!dados || dados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-main);">Nenhum romaneio encontrado para este filtro.</td></tr>`;
            container.style.display = 'block';
            resumo.style.display = 'none';
            return;
        }

        let totRom = dados.length;
        let totToras = 0;
        let totLiq = 0;
        let totBruto = 0;
        let totFrete = 0;

        tbody.innerHTML = '';
        dados.forEach(r => {
            totToras += r.total_toras;
            totLiq += r.vol_liquido;
            totBruto += r.vol_bruto;
            totFrete += r.frete_total;

            const dataFormat = new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR');
            tbody.innerHTML += `
                <tr>
                    <td><b>${r.numero}</b></td>
                    <td>${dataFormat}</td>
                    <td>${r.fornecedor_nome || '---'}</td>
                    <td style="text-align: center;">${r.total_toras}</td>
                    <td style="text-align: center;"><b>${r.vol_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</b></td>
                    <td style="text-align: center;">${r.vol_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                    <td style="text-align: right; font-weight: 700; color: #f59e0b;">R$ ${Number(r.frete_total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `;
        });

        document.getElementById('tot-forn-rom').innerText = totRom;
        document.getElementById('tot-forn-toras').innerText = totToras;
        document.getElementById('tot-forn-liq').innerText = totLiq.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' m³';
        document.getElementById('tot-forn-bruto').innerText = totBruto.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' m³';
        document.getElementById('tot-forn-frete').innerText = 'R$ ' + totFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        container.style.display = 'block';
        resumo.style.display = 'flex';

    } catch (err) {
        console.error("Erro gerarRelatorioFornecedor:", err);
        Swal.fire('Erro', 'Falha ao processar dados.', 'error');
    }
}

async function exportarRelatorioFornecedorPDF() {
    const fornSelect = document.getElementById('rel-forn-id');
    const fornNome = fornSelect.options[fornSelect.selectedIndex].text;
    const fornId = fornSelect.value;
    const dataInicio = document.getElementById('rel-forn-inicio').value;
    const dataFim = document.getElementById('rel-forn-fim').value;
    const romaneioInicio = document.getElementById('rel-forn-rom-inicio').value.trim();
    const romaneioFim = document.getElementById('rel-forn-rom-fim').value.trim();

    try {
        const filtros = { fornecedorId: fornId, dataInicio, dataFim, romaneioInicio, romaneioFim };
        const dados = await window.api.invoke('relatorio-entradas-fornecedor', filtros);

        if (!dados || dados.length === 0) {
            Swal.fire('Aviso', 'Não há dados para exportar.', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const logoBase64 = window.LOGO_PADRAO_BASE64 || '';
        let headerTextX = 14;
        if (logoBase64) {
            try {
                doc.addImage(logoBase64, 'PNG', 14, 8, 15, 15);
                headerTextX = 32;
            } catch (e) {
                console.warn('Falha ao adicionar logo no jsPDF:', e);
            }
        }

        doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(15, 23, 42);
        doc.text("MT-PRO - Controle de Estoque de Toras", headerTextX, 13);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(71, 85, 105);
        doc.text("Relatório de Entradas por Fornecedor", headerTextX, 18);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(51, 65, 85);
        doc.text(`Fornecedor: ${fornNome}`, headerTextX, 23);

        doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.line(14, 25.5, 196, 25.5);

        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
        doc.text(`Período: ${dataInicio ? new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR') : 'Todos'} até ${dataFim ? new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR') : 'Hoje'}`, 14, 29.5);
        if (romaneioInicio || romaneioFim) {
            doc.text(`Filtro Romaneios: De ${romaneioInicio || 'Início'} até ${romaneioFim || 'Fim'}`, 14, 33.5);
        }
        doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, (romaneioInicio || romaneioFim) ? 37.5 : 33.5);

        let totToras = 0;
        let totLiq = 0;
        let totBruto = 0;
        let totFrete = 0;

        const linhas = dados.map(r => {
            totToras += r.total_toras;
            totLiq += r.vol_liquido;
            totBruto += r.vol_bruto;
            totFrete += r.frete_total;
            return [
                r.numero,
                new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR'),
                r.fornecedor_nome || '---',
                r.total_toras.toString(),
                r.vol_liquido.toFixed(3),
                r.vol_bruto.toFixed(3),
                'R$ ' + Number(r.frete_total).toFixed(2)
            ];
        });

        doc.autoTable({
            startY: (romaneioInicio || romaneioFim) ? 41 : 37,
            head: [["Romaneio", "Data", "Fornecedor", "Toras", "Vol. Líq (m³)", "Vol. Bruto (m³)", "Frete Total"]],
            body: linhas,
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105], fontSize: 8, halign: 'center' },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }
        });

        let currentY = doc.lastAutoTable.finalY + 12;
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text(`TOTAL ROMANEIOS: ${dados.length}`, 14, currentY);
        doc.text(`TOTAL TORAS: ${totToras}`, 14, currentY + 6);
        doc.text(`VOLUME LÍQUIDO TOTAL: ${totLiq.toFixed(3)} m³`, 14, currentY + 12);
        doc.text(`VOLUME BRUTO TOTAL: ${totBruto.toFixed(3)} m³`, 14, currentY + 18);
        doc.text(`TOTAL FRETE: R$ ${totFrete.toFixed(2)}`, 14, currentY + 24);

        const fornNomeVal = (fornNome && fornNome !== 'Todos' && !fornNome.includes('Selecione')) ? fornNome : '';
        const nomeArquivoPDF = gerarNomeArquivoDataHora('Relatorio_Fornecedor', fornNomeVal);
        doc.save(nomeArquivoPDF);
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao exportar PDF.', 'error');
    }
}

function limparRelatorioFornecedor() {
    document.getElementById('rel-forn-id').value = 'todos';
    document.getElementById('rel-forn-inicio').value = '';
    document.getElementById('rel-forn-fim').value = '';
    document.getElementById('rel-forn-rom-inicio').value = '';
    document.getElementById('rel-forn-rom-fim').value = '';
    document.getElementById('rel-forn-tabela-container').style.display = 'none';
    document.getElementById('rel-forn-resumo').style.display = 'none';
}

async function gerarRelatorioMotorista() {
    const motoId = document.getElementById('rel-moto-id').value;
    const dataInicio = document.getElementById('rel-moto-inicio').value;
    const dataFim = document.getElementById('rel-moto-fim').value;
    const romaneioInicio = document.getElementById('rel-moto-rom-inicio').value.trim();
    const romaneioFim = document.getElementById('rel-moto-rom-fim').value.trim();

    if ((dataInicio && !dataFim) || (!dataInicio && dataFim)) {
        Swal.fire('Atenção', 'Preencha ambas as datas para filtrar por período.', 'warning');
        return;
    }

    try {
        const filtros = { motoristaId: motoId, dataInicio, dataFim, romaneioInicio, romaneioFim };
        const dados = await window.api.invoke('relatorio-cargas-motorista', filtros);

        const tbody = document.getElementById('rel-moto-tabela-corpo');
        const container = document.getElementById('rel-moto-tabela-container');
        const resumo = document.getElementById('rel-moto-resumo');

        if (!dados || dados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-main);">Nenhum romaneio encontrado para este filtro.</td></tr>`;
            container.style.display = 'block';
            resumo.style.display = 'none';
            return;
        }

        let totCargas = dados.length;
        let totToras = 0;
        let totBruto = 0;
        let totFrete = 0;
        let totComissao = 0;

        tbody.innerHTML = '';
        dados.forEach(r => {
            const percComissao = Number(r.comissao);
            const valComissao = Number(r.frete_total) * percComissao / 100;

            totToras += r.total_toras;
            totBruto += r.vol_bruto;
            totFrete += r.frete_total;
            totComissao += valComissao;

            const dataFormat = new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR');
            tbody.innerHTML += `
                <tr>
                    <td><b>${r.numero}</b></td>
                    <td>${dataFormat}</td>
                    <td>${r.motorista_nome || '---'}</td>
                    <td style="text-align: center;">${r.total_toras}</td>
                    <td style="text-align: center;">${r.vol_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                    <td style="text-align: right; font-weight: 700;">R$ ${Number(r.frete_total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="text-align: center;">${percComissao}%</td>
                    <td style="text-align: right; font-weight: 700; color: #10b981;">R$ ${valComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `;
        });

        document.getElementById('tot-moto-cargas').innerText = totCargas;
        document.getElementById('tot-moto-toras').innerText = totToras;
        document.getElementById('tot-moto-bruto').innerText = totBruto.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' m³';
        document.getElementById('tot-moto-frete').innerText = 'R$ ' + totFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('tot-moto-comissao').innerText = 'R$ ' + totComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        container.style.display = 'block';
        resumo.style.display = 'flex';

    } catch (err) {
        console.error("Erro gerarRelatorioMotorista:", err);
        Swal.fire('Erro', 'Falha ao processar dados.', 'error');
    }
}

async function exportarRelatorioMotoristaPDF() {
    const motoSelect = document.getElementById('rel-moto-id');
    const motoNome = motoSelect.options[motoSelect.selectedIndex].text;
    const motoId = motoSelect.value;
    const dataInicio = document.getElementById('rel-moto-inicio').value;
    const dataFim = document.getElementById('rel-moto-fim').value;
    const romaneioInicio = document.getElementById('rel-moto-rom-inicio').value.trim();
    const romaneioFim = document.getElementById('rel-moto-rom-fim').value.trim();

    try {
        const filtros = { motoristaId: motoId, dataInicio, dataFim, romaneioInicio, romaneioFim };
        const dados = await window.api.invoke('relatorio-cargas-motorista', filtros);

        if (!dados || dados.length === 0) {
            Swal.fire('Aviso', 'Não há dados para exportar.', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const logoBase64 = window.LOGO_PADRAO_BASE64 || '';
        let headerTextX = 14;
        if (logoBase64) {
            try {
                doc.addImage(logoBase64, 'PNG', 14, 8, 15, 15);
                headerTextX = 32;
            } catch (e) {
                console.warn('Falha ao adicionar logo no jsPDF:', e);
            }
        }

        doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(15, 23, 42);
        doc.text("MT-PRO - Controle de Estoque de Toras", headerTextX, 13);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(71, 85, 105);
        doc.text("Relatório de Cargas por Motorista (Comissões)", headerTextX, 18);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(51, 65, 85);
        doc.text("Motorista: " + motoNome, headerTextX, 23);

        doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.line(14, 25.5, 196, 25.5);

        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
        doc.text(`Período: ${dataInicio ? new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR') : 'Todos'} até ${dataFim ? new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR') : 'Hoje'}`, 14, 29.5);
        if (romaneioInicio || romaneioFim) {
            doc.text(`Filtro Romaneios: De ${romaneioInicio || 'Início'} até ${romaneioFim || 'Fim'}`, 14, 33.5);
        }
        doc.text("Emissão: " + new Date().toLocaleString('pt-BR'), 14, (romaneioInicio || romaneioFim) ? 37.5 : 33.5);

        let totToras = 0;
        let totBruto = 0;
        let totFrete = 0;
        let totComissao = 0;

        const linhas = dados.map(r => {
            const valComissao = Number(r.frete_total) * Number(r.comissao) / 100;
            totToras += r.total_toras;
            totBruto += r.vol_bruto;
            totFrete += r.frete_total;
            totComissao += valComissao;
            return [
                r.numero,
                new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR'),
                r.motorista_nome || '---',
                r.total_toras.toString(),
                r.vol_bruto.toFixed(3),
                'R$ ' + Number(r.frete_total).toFixed(2),
                r.comissao + '%',
                'R$ ' + valComissao.toFixed(2)
            ];
        });

        doc.autoTable({
            startY: (romaneioInicio || romaneioFim) ? 41 : 37,
            head: [["Romaneio", "Data", "Motorista", "Toras", "Vol. Bruto (m³)", "Frete Total", "Comissão (%)", "Valor Comis."]],
            body: linhas,
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105], fontSize: 8, halign: 'center' },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'center' }, 7: { halign: 'right' } }
        });

        let currentY = doc.lastAutoTable.finalY + 12;
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text(`TOTAL CARGAS: ${dados.length}`, 14, currentY);
        doc.text(`TOTAL TORAS: ${totToras}`, 14, currentY + 6);
        doc.text(`VOLUME BRUTO TOTAL: ${totBruto.toFixed(3)} m³`, 14, currentY + 12);
        doc.text(`TOTAL FRETE: R$ ${totFrete.toFixed(2)}`, 14, currentY + 18);
        doc.text(`TOTAL COMISSÕES: R$ ${totComissao.toFixed(2)}`, 14, currentY + 24);

        const motoNomeVal = (motoNome && motoNome !== 'Todos' && !motoNome.includes('Selecione')) ? motoNome : '';
        const nomeArquivoPDF = gerarNomeArquivoDataHora('Relatorio_Motorista', motoNomeVal);
        doc.save(nomeArquivoPDF);
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao exportar PDF.', 'error');
    }
}

function limparRelatorioMotorista() {
    document.getElementById('rel-moto-id').value = 'todos';
    document.getElementById('rel-moto-inicio').value = '';
    document.getElementById('rel-moto-fim').value = '';
    document.getElementById('rel-moto-rom-inicio').value = '';
    document.getElementById('rel-moto-rom-fim').value = '';
    document.getElementById('rel-moto-tabela-container').style.display = 'none';
    document.getElementById('rel-moto-resumo').style.display = 'none';
}

// ============================================================
// MÓDULO FINANCEIRO DE MOTORISTAS (VALES E FECHAMENTO)
// ============================================================

let previaFechamentoAtual = null; // Armazena os dados calculados da prévia

// --- 1. CONTROLE DE ABAS ---
function switchFechamentoTab(tabName, element) {
    // 1. Alterna classe ativa dos botões de abas
    const container = document.querySelector('#v-fechamentos .tabs-container');
    if (container) {
        container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    }
    if (element) {
        element.classList.add('active');
    } else {
        // Se chamado via código sem elemento, procura pelo id
        const targetBtn = document.querySelector(`#v-fechamentos .tabs-container button[onclick*="${tabName}"]`);
        if (targetBtn) targetBtn.classList.add('active');
    }

    // 2. Alterna visibilidade dos conteúdos das abas
    document.querySelectorAll('#v-fechamentos .tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    const targetContent = document.getElementById('tab-content-' + tabName);
    if (targetContent) targetContent.style.display = 'block';

    // 3. Executa gatilhos de carregamento da aba
    if (tabName === 'historico') {
        listarFechamentos();
    } else if (tabName === 'vales') {
        resetFormVale();
        listarVales();
        carregarSelectsFechamentos();
    } else if (tabName === 'novo') {
        limparPreviaFechamento();
        carregarSelectsFechamentos();
    }

    // Recria ícones do Lucide
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- 2. CARREGAMENTO DOS SELECTS DE MOTORISTAS ---
async function carregarSelectsFechamentos() {
    const selectFech = document.getElementById('fech-motorista-id');
    const selectVale = document.getElementById('vale-motorista-id');
    
    try {
        const motoristas = await window.api.invoke('listar-motoristas');
        const optionsHtml = '<option value="">Selecione o Motorista...</option>' +
            (motoristas || []).map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
            
        if (selectFech) {
            const valSalvo = selectFech.value;
            selectFech.innerHTML = optionsHtml;
            selectFech.value = valSalvo;
        }
        if (selectVale) {
            const valSalvo = selectVale.value;
            selectVale.innerHTML = optionsHtml;
            selectVale.value = valSalvo;
        }
    } catch (e) {
        console.error("Erro ao carregar selects de fechamentos:", e);
    }
}

// --- 3. CONTROLE DE FILTROS ---
function toggleTipoFiltroFechamento() {
    const tipo = document.getElementById('fech-tipo-filtro').value;
    const rowDatas = document.getElementById('row-filtro-datas');
    const rowRoms = document.getElementById('row-filtro-romaneios');

    if (tipo === 'datas') {
        rowDatas.style.display = 'flex';
        rowRoms.style.display = 'none';
        document.getElementById('fech-rom-inicio').value = '';
        document.getElementById('fech-rom-fim').value = '';
    } else {
        rowDatas.style.display = 'none';
        rowRoms.style.display = 'flex';
        document.getElementById('fech-data-inicio').value = '';
        document.getElementById('fech-data-fim').value = '';
    }
}

function limparPreviaFechamento() {
    previaFechamentoAtual = null;
    document.getElementById('container-previa-fechamento').style.display = 'none';
    document.getElementById('fech-tabela-cargas').innerHTML = '';
    document.getElementById('fech-tabela-vales-previa').innerHTML = '';
    document.getElementById('fech-observacoes').value = '';
    document.getElementById('fech-vales-select-all').checked = false;
}

// --- 4. CÁLCULO E RENDERIZAÇÃO DA PRÉVIA ---
async function gerarPreviaFechamento() {
    const motoristaId = document.getElementById('fech-motorista-id').value;
    const tipoFiltro = document.getElementById('fech-tipo-filtro').value;
    
    if (!motoristaId) {
        return Swal.fire('Atenção', 'Selecione um motorista para calcular o fechamento.', 'warning');
    }

    const filtros = { motoristaId: parseInt(motoristaId) };

    if (tipoFiltro === 'datas') {
        const dataInicio = document.getElementById('fech-data-inicio').value;
        const dataFim = document.getElementById('fech-data-fim').value;
        if (!dataInicio || !dataFim) {
            return Swal.fire('Atenção', 'Informe as datas de início e fim.', 'warning');
        }
        filtros.dataInicio = dataInicio;
        filtros.dataFim = dataFim;
    } else {
        const romInicio = document.getElementById('fech-rom-inicio').value.trim();
        const romFim = document.getElementById('fech-rom-fim').value.trim();
        if (!romInicio || !romFim) {
            return Swal.fire('Atenção', 'Informe os números de romaneio inicial e final.', 'warning');
        }
        filtros.romaneioInicio = romInicio;
        filtros.romaneioFim = romFim;
    }

    try {
        const res = await window.api.invoke('calcular-previa-fechamento', filtros);
        if (res && res.success) {
            previaFechamentoAtual = res;
            previaFechamentoAtual.filtros = filtros; // Armazena filtros aplicados

            // 1. Exibe painel
            document.getElementById('container-previa-fechamento').style.display = 'block';

            // 2. Preenche Resumos de Cargas
            const tbodyCargas = document.getElementById('fech-tabela-cargas');
            if (res.cargas && res.cargas.length > 0) {
                tbodyCargas.innerHTML = res.cargas.map(c => {
                    const dataFmt = c.data ? c.data.split('-').reverse().join('/') : '---';
                    return `
                        <tr>
                            <td><b>${c.numero}</b></td>
                            <td>${dataFmt}</td>
                            <td>${c.total_toras} toras</td>
                            <td>${c.vol_bruto.toFixed(3)} m³</td>
                            <td>R$ ${(c.frete_valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td>R$ ${(c.frete_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style="color:#10b981; font-weight:700;">R$ ${(c.valor_comissao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbodyCargas.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;" class="text-muted">Nenhum romaneio carregado para este intervalo.</td></tr>`;
            }

            // 3. Preenche Resumos de Vales
            const tbodyVales = document.getElementById('fech-tabela-vales-previa');
            if (res.vales && res.vales.length > 0) {
                tbodyVales.innerHTML = res.vales.map(v => {
                    const dataFmt = v.data ? v.data.split('-').reverse().join('/') : '---';
                    return `
                        <tr>
                            <td style="text-align:center;">
                                <input type="checkbox" class="chk-vale-fech" value="${v.id}" data-valor="${v.valor}" onchange="recalcularTotalFechamentoPrevia()" checked>
                            </td>
                            <td>${dataFmt}</td>
                            <td style="color:#ef4444; font-weight:700;">R$ ${v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td>${v.descricao || 'Sem descrição'}</td>
                        </tr>
                    `;
                }).join('');
                document.getElementById('fech-vales-select-all').checked = true;
            } else {
                tbodyVales.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;" class="text-muted">Nenhum adiantamento (vale) em aberto encontrado.</td></tr>`;
                document.getElementById('fech-vales-select-all').checked = false;
            }

            // 4. Executa recálculo inicial (tudo selecionado)
            recalcularTotalFechamentoPrevia();

        } else {
            Swal.fire('Erro', tratarErroIpc(res.error), 'error');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Erro Crítico', 'Falha ao processar a prévia do fechamento.', 'error');
    }
}

function recalcularTotalFechamentoPrevia() {
    if (!previaFechamentoAtual) return;

    let somaValesDescontados = 0;
    const checkboxes = document.querySelectorAll('.chk-vale-fech');
    checkboxes.forEach(chk => {
        if (chk.checked) {
            somaValesDescontados += parseFloat(chk.getAttribute('data-valor')) || 0;
        }
    });

    const salario = previaFechamentoAtual.motorista.salario;
    const comissoes = previaFechamentoAtual.totalComissao;
    const saldoLiquido = salario + comissoes - somaValesDescontados;

    // Atualiza resumo visual
    document.getElementById('fech-resumo-salario').innerText = `R$ ${salario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('fech-resumo-comissoes').innerText = `+ R$ ${comissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('fech-resumo-vales').innerText = `- R$ ${somaValesDescontados.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const elLiquido = document.getElementById('fech-resumo-liquido');
    elLiquido.innerText = `R$ ${saldoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elLiquido.style.color = saldoLiquido >= 0 ? 'var(--accent-color)' : '#ef4444';

    // Salva valores calculados temporariamente
    previaFechamentoAtual.valoresConsolidados = {
        salario,
        comissoes,
        vales: somaValesDescontados,
        liquido: saldoLiquido
    };
}

function toggleSelectAllValesPrevia(selectAllElement) {
    const chkList = document.querySelectorAll('.chk-vale-fech');
    chkList.forEach(chk => {
        chk.checked = selectAllElement.checked;
    });
    recalcularTotalFechamentoPrevia();
}

// --- 5. SALVAR E CONSOLIDAR FECHAMENTO ---
async function confirmarSalvarFechamento() {
    if (!previaFechamentoAtual || !previaFechamentoAtual.valoresConsolidados) {
        return Swal.fire('Atenção', 'Calcule a prévia do fechamento antes de salvar.', 'warning');
    }

    const obs = document.getElementById('fech-observacoes').value.trim();
    const motoristaId = document.getElementById('fech-motorista-id').value;

    const valesIds = [];
    document.querySelectorAll('.chk-vale-fech').forEach(chk => {
        if (chk.checked) valesIds.push(parseInt(chk.value));
    });

    const f = previaFechamentoAtual.filtros;
    const v = previaFechamentoAtual.valoresConsolidados;

    const dados = {
        motorista_id: parseInt(motoristaId),
        periodo_inicio: f.dataInicio || (f.romaneioInicio ? `Romaneio ${f.romaneioInicio}` : 'N/A'),
        periodo_fim: f.dataFim || (f.romaneioFim ? `Romaneio ${f.romaneioFim}` : 'N/A'),
        romaneio_inicio: f.romaneioInicio || null,
        romaneio_fim: f.romaneioFim || null,
        valor_salario: v.salario,
        valor_comissao: v.comissoes,
        valor_vales: v.vales,
        valor_liquido: v.liquido,
        observacoes: obs,
        valesIds
    };

    const confirmResult = await Swal.fire({
        title: 'Consolidar Fechamento?',
        text: `Deseja fechar as contas deste período? Saldo Líquido a pagar: R$ ${v.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Sim, salvar fechamento',
        cancelButtonText: 'Voltar'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const res = await window.api.invoke('salvar-fechamento-motorista', dados);
        if (res && res.success) {
            await Swal.fire('Sucesso', 'Fechamento de contas consolidado com sucesso!', 'success');
            limparPreviaFechamento();
            
            // Abre o modal do recibo imediatamente para impressão
            abrirReciboFechamento(res.id);
            
            // Redireciona para aba do histórico
            switchFechamentoTab('historico');
        } else {
            Swal.fire('Erro', tratarErroIpc(res.error), 'error');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao salvar fechamento.', 'error');
    }
}

// --- 6. HISTÓRICO DE FECHAMENTOS ---
async function listarFechamentos() {
    const tbody = document.getElementById('fech-tabela-historico');
    try {
        const list = await window.api.invoke('listar-fechamentos-motorista', { motoristaId: 'todos' });
        if (list && list.length > 0) {
            tbody.innerHTML = list.map(f => {
                const dataFmt = f.data_fechamento ? f.data_fechamento.split('-').reverse().join('/') : '---';
                const periodo = f.romaneio_inicio && f.romaneio_fim 
                    ? `Roms: ${f.romaneio_inicio} a ${f.romaneio_fim}`
                    : `Período: ${f.periodo_inicio.split('-').reverse().join('/')} a ${f.periodo_fim.split('-').reverse().join('/')}`;
                    
                return `
                    <tr>
                        <td><b>#${f.id}</b></td>
                        <td>${f.motorista_nome}</td>
                        <td>${dataFmt}</td>
                        <td><span style="font-size:0.8rem; opacity:0.8;">${periodo}</span></td>
                        <td>R$ ${f.valor_salario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="color:#10b981;">+ R$ ${f.valor_comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="color:#ef4444;">- R$ ${f.valor_vales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="font-weight:700; color:var(--accent-color);">R$ ${f.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="text-align:center;">
                            <div style="display:flex; gap:6px; justify-content:center;">
                                <button class="btn-edit-table" onclick="abrirReciboFechamento(${f.id})" title="Imprimir Recibo" style="background:#0284c7; border:none; padding:4px 8px; color:white; border-radius:4px; cursor:pointer;">
                                    <i data-lucide="printer" style="width:14px; height:14px;"></i>
                                </button>
                                <button class="btn-delete-table" onclick="estornarFechamento(${f.id})" title="Estornar Fechamento" style="background:#ef4444; border:none; padding:4px 8px; color:white; border-radius:4px; cursor:pointer;">
                                    <i data-lucide="undo" style="width:14px; height:14px;"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px;" class="text-muted">Nenhum fechamento consolidado encontrado.</td></tr>`;
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#ef4444; padding:20px;">Falha ao carregar histórico.</td></tr>`;
    }
}

async function estornarFechamento(id) {
    const confirmResult = await Swal.fire({
        title: 'Estornar Fechamento?',
        text: "Esta ação apagará o fechamento permanente. Todos os vales descontados voltarão a ficar ativos (em aberto) para novo fechamento.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Sim, estornar tudo',
        cancelButtonText: 'Voltar'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const res = await window.api.invoke('excluir-fechamento-motorista', id);
        if (res && res.success) {
            Swal.fire('Estornado', 'Fechamento cancelado e vales reativados!', 'success');
            listarFechamentos();
        } else {
            Swal.fire('Erro', tratarErroIpc(res.error), 'error');
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao estornar fechamento.', 'error');
    }
}

// --- 7. EMISSÃO DO RECIBO ---
async function abrirReciboFechamento(id) {
    try {
        const res = await window.api.invoke('get-fechamento-detalhado', id);
        if (res && res.success) {
            const f = res.fechamento;
            const dataFmt = f.data_fechamento ? f.data_fechamento.split('-').reverse().join('/') : '---';
            
            document.getElementById('recibo-subtitulo').innerText = `Recibo Nº ${f.id} | Emissão: ${dataFmt}`;
            
            const logoBase64 = window.LOGO_PADRAO_BASE64 || '';
            let html = `
<div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 18px; border-bottom: 1px dashed #000; padding-bottom: 12px;">
    ${logoBase64 ? `<img src="${logoBase64}" style="width: 44px; height: 44px; object-fit: contain;" />` : ''}
    <div style="text-align: left;">
        <h2 style="margin: 0; font-size: 1.05rem; font-weight: bold; color: #0f172a;">MT-PRO - Controle de Estoque de Toras</h2>
        <p style="margin: 2px 0 0 0; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; color: #475569;">Recibo de Fechamento de Motorista</p>
    </div>
</div>

<div style="margin-bottom: 15px; font-size: 0.85rem; line-height: 1.4;">
    <div><strong>MOTORISTA:</strong> ${f.motorista_nome}</div>
    <div><strong>VEÍCULO:</strong> ${f.placa_veiculo || '---'}</div>
    <div><strong>DATA DE EMISSÃO:</strong> ${dataFmt}</div>
    <div><strong>PERÍODO:</strong> ${f.romaneio_inicio ? `Romaneios ${f.romaneio_inicio} a ${f.romaneio_fim}` : `${f.periodo_inicio.split('-').reverse().join('/')} a ${f.periodo_fim.split('-').reverse().join('/')}`}</div>
</div>

<div style="margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
        <thead>
            <tr style="border-bottom: 1px solid #000; font-weight: bold;">
                <th style="padding: 4px 0;">Cargas</th>
                <th>Data</th>
                <th style="text-align: right;">Frete (R$)</th>
                <th style="text-align: right;">Comissão (${f.motorista_comissao_pct || 0}%)</th>
            </tr>
        </thead>
        <tbody>
            ${res.cargas.map(c => `
                <tr>
                    <td style="padding: 4px 0;">Rom. ${c.numero}</td>
                    <td>${c.data ? c.data.split('-').reverse().join('/') : '---'}</td>
                    <td style="text-align: right;">R$ ${(c.frete_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="text-align: right;">R$ ${(c.valor_comissao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</div>

${res.vales && res.vales.length > 0 ? `
<div style="margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px;">
    <div style="font-weight: bold; font-size: 0.8rem; margin-bottom: 5px;">(-) DETALHE DOS VALES DESCONTADOS:</div>
    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
        <tbody>
            ${res.vales.map(v => `
                <tr>
                    <td style="padding: 2px 0;">${v.data ? v.data.split('-').reverse().join('/') : '---'} - ${v.descricao || 'Adiantamento'}</td>
                    <td style="text-align: right; color:#ef4444;">- R$ ${v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</div>
` : ''}

<div style="font-size: 0.9rem; line-height: 1.6; margin-bottom: 25px; border-bottom: 1px dashed #000; padding-bottom: 10px;">
    <div style="display: flex; justify-content: space-between;">
        <span>Salário Fixo:</span>
        <span>R$ ${f.valor_salario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
    <div style="display: flex; justify-content: space-between; color: green;">
        <span>(+) Total Comissões:</span>
        <span>+ R$ ${f.valor_comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
    <div style="display: flex; justify-content: space-between; color: red;">
        <span>(-) Total Vales:</span>
        <span>- R$ ${f.valor_vales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1rem; border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;">
        <span>VALOR LÍQUIDO PAGO:</span>
        <span>R$ ${f.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
</div>

${f.observacoes ? `
<div style="margin-bottom: 25px; font-size: 0.8rem; font-style: italic;">
    <strong>Observações:</strong> ${f.observacoes}
</div>
` : ''}

<div style="margin-top: 40px; text-align: center; font-size: 0.8rem;">
    <div style="border-top: 1px solid #000; width: 250px; margin: 0 auto 5px auto; padding-top: 5px;">
        ${f.motorista_nome}
    </div>
    <span>Assinatura do Motorista</span>
</div>
            `;
            
            document.getElementById('recibo-impressao-conteudo').innerHTML = html;
            
            // Abre o modal do recibo
            const modal = document.getElementById('modal-recibo-fechamento');
            modal.style.display = 'flex';
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            Swal.fire('Erro', tratarErroIpc(res.error), 'error');
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao buscar detalhes do fechamento.', 'error');
    }
}

function fecharModalRecibo() {
    document.getElementById('modal-recibo-fechamento').style.display = 'none';
}

function imprimirReciboConteudo() {
    const conteudo = document.getElementById('recibo-impressao-conteudo').innerHTML;
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write('<html><head><title>Recibo de Fechamento</title>');
    win.document.write('<style>body { font-family: "Courier New", monospace; padding: 20px; }</style>');
    win.document.write('</head><body>');
    win.document.write(conteudo);
    win.document.write('</body></html>');
    win.document.close();
    
    // Pequeno atraso para carregar o HTML antes de abrir a janela de impressão
    setTimeout(() => {
        win.print();
        win.close();
    }, 250);
}

// --- 8. GERENCIAMENTO DE VALES ---
async function salvarValeMotorista() {
    const motoristaId = document.getElementById('vale-motorista-id').value;
    const valorRaw = document.getElementById('vale-valor').value;
    const data = document.getElementById('vale-data').value;
    const descricao = document.getElementById('vale-descricao').value.trim();
    const id = document.getElementById('vale-id').value;

    if (!motoristaId || !valorRaw || !data) {
        return Swal.fire('Atenção', 'Selecione o motorista, informe o valor e a data do vale.', 'warning');
    }

    // Limpa valor formatado (ex: "1.000,00" -> 1000.00)
    let valorLimpo = valorRaw.replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(valorLimpo) || 0;

    if (valor <= 0) {
        return Swal.fire('Atenção', 'Informe um valor de vale maior que zero.', 'warning');
    }

    const vale = {
        motorista_id: parseInt(motoristaId),
        valor,
        data,
        descricao
    };

    if (id) vale.id = parseInt(id);

    try {
        const res = await window.api.invoke('salvar-vale-motorista', vale);
        if (res && res.success) {
            avisar('success', id ? 'Vale atualizado!' : 'Vale lançado com sucesso!');
            resetFormVale();
            listarVales();
        } else {
            Swal.fire('Erro', tratarErroIpc(res.error), 'error');
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao salvar vale.', 'error');
    }
}

async function listarVales() {
    const tbody = document.getElementById('vale-tabela-lista');
    try {
        const list = await window.api.invoke('listar-vales-motorista', { motoristaId: 'todos', status: 'todos' });
        if (list && list.length > 0) {
            tbody.innerHTML = list.map(v => {
                const dataFmt = v.data ? v.data.split('-').reverse().join('/') : '---';
                const isPago = v.status === 'pago';
                const statusBadge = isPago 
                    ? `<span style="background:var(--badge-neutral-bg, #f1f5f9); color:var(--text-muted, #64748b); padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">PAGO (FECH. #${v.fechamento_id})</span>`
                    : `<span style="background:var(--badge-danger-bg, #fee2e2); color:#ef4444; padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">EM ABERTO</span>`;
                
                const acoes = isPago 
                    ? `---` 
                    : `
                        <div style="display:flex; gap:6px; justify-content:center;">
                            <button class="btn-edit-table" onclick="prepararEdicaoVale('${encodeURIComponent(JSON.stringify(v))}')" title="Editar">
                                <i data-lucide="pencil" style="width:14px; height:14px;"></i>
                            </button>
                            <button class="btn-delete-table" onclick="excluirVale(${v.id})" title="Excluir">
                                <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                            </button>
                        </div>
                      `;
                      
                return `
                    <tr>
                        <td>${dataFmt}</td>
                        <td><b>${v.motorista_nome}</b></td>
                        <td style="font-weight:700; color:#ef4444;">- R$ ${v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>${v.descricao || 'Sem descrição'}</td>
                        <td>${statusBadge}</td>
                        <td style="text-align:center;">${acoes}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px;" class="text-muted">Nenhum vale cadastrado.</td></tr>`;
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:20px;">Falha ao carregar vales.</td></tr>`;
    }
}

function prepararEdicaoVale(jsonString) {
    const v = JSON.parse(decodeURIComponent(jsonString));
    document.getElementById('vale-id').value = v.id;
    document.getElementById('vale-motorista-id').value = v.motorista_id;
    document.getElementById('vale-valor').value = v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('vale-data').value = v.data;
    document.getElementById('vale-descricao').value = v.descricao || '';
    
    document.getElementById('btn-cancelar-vale').style.display = 'block';
}

function resetFormVale() {
    document.getElementById('vale-id').value = '';
    document.getElementById('vale-motorista-id').value = '';
    document.getElementById('vale-valor').value = '';
    document.getElementById('vale-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('vale-descricao').value = '';
    document.getElementById('btn-cancelar-vale').style.display = 'none';
}

async function excluirVale(id) {
    const confirmResult = await Swal.fire({
        title: 'Excluir vale?',
        text: "Deseja realmente apagar este adiantamento permanentemente?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const res = await window.api.invoke('excluir-vale-motorista', id);
        if (res && res.success) {
            avisar('success', 'Vale excluído!');
            listarVales();
        } else {
            Swal.fire('Erro', tratarErroIpc(res.error), 'error');
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao excluir vale.', 'error');
    }
}

function mascaraMoeda(input) {
    let value = input.value.replace(/\D/g, '');
    if (value === "") {
        input.value = "";
        return;
    }
    if (value.length > 2) {
        value = value.slice(0, -2) + ',' + value.slice(-2);
    }
    input.value = value;
}

// ============================================================
// SISTEMA INTERATIVO DE AUTO-UPDATER
// ============================================================

let downloadUpdateEmAndamento = false;
let usuarioPediuVerificacaoManual = false;

function iniciarListenersAutoUpdater() {
    // 1. Ouvinte: Nova versão encontrada no servidor/GitHub
    if (window.api && window.api.receive) {
        window.api.receive('update-available', async (info) => {
            console.log("🔔 [AutoUpdater] Nova versão encontrada:", info);
            usuarioPediuVerificacaoManual = false;

            let versaoAtual = '1.1.8';
            try {
                versaoAtual = await window.api.invoke('get-app-version') || versaoAtual;
            } catch (e) {}

            const releaseNotesHtml = info.releaseNotes ? `
                <div style="text-align: left; max-height: 120px; overflow-y: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin: 12px 0; font-size: 12px; color: #475569; line-height: 1.4;">
                    <strong style="color: #0f172a;">Novidades da versão:</strong><br>${info.releaseNotes}
                </div>
            ` : '';

            Swal.fire({
                title: 'Nova Versão Disponível!',
                html: `
                    <div style="text-align: center; padding: 4px 0;">
                        <p style="font-size: 14px; color: #334155; margin-bottom: 12px;">
                            Uma nova atualização do <strong>MT-PRO - Controle de Estoque de Toras</strong> foi encontrada!
                        </p>
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px; background: #f1f5f9; padding: 6px 14px; border-radius: 8px;">
                            <span style="background: #e2e8f0; color: #475569; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 12px;">v${versaoAtual}</span>
                            <span style="color: #94a3b8; font-weight: bold;">➔</span>
                            <span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 13px;">v${info.version}</span>
                        </div>
                        ${releaseNotesHtml}
                        <p style="font-size: 13px; color: #64748b; margin-top: 8px;">
                            Deseja iniciar o download da atualização agora?
                        </p>
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: '<i data-lucide="download"></i> Sim, Baixar Atualização',
                cancelButtonText: 'Lembrar Mais Tarde',
                reverseButtons: true,
                allowOutsideClick: false,
                didOpen: () => {
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await executarDownloadAtualizacao(info.version);
                }
            });
        });

        // 2. Ouvinte: Sistema já está na versão mais recente
        window.api.receive('update-not-available', (info) => {
            console.log("✅ [AutoUpdater] Sistema atualizado.");
            if (usuarioPediuVerificacaoManual) {
                usuarioPediuVerificacaoManual = false;
                Swal.fire({
                    icon: 'success',
                    title: 'Sistema Atualizado!',
                    text: `Você já está utilizando a versão mais recente do MT-PRO (v${info?.version || '1.1.8'}).`,
                    confirmButtonColor: '#10b981',
                    confirmButtonText: 'Entendido'
                });
            }
        });

        // 3. Ouvinte: Progresso de download em tempo real
        window.api.receive('update-download-progress', (prog) => {
            if (!downloadUpdateEmAndamento) return;

            const bar = document.getElementById('swal-update-progress-bar');
            const txtPercent = document.getElementById('swal-update-percent');
            const txtSpeed = document.getElementById('swal-update-speed');
            const txtSize = document.getElementById('swal-update-size');

            const percent = Math.min(100, Math.max(0, prog.percent || 0));
            if (bar) bar.style.width = `${percent}%`;
            if (txtPercent) txtPercent.innerText = `${percent}%`;

            if (txtSpeed && prog.bytesPerSecond !== undefined) {
                const speedMB = (prog.bytesPerSecond / (1024 * 1024));
                if (speedMB >= 1) {
                    txtSpeed.innerText = `${speedMB.toFixed(1)} MB/s`;
                } else {
                    const speedKB = (prog.bytesPerSecond / 1024).toFixed(0);
                    txtSpeed.innerText = `${speedKB} KB/s`;
                }
            }

            if (txtSize && prog.total) {
                const transMB = (prog.transferred / (1024 * 1024)).toFixed(1);
                const totMB = (prog.total / (1024 * 1024)).toFixed(1);
                txtSize.innerText = `${transMB} MB / ${totMB} MB`;
            }
        });

        // 4. Ouvinte: Download finalizado com sucesso
        window.api.receive('update-downloaded', (info) => {
            downloadUpdateEmAndamento = false;
            console.log("🎉 [AutoUpdater] Download pronto para instalação:", info.version);

            Swal.fire({
                title: 'Atualização Pronta!',
                html: `
                    <div style="text-align: center; padding: 6px 0;">
                        <div style="background: #dcfce7; color: #15803d; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                            <i data-lucide="check-circle" style="width: 32px; height: 32px;"></i>
                        </div>
                        <p style="font-size: 14px; color: #334155; margin-bottom: 8px;">
                            A versão <strong>v${info.version}</strong> foi baixada com sucesso!
                        </p>
                        <p style="font-size: 13px; color: #64748b;">
                            O sistema será reiniciado automaticamente para aplicar as novidades.
                        </p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: '<i data-lucide="refresh-cw"></i> Reiniciar e Instalar Agora',
                cancelButtonText: 'Instalar ao Fechar o Sistema',
                allowOutsideClick: false,
                reverseButtons: true,
                didOpen: () => {
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            }).then((res) => {
                if (res.isConfirmed) {
                    window.api.invoke('instalar-update-agora');
                } else {
                    avisar('info', 'A atualização será instalada quando o sistema for fechado.');
                }
            });
        });

        // 5. Ouvinte: Erros
        window.api.receive('update-error', (errMsg) => {
            console.error("❌ [AutoUpdater Error]:", errMsg);
            if (downloadUpdateEmAndamento || usuarioPediuVerificacaoManual) {
                downloadUpdateEmAndamento = false;
                usuarioPediuVerificacaoManual = false;
                Swal.fire({
                    icon: 'error',
                    title: 'Falha na Atualização',
                    text: 'Não foi possível completar a operação com o servidor de updates. Verifique sua conexão com a internet.',
                    confirmButtonColor: '#ef4444'
                });
            }
        });
    }

    atualizarInfoVersaoConfiguracoes();
}

async function executarDownloadAtualizacao(versao) {
    downloadUpdateEmAndamento = true;

    Swal.fire({
        title: 'Baixando Atualização...',
        html: `
            <div style="text-align: center; padding: 10px 0;">
                <p style="margin-bottom: 14px; font-size: 13.5px; color: #334155;">
                    Baixando a versão <strong>v${versao}</strong> do MT-PRO. Por favor, aguarde.
                </p>
                <div style="background: #e2e8f0; border-radius: 999px; height: 16px; overflow: hidden; position: relative; margin-bottom: 10px; border: 1px solid #cbd5e1;">
                    <div id="swal-update-progress-bar" style="background: linear-gradient(90deg, #10b981, #059669); height: 100%; width: 0%; border-radius: 999px; transition: width 0.3s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; font-weight: 600;">
                    <span id="swal-update-percent">0%</span>
                    <span id="swal-update-speed">Iniciando download...</span>
                    <span id="swal-update-size">0 MB / 0 MB</span>
                </div>
            </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        showCancelButton: false
    });

    try {
        const res = await window.api.invoke('iniciar-download-update');
        if (!res || !res.success) {
            throw new Error(res?.error || 'Erro ao acionar download');
        }
    } catch (err) {
        console.error("Erro ao iniciar download:", err);
        downloadUpdateEmAndamento = false;
        Swal.fire({
            icon: 'error',
            title: 'Erro no Download',
            text: 'Não foi possível baixar o instalador da atualização. Tente novamente mais tarde.',
            confirmButtonColor: '#ef4444'
        });
    }
}

async function verificarAtualizacaoManual() {
    const btnIcon = document.getElementById('icon-check-update');
    const btnText = document.getElementById('text-check-update');

    if (btnIcon) btnIcon.classList.add('lucide-spin');
    if (btnText) btnText.innerText = 'Verificando...';
    usuarioPediuVerificacaoManual = true;

    try {
        const res = await window.api.invoke('verificar-atualizacoes');
        if (res && res.isDev) {
            usuarioPediuVerificacaoManual = false;
            Swal.fire({
                icon: 'info',
                title: 'Modo Desenvolvedor',
                text: `O aplicativo está rodando em ambiente de desenvolvimento (versão v${res.version}). As atualizações automáticas via GitHub são ativadas na versão compilada instalada.`,
                confirmButtonColor: '#10b981'
            });
        }
    } catch (err) {
        console.error("Erro ao verificar atualização:", err);
        usuarioPediuVerificacaoManual = false;
        Swal.fire('Erro', 'Falha ao comunicar com o servidor de atualizações.', 'error');
    } finally {
        setTimeout(() => {
            if (btnIcon) btnIcon.classList.remove('lucide-spin');
            if (btnText) btnText.innerText = 'Verificar Atualizações';
        }, 1200);
    }
}

async function atualizarInfoVersaoConfiguracoes() {
    try {
        if (window.api && window.api.invoke) {
            const v = await window.api.invoke('get-app-version');
            if (v) {
                const tag = document.getElementById('cfg-versao-atual-tag');
                const footerTag = document.getElementById('cfg-footer-versao');
                if (tag) tag.innerText = `v${v}`;
                if (footerTag) footerTag.innerText = `v${v}`;
            }
        }
    } catch (e) {}
}


