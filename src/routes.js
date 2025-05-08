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
      WHERE cargo IN ('Engenheiro', 'Técnico', 'Gerente', 'ADMIN', 'ADM', 'Inspetor')
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
                ct.transformador_destinado
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
        res.status(200).json(rows);

    } catch (err) {
        console.error('Erro ao filtrar transformadores:', {
            message: err.message,
            stack: err.stack,
            sql: err.sql
        });
        res.status(500).json({
            message: 'Erro ao filtrar transformadores',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

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
        const nomeArquivo = `checklist_${id}_${numero_serie}_${marcaFormatada}.pdf`;

        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        const url = `http://localhost:${process.env.SERVER_PORT || 3000}/relatorio_publico?id=${id}`;

        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);

        if (!res.headersSent) {
            res.status(500).json({
                message: 'Erro ao gerar PDF!',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
});
// Adicione esta função auxiliar no início do arquivo routes.js (antes das rotas)
const getTipoAnexo = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

    if (imageExtensions.includes(ext)) {
        return 'imagem_conclusao';
    }
    return 'documento';
};

// Rota POST /api/servicos (versão corrigida)
router.post('/api/servicos', upload.array('anexos', 5), async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Extração e validação dos dados
        const {
            processo,
            tipo_processo = 'Normal',
            data_prevista_execucao,
            desligamento,
            hora_inicio = null,
            hora_fim = null,
            subestacao,
            alimentador,
            chave_montante,
            responsavel_matricula = 'pendente',
            maps
        } = req.body;

        // Validações obrigatórias
        if (!data_prevista_execucao || !subestacao || !desligamento) {
            limparArquivosTemporarios(req.files);
            return res.status(400).json({
                success: false,
                message: 'Campos obrigatórios faltando: data_prevista_execucao, subestacao ou desligamento'
            });
        }

        // Validação de horários apenas se desligamento for SIM
        if (desligamento === 'SIM') {
            if (!hora_inicio || !hora_fim) {
                limparArquivosTemporarios(req.files);
                return res.status(400).json({
                    success: false,
                    message: 'Para desligamentos, hora_inicio e hora_fim são obrigatórios'
                });
            }
        }

        // Lógica para processos emergenciais
        let processoFinal;
        if (tipo_processo === 'Emergencial') {
            // Insert para emergencial
            const [result] = await connection.query(
                `INSERT INTO processos SET
                    tipo = 'Emergencial',
                    data_prevista_execucao = ?,
                    desligamento = ?,
                    hora_inicio = ?,
                    hora_fim = ?,
                    subestacao = ?,
                    alimentador = ?,
                    chave_montante = ?,
                    responsavel_matricula = ?,
                    maps = ?,
                    status = 'ativo'`,
                [
                    data_prevista_execucao,
                    desligamento,
                    desligamento === 'SIM' ? hora_inicio : null,
                    desligamento === 'SIM' ? hora_fim : null,
                    subestacao,
                    alimentador || null,
                    chave_montante || null,
                    responsavel_matricula,
                    maps || null
                ]
            );

            // Atualiza com o ID gerado
            processoFinal = `EMERGENCIAL-${result.insertId}`;
            await connection.query(
                'UPDATE processos SET processo = ? WHERE id = ?',
                [processoFinal, result.insertId]
            );
        } else {
            // Processos normais
            if (!processo || typeof processo !== 'string' || processo.trim() === '') {
                limparArquivosTemporarios(req.files);
                return res.status(400).json({
                    success: false,
                    message: 'Para serviços normais, o número do processo é obrigatório'
                });
            }

            processoFinal = processo.trim();

            // Insert para normal
            await connection.query(
                `INSERT INTO processos SET
                    processo = ?,
                    tipo = 'Normal',
                    data_prevista_execucao = ?,
                    desligamento = ?,
                    hora_inicio = ?,
                    hora_fim = ?,
                    subestacao = ?,
                    alimentador = ?,
                    chave_montante = ?,
                    responsavel_matricula = ?,
                    maps = ?,
                    status = 'ativo'`,
                [
                    processoFinal,
                    data_prevista_execucao,
                    desligamento,
                    desligamento === 'SIM' ? hora_inicio : null,
                    desligamento === 'SIM' ? hora_fim : null,
                    subestacao,
                    alimentador || null,
                    chave_montante || null,
                    responsavel_matricula,
                    maps || null
                ]
            );
        }

        // Processamento de anexos
        const anexosInfo = [];
        if (req.files && req.files.length > 0) {
            const uploadDir = path.join(__dirname, '../upload_arquivos');
            const processoDir = path.join(uploadDir, processoFinal.replace(/\//g, '-'));

            if (!fs.existsSync(processoDir)) {
                fs.mkdirSync(processoDir, { recursive: true });
            }

            for (const file of req.files) {
                const extensao = path.extname(file.originalname).toLowerCase();
                const novoNome = `anexo_${Date.now()}${extensao}`;
                const novoPath = path.join(processoDir, novoNome);

                await fs.promises.rename(file.path, novoPath);

                await connection.query(
                    `INSERT INTO processos_anexos (
                        processo_id, 
                        nome_original, 
                        caminho_servidor, 
                        tamanho, 
                        tipo_anexo
                    ) VALUES (
                        (SELECT id FROM processos WHERE processo = ? LIMIT 1),
                        ?, ?, ?, ?
                    )`,
                    [
                        processoFinal,
                        file.originalname,
                        `/api/upload_arquivos/${processoFinal.replace(/\//g, '-')}/${novoNome}`,
                        file.size,
                        ['jpg', 'jpeg', 'png'].includes(extensao.substring(1)) ? 'imagem' : 'documento'
                    ]
                );

                anexosInfo.push({
                    nomeOriginal: file.originalname,
                    caminho: `/api/upload_arquivos/${processoFinal.replace(/\//g, '-')}/${novoNome}`
                });
            }
        }

        await connection.commit();

        // Registrar auditoria
        if (req.user?.matricula) {
            await registrarAuditoria(
                req.user.matricula,
                'Registro de Serviço',
                `Serviço ${tipo_processo} registrado: ${processoFinal}`
            );
        }

        res.status(201).json({
            success: true,
            processo: processoFinal,
            tipo: tipo_processo,
            anexos: anexosInfo
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao registrar serviço:', error);
        limparArquivosTemporarios(req.files);

        res.status(500).json({
            success: false,
            message: 'Erro interno ao registrar serviço',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        connection.release();
    }
});

// Função auxiliar para limpar arquivos temporários
function limparArquivosTemporarios(files) {
    if (files) {
        files.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });
    }
}


//filtrar
router.get('/api/servicos', autenticar, async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT 
                p.id,
                p.processo,
                p.data_prevista_execucao,
                p.desligamento,
                p.subestacao,
                p.alimentador,
                p.chave_montante,
                p.responsavel_matricula,
                p.maps,
                p.status,
                p.data_conclusao,
                p.observacoes_conclusao,
                u.nome as responsavel,
                CASE 
                    WHEN p.processo = 'EMERGENCIAL' THEN 'Emergencial'
                    ELSE 'Normal'
                END as tipo_processo
            FROM processos p
            LEFT JOIN users u ON p.responsavel_matricula = u.matricula
        `;

        const params = [];

        if (status) {
            query += ' WHERE p.status = ?';
            params.push(status);
        }

        query += ' ORDER BY p.data_prevista_execucao ASC';

        const [servicos] = await promisePool.query(query, params);

        res.status(200).json(servicos);

    } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar serviços',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Função para formatar tamanho de arquivo (bytes para KB/MB/GB)
function formatarTamanhoArquivo(bytes) {
    if (bytes === 0 || !bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Detalhes de um serviço específico
router.get('/api/servicos/:id', autenticar, async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
        const { id } = req.params;

        // 1. Buscar os dados principais do serviço
        const [servico] = await connection.query(`
            SELECT 
                p.id,
                p.processo,
                p.data_prevista_execucao,
                p.data_conclusao,
                p.desligamento,
                p.hora_inicio,
                p.hora_fim,
                p.subestacao,
                p.alimentador,
                p.chave_montante,
                p.responsavel_matricula,
                p.maps,
                p.status,
                p.observacoes_conclusao,
                u.nome as responsavel_nome,
                u.matricula as responsavel_matricula
            FROM processos p
            LEFT JOIN users u ON p.responsavel_matricula = u.matricula
            WHERE p.id = ?
        `, [id]);

        if (servico.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serviço não encontrado'
            });
        }

        // 2. Buscar os anexos do serviço
        const [anexos] = await connection.query(`
            SELECT 
                id,
                nome_original as nomeOriginal,
                caminho_servidor as caminho,
                tamanho,
                tipo_anexo as tipo,
                DATE_FORMAT(data_upload, '%d/%m/%Y %H:%i') as dataUpload
            FROM processos_anexos
            WHERE processo_id = ?
            ORDER BY data_upload DESC
        `, [id]);

        // 3. Formatar a resposta
        const resultado = {
            id: servico[0].id,
            processo: servico[0].processo,
            data_prevista_execucao: servico[0].data_prevista_execucao,
            data_conclusao: servico[0].data_conclusao,
            desligamento: servico[0].desligamento,
            hora_inicio: servico[0].hora_inicio,
            hora_fim: servico[0].hora_fim,
            subestacao: servico[0].subestacao,
            alimentador: servico[0].alimentador,
            chave_montante: servico[0].chave_montante,
            responsavel_matricula: servico[0].responsavel_matricula,
            responsavel_nome: servico[0].responsavel_nome,
            maps: servico[0].maps,
            status: servico[0].status,
            observacoes_conclusao: servico[0].observacoes_conclusao,
            anexos: anexos.map(anexo => ({
                ...anexo,
                tamanho: formatarTamanhoArquivo(anexo.tamanho) || '0 Bytes'
            }))
        };

        res.status(200).json({
            success: true,
            data: resultado
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes do serviço:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar detalhes do serviço',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        connection.release();
    }
});
// Excluir serviço


// Rota para obter encarregados (turmas)
router.get('/api/encarregados', autenticar, async (req, res) => {
    try {
        // Busca usuários com cargo de "Encarregado" ou similar
        const [rows] = await promisePool.query(
            "SELECT DISTINCT matricula, nome FROM users WHERE cargo IN ('Encarregado', 'Supervisor', 'Gerente') ORDER BY nome"
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar encarregados:', err);
        res.status(500).json({ message: 'Erro ao buscar encarregados!' });
    }
});

// Rota para atualizar responsável do serviço
router.patch('/api/servicos/:id', autenticar, async (req, res) => {
    const { id } = req.params;
    const { responsavel_matricula } = req.body;

    try {
        await promisePool.query(
            'UPDATE processos SET responsavel_matricula = ? WHERE id = ?',
            [responsavel_matricula, id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar responsável:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar responsável'
        });
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
router.get('/api/upload_arquivos/:processo/:filename', (req, res) => {
    const { processo, filename } = req.params;
    const filePath = path.join(
        __dirname,
        '../upload_arquivos',
        processo.replace(/\//g, '-'),
        filename
    );

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            message: 'Arquivo não encontrado'
        });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.pdf': 'application/pdf'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');

    // Força download se especificado
    if (req.query.download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

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

// routes.js - Adicione esta rota
router.get('/servicos_atribuidos', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/servicos_atribuidos.html'));
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
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const user = req.user; // Dados do usuário autenticado

        // Lista de cargos permitidos para exclusão
        const cargosPermitidos = ['ADMIN', 'Gerente', 'Supervisor', 'Engenheiro', 'Técnico', 'Inspetor'];

        // Verificar se o usuário tem permissão
        if (!cargosPermitidos.includes(user.cargo)) {
            return res.status(403).json({
                success: false,
                message: 'Apenas administradores, gerentes e supervisores podem excluir serviços'
            });
        }

        // 1. Verificar se o serviço existe
        const [servico] = await connection.query(
            'SELECT * FROM processos WHERE id = ?',
            [id]
        );

        if (servico.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serviço não encontrado'
            });
        }

        // 2. Excluir anexos primeiro
        await connection.query(
            'DELETE FROM processos_anexos WHERE processo_id = ?',
            [id]
        );

        // 3. Excluir o serviço principal
        const [result] = await connection.query(
            'DELETE FROM processos WHERE id = ?',
            [id]
        );

        await connection.commit();

        // Registrar auditoria
        await registrarAuditoria(
            user.matricula,
            'Exclusão de Serviço',
            `Serviço excluído - ID: ${id}, Processo: ${servico[0].processo}`
        );

        res.json({
            success: true,
            message: 'Serviço excluído com sucesso'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao excluir serviço:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir serviço',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        connection.release();
    }
});

// Rota para concluir serviço com imagem
router.post('/api/servicos/:id/concluir', upload.array('fotos_conclusao', 5), autenticar, async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { observacoes, matricula_responsavel, data_conclusao } = req.body;

        // Verifica se temos a matrícula do responsável
        if (!matricula_responsavel && !req.user?.matricula) {
            throw new Error('Matrícula do responsável não informada');
        }

        const matricula = matricula_responsavel || req.user.matricula;

        // ✅ Aqui está o trecho atualizado
        await connection.query(
            `UPDATE processos 
             SET status = 'concluido', 
                 data_conclusao = ?,
                 observacoes_conclusao = ?,
                 responsavel_matricula = ?
             WHERE id = ?`,
            [
                data_conclusao || new Date().toISOString().split('T')[0], // usa só a data
                observacoes || null,
                matricula,
                id
            ]
        );

        // 2. Processa os anexos se existirem
        if (req.files?.length > 0) {
            const [processo] = await connection.query(
                'SELECT processo FROM processos WHERE id = ?',
                [id]
            );

            const pastaProcesso = path.join(
                __dirname,
                '../upload_arquivos',
                processo[0].processo.replace(/\//g, '-')
            );

            if (!fs.existsSync(pastaProcesso)) {
                fs.mkdirSync(pastaProcesso, { recursive: true });
            }

            for (const arquivo of req.files) {
                const novoNome = `conclusao_${Date.now()}${path.extname(arquivo.originalname)}`;
                const caminhoCompleto = path.join(pastaProcesso, novoNome);

                fs.renameSync(arquivo.path, caminhoCompleto);

                await connection.query(
                    `INSERT INTO processos_anexos (
                        processo_id,
                        nome_original,
                        caminho_servidor,
                        tipo_anexo,
                        tamanho
                    ) VALUES (?, ?, ?, ?, ?)`,
                    [
                        id,
                        arquivo.originalname,
                        `/api/upload_arquivos/${processo[0].processo.replace(/\//g, '-')}/${novoNome}`,
                        getTipoAnexo(arquivo.originalname),
                        arquivo.size
                    ]
                );
            }
        }

        await connection.commit();

        await registrarAuditoria(
            matricula,
            'Conclusão de Serviço',
            `Serviço ${id} concluído`
        );

        res.json({
            sucesso: true,
            mensagem: 'Serviço concluído com sucesso'
        });

    } catch (erro) {
        await connection.rollback();
        console.error('Erro ao concluir serviço:', erro);

        req.files?.forEach(arquivo => {
            if (fs.existsSync(arquivo.path)) fs.unlinkSync(arquivo.path);
        });

        res.status(500).json({
            sucesso: false,
            mensagem: erro.message || 'Falha ao concluir serviço'
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



// Rota para obter responsáveis técnicos (Encarregado/Técnico/Engenheiro) - apenas matrícula e primeiro nome
router.get('/api/responsaveis_tecnicos', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT 
                matricula, 
                SUBSTRING_INDEX(nome, ' ', 1) as nome
             FROM users 
             WHERE cargo IN ('Encarregado', 'Técnico', 'Engenheiro')
             ORDER BY nome`
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar responsáveis técnicos:', err);
        res.status(500).json({ message: 'Erro ao buscar responsáveis técnicos!' });
    }
});


// Rota para retornar serviço concluído para ativo
// Rota para reativar serviço corrigida
router.patch('/api/servicos/:id/reativar', autenticar, async (req, res) => {
    try {
        const [result] = await promisePool.query(
            'UPDATE processos SET status = "ativo", data_conclusao = NULL WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Serviço não encontrado' });
        }

        res.json({ message: 'Serviço reativado com sucesso' });
    } catch (error) {
        console.error('Erro ao reativar serviço:', error);
        res.status(500).json({ message: 'Erro ao reativar serviço' });
    }
});



router.post('/api/gerar_pdf_tabela_transformadores', autenticar, async (req, res) => {
    const { dados, filtros } = req.body;

    try {
        // Criar HTML com o mesmo estilo da tabela
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Transformadores</title>
                <style>
                    body {
                        font-family: 'Poppins', sans-serif;
                        color: #495057;
                        padding: 20px;
                    }
                    h1 {
                        color: #2a5298;
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .info-filtros {
                        background-color: #e6f0ff;
                        padding: 10px;
                        border-radius: 5px;
                        margin-bottom: 20px;
                        font-size: 14px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th {
                        background-color: #2a5298;
                        color: white;
                        padding: 10px;
                        text-align: left;
                        font-weight: 500;
                    }
                    td {
                        padding: 10px;
                        border-bottom: 1px solid #dee2e6;
                        vertical-align: middle;
                    }
                    tr:nth-child(even) {
                        background-color: #f8f9fa;
                    }
                    tr:hover {
                        background-color: #e6f0ff;
                    }
                    .footer {
                        margin-top: 30px;
                        font-size: 12px;
                        text-align: right;
                        color: #6c757d;
                    }
                </style>
            </head>
            <body>
                <h1>Relatório de Transformadores</h1>
                
                <div class="info-filtros">
                    <strong>Filtros aplicados:</strong><br>
                    ${filtros.dataInicial ? `Data inicial: ${filtros.dataInicial}<br>` : ''}
                    ${filtros.dataFinal ? `Data final: ${filtros.dataFinal}<br>` : ''}
                    ${filtros.numero_serie ? `Número de série: ${filtros.numero_serie}<br>` : ''}
                    ${filtros.responsavel ? `Responsável: ${filtros.responsavel}<br>` : ''}
                    Data de geração: ${new Date().toLocaleDateString('pt-BR')}
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Número de Série</th>
                            <th>Potência (kVA)</th>
                            <th>Marca</th>
                            <th>Data do Formulário</th>
                            <th>Responsável Técnico</th>
                            <th>Destinado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.map(item => `
                            <tr>
                                <td>${item.id}</td>
                                <td>${item.numero_serie}</td>
                                <td>${item.potencia}</td>
                                <td>${item.marca}</td>
                                <td>${item.data_formulario}</td>
                                <td>${item.responsavel}</td>
                                <td>${item.destinado}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    Gerado por ${req.user.nome} (${req.user.matricula}) em ${new Date().toLocaleString('pt-BR')}
                </div>
            </body>
            </html>
        `;

        // Gerar PDF com Playwright
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Usar o HTML gerado
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle'
        });

        // Configurações do PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });

        await browser.close();

        // Configurar resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Relatorio_Transformadores.pdf');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Erro ao gerar PDF da tabela:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar PDF',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});



router.get('/fibra', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/fibra.html'));
});

router.get('/inspecoes-redes', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/inspecoes_redes.html'));
});



// Adicione esta rota no arquivo routes.js
router.get('/api/subestacoes', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT DISTINCT subestacao as nome FROM processos WHERE subestacao IS NOT NULL AND subestacao != "" ORDER BY subestacao'
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar subestações:', err);
        res.status(500).json({ message: 'Erro ao buscar subestações!' });
    }
});




router.get('/transformadores_reformados', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/transformadores_reformados.html'));
});

router.get('/trafos_reformados_filtrar.html', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/trafos_reformados_filtrar.html'));
});

router.get('/trafos_reformados_importar.html', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/trafos_reformados_importar.html'));
});


router.post('/api/importar_trafos_reformados', upload.single('planilha'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'Nenhum arquivo enviado'
        });
    }

    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Processar planilha
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (!data || data.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Planilha vazia ou formato inválido'
            });
        }

        // 2. Mapeamento de colunas com tratamento robusto
        const headers = Object.keys(data[0]);
        const columnMap = {
            item: headers.find(h => h.trim().toUpperCase() === 'ITEM'),
            numero_projeto: headers.find(h =>
                h.trim().toUpperCase().includes('PROJETO') ||
                h.trim().toUpperCase().includes('PROJ')
            ),
            pot: headers.find(h => h.trim().toUpperCase() === 'POT'),
            numero_serie: headers.find(h =>
                h.trim().toUpperCase().includes('SÉRIE') ||
                h.trim().toUpperCase().includes('SERIE')
            ),
            numero_nota: headers.find(h =>
                h.trim().toUpperCase().includes('NOTA')
            ),
            t_at: headers.find(h =>
                h.trim().toUpperCase().includes('T AT') ||
                h.trim().toUpperCase().includes('TENSÃO AT')
            ),
            t_bt: headers.find(h =>
                h.trim().toUpperCase().includes('T BT') ||
                h.trim().toUpperCase().includes('TENSÃO BT')
            ),
            taps: headers.find(h =>
                h.trim().toUpperCase().includes('TAP')
            ),
            fabricante: headers.find(h =>
                h.trim().toUpperCase().includes('FABRICANTE')
            )
        };

        // 3. Validar colunas obrigatórias
        const requiredColumns = ['item', 'numero_serie', 'pot'];
        const missingColumns = requiredColumns.filter(col => !columnMap[col]);

        if (missingColumns.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`
            });
        }

        // 4. Inicializar resultados
        const results = {
            total: data.length,
            imported: 0,
            failed: 0,
            duplicates_in_db: [],
            duplicates_in_sheet: [],
            details: []
        };

        // 5. Processar números de série
        const serialNumbers = data.map(row => {
            const colName = columnMap.numero_serie;
            const rawValue = row[colName];
            return rawValue ? rawValue.toString().trim() : null;
        }).filter(Boolean);

        // 6. Verificar duplicatas na planilha
        const duplicatesInSheet = [...new Set(
            serialNumbers.filter((num, i) =>
                serialNumbers.indexOf(num) !== i && serialNumbers.lastIndexOf(num) === i
            )
        )];

        // 7. Verificar existência no banco
        const [existingSerials] = await connection.query(
            'SELECT numero_serie FROM trafos_reformados WHERE numero_serie IN (?)',
            [serialNumbers]
        );
        const existingSerialNumbers = existingSerials.map(item => item.numero_serie);

        // 8. Processar cada linha
        for (const [index, row] of data.entries()) {
            const linha = index + 2;
            let status = 'success';
            let errorMessage = '';
            let numeroSerie = '';

            try {
                // Função auxiliar para obter valores
                const getValue = (key) => {
                    const colName = columnMap[key];
                    if (!colName || row[colName] === undefined || row[colName] === null) {
                        return null;
                    }
                    return row[colName].toString().trim();
                };

                numeroSerie = getValue('numero_serie');

                // Validações
                if (!numeroSerie) {
                    throw new Error('Número de série é obrigatório');
                }

                if (duplicatesInSheet.includes(numeroSerie)) {
                    results.duplicates_in_sheet.push(numeroSerie);
                    throw new Error('Número de série duplicado na planilha');
                }

                if (existingSerialNumbers.includes(numeroSerie)) {
                    results.duplicates_in_db.push(numeroSerie);
                    throw new Error('Número de série já existe no banco de dados');
                }

                // Inserir no banco
                await connection.query(
                    `INSERT INTO trafos_reformados (
                        item, numero_projeto, pot, numero_serie, numero_nota,
                        t_at, t_bt, taps, fabricante, status_avaliacao
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
                    [
                        getValue('item'),
                        getValue('numero_projeto'),
                        getValue('pot'),
                        numeroSerie,
                        getValue('numero_nota'),
                        getValue('t_at'),
                        getValue('t_bt'),
                        getValue('taps'),
                        getValue('fabricante')
                    ]
                );

                results.imported++;

            } catch (error) {
                status = 'error';
                errorMessage = error.message;
                results.failed++;
            } finally {
                results.details.push({
                    linha,
                    numero_serie: numeroSerie || (columnMap.numero_serie && row[columnMap.numero_serie]) || '',
                    status,
                    message: errorMessage
                });
            }
        }

        // 9. Remover duplicatas das listas
        results.duplicates_in_db = [...new Set(results.duplicates_in_db)];
        results.duplicates_in_sheet = [...new Set(results.duplicates_in_sheet)];

        // 10. Verificar consistência
        const calculatedTotal = results.imported + results.failed;
        if (calculatedTotal !== results.total) {
            console.warn(`Discrepância na contagem: Total=${results.total}, Calculado=${calculatedTotal}`);
            results.failed = results.total - results.imported;
        }

        await connection.commit();

        // 11. Retornar resultados
        res.json({
            success: results.imported > 0,
            message: `Importação concluída: ${results.imported} registros importados, ${results.failed} falhas`,
            total: results.total,
            imported: results.imported,
            failed: results.failed,
            duplicates_in_db: results.duplicates_in_db,
            duplicates_in_sheet: results.duplicates_in_sheet,
            details: results.details
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro no processamento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro no processamento: ' + error.message
        });
    } finally {
        connection.release();
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
    }
});

// Rota para importação de transformadores reformados
router.get('/api/transformadores_reformados', autenticar, async (req, res) => {
    try {
        const {
            status,
            numero_serie,
            fabricante,
            pot,
            tecnico_responsavel,
            data_inicial,
            data_final
        } = req.query;

        let query = `
            SELECT 
                tr.*,
                u.nome as nome_tecnico
            FROM trafos_reformados tr
            LEFT JOIN users u ON tr.tecnico_responsavel = u.matricula
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            query += ' AND tr.status_avaliacao = ?';
            params.push(status);
        }

        if (numero_serie) {
            query += ' AND tr.numero_serie LIKE ?';
            params.push(`%${numero_serie}%`);
        }

        if (fabricante) {
            query += ' AND tr.fabricante LIKE ?';
            params.push(`%${fabricante}%`);
        }

        if (pot) {
            query += ' AND tr.pot = ?';  // Filtro exato para potência
            params.push(pot);
        }

        if (tecnico_responsavel) {
            query += ' AND tr.tecnico_responsavel = ?';
            params.push(tecnico_responsavel);
        }

        if (data_inicial && data_final) {
            query += ' AND DATE(tr.data_avaliacao) BETWEEN ? AND ?';
            params.push(data_inicial, data_final);
        } else if (data_inicial) {
            query += ' AND DATE(tr.data_avaliacao) >= ?';
            params.push(data_inicial);
        } else if (data_final) {
            query += ' AND DATE(tr.data_avalicao) <= ?';
            params.push(data_final);
        }

        query += ' ORDER BY tr.id DESC LIMIT 50';

        const [trafos] = await promisePool.query(query, params);

        res.json({
            success: true,
            data: trafos,
            filtros: {
                status,
                numero_serie,
                fabricante,
                pot,
                tecnico_responsavel,
                data_inicial,
                data_final
            }
        });

    } catch (err) {
        console.error('Erro ao buscar transformadores reformados:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar transformadores reformados'
        });
    }
});

// Rota para listar transformadores reformados com paginação

router.get('/api/transformadores_reformados', autenticar, async (req, res) => {
    try {
        // Destructure query parameters
        const {
            status,
            numero_serie,
            fabricante,
            pot,
            tecnico_responsavel,
            data_inicial,
            data_final
        } = req.query;

        let query = `
            SELECT 
                tr.*,
                u.nome as nome_tecnico
            FROM trafos_reformados tr
            LEFT JOIN users u ON tr.tecnico_responsavel = u.matricula
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            query += ' AND tr.status_avaliacao = ?';
            params.push(status);
        }

        if (numero_serie) {
            query += ' AND tr.numero_serie LIKE ?';
            params.push(`%${numero_serie}%`);
        }

        if (fabricante) {
            query += ' AND tr.fabricante LIKE ?';
            params.push(`%${fabricante}%`);
        }

        if (pot) {
            query += ' AND tr.pot LIKE ?';
            params.push(`%${pot}%`);
        }

        if (tecnico_responsavel) {
            query += ' AND tr.tecnico_responsavel = ?';
            params.push(tecnico_responsavel);
        }

        if (data_inicial && data_final) {
            query += ' AND DATE(tr.data_avaliacao) BETWEEN ? AND ?';
            params.push(data_inicial, data_final);
        } else if (data_inicial) {
            query += ' AND DATE(tr.data_avaliacao) >= ?';
            params.push(data_inicial);
        } else if (data_final) {
            query += ' AND DATE(tr.data_avaliacao) <= ?';
            params.push(data_final);
        }

        query += ' ORDER BY tr.id DESC LIMIT 50';

        const [trafos] = await promisePool.query(query, params);

        res.json({
            success: true,
            data: trafos,
            filtros: {
                status,
                numero_serie,
                fabricante,
                pot,
                tecnico_responsavel,
                data_inicial,
                data_final
            }
        });

    } catch (err) {
        console.error('Erro ao buscar transformadores reformados:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar transformadores reformados'
        });
    }
});

// Rota para buscar um transformador específico
router.get('/api/transformadores_reformados/:id', autenticar, async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await promisePool.query(`
            SELECT 
                tr.*,
                u.nome as nome_tecnico,
                u.matricula as matricula_tecnico
            FROM trafos_reformados tr
            LEFT JOIN users u ON tr.tecnico_responsavel = u.matricula
            WHERE tr.id = ?
        `, [id]);

        if (rows.length > 0) {
            res.json({
                success: true,
                data: rows[0]
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Transformador não encontrado'
            });
        }
    } catch (err) {
        console.error('Erro ao buscar transformador:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar transformador'
        });
    }
});

// Rota para atualizar a avaliação
router.put('/api/transformadores_reformados/:id/avaliar', autenticar, async (req, res) => {
    const { id } = req.params;
    const {
        matricula_responsavel,
        status_avaliacao,
        resultado_avaliacao
    } = req.body;

    // Validações básicas
    if (!matricula_responsavel || !status_avaliacao) {
        return res.status(400).json({
            success: false,
            message: 'Matrícula do responsável e status são obrigatórios'
        });
    }

    // Valores permitidos conforme o ENUM no banco de dados
    const statusPermitidos = ['pendente', 'avaliado', 'reprovado'];
    if (!statusPermitidos.includes(status_avaliacao)) {
        return res.status(400).json({
            success: false,
            message: 'Status de avaliação inválido. Valores permitidos: pendente, avaliado, reprovado'
        });
    }

    try {
        // Verifica se o técnico existe
        const [tecnico] = await promisePool.query(
            `SELECT matricula FROM users 
             WHERE matricula = ? 
             AND cargo IN ('ADMIN', 'ADM', 'Engenheiro', 'Técnico', 'Inspetor')`,
            [matricula_responsavel]
        );

        if (tecnico.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Técnico responsável não encontrado ou não autorizado'
            });
        }

        // Atualiza o transformador
        await promisePool.query(`
            UPDATE trafos_reformados 
            SET 
                tecnico_responsavel = ?,
                status_avaliacao = ?,
                resultado_avaliacao = ?,
                data_avaliacao = NOW()
            WHERE id = ?
        `, [
            matricula_responsavel,
            status_avaliacao,
            resultado_avaliacao || null,
            id
        ]);

        res.json({
            success: true,
            message: 'Avaliação salva com sucesso'
        });

    } catch (err) {
        console.error('Erro ao salvar avaliação:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao salvar avaliação',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


router.get('/api/tecnicos_responsaveis_trafos_reformados', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT 
                matricula,
                nome,
                cargo
            FROM users 
            WHERE cargo IN ('ADMIN', 'ADM', 'Engenheiro', 'Técnico', 'Inspetor')
            ORDER BY nome
        `);

        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar técnicos responsáveis:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar técnicos responsáveis',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


// Rota para obter fabricantes distintos
router.get('/api/fabricantes_trafos_reformados', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT DISTINCT fabricante FROM trafos_reformados WHERE fabricante IS NOT NULL AND fabricante != "" ORDER BY fabricante'
        );

        // Garante que o content-type seja JSON
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(rows.map(row => row.fabricante));

    } catch (err) {
        console.error('Erro ao buscar fabricantes:', err);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar fabricantes!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Rota para obter potências distintas
router.get('/api/potencias_trafos_reformados', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT DISTINCT pot FROM trafos_reformados WHERE pot IS NOT NULL AND pot != "" ORDER BY pot'
        );
        res.status(200).json(rows.map(row => row.pot));
    } catch (err) {
        console.error('Erro ao buscar potências:', err);
        res.status(500).json({ message: 'Erro ao buscar potências!' });
    }
});


