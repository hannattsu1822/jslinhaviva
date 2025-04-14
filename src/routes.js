const express = require('express');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { chromium } = require('playwright');
const { app, upload, promisePool } = require('./init');
const {
    autenticar,
    verificarPermissaoPorCargo,
    verificarPermissao,
    registrarAuditoria
} = require('./auth');

const router = express.Router();

// Função robusta para converter datas de Excel para formato JS/MySQL
function excelSerialDateToJSDate(input) {
    // Se o input já estiver no formato ISO (YYYY-MM-DD)
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
        return input;
    }

    // Se for número (formato serial do Excel)
    if (!isNaN(input)) {
        try {
            // Excel usa 1 = 1 Jan 1900, mas tem um bug (considera 1900 como ano bissexto)
            const utcDays = Math.floor(input - (input > 60 ? 25569 : 25568)); // Ajuste para o bug do Excel
            const utcValue = utcDays * 86400; // Segundos por dia
            const date = new Date(utcValue * 1000); // Converter para milissegundos

            // Verificar se a data é válida
            if (isNaN(date.getTime())) {
                throw new Error('Data inválida');
            }

            // Formatar como YYYY-MM-DD
            const isoString = date.toISOString();
            return isoString.split('T')[0];
        } catch (err) {
            console.error('Erro ao converter data serial:', input, err);
            return null;
        }
    }

    // Tentar parsear como string de data (formato brasileiro ou ISO)
    if (typeof input === 'string') {
        try {
            // Tentar formato brasileiro (DD/MM/YYYY)
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
                const [day, month, year] = input.split('/');
                const date = new Date(`${year}-${month}-${day}`);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }

            // Tentar formato ISO (YYYY-MM-DD)
            const date = new Date(input);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (err) {
            console.error('Erro ao converter data string:', input, err);
            return null;
        }
    }

    console.error('Formato de data não reconhecido:', input);
    return null;
}

// Rotas de autenticação
router.post('/login', async (req, res) => {
    const { matricula, senha } = req.body;

    try {
        const [rows] = await promisePool.query('SELECT * FROM users WHERE matricula = ?', [matricula]);

        if (rows.length > 0) {
            const user = rows[0];

            if (senha === user.senha) {
                req.session.user = {
                    nome: user.nome,
                    matricula: user.matricula,
                    cargo: user.cargo,
                };

                res.status(200).json({
                    message: 'Login bem-sucedido!',
                    user: req.session.user,
                });
            } else {
                res.status(401).json({ message: 'Matrícula ou senha incorretas!' });
            }
        } else {
            res.status(404).json({ message: 'Usuário não encontrado!' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erro ao conectar ao banco de dados!' });
    }
});

router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rotas de veículos
router.get('/api/motoristas', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query("SELECT matricula, nome FROM users WHERE cargo = 'Motorista'");
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar motoristas!' });
    }
});

router.get('/api/placas', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT placa FROM veiculos');
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar placas!' });
    }
});

router.get('/api/inspecoes', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT * FROM inspecoes');
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar inspeções:', err);
        res.status(500).json({ message: 'Erro ao buscar inspeções!' });
    }
});

router.get('/api/inspecoes/:id', autenticar, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await promisePool.query('SELECT * FROM inspecoes WHERE id = ?', [id]);

        if (rows.length > 0) {
            res.status(200).json(rows[0]);
        } else {
            res.status(404).json({ message: 'Inspeção não encontrada!' });
        }
    } catch (err) {
        console.error('Erro ao buscar inspeção:', err);
        res.status(500).json({ message: 'Erro ao buscar inspeção!' });
    }
});

router.post('/api/salvar_inspecao', autenticar, async (req, res) => {
    const {
        matricula,
        placa,
        data_inspecao,
        km_atual,
        horimetro,
        observacoes,
        ...outrosCampos
    } = req.body;

    if (!matricula || !placa || !data_inspecao || !km_atual || !horimetro) {
        return res.status(400).json({ message: 'Dados obrigatórios faltando!' });
    }

    if (km_atual < 0 || horimetro < 0) {
        return res.status(400).json({ message: 'KM atual e horímetro devem ser valores positivos!' });
    }

    try {
        const campos = [
            'matricula', 'placa', 'data_inspecao', 'km_atual', 'horimetro', 'observacoes',
            'buzina', 'cinto_seguranca', 'quebra_sol', 'retrovisor_inteiro', 'retrovisor_direito_esquerdo',
            'limpador_para_brisa', 'farol_baixa', 'farol_alto', 'meia_luz', 'luz_freio', 'luz_re',
            'bateria', 'luzes_painel', 'seta_direita_esquerdo', 'pisca_alerta', 'luz_interna',
            'velocimetro_tacografo', 'freios', 'macaco', 'chave_roda', 'triangulo_sinalizacao',
            'extintor_incendio', 'portas_travas', 'sirene', 'fechamento_janelas', 'para_brisa',
            'oleo_motor', 'oleo_freio', 'nivel_agua_radiador', 'pneus_estado_calibragem',
            'pneu_reserva_estepe', 'bancos_encosto_assentos', 'para_choque_dianteiro',
            'para_choque_traseiro', 'lataria', 'estado_fisico_sky', 'funcionamento_sky',
            'sapatas', 'cestos', 'comandos', 'lubrificacao', 'ensaio_eletrico', 'cilindros',
            'gavetas', 'capas', 'nivel_oleo_sky'
        ];

        const placeholders = campos.map(() => '?').join(', ');
        const values = campos.map(campo => {
            if (campo === 'observacoes') {
                return req.body[campo] || null;
            }
            if (req.body[campo] === undefined) {
                return null;
            }
            return req.body[campo];
        });

        const query = `
      INSERT INTO inspecoes (
        ${campos.join(', ')}
      )
      VALUES (${placeholders})
    `;

        await promisePool.query(query, values);
        await registrarAuditoria(matricula, 'Salvar Inspeção', `Inspeção salva com placa: ${placa}`);

        res.status(201).json({ message: 'Inspeção salva com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar inspeção:', err);
        res.status(500).json({ message: 'Erro ao salvar inspeção!' });
    }
});

router.post('/api/filtrar_inspecoes', autenticar, async (req, res) => {
    const { placa, matricula, dataInicial, dataFinal } = req.body;

    try {
        let query = 'SELECT * FROM inspecoes WHERE 1=1';
        const values = [];

        if (placa) {
            query += ` AND placa = ?`;
            values.push(placa);
        }

        if (matricula) {
            query += ` AND matricula = ?`;
            values.push(matricula);
        }

        if (dataInicial && dataFinal) {
            query += ` AND data_inspecao BETWEEN ? AND ?`;
            values.push(dataInicial, dataFinal);
        } else if (dataInicial) {
            query += ` AND data_inspecao >= ?`;
            values.push(dataInicial);
        } else if (dataFinal) {
            query += ` AND data_inspecao <= ?`;
            values.push(dataFinal);
        }

        const [rows] = await promisePool.query(query, values);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao filtrar inspeções:', err);
        res.status(500).json({ message: 'Erro ao filtrar inspeções!' });
    }
});

router.delete('/api/excluir_inspecao/:id', autenticar, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await promisePool.query('DELETE FROM inspecoes WHERE id = ?', [id]);

        if (result.affectedRows > 0) {
            await registrarAuditoria(req.user.matricula, 'Excluir Inspeção', `Inspeção excluída com ID: ${id}`);
            res.status(200).json({ message: 'Inspeção excluída com sucesso!' });
        } else {
            res.status(404).json({ message: 'Inspeção não encontrada!' });
        }
    } catch (err) {
        console.error('Erro ao excluir inspeção:', err);
        res.status(500).json({ message: 'Erro ao excluir inspeção!' });
    }
});

