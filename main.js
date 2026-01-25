const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { machineIdSync } = require('node-machine-id');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { autoUpdater } = require("electron-updater");

let mainWindow;

// --- CONFIGURAÇÃO DO BANCO DE DADOS ---
const dbPath = path.join(app.getPath('userData'), 'toracontroll.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// --- ESTRUTURA DO BANCO (Garantindo Schema completo) ---
db.exec(`
    CREATE TABLE IF NOT EXISTS especies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cientifico TEXT
    );

    CREATE TABLE IF NOT EXISTS lotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT UNIQUE NOT NULL, -- Número do Lote [cite: 2026-01-17]
        descricao TEXT,
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS toras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE,          -- Número da Tora [cite: 2026-01-17]
        especie_id INTEGER,
        lote_id INTEGER,
        rodo INTEGER,                -- Circunferência em cm
        comprimento REAL,            -- Metros
        desconto_1 INTEGER DEFAULT 0, -- Oco Medida 1
        desconto_2 INTEGER DEFAULT 0, -- Oco Medida 2
        total_desconto REAL,         -- Volume do oco (m3)
        volume REAL,                 -- Volume Líquido Final (m3)
        status TEXT DEFAULT 'pátio',
        data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_saida TEXT,
        FOREIGN KEY (especie_id) REFERENCES especies(id),
        FOREIGN KEY (lote_id) REFERENCES lotes(id)
    );

    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario TEXT,
        acao TEXT,
        descricao TEXT
    );
`);

// Migrações para adaptar o banco anterior ao novo modelo de cubagem
try { db.exec("ALTER TABLE toras ADD COLUMN rodo INTEGER;"); } catch (e) { }
try { db.exec("ALTER TABLE toras ADD COLUMN desconto_1 INTEGER DEFAULT 0;"); } catch (e) { }
try { db.exec("ALTER TABLE toras ADD COLUMN desconto_2 INTEGER DEFAULT 0;"); } catch (e) { }
try { db.exec("ALTER TABLE toras ADD COLUMN total_desconto REAL DEFAULT 0;"); } catch (e) { }
try { db.exec("ALTER TABLE toras ADD COLUMN status TEXT DEFAULT 'pátio';"); } catch (e) { }
try { db.exec("ALTER TABLE toras ADD COLUMN data_saida TEXT;"); } catch (e) { }

// --- JANELA PRINCIPAL COM TRAVAS DE PRODUÇÃO ---
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1050,
        title: `${packageInfo.productName || "Controle de Toras"} - v${packageInfo.version || "1.0.0"}`,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            devTools: !app.isPackaged // Bloqueia F12 em produção
        }
    });
    mainWindow.once('ready-to-show', () => {
        setupAutoUpdater(mainWindow);
    });
    mainWindow.setMenu(null); // Layout limpo conforme solicitado [cite: 2026-01-16]
    mainWindow.maximize();
    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => mainWindow.show());
    // Opcional: Impedir que o site mude o título (alguns HTMLs sobrescrevem o título)
    mainWindow.on('page-title-updated', (evt) => {
      evt.preventDefault();
    });

    if (app.isPackaged) {
        mainWindow.webContents.on('devtools-opened', () => mainWindow.webContents.closeDevTools());
    }
}

// Configuração de logs para o Updater (útil para debug se algo falhar)
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