router.delete('/api/transformadores_reformados/:id', autenticar, async (req, res) => {
    const { id } = req.params;
    console.log(`Tentando excluir transformador com ID: ${id}`);

    try {
        const [result] = await promisePool.query('DELETE FROM trafos_reformados WHERE id = ?', [id]);
        console.log(`Resultado da exclusão:`, result.affectedRows);

        if (result.affectedRows > 0) {
            await registrarAuditoria(req.user.matricula, 'Excluir Transformador Reformado', `Transformador excluído com ID: ${id}`);
            res.status(200).json({
                success: true,
                message: 'Transformador excluído com sucesso!'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Transformador não encontrado!'
            });
        }
    } catch (err) {
        console.error('Erro ao excluir transformador:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir transformador!'
        });
    }
});


// Rota para gerar PDF da tabela de transformadores reformados
router.post('/api/gerar_pdf_trafos_reformados', autenticar, async (req, res) => {
    const { dados, filtros } = req.body;

    try {
        // Criar HTML com o mesmo estilo da tabela
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Transformadores Reformados</title>
                <style>
                    body {
                        font-family: 'Poppins', sans-serif;
                        color: #495057;
                        padding: 20px;
                    }
                    h1 {
                        color: #2a5298;
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .info-filtros {
                        background-color: #e6f0ff;
                        padding: 10px;
                        border-radius: 5px;
                        margin-bottom: 20px;
                        font-size: 14px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th {
                        background-color: #2a5298;
                        color: white;
                        padding: 10px;
                        text-align: left;
                        font-weight: 500;
                    }
                    td {
                        padding: 10px;
                        border-bottom: 1px solid #dee2e6;
                        vertical-align: middle;
                    }
                    tr:nth-child(even) {
                        background-color: #f8f9fa;
                    }
                    .badge {
                        padding: 5px 10px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .bg-success {
                        background-color: #28a745;
                        color: white;
                    }
                    .bg-warning {
                        background-color: #ffc107;
                        color: #212529;
                    }
                    .bg-danger {
                        background-color: #dc3545;
                        color: white;
                    }
                    .footer {
                        margin-top: 30px;
                        font-size: 12px;
                        text-align: right;
                        color: #6c757d;
                    }
                </style>
            </head>
            <body>
                <h1>Relatório de Transformadores Reformados</h1>
                
                <div class="info-filtros">
                    <strong>Filtros aplicados:</strong><br>
                    ${filtros.status ? `Status: ${filtros.status}<br>` : ''}
                    ${filtros.fabricante ? `Fabricante: ${filtros.fabricante}<br>` : ''}
                    ${filtros.pot ? `Potência: ${filtros.pot}<br>` : ''}
                    ${filtros.tecnico_responsavel ? `Técnico: ${filtros.tecnico_responsavel}<br>` : ''}
                    ${filtros.data_inicial ? `Data inicial: ${filtros.data_inicial}<br>` : ''}
                    ${filtros.data_final ? `Data final: ${filtros.data_final}<br>` : ''}
                    Data de geração: ${new Date().toLocaleDateString('pt-BR')}
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Nº de Série</th>
                            <th>Fabricante</th>
                            <th>Potência</th>
                            <th>Status</th>
                            <th>Data Avaliação</th>
                            <th>Técnico Responsável</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.map(item => {
            let statusClass, statusText;
            switch (item.status_avaliacao) {
                case 'avaliado':
                    statusClass = 'bg-success';
                    statusText = 'Aprovado';
                    break;
                case 'reprovado':
                    statusClass = 'bg-danger';
                    statusText = 'Reprovado';
                    break;
                default:
                    statusClass = 'bg-warning';
                    statusText = 'Pendente';
            }

            return `
                                <tr>
                                    <td>${item.item || '-'}</td>
                                    <td>${item.numero_serie}</td>
                                    <td>${item.fabricante || '-'}</td>
                                    <td>${item.pot || '-'}</td>
                                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                                    <td>${item.data_avaliacao ? new Date(item.data_avaliacao).toLocaleDateString('pt-BR') : '-'}</td>
                                    <td>${item.nome_tecnico || '-'}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    Gerado por ${req.user.nome} (${req.user.matricula}) em ${new Date().toLocaleString('pt-BR')}
                </div>
            </body>
            </html>
        `;

        // Gerar PDF com Playwright
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Usar o HTML gerado
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle'
        });

        // Configurações do PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });

        await browser.close();

        // Configurar resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Relatorio_Transformadores_Reformados.pdf');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Erro ao gerar PDF da tabela:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar PDF',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


router.get('/turmas_ativas', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/turmas_ativas.html'));
});

// Rota para o arquivo JavaScript
router.get('/scripts/turmas_ativas.js', autenticar, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/scripts/turmas_ativas.js'));
});


router.get('/api/turmas', autenticar, async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT id, matricula, nome, cargo, turma_encarregado FROM turmas ORDER BY turma_encarregado');
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar usuários das turmas:', err);
        res.status(500).json({ 
            message: 'Erro ao buscar usuários das turmas!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Rotas para gestão de turmas
router.post('/api/turmas/adicionar', autenticar, verificarPermissaoPorCargo, async (req, res) => {
    const { matricula, nome, cargo, turma_encarregado } = req.body;
    
    try {
        // Verifica se o usuário já existe
        const [existing] = await promisePool.query(
            'SELECT * FROM turmas WHERE matricula = ?', 
            [matricula]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                message: 'Já existe um usuário com esta matrícula!' 
            });
        }

        // Insere novo membro
        await promisePool.query(
            'INSERT INTO turmas (matricula, nome, cargo, turma_encarregado) VALUES (?, ?, ?, ?)',
            [matricula, nome, cargo, turma_encarregado]
        );

        res.status(201).json({ message: 'Membro adicionado com sucesso!' });
    } catch (err) {
        console.error('Erro ao adicionar membro:', err);
        res.status(500).json({ message: 'Erro ao adicionar membro!' });
    }
});

router.put('/api/turmas/:id', autenticar, verificarPermissaoPorCargo, async (req, res) => {
    const { id } = req.params;
    const { turma_encarregado } = req.body;

    try {
        // Atualiza a turma
        await promisePool.query(
            'UPDATE turmas SET turma_encarregado = ? WHERE id = ?',
            [turma_encarregado, id]
        );

        res.status(200).json({ message: 'Membro movido com sucesso!' });
    } catch (err) {
        console.error('Erro ao mover membro:', err);
        res.status(500).json({ message: 'Erro ao mover membro!' });
    }
});

router.delete('/api/turmas/:id', autenticar, verificarPermissaoPorCargo, async (req, res) => {
    const { id } = req.params;

    try {
        // Remove o membro
        await promisePool.query(
            'DELETE FROM turmas WHERE id = ?',
            [id]
        );

        res.status(200).json({ message: 'Membro removido com sucesso!' });
    } catch (err) {
        console.error('Erro ao remover membro:', err);
        res.status(500).json({ message: 'Erro ao remover membro!' });
    }
});


// Rotas para diárias


router.post('/api/diarias', autenticar, async (req, res) => {
    const { data, processo, matricula, qs, qd } = req.body;

    // Validações básicas
    if (!data || !processo || !matricula || (qs === undefined && qd === undefined)) {
        return res.status(400).json({ 
            success: false,
            message: 'Data, processo, matrícula e pelo menos um tipo (QS/QD) são obrigatórios!' 
        });
    }

    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verifica se o funcionário existe e obtém o nome
        const [funcionario] = await connection.query(
            'SELECT nome, cargo FROM turmas WHERE matricula = ?',
            [matricula]
        );
        
        if (funcionario.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                success: false,
                message: 'Funcionário não encontrado na turma!' 
            });
        }

        // 2. Verifica se já existe diária para este funcionário no mesmo dia e processo
        const [existente] = await connection.query(
            `SELECT id FROM diarias 
             WHERE matricula = ? 
             AND data = ? 
             AND processo = ?`,
            [matricula, data, processo]
        );
        
        if (existente.length > 0) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false,
                message: 'Já existe diária para este funcionário no processo e data informados!' 
            });
        }
        
        // 3. Insere a diária com QS e QD
        const [result] = await connection.query(
            'INSERT INTO diarias (data, processo, matricula, nome, cargo, qs, qd) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [data, processo, matricula, funcionario[0].nome, funcionario[0].cargo, qs || false, qd || false]
        );
        
        await connection.commit();
        
        res.status(201).json({ 
            success: true,
            message: 'Diária registrada com sucesso!',
            id: result.insertId
        });
    } catch (err) {
        await connection.rollback();
        console.error('Erro ao registrar diária:', err);
        res.status(500).json({ 
            success: false,
            message: 'Erro ao registrar diária!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        connection.release();
    }
});

router.get('/api/diarias', autenticar, async (req, res) => {
    try {
        const { turma, dataInicial, dataFinal, processo, qs, qd, ordenar } = req.query;
        
        let query = `
            SELECT 
                d.id,
                DATE_FORMAT(d.data, '%d/%m/%Y') as data_formatada,
                d.processo,
                d.matricula,
                d.nome,
                d.cargo,
                d.qs,
                d.qd,
                t.turma_encarregado as turma
            FROM diarias d
            LEFT JOIN turmas t ON d.matricula = t.matricula
            WHERE 1=1
        `;
        
        const params = [];
        
        if (turma) {
            query += ' AND t.turma_encarregado = ?';
            params.push(turma);
        }
        
        if (dataInicial && dataFinal) {
            query += ' AND d.data BETWEEN ? AND ?';
            params.push(dataInicial, dataFinal);
        } else if (dataInicial) {
            query += ' AND d.data >= ?';
            params.push(dataInicial);
        } else if (dataFinal) {
            query += ' AND d.data <= ?';
            params.push(dataFinal);
        }
        
        if (processo) {
            query += ' AND d.processo = ?';
            params.push(processo);
        }

        if (qs === 'true') {
            query += ' AND d.qs = 1';
        }
        
        if (qd === 'true') {
            query += ' AND d.qd = 1';
        }
        
        // Modifica a ordenação baseada no parâmetro
        if (ordenar === 'data_asc') {
            query += ' ORDER BY d.data ASC, d.nome ASC';  // Data mais antiga primeiro, depois por nome
        } else {
            query += ' ORDER BY d.data DESC, d.nome ASC';  // Mantém o padrão como fallback
        }
        
        const [rows] = await promisePool.query(query, params);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar diárias:', err);
        res.status(500).json({ 
            message: 'Erro ao buscar diárias!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

router.delete('/api/diarias/:id', autenticar, async (req, res) => {
    const { id } = req.params;
    
    try {
        const [result] = await promisePool.query(
            'DELETE FROM diarias WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Diária não encontrada!' });
        }
        
        await registrarAuditoria(
            req.user.matricula,
            'Remoção de Diária',
            `Diária removida - ID: ${id}`
        );
        
        res.status(200).json({ message: 'Diária removida com sucesso!' });
    } catch (err) {
        console.error('Erro ao remover diária:', err);
        res.status(500).json({ 
            message: 'Erro ao remover diária!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});



router.get('/api/funcionarios_por_turma/:turma', autenticar, async (req, res) => {
    try {
        const { turma } = req.params;
        const [rows] = await promisePool.query(
            'SELECT matricula, nome FROM turmas WHERE turma_encarregado = ? ORDER BY nome',
            [turma]
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erro ao buscar funcionários:', err);
        res.status(500).json({ message: 'Erro ao buscar funcionários!' });
    }
});

router.get('/api/processos_disponiveis', autenticar, async (req, res) => {
    try {
        const { data } = req.query;
        
        let query = `
            SELECT DISTINCT processo 
            FROM processos 
            WHERE status IN ('ativo', 'concluido') 
            AND processo IS NOT NULL
        `;
        
        if (data) {
            query += ` AND (
                (status = 'ativo' AND data_prevista_execucao <= ?) OR
                (status = 'concluido' AND data_conclusao <= ?)
            )`;
        }
        
        query += ' ORDER BY processo';
        
        const params = data ? [data, data] : [];
        
        const [rows] = await promisePool.query(query, params);
        res.status(200).json(rows.map(row => row.processo));
    } catch (err) {
        console.error('Erro ao buscar processos:', err);
        res.status(500).json({ message: 'Erro ao buscar processos!' });
    }
});


router.get('/api/processos_por_turma_data', autenticar, async (req, res) => {
    try {
        const { turma, data } = req.query;
        
        if (!turma || !data) {
            return res.status(400).json({ message: 'Turma e data são obrigatórios!' });
        }

        // Primeiro, buscar os membros da turma
        const [membros] = await promisePool.query(
            'SELECT matricula FROM turmas WHERE turma_encarregado = ?',
            [turma]
        );

        if (membros.length === 0) {
            return res.status(200).json([]);
        }

        const matriculas = membros.map(m => m.matricula);

        // Agora buscar processos onde o responsável está na turma
        const query = `
            SELECT DISTINCT p.processo
            FROM processos p
            JOIN turmas t ON p.responsavel_matricula = t.matricula
            WHERE t.turma_encarregado = ?
            AND p.status IN ('ativo', 'concluido')
            ORDER BY p.processo
        `;
        
        const [rows] = await promisePool.query(query, [turma]);
        res.status(200).json(rows.map(row => row.processo));
    } catch (err) {
        console.error('Erro ao buscar processos por turma e data:', err);
        res.status(500).json({ 
            message: 'Erro ao buscar processos!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


router.get('/api/processos_por_responsavel', autenticar, async (req, res) => {
    try {
        const { matricula } = req.query;
        
        if (!matricula) {
            return res.status(400).json({ message: 'Matrícula é obrigatória!' });
        }

        const query = `
            SELECT processo
            FROM processos
            WHERE responsavel_matricula = ?
            AND status IN ('ativo', 'concluido')
            ORDER BY data_prevista_execucao DESC
        `;
        
        const [rows] = await promisePool.query(query, [matricula]);
        res.status(200).json(rows.map(row => row.processo));
    } catch (err) {
        console.error('Erro ao buscar processos por responsável:', err);
        res.status(500).json({ 
            message: 'Erro ao buscar processos!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


router.post('/api/gerar_pdf_diarias', autenticar, async (req, res) => {
    try {
        const { diarias, filtros, usuario } = req.body;

        // HTML para o PDF
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Diárias</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 10px; }
                    h1 { color: #2a5298; text-align: center; font-size: 16px; margin-bottom: 10px; }
                    .header-info { margin-bottom: 10px; text-align: center; font-size: 10px; }
                    .filters { background-color: #f5f5f5; padding: 5px; border-radius: 3px; margin-bottom: 10px; font-size: 9px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9px; }
                    th { background-color: #2a5298; color: white; padding: 3px; text-align: left; }
                    td { padding: 3px; border-bottom: 1px solid #ddd; }
                    .group-header { background-color: #e6f0ff; font-weight: bold; }
                    .footer { margin-top: 20px; font-size: 9px; text-align: center; }
                    .assinatura { margin-top: 60px; border-top: 1px solid #000; width: 60%; margin-left: auto; margin-right: auto; padding-top: 5px; text-align: center; }
                    .text-center { text-align: center; }
                </style>
            </head>
            <body>
                <h1>Relatório de Diárias</h1>
                
                <div class="header-info">
                    <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
                
                <div class="filters">
                    <h3>Filtros Aplicados</h3>
                    <p><strong>Turma:</strong> ${filtros.turma}</p>
                    <p><strong>Período:</strong> ${filtros.dataInicial || ''} ${filtros.dataFinal ? 'até ' + filtros.dataFinal : ''}</p>
                    <p><strong>Processo:</strong> ${filtros.processo}</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Matrícula</th>
                            <th>Nome</th>
                            <th>Função</th>
                            <th>Data</th>
                            <th>QS</th>
                            <th>QD</th>
                            <th>Processo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(diarias).map(([matricula, dados]) => `
                            <tr class="group-header">
                                <td colspan="7">${matricula} - ${dados.nome} (${dados.cargo || 'N/A'})</td>
                            </tr>
                            ${dados.diarias.map(diaria => `
                                <tr>
                                    <td>${matricula}</td>
                                    <td>${dados.nome}</td>
                                    <td>${dados.cargo || 'N/A'}</td>
                                    <td>${diaria.data_formatada || new Date(diaria.data).toLocaleDateString('pt-BR')}</td>
                                    <td class="text-center">${diaria.qs ? 'X' : ''}</td>
                                    <td class="text-center">${diaria.qd ? 'X' : ''}</td>
                                    <td>${diaria.processo}</td>
                                </tr>
                            `).join('')}
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>Total de diárias: ${Object.values(diarias).reduce((acc, curr) => acc + curr.diarias.length, 0)}</p>
                    <div class="assinatura">
                        <p>Gerado por: ${usuario.nome} (${usuario.matricula})</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Gerar PDF com Playwright
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.setContent(htmlContent, { waitUntil: 'networkidle' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
            }
        });

        await browser.close();

        // Responder com o PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Relatorio_Diarias.pdf');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Erro ao gerar PDF de diárias:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar PDF',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


router.get('/diarias', autenticar, verificarPermissaoPorCargo, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/diarias.html'));
});

router.get('/gestao-turmas', autenticar, (req, res, next) => {
    const cargosPermitidos = ['ADMIN', 'Gerente', 'Encarregado', 'Inspetor', 'Engenheiro', 'Técnico']; // ← Defina seus cargos aqui
    if (cargosPermitidos.includes(req.user.cargo)) {
        res.sendFile(path.join(__dirname, '../public/gestao-turmas.html'));
    } else {
        res.status(403).json({ message: 'Acesso negado!' });
    }
});

module.exports = router;