router.get('/editar_inspecao', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/editar_inspecao.html'));
});

router.get('/api/editar_inspecao/:id', autenticar, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await promisePool.query('SELECT * FROM inspecoes WHERE id = ?', [id]);

        if (rows.length > 0) {
            res.status(200).json(rows[0]);
        } else {
            res.status(404).json({ message: 'Inspeção não encontrada!' });
        }
    } catch (err) {
        console.error('Erro ao buscar inspeção:', err);
        res.status(500).json({ message: 'Erro ao buscar inspeção!' });
    }
});

router.post('/api/editar_inspecao/:id', autenticar, async (req, res) => {
    const { id } = req.params;
    const { placa, matricula, data_inspecao, km_atual, horimetro, observacoes } = req.body;

    try {
        const query = `
      UPDATE inspecoes
      SET placa = ?, matricula = ?, data_inspecao = ?, km_atual = ?, horimetro = ?, observacoes = ?
      WHERE id = ?
    `;
        const values = [placa, matricula, data_inspecao, km_atual, horimetro, observacoes, id];

        await promisePool.query(query, values);
        await registrarAuditoria(matricula, 'Editar Inspeção', `Inspeção editada com ID: ${id}`);

        res.status(200).json({ message: 'Inspeção atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar inspeção:', err);
        res.status(500).json({ message: 'Erro ao atualizar inspeção!' });
    }
});

router.post('/api/upload_transformadores', autenticar, upload.single('planilha'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'Nenhum arquivo enviado!'
        });
    }

    try {
        // 1. Processar planilha
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { defval: null });

        if (!data || data.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Planilha vazia ou formato inválido'
            });
        }

        // 2. Verificar estrutura da planilha
        const headers = Object.keys(data[0]);
        console.log('Cabeçalhos encontrados:', headers);

        // 3. Mapeamento robusto de colunas
        const columnMap = {
            item: headers.find(h => h.trim().toUpperCase() === 'ITEM'),
            marca: headers.find(h => h.trim().toUpperCase() === 'MARCA'),
            potencia: headers.find(h => h.trim().toUpperCase().includes('POTÊNCIA') ||
                h.trim().toUpperCase().includes('KVA')),
            fases: headers.find(h => h.trim().toUpperCase().includes('FASES') ||
                h.trim().toUpperCase().includes('FASE')),
            serie: headers.find(h => h.trim().toUpperCase().includes('SÉRIE') ||
                h.trim().toUpperCase().includes('SERIE')),
            local: headers.find(h => h.trim().toUpperCase().includes('LOCAL') ||
                h.trim().toUpperCase().includes('RETIRADA')),
            regional: headers.find(h => h.trim().toUpperCase() === 'REGIONAL'),
            motivo: headers.find(h => h.trim().toUpperCase().includes('MOTIVO') ||
                h.trim().toUpperCase().includes('DESATIVAÇÃO') ||
                h.trim().toUpperCase().includes('DESATIVACAO')),
            data: headers.find(h => h.trim().toUpperCase().includes('DATA') ||
                h.trim().toUpperCase().includes('ENTRADA') ||
                h.trim().toUpperCase().includes('ALMOXARIFADO'))
        };

        // 4. Validar mapeamento
        const requiredColumns = ['marca', 'potencia', 'serie', 'data'];
        const missingColumns = requiredColumns.filter(col => !columnMap[col]);

        if (missingColumns.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`
            });
        }

        // 5. Processar dados
        const transformadores = data.map((row, idx) => {
            // Função para obter valores com tratamento seguro
            const getValue = (key) => {
                const colName = columnMap[key];
                return colName && row[colName] !== undefined ? row[colName] : null;
            };

            // Processar data - verificar se já está no formato ISO
            const dataRaw = getValue('data');
            let dataEntrada = null;

            if (dataRaw) {
                if (typeof dataRaw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dataRaw)) {
                    // Já está no formato ISO (com ou sem hora)
                    dataEntrada = dataRaw.split(' ')[0];
                } else if (!isNaN(dataRaw)) {
                    // Número serial do Excel
                    dataEntrada = excelSerialDateToJSDate(dataRaw);
                }
            }

            return {
                linha: idx + 2,
                item: getValue('item'),
                marca: getValue('marca'),
                potencia: getValue('potencia'),
                numero_fases: getValue('fases'),
                numero_serie: getValue('serie'),
                local_retirada: getValue('local'),
                regional: getValue('regional'),
                motivo_desativacao: getValue('motivo'),
                data_entrada: dataEntrada,
                errors: []
            };
        });

        // 6. Validações
        let hasErrors = false;
        transformadores.forEach(tf => {
            if (!tf.numero_serie) {
                tf.errors.push('Número de série é obrigatório');
                hasErrors = true;
            }
            if (!tf.marca) {
                tf.errors.push('Marca é obrigatória');
                hasErrors = true;
            }
            if (!tf.potencia) {
                tf.errors.push('Potência é obrigatória');
                hasErrors = true;
            }
            if (!tf.data_entrada) {
                tf.errors.push('Data de entrada inválida ou faltando');
                hasErrors = true;
            }
        });

        // 7. Verificar duplicatas
        const serialNumbers = transformadores.map(t => t.numero_serie);
        const duplicatesInSheet = [...new Set(
            serialNumbers.filter((num, i) => serialNumbers.indexOf(num) !== i)
        )];

        // Verificar existência no banco
        const uniqueSerials = [...new Set(serialNumbers.filter(Boolean))];
        const existingInDb = [];
        if (uniqueSerials.length > 0) {
            const [existing] = await promisePool.query(
                'SELECT numero_serie FROM transformadores WHERE numero_serie IN (?)',
                [uniqueSerials]
            );
            existing.forEach(item => existingInDb.push(item.numero_serie));
        }

        // 8. Preparar resultado
        const results = {
            total: transformadores.length,
            imported: 0,
            failed: 0,
            duplicates_in_sheet: duplicatesInSheet,
            duplicates_in_db: existingInDb,
            details: []
        };

        // 9. Importar para o banco
        for (const tf of transformadores) {
            try {
                if (tf.errors.length > 0) {
                    throw new Error(tf.errors.join('; '));
                }

                if (duplicatesInSheet.includes(tf.numero_serie)) {
                    throw new Error('Número de série duplicado na planilha');
                }

                if (existingInDb.includes(tf.numero_serie)) {
                    throw new Error('Número de série já existe no banco');
                }

                await promisePool.query(
                    `INSERT INTO transformadores (
                        item, marca, potencia, numero_fases, numero_serie,
                        local_retirada, regional, motivo_desativacao, data_entrada_almoxarifado
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        tf.item,
                        tf.marca,
                        tf.potencia,
                        tf.numero_fases,
                        tf.numero_serie,
                        tf.local_retirada,
                        tf.regional,
                        tf.motivo_desativacao,
                        tf.data_entrada
                    ]
                );

                results.imported++;
                results.details.push({
                    linha: tf.linha,
                    numero_serie: tf.numero_serie,
                    status: 'success'
                });
            } catch (error) {
                results.failed++;
                results.details.push({
                    linha: tf.linha,
                    numero_serie: tf.numero_serie,
                    status: 'error',
                    message: error.message
                });
            }
        }

        // 10. Responder
        res.json({
            success: results.imported > 0,
            message: results.imported === results.total ?
                'Todos os registros importados com sucesso!' :
                `Importação concluída com ${results.failed} erro(s)`,
            ...results
        });

    } catch (error) {
        console.error('Erro no processamento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro no processamento: ' + error.message
        });
    } finally {
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
    }
});

// Adicione esta rota no routes.js
router.get('/api/transformadores_sem_checklist', autenticar, async (req, res) => {
    try {
        const query = `
            SELECT t.numero_serie 
            FROM transformadores t
            LEFT JOIN checklist_transformadores ct ON t.numero_serie = ct.numero_serie
            WHERE ct.numero_serie IS NULL
        `;
        const [rows] = await promisePool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar transformadores sem checklist:', err);
        res.status(500).json({ message: 'Erro ao buscar transformadores sem checklist!' });
    }
});

// Rota modificada para salvar checklist de transformadores
router.post('/api/salvar_checklist', autenticar, async (req, res) => {
    const {
        numero_serie,
        data_fabricacao,
        reformado,
        data_reformado,
        detalhes_tanque,
        corrosao_tanque,
        buchas_primarias,
        buchas_secundarias,
        conectores,
        avaliacao_bobina_i,
        avaliacao_bobina_ii,
        avaliacao_bobina_iii,
        conclusao,
        transformador_destinado,
        matricula_responsavel,
        matricula_supervisor,
        observacoes
    } = req.body;

    if (!numero_serie || !matricula_responsavel) {
        return res.status(400).json({ message: 'Número de série e responsável são obrigatórios!' });
    }

    try {
        // Verificações existentes...

        const isReformado = reformado === 'true';

        const dataFabricacaoFormatada = data_fabricacao ?
            (data_fabricacao.includes('-') ? data_fabricacao : `${data_fabricacao}-01-01`) :
            null;

        const dataReformadoFormatada = isReformado && data_reformado ?
            (data_reformado.includes('-') ? data_reformado : `${data_reformado}-01-01`) :
            null;

        // Query modificada - removido data_checklist da lista de colunas
        const query = `
            INSERT INTO checklist_transformadores (
                numero_serie, 
                data_fabricacao, 
                reformado, 
                data_reformado,
                detalhes_tanque,
                corrosao_tanque,
                buchas_primarias,
                buchas_secundarias,
                conectores,
                avaliacao_bobina_i,
                avaliacao_bobina_ii,
                avaliacao_bobina_iii,
                conclusao,
                transformador_destinado,
                matricula_responsavel,
                supervisor_tecnico,
                observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            numero_serie,
            dataFabricacaoFormatada,
            isReformado,
            dataReformadoFormatada,
            detalhes_tanque,
            corrosao_tanque || 'NENHUMA',
            buchas_primarias,
            buchas_secundarias,
            conectores,
            avaliacao_bobina_i,
            avaliacao_bobina_ii,
            avaliacao_bobina_iii,
            conclusao,
            transformador_destinado,
            matricula_responsavel,
            matricula_supervisor,
            observacoes
        ];

        await promisePool.query(query, values);
        await registrarAuditoria(matricula_responsavel, 'Salvar Checklist', `Checklist salvo para transformador: ${numero_serie}`);

        res.status(201).json({ message: 'Checklist salvo com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar checklist:', error);
        res.status(500).json({ message: 'Erro ao salvar checklist!' });
    }
});

router.get('/api/responsaveis', autenticar, async (req, res) => {
    try {
        const query = `
      SELECT matricula, nome 
      FROM users 
      WHERE cargo IN ('Engenheiro', 'Técnico', 'Gerente', 'ADMIN', 'ADM')
    `;
        const [rows] = await promisePool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar responsáveis:', err);
        res.status(500).json({ message: 'Erro ao buscar responsáveis técnicos!' });
    }
});

router.get('/api/supervisores', autenticar, async (req, res) => {
    try {
        const query = `
      SELECT matricula, nome 
      FROM users 
      WHERE cargo IN ('Engenheiro', 'Gerente')
    `;
        const [rows] = await promisePool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar supervisores:', err);
        res.status(500).json({ message: 'Erro ao buscar supervisores técnicos!' });
    }
});

// Rotas para troca de óleo
router.get('/registro_oleo', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/registro_oleo.html'));
});

// API para obter veículos
router.get('/api/veiculos_oleo', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT id, placa, modelo FROM veiculos ORDER BY placa');
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar veículos:', err);
        res.status(500).json({ message: 'Erro ao buscar veículos!' });
    }
});

// API para obter técnicos/engenheiros
router.get('/api/tecnicos_oleo', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            "SELECT id, matricula, nome FROM users WHERE cargo IN ('Técnico', 'Engenheiro') ORDER BY nome"
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar técnicos:', err);
        res.status(500).json({ message: 'Erro ao buscar técnicos!' });
    }
});

// Corrigir a rota /api/registrar_oleo
router.post('/api/registrar_oleo', autenticar, async (req, res) => {
    const {
        veiculo_id,
        responsavel_id,
        data_troca,
        horimetro,
        observacoes
    } = req.body;

    // Validações básicas
    if (!veiculo_id || !responsavel_id || !data_troca || !horimetro) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios!' });
    }

    if (horimetro < 0) {
        return res.status(400).json({ message: 'Horímetro deve ser um valor positivo!' });
    }

    try {
        // Verificar se o veículo existe
        const [veiculo] = await promisePool.query('SELECT id FROM veiculos WHERE id = ?', [veiculo_id]);
        if (veiculo.length === 0) {
            return res.status(404).json({ message: 'Veículo não encontrado!' });
        }

        // Verificar se o responsável existe e tem cargo válido
        const [responsavel] = await promisePool.query(
            'SELECT id FROM users WHERE id = ? AND cargo IN ("Técnico", "Engenheiro")',
            [responsavel_id]
        );
        if (responsavel.length === 0) {
            return res.status(404).json({ message: 'Responsável técnico não encontrado ou não autorizado!' });
        }

        // Inserir no banco de dados
        const query = `
            INSERT INTO trocas_oleo (
                veiculo_id, 
                responsavel_id, 
                data_troca, 
                horimetro, 
                observacoes
            ) VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
            veiculo_id,
            responsavel_id,
            data_troca,
            horimetro,
            observacoes || null
        ];

        const [result] = await promisePool.query(query, values);

        // Registrar auditoria - usando matrícula do usuário logado
        await registrarAuditoria(
            req.user.matricula,  // Alterado de req.user.id para req.user.matricula
            'Registro de Troca de Óleo',
            `Troca de óleo registrada para veículo ID: ${veiculo_id}`
        );

        res.status(201).json({
            message: 'Troca de óleo registrada com sucesso!',
            id: result.insertId
        });
    } catch (err) {
        console.error('Erro ao registrar troca de óleo:', err);
        res.status(500).json({ message: 'Erro ao registrar troca de óleo!' });
    }
});

// API para obter histórico de trocas
router.post('/api/registrar_oleo', autenticar, async (req, res) => {
    const {
        veiculo_id,
        responsavel_id,
        data_troca,
        horimetro,
        observacoes
    } = req.body;

    // Validações básicas
    if (!veiculo_id || !responsavel_id || !data_troca || !horimetro) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios!' });
    }

    if (horimetro < 0) {
        return res.status(400).json({ message: 'Horímetro deve ser um valor positivo!' });
    }

    try {
        // Obter informações do veículo
        const [veiculo] = await promisePool.query('SELECT id, placa FROM veiculos WHERE id = ?', [veiculo_id]);
        if (veiculo.length === 0) {
            return res.status(404).json({ message: 'Veículo não encontrado!' });
        }

        const placa = veiculo[0].placa;

        // Verificar se o responsável existe e tem cargo válido
        const [responsavel] = await promisePool.query(
            'SELECT id, matricula FROM users WHERE id = ? AND cargo IN ("Técnico", "Engenheiro")',
            [responsavel_id]
        );
        if (responsavel.length === 0) {
            return res.status(404).json({ message: 'Responsável técnico não encontrado ou não autorizado!' });
        }

        // Obter último horímetro da inspeção
        const [ultimaInspecao] = await promisePool.query(
            'SELECT horimetro FROM inspecoes WHERE placa = ? ORDER BY data_inspecao DESC LIMIT 1',
            [placa]
        );

        // Obter último horímetro de troca de óleo
        const [ultimaTroca] = await promisePool.query(
            'SELECT horimetro FROM trocas_oleo WHERE veiculo_id = ? ORDER BY data_troca DESC LIMIT 1',
            [veiculo_id]
        );

        // Calcular horímetros
        const horimetroInspecao = ultimaInspecao[0]?.horimetro || 0;
        const horimetroUltimaTroca = ultimaTroca[0]?.horimetro || 0;

        // Validar se o horímetro informado é válido (deve ser >= que o último registrado)
        if (horimetro < horimetroUltimaTroca) {
            return res.status(400).json({
                message: `O horímetro informado (${horimetro}) deve ser maior ou igual ao último registrado (${horimetroUltimaTroca})`
            });
        }

        // Calcular próxima troca (sem casas decimais)
        const horimetroProximaTroca = Math.floor(parseFloat(horimetro) + 300);

        // Inserir no banco de dados (apenas com os campos existentes)
        const query = `
            INSERT INTO trocas_oleo (
                veiculo_id, 
                responsavel_id, 
                data_troca, 
                horimetro, 
                observacoes
            ) VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
            veiculo_id,
            responsavel_id,
            data_troca,
            horimetro,
            observacoes || null
        ];

        const [result] = await promisePool.query(query, values);

        // Registrar auditoria
        await registrarAuditoria(
            req.user.matricula,
            'Registro de Troca de Óleo',
            `Troca de óleo registrada para veículo ID: ${veiculo_id} - Placa: ${placa}`
        );

        // Retornar os dados formatados
        res.status(201).json({
            message: 'Troca de óleo registrada com sucesso!',
            id: result.insertId,
            horimetros: {
                atual: horimetro,
                ultima_inspecao: horimetroInspecao,
                ultima_troca: horimetroUltimaTroca,
                proxima_troca: horimetroProximaTroca
            },
            placa: placa,
            data_troca: data_troca
        });

    } catch (err) {
        console.error('Erro ao registrar troca de óleo:', err);
        res.status(500).json({ message: 'Erro ao registrar troca de óleo!' });
    }
});

// Rota para listar todos os registros ou filtrar
router.get('/api/historico_oleo/:veiculo_id?', autenticar, async (req, res) => {
    const { veiculo_id } = req.params;

    try {
        let query = `
            SELECT 
                t.id,
                t.data_troca,
                t.horimetro,
                t.observacoes,
                t.created_at,
                v.placa,
                v.modelo,
                u.nome as responsavel,
                u.matricula
            FROM trocas_oleo t
            JOIN users u ON t.responsavel_id = u.id
            LEFT JOIN veiculos v ON t.veiculo_id = v.id
        `;

        const params = [];

        if (veiculo_id) {
            query += ' WHERE t.veiculo_id = ?';
            params.push(veiculo_id);
        }

        query += ' ORDER BY t.data_troca DESC';

        const [rows] = await promisePool.query(query, params);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar histórico de trocas:', err);
        res.status(500).json({ message: 'Erro ao buscar histórico de trocas!' });
    }
});

router.get('/api/ultimo_horimetro', autenticar, async (req, res) => {
    const { placa } = req.query;

    if (!placa) {
        return res.status(400).json({ message: 'Placa é obrigatória!' });
    }

    try {
        console.log('Buscando horímetro para a placa:', placa);

        const [rows] = await promisePool.query(
            'SELECT horimetro FROM inspecoes WHERE placa = ? ORDER BY data_inspecao DESC LIMIT 1',
            [placa]
        );

        console.log('Resultado da consulta:', rows);

        if (rows.length > 0) {
            res.status(200).json({ horimetro: rows[0].horimetro });
        } else {
            res.status(404).json({ message: 'Nenhuma inspeção encontrada para esta placa.' });
        }
    } catch (error) {
        console.error('Erro ao buscar horímetro:', error);
        res.status(500).json({ message: 'Erro ao buscar horímetro.' });
    }
});

router.get('/api/proxima_troca_oleo', autenticar, async (req, res) => {
    try {
        // 1. Buscar TODAS as placas de veículos
        const [veiculos] = await promisePool.query(
            `SELECT id, placa, modelo FROM veiculos ORDER BY placa`
        );

        // 2. Processar cada veículo
        const cards = await Promise.all(veiculos.map(async (veiculo) => {
            const { id, placa, modelo } = veiculo;

            // 3. Buscar último horímetro de inspeção (convertendo para inteiro)
            const [inspecao] = await promisePool.query(
                `SELECT FLOOR(horimetro) as horimetro 
                 FROM inspecoes 
                 WHERE placa = ? 
                 ORDER BY data_inspecao DESC LIMIT 1`,
                [placa]
            );

            // 4. Buscar último horímetro de troca de óleo (convertendo para inteiro)
            const [troca] = await promisePool.query(
                `SELECT FLOOR(horimetro) as horimetro 
                 FROM trocas_oleo 
                 WHERE veiculo_id = ?
                 ORDER BY data_troca DESC LIMIT 1`,
                [id]
            );

            // 5. Calcular valores (todos como inteiros)
            const horimetroInspecao = inspecao[0]?.horimetro || 0;
            const ultimaTroca = troca[0]?.horimetro || 0;
            const horimetroAtual = horimetroInspecao;
            const proximaTroca = ultimaTroca + 300; // 300 horas após a última troca

            return {
                id,
                placa,
                modelo,
                horimetroInspecao,
                ultimaTroca,
                horimetroAtual,
                proximaTroca,
                horasRestantes: Math.max(0, proximaTroca - horimetroAtual)
            };
        }));

        res.status(200).json(cards);

    } catch (error) {
        console.error('Erro ao gerar cards:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar dados',
            error: error.message
        });
    }
});
router.get('/proxima_troca_oleo', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/proxima_troca_oleo.html'));
});

router.get('/api/checklist_transformadores/:id', autenticar, async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
      SELECT 
        ct.*, 
        t.potencia, 
        t.numero_serie,
        t.local_retirada,
        t.regional,
        t.numero_fases,
        t.marca,
        t.motivo_desativacao,
        t.data_entrada_almoxarifado,
        u.nome AS nome_responsavel,
        ct.supervisor_tecnico AS nome_supervisor
      FROM checklist_transformadores ct
      INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
      INNER JOIN users u ON ct.matricula_responsavel = u.matricula
      WHERE ct.id = ?
    `;
        const [rows] = await promisePool.query(query, [id]);

        if (rows.length > 0) {
            res.status(200).json(rows[0]);
        } else {
            res.status(404).json({ message: 'Checklist não encontrado!' });
        }
    } catch (err) {
        console.error('Erro ao buscar checklist:', err);
        res.status(500).json({ message: 'Erro ao buscar checklist!' });
    }
});

router.get('/relatorio_publico', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/relatorio_formulario.html'));
});

// Rota para gerar PDF
router.get('/api/gerar_pdf/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                t.marca,
                t.numero_serie
            FROM checklist_transformadores ct
            INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
            WHERE ct.id = ?
        `;
        const [rows] = await promisePool.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Checklist não encontrado!' });
        }

        const { marca, numero_serie } = rows[0];
        const marcaFormatada = marca.replace(/[^a-zA-Z0-9]/g, '_');
        const nomeArquivo = `${id}_${numero_serie}_${marcaFormatada}.pdf`;

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const url = `http://localhost:${process.env.SERVER_PORT || 3000}/relatorio_publico?id=${id}`;

        await page.goto(url, { waitUntil: 'networkidle' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
        });

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        res.status(500).json({ message: 'Erro ao gerar PDF!' });
    }
});

router.get('/api/auditoria', autenticar, verificarPermissao, async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT * FROM auditoria ORDER BY timestamp DESC');
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar logs de auditoria:', err);
        res.status(500).json({ message: 'Erro ao buscar logs de auditoria!' });
    }
});

router.get('/auditoria', autenticar, verificarPermissao, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/auditoria.html'));
});

// Rotas de páginas
router.get('/dashboard', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

router.get('/transformadores', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/transformadores.html'));
});

router.get('/subestacao', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/subestacao.html'));
});

router.get('/frota', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/frota.html'));
});

router.get('/checklist_veiculos', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checklist_veiculos.html'));
});

router.get('/filtrar_veiculos', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/filtrar_veiculos.html'));
});

router.get('/relatorio_veiculos', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/relatorio_veiculos.html'));
});

router.get('/check_horimetro', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/check_horimetro.html'));
});

router.get('/upload_transformadores', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/upload_transformadores.html'));
});

router.get('/formulario_transformadores', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/formulario_transformadores.html'));
});

router.get('/filtrar_transformadores', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/filtrar_transformadores.html'));
});

router.get('/relatorio_formulario', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/relatorio_formulario.html'));
});

router.get('/api/checklist_transformadores_publico/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                ct.*, 
                t.potencia, 
                t.numero_serie,
                t.local_retirada,
                t.regional,
                t.numero_fases,
                t.marca,
                t.motivo_desativacao,
                t.data_entrada_almoxarifado,
                u.nome AS nome_responsavel,
                u2.nome AS nome_supervisor,
                DATE_FORMAT(ct.data_checklist, '%Y-%m-%d') as data_formulario
            FROM checklist_transformadores ct
            INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
            INNER JOIN users u ON ct.matricula_responsavel = u.matricula
            LEFT JOIN users u2 ON ct.supervisor_tecnico = u2.matricula
            WHERE ct.id = ?
        `;
        const [rows] = await promisePool.query(query, [id]);

        if (rows.length > 0) {
            // Formata a data de entrada no almoxarifado para garantir o formato correto
            const result = rows[0];
            if (result.data_entrada_almoxarifado) {
                const date = new Date(result.data_entrada_almoxarifado);
                result.data_entrada_almoxarifado = date.toISOString().split('T')[0];
            }
            res.status(200).json(result);
        } else {
            res.status(404).json({ message: 'Checklist não encontrado!' });
        }
    } catch (err) {
        console.error('Erro ao buscar checklist:', err);
        res.status(500).json({ message: 'Erro ao buscar checklist!' });
    }
});

router.get('/editar_transformadores', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/editar_transformadores.html'));
});

router.delete('/api/excluir_transformador/:id', autenticar, async (req, res) => {
    const { id } = req.params;
    console.log(`Tentando excluir transformador com ID: ${id}`);

    try {
        const [result] = await promisePool.query('DELETE FROM checklist_transformadores WHERE id = ?', [id]);
        console.log(`Resultado da exclusão:`, result.affectedRows);

        if (result.affectedRows > 0) {
            await registrarAuditoria(req.user.matricula, 'Excluir Transformador', `Transformador excluído com ID: ${id}`);
            res.status(200).json({ message: 'Transformador excluído com sucesso!' });
        } else {
            res.status(404).json({ message: 'Transformador não encontrado!' });
        }
    } catch (err) {
        console.error('Erro ao excluir transformador:', err);
        res.status(500).json({ message: 'Erro ao excluir transformador!' });
    }
});

router.get('/api/gerar_pdf_veiculos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
      SELECT 
        placa
      FROM inspecoes
      WHERE id = ?
    `;
        const [rows] = await promisePool.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Inspeção não encontrada!' });
        }

        const { placa } = rows[0];
        const placaFormatada = placa.replace(/[^a-zA-Z0-9]/g, '_');
        const nomeArquivo = `${id}_${placaFormatada}.pdf`;

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const url = `http://localhost:${process.env.SERVER_PORT || 3000}/relatorio_publico_veiculos?id=${id}`;

        await page.goto(url, { waitUntil: 'networkidle' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
        });

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Erro ao gerar PDF com Playwright:', err);
        res.status(500).json({ message: 'Erro ao gerar PDF com Playwright!' });
    }
});

router.get('/relatorio_publico_veiculos', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/relatorio_veiculos.html'));
});

router.get('/api/inspecoes_publico/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await promisePool.query('SELECT * FROM inspecoes WHERE id = ?', [id]);

        if (rows.length > 0) {
            res.status(200).json(rows[0]);
        } else {
            res.status(404).json({ message: 'Inspeção não encontrada!' });
        }
    } catch (err) {
        console.error('Erro ao buscar inspeção:', err);
        res.status(500).json({ message: 'Erro ao buscar inspeção!' });
    }
});

router.post('/api/filtrar_transformadores', autenticar, async (req, res) => {
    const { numero_serie, matricula_responsavel, dataInicial, dataFinal } = req.body;

    try {
        let query = `
            SELECT 
                ct.id,
                t.numero_serie,
                t.potencia,
                t.marca,
                DATE(ct.data_checklist) as data_formulario,
                ct.matricula_responsavel,
                u.nome as nome_responsavel,
                ct.conclusao as status
            FROM checklist_transformadores ct
            INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
            INNER JOIN users u ON ct.matricula_responsavel = u.matricula
            WHERE 1=1
        `;

        const params = [];

        if (numero_serie && numero_serie.trim() !== '') {
            query += ' AND t.numero_serie LIKE ?';
            params.push(`%${numero_serie}%`);
        }

        if (matricula_responsavel && matricula_responsavel.trim() !== '') {
            query += ' AND ct.matricula_responsavel = ?';
            params.push(matricula_responsavel);
        }

        if (dataInicial || dataFinal) {
            if (dataInicial && dataFinal) {
                query += ' AND DATE(ct.data_checklist) BETWEEN ? AND ?';
                params.push(dataInicial, dataFinal);
            } else if (dataInicial) {
                query += ' AND DATE(ct.data_checklist) >= ?';
                params.push(dataInicial);
            } else if (dataFinal) {
                query += ' AND DATE(ct.data_checklist) <= ?';
                params.push(dataFinal);
            }
        }

        query += ' ORDER BY ct.data_checklist DESC';

        const [rows] = await promisePool.query(query, params);

        if (rows.length === 0) {
            return res.status(200).json({
                message: 'Nenhum transformador encontrado com os filtros aplicados',
                data: []
            });
        }

        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro detalhado:', {
            message: err.message,
            stack: err.stack,
            sql: err.sql,
            code: err.code
        });

        res.status(500).json({
            message: 'Falha ao filtrar transformadores',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});
router.post('/api/servicos', upload.array('anexos', 5), async (req, res) => {
    try {
        const {
            processo,
            data_prevista_execucao,
            desligamento,
            subestacao,
            alimentador,
            chave_montante,
            turma_matricula,
            maps
        } = req.body;

        // Validação dos campos obrigatórios
        if (!processo || !data_prevista_execucao || !subestacao || !desligamento) {
            // Remove arquivos temporários se houver erro
            if (req.files) {
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
            return res.status(400).json({ message: 'Campos obrigatórios faltando' });
        }

        // Inserir o processo principal no banco de dados
        const [result] = await promisePool.query(
            `INSERT INTO processos (
                processo, 
                data_prevista_execucao, 
                desligamento, 
                subestacao, 
                alimentador,
                chave_montante, 
                turma_matricula, 
                maps, 
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativo')`,
            [
                processo,
                data_prevista_execucao,
                desligamento,
                subestacao,
                alimentador || null,
                chave_montante || null,
                turma_matricula || null,
                maps || null
            ]
        );

        const processId = result.insertId;
        const anexosSalvos = [];

        // Processar cada anexo enviado
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const fileExtension = path.extname(file.originalname).toLowerCase();
                const novoNome = `${processId}_${i + 1}${fileExtension}`;
                const novoPath = path.join(__dirname, '../upload_arquivos', novoNome);

                // Renomear o arquivo temporário
                fs.renameSync(file.path, novoPath);

                const caminhoServidor = `/api/upload_arquivos/${novoNome}`;

                // Inserir metadados do anexo na tabela processos_anexos
                const [anexoResult] = await promisePool.query(
                    `INSERT INTO processos_anexos (
                        processo_id, 
                        nome_original, 
                        caminho_servidor, 
                        tamanho
                    ) VALUES (?, ?, ?, ?)`,
                    [processId, file.originalname, caminhoServidor, file.size]
                );

                anexosSalvos.push({
                    id: anexoResult.insertId,
                    nomeOriginal: file.originalname,
                    caminho: caminhoServidor,
                    tamanho: file.size
                });
            }
        }

        // Resposta de sucesso
        res.status(201).json({
            success: true,
            message: 'Serviço registrado com sucesso',
            processId: processId,
            anexos: anexosSalvos
        });

    } catch (error) {
        console.error('Erro ao registrar serviço:', error);

        // Remove arquivos temporários em caso de erro
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erro ao registrar serviço',
            error: error.message
        });
    }
});

// Listar serviços com filtros
router.get('/api/servicos', autenticar, async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT p.*, u.nome as responsavel FROM processos p LEFT JOIN users u ON p.turma_matricula = u.matricula';
        const params = [];

        if (status) {
            query += ' WHERE p.status = ?';
            params.push(status);
        }
        query += ' ORDER BY p.data_prevista_execucao DESC';

        const [servicos] = await promisePool.query(query, params);
        res.json(servicos);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar serviços' });
    }
});

// Detalhes de um serviço específico
router.get('/api/servicos/:id', autenticar, async (req, res) => {
    try {
        // Busca os dados do processo
        const [processo] = await promisePool.query(`
            SELECT p.*, u.nome as responsavel 
            FROM processos p 
            LEFT JOIN users u ON p.turma_matricula = u.matricula 
            WHERE p.id = ?`,
            [req.params.id]
        );

        if (processo.length === 0) {
            return res.status(404).json({ message: 'Serviço não encontrado' });
        }

        // Busca os anexos relacionados
        const [anexos] = await promisePool.query(
            'SELECT * FROM processos_anexos WHERE processo_id = ?',
            [req.params.id]
        );

        // Formata a resposta
        const servico = {
            ...processo[0],
            anexos: anexos.map(anexo => ({
                id: anexo.id,
                nomeOriginal: anexo.nome_original,
                caminho: anexo.caminho_servidor,
                tamanho: anexo.tamanho,
                dataUpload: anexo.data_upload
            }))
        };

        res.json(servico);
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Atualizar status do serviço
router.patch('/api/servicos/:id/status', autenticar, async (req, res) => {
    try {
        const { status } = req.body;
        const statusValidos = ['ativo', 'concluido', 'cancelado', 'pendente'];

        if (!statusValidos.includes(status)) {
            return res.status(400).json({ message: 'Status inválido' });
        }

        await promisePool.query(
            `UPDATE processos SET 
                status = ?,
                data_conclusao = ${status === 'concluido' ? 'CURRENT_DATE()' : 'NULL'}
             WHERE id = ?`,
            [status, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Excluir serviço
// routes.js
router.get('/api/servicos/:id', autenticar, async (req, res) => {
    try {
        // 1. Busca o serviço principal
        const [servicoRows] = await promisePool.query(`
            SELECT p.*, u.nome as responsavel 
            FROM processos p
            LEFT JOIN users u ON p.turma_matricula = u.matricula
            WHERE p.id = ?`,
            [req.params.id]
        );

        if (servicoRows.length === 0) {
            return res.status(404).json({ message: 'Serviço não encontrado' });
        }

        // 2. Busca os anexos
        const [anexosRows] = await promisePool.query(`
            SELECT * FROM processos_anexos 
            WHERE processo_id = ?`,
            [req.params.id]
        );

        // 3. Formata a resposta
        const response = {
            ...servicoRows[0],
            anexos: anexosRows.map(anexo => ({
                id: anexo.id,
                nomeOriginal: anexo.nome_original,
                caminho: anexo.caminho_servidor,
                tamanho: anexo.tamanho,
                dataUpload: anexo.data_upload
            }))
        };

        res.json(response);
    } catch (error) {
        console.error('Erro ao buscar serviço:', error);
        res.status(500).json({ message: 'Erro ao buscar serviço' });
    }
});

// Contador de serviços por status
router.get('/api/servicos/contador', autenticar, async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT COUNT(*) as total FROM processos';
        const params = [];

        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }

        const [result] = await promisePool.query(query, params);
        res.json({ total: result[0].total });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao contar serviços' });
    }
});

// Download/visualização de anexos
router.get('/api/upload_arquivos/:filename', (req, res) => {
    const filePath = path.join(__dirname, '../upload_arquivos', req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Arquivo não encontrado' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
    };

    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${req.params.filename}"`);
    fs.createReadStream(filePath).pipe(res);
});

// ==============================================
// ROTAS PARA PÁGINAS (FRONTEND)
// ==============================================

// Página de gestão de serviços
router.get('/gestao-servicos', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/gestao_servico.html'));
});

// Página de registro de serviços
router.get('/registro_servicos', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/registro_servicos.html'));
});

// Página de serviços ativos
router.get('/servicos_ativos', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/servicos_ativos.html'));
});

// Página de serviços concluídos
router.get('/servicos_concluidos', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/servicos_concluidos.html'));
});

// Página de detalhes do serviço
router.get('/detalhes_servico', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/detalhes_servico.html'));
});

// Página de edição de serviço
router.get('/editar_servico', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/editar_servico.html'));
});



router.post('/api/servicos', upload.array('anexos', 5), async (req, res) => {
    try {
        // 1. Insere o processo principal
        const [result] = await promisePool.query('INSERT INTO processos (...) VALUES (...)');

        // 2. Processa os anexos se existirem
        if (req.files && req.files.length > 0) {
            const anexos = await salvarAnexos(result.insertId, req.files);
            // ... resto da lógica
        }

        res.status(201).json({ success: true });
    } catch (error) {
        // Tratamento de erro
    }
});


// Rota para excluir serviço
router.delete('/api/servicos/:id', autenticar, async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Verificar se o serviço existe
        const [servico] = await promisePool.query('SELECT * FROM processos WHERE id = ?', [id]);

        if (servico.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serviço não encontrado'
            });
        }

        // 2. Excluir anexos primeiro (se houver)
        await promisePool.query('DELETE FROM processos_anexos WHERE processo_id = ?', [id]);

        // 3. Excluir o serviço principal
        const [result] = await promisePool.query('DELETE FROM processos WHERE id = ?', [id]);

        if (result.affectedRows > 0) {
            // Registrar auditoria
            await registrarAuditoria(
                req.user.matricula,
                'Excluir Serviço',
                `Serviço excluído - ID: ${id}, Processo: ${servico[0].processo}`
            );

            res.json({
                success: true,
                message: 'Serviço excluído com sucesso'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Nenhum serviço foi excluído'
            });
        }
    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir serviço',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Rota para concluir serviço com imagem
// routes.js - Adicione esta rota modificada
router.post('/api/servicos/:id/concluir', autenticar, upload.single('imagem_conclusao'), async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { observacoes } = req.body;

        // 1. Verificar se o serviço existe
        const [servico] = await connection.query('SELECT * FROM processos WHERE id = ?', [id]);
        if (servico.length === 0) {
            if (req.file?.path) fs.unlinkSync(req.file.path);
            return res.status(404).json({ message: 'Serviço não encontrado' });
        }

        // 2. Atualizar status do serviço
        await connection.query(
            `UPDATE processos SET 
                status = 'concluido',
                data_conclusao = CURRENT_DATE(),
                observacoes_conclusao = ?
             WHERE id = ?`,
            [observacoes || null, id]
        );

        // 3. Processar imagem de conclusão se existir
        if (req.file) {
            const fileExtension = path.extname(req.file.originalname).toLowerCase();
            const novoNome = `conclusao_${id}${fileExtension}`;
            const uploadDir = path.join(__dirname, '../upload_arquivos');

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const novoPath = path.join(uploadDir, novoNome);
            fs.renameSync(req.file.path, novoPath);

            await connection.query(
                `INSERT INTO processos_anexos (
                    processo_id, 
                    nome_original, 
                    caminho_servidor, 
                    tamanho,
                    tipo_anexo
                ) VALUES (?, ?, ?, ?, 'imagem_conclusao')`,
                [id, req.file.originalname, `/api/upload_arquivos/${novoNome}`, req.file.size]
            );
        }

        // 4. Registrar auditoria (usando a mesma conexão da transação)
        await registrarAuditoria(
            req.user.matricula,
            'Concluir Serviço',
            `Serviço concluído - ID: ${id}, Processo: ${servico[0].processo}`,
            connection
        );

        await connection.commit();
        res.json({ success: true, message: 'Serviço concluído com sucesso' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao concluir serviço:', error);

        // Remove arquivo temporário se houver erro
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: 'Erro ao concluir serviço',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        connection.release();
    }
});

router.get('/api/servicos_concluidos', autenticar, async (req, res) => {
    try {
        const { subestacao, responsavel, dataInicial, dataFinal } = req.query;

        let query = `
            SELECT 
                p.id,
                p.processo,
                p.data_prevista_execucao as data_inicio,
                p.data_conclusao,
                p.subestacao,
                p.alimentador,
                p.chave_montante,
                p.desligamento,
                p.maps,
                p.observacoes_conclusao as relatorio_resumido,
                CONCAT(u.matricula, ' - ', u.nome) as responsavel,
                'concluido' as status
            FROM processos p
            LEFT JOIN users u ON p.turma_matricula = u.matricula
            WHERE p.status = 'concluido'
        `;

        const params = [];

        if (subestacao) {
            query += ' AND p.subestacao = ?';
            params.push(subestacao);
        }

        if (responsavel) {
            query += ' AND u.matricula = ?';
            params.push(responsavel);
        }

        if (dataInicial && dataFinal) {
            query += ' AND p.data_conclusao BETWEEN ? AND ?';
            params.push(dataInicial, dataFinal);
        } else if (dataInicial) {
            query += ' AND p.data_conclusao >= ?';
            params.push(dataInicial);
        } else if (dataFinal) {
            query += ' AND p.data_conclusao <= ?';
            params.push(dataFinal);
        }

        query += ' ORDER BY p.data_conclusao DESC';

        const [rows] = await promisePool.query(query, params);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar serviços concluídos:', err);
        res.status(500).json({ message: 'Erro ao buscar serviços concluídos' });
    }
});

router.get('/api/servico/:id', autenticar, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                p.*,
                CONCAT(u.matricula, ' - ', u.nome) as responsavel
            FROM processos p
            LEFT JOIN users u ON p.turma_matricula = u.matricula
            WHERE p.id = ?
        `;

        const [rows] = await promisePool.query(query, [id]);

        if (rows.length > 0) {
            res.status(200).json(rows[0]);
        } else {
            res.status(404).json({ message: 'Serviço não encontrado' });
        }
    } catch (err) {
        console.error('Erro ao buscar serviço:', err);
        res.status(500).json({ message: 'Erro ao buscar serviço' });
    }
});

module.exports = router;