function setupAutoUpdater(window) {
    // Verifica se há atualizações assim que o app inicia
    autoUpdater.checkForUpdatesAndNotify();

    // Evento disparado quando uma atualização é encontrada
    autoUpdater.on('update-available', () => {
        window.webContents.send('status-atualizacao', 'Nova versão encontrada. Baixando...');
    });

    // Evento disparado quando o download termina
    autoUpdater.on('update-downloaded', (info) => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Atualização Pronta',
            message: `A versão ${info.version} foi baixada. Deseja reiniciar para atualizar agora?`,
            buttons: ['Sim, reiniciar', 'Depois']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    // Tratar erros (importante para não travar o app se o GitHub estiver fora)
    autoUpdater.on('error', (err) => {
        console.error("Erro no Updater: ", err);
    });
}

app.whenReady().then(createWindow);

// --- HELPERS DE SISTEMA ---
function obterDataLocal() {
    const agora = new Date();
    const offset = agora.getTimezoneOffset() * 60000;
    return (new Date(agora - offset)).toISOString().slice(0, 19).replace('T', ' ');
}


function registrarLog(usuario, acao, descricao) {
    try {
        const stmt = db.prepare(`INSERT INTO logs (usuario, acao, descricao, data_hora) VALUES (?, ?, ?, ?)`);
        stmt.run(usuario, acao, descricao, obterDataLocal());
    } catch (err) { console.error("Erro ao registrar log:", err); }
}

// --- HANDLERS: ESPÉCIES ---
ipcMain.handle('get-especies', async () => db.prepare("SELECT * FROM especies ORDER BY nome").all());
ipcMain.handle('listar-especies', async () => db.prepare('SELECT * FROM especies ORDER BY nome ASC').all());
ipcMain.handle('salvar-especie', async (e, d) => {
    const res = db.prepare('INSERT INTO especies (nome, cientifico) VALUES (?, ?)').run(d.nome, d.cientifico);
    registrarLog('Operador', 'Cadastro Espécie', `Espécie criada: ${d.nome}`);
    return { success: true, id: res.lastInsertRowid };
});
ipcMain.handle('editar-especie', async (e, d) => {
    db.prepare('UPDATE especies SET nome = ?, cientifico = ? WHERE id = ?').run(d.nome, d.cientifico, d.id);
    registrarLog('Operador', 'Edição Espécie', `Espécie ID ${d.id} atualizada.`);
    return { success: true };
});
ipcMain.handle('excluir-especie', async (e, id) => {
    const check = db.prepare('SELECT COUNT(*) as count FROM toras WHERE especie_id = ?').get(id);
    if (check.count > 0) return { success: false, error: `Não é possível excluir: existem ${check.count} toras desta espécie.` };
    db.prepare('DELETE FROM especies WHERE id = ?').run(id);
    return { success: true };
});

// --- HANDLERS: LOTES ---
ipcMain.handle('get-lotes', async () => db.prepare("SELECT * FROM lotes ORDER BY numero").all());
ipcMain.handle('listar-lotes', async () => {
    return db.prepare(`
        SELECT l.*, COUNT(t.id) as total_toras, IFNULL(SUM(t.volume), 0) as volume_total
        FROM lotes l LEFT JOIN toras t ON l.id = t.lote_id
        GROUP BY l.id ORDER BY l.numero DESC
    `).all();
});
ipcMain.handle('salvar-lote', async (e, d) => {
    const res = db.prepare('INSERT INTO lotes (numero, descricao) VALUES (?, ?)').run(d.numero, d.descricao);
    registrarLog('Operador', 'Cadastro', `Lote Nome: ${d.numero} criado.`);
    return { success: true, id: res.lastInsertRowid };
});
ipcMain.handle('editar-lote', async (e, data) => {
    try {
        const res = db.prepare('UPDATE lotes SET numero = ?, descricao = ? WHERE id = ?').run(data.numero, data.descricao, data.id);
        // LOG ADICIONADO
        registrarLog('Operador', 'Edição', `Lote Nome: ${data.numero} atualizado.`);
        return { success: true, changes: res.changes };
    } catch (error) {
        console.error("Erro ao editar lote:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('excluir-lote', async (e, id) => {
    const check = db.prepare('SELECT COUNT(*) as count FROM toras WHERE lote_id = ?').get(id);
    if (check.count > 0) {
        throw new Error(`Não é possível excluir: o lote contém ${check.count} toras cadastradas.`);
    }
    const lote = db.prepare('SELECT numero FROM lotes WHERE id = ?').get(id);
    const res = db.prepare('DELETE FROM lotes WHERE id = ?').run(id);
    // LOG ADICIONADO
    registrarLog('Operador', 'Exclusão Lote', `Lote Número ${lote ? lote.numero : id} removido.`);
    return { success: true };
});

// --- HANDLERS: TORAS E ESTOQUE (MODULO NÚMERO) ---
ipcMain.handle('salvar-tora', async (event, tora) => {
    try {
        const stmt = db.prepare(`
            INSERT INTO toras (
                codigo, 
                especie_id, 
                lote_id, 
                rodo, 
                desconto_1, 
                desconto_2, 
                total_desconto, 
                comprimento, 
                volume, 
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pátio')
        `);

        const result = stmt.run(
            tora.codigo,
            tora.especie_id,
            tora.lote_id,
            tora.rodo,
            tora.desconto_1,
            tora.desconto_2,
            tora.total_desconto,
            tora.comprimento,
            tora.volume
        );

        // Registro de Log padronizado [cite: 2026-01-20]
        registrarLog('Sistema', 'Entrada', `O Número ${tora.codigo} adicionado ao estoque.`);

        return { success: true, id: result.lastInsertRowid };
    } catch (err) {
        console.error("Erro no Banco de Dados:", err);
        if (err.message.includes('UNIQUE constraint failed')) {
            throw new Error('Este Número de tora já existe no sistema.');
        }
        throw err;
    }
});

ipcMain.handle('excluir-tora', async (event, id) => {
    try {
        // Busca o código antes de deletar para usar no log
        const tora = db.prepare('SELECT codigo, status FROM toras WHERE id = ?').get(id);

        if (!tora) throw new Error("Tora não encontrada.");

        if (tora.status === 'serrada') {
            throw new Error(`A Tora Número ${tora.codigo} já foi baixada (serrada) e não pode ser excluída.`);
        }

        db.prepare('DELETE FROM toras WHERE id = ?').run(id);

        // LOG PADRONIZADO
        registrarLog(
            'Operador',
            'exclusao',
            `Excluiu a Tora Número ${tora.codigo} do sistema.`
        );

        return { success: true };
    } catch (err) {
        throw err;
    }
});

ipcMain.handle('editar-tora', async (event, tora) => {
    try {
        const stmt = db.prepare(`
            UPDATE toras SET 
                codigo = ?, 
                especie_id = ?, 
                lote_id = ?, 
                rodo = ?, 
                desconto_1 = ?, 
                desconto_2 = ?, 
                total_desconto = ?, 
                comprimento = ?, 
                volume = ?
            WHERE id = ?
        `);

        stmt.run(
            tora.codigo,
            tora.especie_id,
            tora.lote_id,
            tora.rodo,
            tora.desconto_1,
            tora.desconto_2,
            tora.total_desconto,
            tora.comprimento,
            tora.volume,
            tora.id
        );

        // Registro de Log da Edição
        registrarLog(
            'Operador',
            'Edição',
            `Tora número ${tora.codigo} atualizada. Novo volume: ${tora.volume} m³`
        );

        return { success: true };
    } catch (err) {
        registrarLog('Sistema', 'Erro Edição', `Falha ao editar tora ${tora.codigo}: ${err.message}`);
        throw err; // Isso fará o Swal exibir o erro correto na tela
    }
});

ipcMain.handle('get-totais-estoque', async (event, filtros) => {
    try {
        let sql = `SELECT COUNT(*) as total_qtd, SUM(volume) as total_vol FROM toras WHERE 1=1`;
        const params = [];

        // Filtro de Status Inteligente
        if (filtros.status && filtros.status !== 'todos') {
            // Se o filtro contém 'p' (pátio, p├ítio, etc)
            if (filtros.status.toLowerCase().includes('p')) {
                sql += " AND (status LIKE 'p%tio' OR status = 'pátio' OR status = 'patio')";
            }
            // Se o filtro for serrada
            else if (filtros.status.toLowerCase().includes('ser')) {
                sql += " AND (status LIKE 'ser%' OR status = 'serrada')";
            }
            // Para outros casos futuros
            else {
                sql += " AND status = ?";
                params.push(filtros.status);
            }
        }

        // Filtro de Lote
        if (filtros.loteId && filtros.loteId !== 'todos') {
            sql += " AND lote_id = ?"; // ou t.lote_id dependendo do seu JOIN
            params.push(filtros.loteId);
        }

        // Filtro de Número [cite: 2026-01-17]
        if (filtros.codigo) {
            sql += " AND (codigo = ? OR CAST(codigo AS INTEGER) = CAST(? AS INTEGER))";
            params.push(filtros.codigo, filtros.codigo);
        }

        const result = db.prepare(sql).get(...params);

        return {
            total_qtd: result.total_qtd || 0,
            total_vol: result.total_vol || 0
        };
    } catch (err) {
        console.error("Erro ao somar serradas:", err);
        return { total_qtd: 0, total_vol: 0 };
    }
});

ipcMain.handle('get-estoque-detalhado', async (event, filtros) => {
    try {
        // 1. Base da Query com Joins para trazer nomes de Espécie e Lote
        let sql = `
            SELECT 
                t.*, 
                e.nome as especie_nome, 
                l.numero as lote_numero 
            FROM toras t
            LEFT JOIN especies e ON t.especie_id = e.id 
            LEFT JOIN lotes l ON t.lote_id = l.id
            WHERE 1=1
        `;
        const params = [];

        // 2. Filtro de Status
        if (filtros.status && filtros.status !== 'todos') {
            sql += " AND t.status = ?";
            params.push(filtros.status);
        }

        // 3. Filtro por Lote
        if (filtros.loteId && filtros.loteId !== 'todos') {
            sql += " AND lote_id = ?"; // ou t.lote_id dependendo do seu JOIN
            params.push(filtros.loteId);
        }

        // 4. CORREÇÃO: Filtro por Número [cite: 2026-01-17]
        // Mudamos de LIKE para "=" para evitar que '150' traga '1500'
        if (filtros.codigo) {
            sql += " AND (t.codigo = ? OR CAST(t.codigo AS INTEGER) = CAST(? AS INTEGER))";
            params.push(filtros.codigo);
            params.push(filtros.codigo);
        }

        // 5. Ordenação (Mais recentes primeiro)
        sql += " ORDER BY t.id DESC";

        // 6. Paginação (Limite de 50 por vez para manter o layout leve)
        sql += " LIMIT ? OFFSET ?";
        params.push(filtros.limite || 50);
        params.push(filtros.pular || 0);

        const rows = db.prepare(sql).all(...params);
        return rows;
    } catch (err) {
        console.error("Erro no get-estoque-detalhado:", err);
        return [];
    }
});

ipcMain.handle('buscar-tora-por-codigo', async (event, codigo) => {
    try {
        // Usamos CAST para garantir que a comparação ignore zeros à esquerda
        // Ex: '001' vira 1 e coincide com a coluna se ela for numérica.
        // Se a coluna for TEXTO, usamos o código puro.
        const query = `
            SELECT t.*, e.nome as especie_nome, l.numero as lote_numero 
            FROM toras t
            LEFT JOIN especies e ON t.especie_id = e.id 
            LEFT JOIN lotes l ON t.lote_id = l.id
            WHERE (t.codigo = ? OR CAST(t.codigo AS INTEGER) = CAST(? AS INTEGER))
            AND t.status = 'pátio'
            LIMIT 1
        `;

        // Passamos o código duas vezes para os dois '?' da query
        return db.prepare(query).get(codigo, codigo);
    } catch (err) {
        console.error("Erro ao buscar tora para baixa:", err);
        throw err;
    }
});

// Busca qualquer tora pelo número (independente do status, para consulta ou edição)
ipcMain.handle('buscar-tora-por-numero', async (event, numero) => {
    try {
        const termo = String(numero).trim();

        // 1. Tentativa: Busca exata, mas usando TRIM para remover espaços invisíveis no banco
        // 2. Tentativa: Busca convertendo ambos para número (resolve 003 vs 3)
        // 3. Tentativa: Busca usando LIKE (caso o código tenha prefixos)
        const sql = `
            SELECT t.*, e.nome as especie_nome, l.numero 
            FROM toras t
            LEFT JOIN especies e ON t.especie_id = e.id
            LEFT JOIN lotes l ON t.lote_id = l.id
            WHERE TRIM(t.codigo) = ? 
               OR CAST(t.codigo AS INTEGER) = CAST(? AS INTEGER)
               OR t.codigo LIKE ?
            LIMIT 1
        `;

        // Executa a busca tentando as três formas
        const tora = db.prepare(sql).get(termo, termo, `%${termo}%`);

        if (tora) {
            console.log("Tora encontrada:", tora.codigo); // Log no terminal do VS Code
            return { success: true, data: tora };
        } else {
            console.log("Nenhuma tora encontrada com o termo:", termo);
            return { success: false, error: "Não localizado." };
        }
    } catch (error) {
        console.error("Erro crítico no SQL:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('estornar-baixa-tora', async (event, idTora, numeroTora) => {
    try {
        const stmt = db.prepare(`
            UPDATE estoque 
            SET status = 'pátio', data_saida = NULL 
            WHERE id = ?
        `);

        const resultado = stmt.run(idTora);

        if (resultado.changes > 0) {
            // Registrar no Log o estorno
            registrarLog('Estorno', `Estorno de baixa realizado. Tora ${numeroTora} retornou ao pátio.`);
            return { success: true };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('listar-toras-recentes', async () => {
    try {
        const query = `
            SELECT t.*, e.nome as especie_nome, l.numero as lote_numero 
            FROM toras t
            LEFT JOIN especies e ON t.especie_id = e.id
            LEFT JOIN lotes l ON t.lote_id = l.id
            ORDER BY t.id DESC LIMIT 10
        `;
        const dados = db.prepare(query).all();

        return dados;
    } catch (err) {
        registrarLog('Sistema', 'Erro SQL', `Falha ao listar toras: ${err.message}`);
        throw err;
    }
});
ipcMain.handle('reverter-status-tora', async (event, id, codigo) => {
    try {
        const transacao = db.transaction(() => {
            // 1. Atualiza o status do Número no estoque
            const stmt = db.prepare(`
                UPDATE toras 
                SET status = 'pátio', data_saida = NULL 
                WHERE id = ?
            `);
            const info = stmt.run(id);

            if (info.changes === 0) throw new Error("Registro não encontrado.");

            // 2. Registra o Log usando sua nova função padronizada
            // Aqui você pode passar o usuário logado se tiver essa variável
            registrarLog('Sistema', 'ESTORNO', `O Número ${codigo} retornou ao pátio via estorno.`);

            return true;
        });

        return { success: transacao() };

    } catch (error) {
        console.error("Erro no estorno:", error);
        return { success: false, error: error.message };
    }
});


ipcMain.handle('processar-baixa-lote', async (event, { ids, dataSaida }) => {
    try {
        // Define a data no formato do banco (YYYY-MM-DD) para persistência
        const dataParaBanco = dataSaida || new Date().toISOString().split('T')[0];

        // FORMATAÇÃO PARA O PADRÃO BRASILEIRO (DD/MM/YYYY) para o Log
        const dataFormatada = dataParaBanco.split('-').reverse().join('/');

        // 1. Busca os números das toras para o log [cite: 2026-01-17]
        const placeholders = ids.map(() => '?').join(',');
        const torasSelecionadas = db.prepare(`SELECT codigo FROM toras WHERE id IN (${placeholders})`).all(ids);
        const listaNumeros = torasSelecionadas.map(t => t.codigo).join(', ');

        // 2. Executa a atualização no banco de dados
        const update = db.prepare("UPDATE toras SET status = 'serrada', data_saida = ? WHERE id = ? AND status != 'serrada'");
        const executarTransacao = db.transaction((idsList, dt) => {
            for (const id of idsList) {
                update.run(dt, id);
            }
        });
        executarTransacao(ids, dataParaBanco);

        // 3. Registra o Log com data em formato PT-BR e terminologia correta [cite: 2026-01-20]
        const mensagemLog = `Baixa de ${ids.length} toras em ${dataFormatada}. Números: [${listaNumeros}]`;
        registrarLog('Operador', 'Baixa', mensagemLog);

        return { success: true };
    } catch (err) {
        console.error("Erro ao processar baixa:", err);
        throw err;
    }
});

// --- HANDLERS: RELATÓRIOS E LOGS ---
ipcMain.handle('buscar-dados-relatorio', async (event, filtros) => {
    let sql = `
        SELECT t.*, e.nome as especie_nome, l.numero as lote_numero 
        FROM toras t 
        LEFT JOIN especies e ON t.especie_id = e.id 
        LEFT JOIN lotes l ON t.lote_id = l.id 
        WHERE 1=1`;

    const params = [];

    // --- CORREÇÃO DOS FILTROS BASEADOS NO SEU SELECT ---

    if (filtros.tipo === 'estoque') {
        // Inventário Atual: Somente toras que AINDA estão no pátio
        sql += " AND t.status = 'pátio'";
    }
    else if (filtros.tipo === 'baixas') {
        // Somente toras que JÁ foram serradas/saíram
        sql += " AND t.status = 'serrada'";
    }
    else if (filtros.tipo === 'entradas') {
        // Mostra tudo o que entrou, independente de ainda estar lá ou não
        // (Geralmente filtramos apenas por data de entrada aqui)
    }
    // Se for 'geral', ele não adiciona filtro de status e mostra todo o histórico

    // --- FILTROS DE DATA ---
    // Só aplicamos data se houver valores e se NÃO for o inventário total (opcional)
    if (filtros.dataInicio && filtros.dataFim) {
        // Se for baixas, olha data de saída. Se for entradas ou geral, olha data de entrada.
        const campoData = filtros.tipo === 'baixas' ? 't.data_saida' : 't.data_entrada';
        sql += ` AND ${campoData} BETWEEN ? AND ?`;
        params.push(filtros.dataInicio, filtros.dataFim);
    }

    // --- FILTROS DE IDENTIFICAÇÃO ---
    if (filtros.especieId && filtros.especieId !== 'todas') {
        sql += " AND t.especie_id = ?";
        params.push(filtros.especieId);
    }

    if (filtros.loteId && filtros.loteId !== 'todos') {
        sql += " AND t.lote_id = ?";
        params.push(filtros.loteId);
    }

    sql += " ORDER BY t.data_entrada DESC";

    try {
        return db.prepare(sql).all(...params);
    } catch (err) {
        console.error("Erro SQL:", err);
        throw err;
    }
});

ipcMain.handle('get-resumo-gerencial', async (event, filtros) => {
    // Mesma lógica de filtros que você já usa
    let sql = `
        SELECT t.volume, t.status, e.nome as especie_nome, l.numero as lote_numero 
        FROM toras t 
        LEFT JOIN especies e ON t.especie_id = e.id 
        LEFT JOIN lotes l ON t.lote_id = l.id 
        WHERE 1=1`;

    const params = [];

    // --- REUTILIZANDO SUA LÓGICA DE FILTROS ---
    if (filtros.tipo === 'estoque') sql += " AND t.status = 'pátio'";
    else if (filtros.tipo === 'baixas') sql += " AND t.status = 'serrada'";

    if (filtros.dataInicio && filtros.dataFim) {
        const campoData = filtros.tipo === 'baixas' ? 't.data_saida' : 't.data_entrada';
        sql += ` AND ${campoData} BETWEEN ? AND ?`;
        params.push(filtros.dataInicio, filtros.dataFim);
    }

    if (filtros.especieId && filtros.especieId !== 'todas') {
        sql += " AND t.especie_id = ?";
        params.push(filtros.especieId);
    }

    if (filtros.loteId && filtros.loteId !== 'todos') {
        sql += " AND t.lote_id = ?";
        params.push(filtros.loteId);
    }

    try {
        const dados = db.prepare(sql).all(...params);

        // Processa os dados para o formato que sua função renderizarTabelaRelatorio espera
        let volTotalGeral = 0;
        const resumoEspecies = {};
        const resumoLotes = {};

        dados.forEach(t => {
            const vol = Number(t.volume);
            volTotalGeral += vol;
            const esp = t.especie_nome || 'Indefinida';
            const lote = t.lote_numero || 'Sem Lote';

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

        return {
            volTotalGeral,
            qtdTotalGeral: dados.length,
            resumoEspecies,
            resumoLotes
        };
    } catch (err) {
        console.error("Erro no Resumo:", err);
        throw err;
    }
});

ipcMain.handle('buscar-dados-relatorio-paginado', async (event, filtros) => {
    let sql = `
        SELECT t.*, e.nome as especie_nome, l.numero as lote_numero 
        FROM toras t 
        LEFT JOIN especies e ON t.especie_id = e.id 
        LEFT JOIN lotes l ON t.lote_id = l.id 
        WHERE 1=1`;

    const params = [];

    // (Repetir aqui exatamente os mesmos filtros aplicados acima)
    if (filtros.tipo === 'estoque') sql += " AND t.status = 'pátio'";
    else if (filtros.tipo === 'baixas') sql += " AND t.status = 'serrada'";

    if (filtros.dataInicio && filtros.dataFim) {
        const campoData = filtros.tipo === 'baixas' ? 't.data_saida' : 't.data_entrada';
        sql += ` AND ${campoData} BETWEEN ? AND ?`;
        params.push(filtros.dataInicio, filtros.dataFim);
    }

    if (filtros.especieId && filtros.especieId !== 'todas') {
        sql += " AND t.especie_id = ?";
        params.push(filtros.especieId);
    }

    if (filtros.loteId && filtros.loteId !== 'todos') {
        sql += " AND t.lote_id = ?";
        params.push(filtros.loteId);
    }

    sql += " ORDER BY t.data_entrada DESC";

    // PAGINAÇÃO
    sql += " LIMIT ? OFFSET ?";
    params.push(filtros.limite || 50, filtros.pular || 0);

    try {
        return db.prepare(sql).all(...params);
    } catch (err) {
        console.error("Erro na Tabela Paginada:", err);
        throw err;
    }
});

ipcMain.handle('listar-logs', async (event, filtros = {}) => {
    try {
        const { acao, dataInicio, dataFim, limiteInicial } = filtros;
        let sql = "SELECT * FROM logs WHERE 1=1";
        let params = [];

        if (acao && acao !== 'todos') {
            // Transformamos tudo para minúsculo no banco e no filtro para comparar
            if (acao === 'EDICAO') {
                // Busca radical 'edi' para ignorar o 'ção' ou 'cao'
                sql += " AND LOWER(acao) LIKE LOWER('%edi%')";
            }
            else if (acao === 'EXCLUSAO') {
                // Busca radical 'exclu' para ignorar 'são' ou 'sao'
                sql += " AND LOWER(acao) LIKE LOWER('%exclu%')";
            } else if (acao === 'LOTE') {
                // Busca radical 'exclu' para ignorar 'são' ou 'sao'
                sql += " AND LOWER(acao) LIKE LOWER('%cadastro%')";
            }
            else {
                sql += " AND LOWER(acao) LIKE LOWER(?)";
                params.push(`%${acao}%`);
            }
        }

        if (dataInicio) {
            sql += " AND date(data_hora) >= date(?)";
            params.push(dataInicio);
        }
        if (dataFim) {
            sql += " AND date(data_hora) <= date(?)";
            params.push(dataFim);
        }

        sql += " ORDER BY data_hora DESC LIMIT ?";
        params.push(limiteInicial || 500);

        const logs = db.prepare(sql).all(...params);
        return { success: true, data: logs };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
// --- DASHBOARD (FUSÃO DE TODAS AS ESTATÍSTICAS) ---
ipcMain.handle('get-dashboard-data', () => {
    try {
        const estoque = db.prepare(`SELECT COUNT(*) as totalPecas, SUM(volume) as totalVolume FROM toras WHERE status = 'pátio'`).get();
        const dataHoje = new Date().toLocaleDateString('en-CA');
        const logsH = db.prepare(`SELECT COUNT(*) as qtd FROM logs WHERE data_hora LIKE ?`).get(`${dataHoje}%`);
        const ultimas = db.prepare(`SELECT t.codigo, e.nome as especie, t.volume, t.data_entrada, t.status FROM toras t 
                                    LEFT JOIN especies e ON t.especie_id = e.id ORDER BY t.id DESC LIMIT 10`).all();
        const lotes = db.prepare(`SELECT l.numero as lote, COUNT(t.id) as totalToras, SUM(t.volume) as volumeTotal FROM toras t
                                  JOIN lotes l ON t.lote_id = l.id WHERE t.status = 'pátio' GROUP BY l.numero ORDER BY volumeTotal DESC LIMIT 4`).all();
        const ranking = db.prepare(`SELECT e.nome as especie, SUM(t.volume) as volumeTotal FROM toras t JOIN especies e ON t.especie_id = e.id
                                     WHERE t.status = 'pátio' GROUP BY e.id ORDER BY volumeTotal DESC LIMIT 5`).all();
        return {
            totalPecas: estoque.totalPecas || 0,
            totalVolume: estoque.totalVolume || 0,
            logsHoje: logsH.qtd || 0,
            ultimasToras: ultimas,
            resumoLotes: lotes,
            rankingEspecies: ranking,
            logsRecentes: db.prepare(`SELECT data_hora, descricao FROM logs ORDER BY id DESC LIMIT 3`).all()
        };
    } catch (err) { return null; }
});

// --- UTILITÁRIOS E SEGURANÇA ---
ipcMain.handle('get-machine-id', () => machineIdSync());

ipcMain.handle('gerar-pdf-logs', async (event, html) => {
    let winPDF = new BrowserWindow({ show: false });
    await winPDF.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await winPDF.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
    const filePath = path.join(app.getPath('documents'), `Relatorio_${Date.now()}.pdf`);
    fs.writeFileSync(filePath, pdfData);
    shell.showItemInFolder(filePath);
    winPDF.close();
    return { success: true };
});

ipcMain.handle('exportar-backup', async () => {
    // 1. Gera o nome com data/hora local para o Número [cite: 2026-01-17] e registros
    const dataFormatada = obterDataLocal().replace(/[: ]/g, '-');
    const nomeSugerido = `tora-control-backup-${dataFormatada}.db`;

    const { filePath } = await dialog.showSaveDialog({
        title: 'Exportar Backup Otimizado',
        defaultPath: nomeSugerido,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (filePath) {
        try {
            // Se o arquivo já existir, o SQLite não deixa usar o VACUUM INTO, então deletamos se houver
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            // 2. O COMANDO MÁGICO: Cria o backup e otimiza o banco simultaneamente
            // Usamos caminhos absolutos para garantir que o SQLite encontre o local
            db.prepare(`VACUUM INTO '${filePath}'`).run();

            registrarLog('Sistema', 'BACKUP', `Backup otimizado gerado com sucesso: ${nomeSugerido}`);

            return { success: true };
        } catch (err) {
            console.error("Erro no backup avançado:", err);
            // Se o VACUUM falhar (em versões muito antigas do SQLite), voltamos para o método antigo
            try {
                fs.copyFileSync(dbPath, filePath);
                return { success: true };
            } catch (copyErr) {
                return { success: false, error: copyErr.message };
            }
        }
    }
    return { success: false };
});

ipcMain.handle('limpar-banco-dados', async () => {
    db.transaction(() => {
        db.prepare('DELETE FROM toras').run();
        db.prepare('DELETE FROM lotes').run();
        db.prepare('DELETE FROM especies').run();
        db.prepare("DELETE FROM logs").run();
    })();
    return { success: true };
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });