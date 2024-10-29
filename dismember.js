// Api que realiza o desmembramento de uma ordem de coleta (sql server)
router.post('/desmembrar', async (req, res) => {
    const ordemColeta = req.body.oc;
    const observacao = req.body.observacao;
  
    try {
        const request = new sql.Request(pool);
        request.input('ordemColeta', sql.VarChar, ordemColeta);
        request.input('observacao', sql.VarChar, observacao);
  
        const sqlQuery = `
            SELECT COUNT(*) AS QTD_OC, ENTREGA_PLANEJADA, ID_AGRUPAMENTO
            FROM TB_COLETAS
            WHERE ORDEM_COLETA LIKE @ordemColeta
            GROUP BY ENTREGA_PLANEJADA, ID_AGRUPAMENTO
        `;
  
        const result = await request.query(sqlQuery);
  
        if (result.recordset.length > 0) {
            const qtdOc = result.recordset[0].QTD_OC;
            const entregaPlanejada = new Date(result.recordset[0].ENTREGA_PLANEJADA);
            const idAgrupamento = result.recordset[0].ID_AGRUPAMENTO;
  
            let minutos = entregaPlanejada.getMinutes();
            if (minutos < 15) {
                entregaPlanejada.setMinutes(0);
            } else if (minutos >= 15 && minutos < 30) {
                entregaPlanejada.setMinutes(15);
            } else if (minutos >= 30 && minutos < 45) {
                entregaPlanejada.setMinutes(30);
            } else if (minutos >= 45) {
                entregaPlanejada.setMinutes(45);
            }
  
            entregaPlanejada.setMinutes(entregaPlanejada.getMinutes() + 15);
            const entregaAjustada = entregaPlanejada.toISOString().slice(0, 19).replace('T', ' ');
  
            const sulfixQtd = String.fromCharCode(qtdOc + 65);
            const novaOc = ordemColeta + "-" + sulfixQtd;
            console.log("Nova ordem de coleta: " + novaOc);
  
            if (idAgrupamento !== '') {
                const requestAgrupamento = new sql.Request(pool);
                requestAgrupamento.input('idAgrupamento', sql.VarChar, idAgrupamento);
                const sqlAgrupamento = `SELECT C.ORDEM_COLETA FROM tb_coletas C WHERE ID_AGRUPAMENTO = @idAgrupamento`;
                const resultAgrupamento = await requestAgrupamento.query(sqlAgrupamento);
                
                const ordensColeta = resultAgrupamento.recordset;
  
                const sqlNewAgrupamento = `
                    SELECT COUNT(DISTINCT ID_AGRUPAMENTO) AS QTD_OC_AGRUPADAS FROM tb_consolidacao_coletas;
                `;
    
                const result = await request.query(sqlNewAgrupamento);
                const ordensAgrupamento = result.recordset[0].QTD_OC_AGRUPADAS;
                const novoIDAgrupamento = "FKS" + String(ordensAgrupamento + 1).padStart(6, '0');
  
                for (const ordem of ordensColeta) {
                    const request2 = new sql.Request(pool);
                    const ocOriginal = ordem.ORDEM_COLETA;
                    const novasOc = ocOriginal + "-" + sulfixQtd;
                    
                    request2.input('novoIdAgrupamento', sql.VarChar, novoIDAgrupamento);
                    request2.input('novaOc', sql.VarChar, novasOc);
                    request2.input('ocOriginal', sql.VarChar, ocOriginal);
                    request2.input('entregaAjustada', sql.VarChar, entregaAjustada);
                    request2.input('observacao', sql.VarChar, observacao);
  
                    const sqlNovoAgrupamento = `
                        INSERT INTO tb_consolidacao_coletas(REGISTRO, ID_AGRUPAMENTO, ORDEM_COLETA, AGRUPADO_POR)
                        VALUES (GETDATE(), @novoIdAgrupamento, @novaOc, 'Usuário Teste')
                    `;
                    await request2.query(sqlNovoAgrupamento);
  
                    const sqlInsertQuery = `
                        INSERT INTO 
                            TB_COLETAS
                            (REGISTRO, UNIDADE, ORDEM_COLETA, ROTA, DATA, ID_AGRUPAMENTO, ID_RAST_CLIENTE, TOMADOR, TOMADOR_CNPJ, ORIGEM, 
                            ORIGEM_CNPJ, ORIGEM_CIDADE, ORIGEM_UF, ORIGEM_CEP, DESTINO, DESTINO_CNPJ, DESTINO_CIDADE, DESTINO_UF, DESTINO_CEP, COLETA_PLANEJADA, 
                            SAIDA_PLANEJADA, ENTREGA_PLANEJADA, SAIDA_ENTREGA_PLANEJADA, PLACA1, PLACA2, PLACA3, TIPO_VEICULO, MOTORISTA, STATUS, OBSERVACAO)
                        SELECT
                            GETDATE() AS REGISTRO, C.UNIDADE, @novaOc as ORDEM_COLETA, C.ROTA, C.DATA, @novoIdAgrupamento, C.ID_RAST_CLIENTE, C.TOMADOR, C.TOMADOR_CNPJ, C.ORIGEM,
                            C.ORIGEM_CNPJ, C.ORIGEM_CIDADE, C.ORIGEM_UF, C.ORIGEM_CEP, C.DESTINO, C.DESTINO_CNPJ, C.DESTINO_CIDADE, C.DESTINO_UF, C.DESTINO_CEP, @entregaAjustada, NULL, C.ENTREGA_PLANEJADA,
                            C.SAIDA_ENTREGA_PLANEJADA, C.PLACA1, C.PLACA2, C.PLACA3, C.TIPO_VEICULO, C.MOTORISTA, C.STATUS, @observacao
                        FROM TB_COLETAS C
                        WHERE C.ORDEM_COLETA = @ocOriginal;
                    `;
                    await request2.query(sqlInsertQuery);
  
                    const sqlUpdate1 = `
                        UPDATE tb_coletas_plan
                        SET ATUALIZACAO = GETDATE(), ENTREGA_AJUSTADA = @entregaAjustada, OC_SOLIC_AJUSTE = @ocOriginal, LANCAMENTO_MANUAL = 1, LANC_MANUAL_POR = 'Usuário Teste', STS = 999, STATUS = 'FINALIZADO'
                        WHERE ORDEM_COLETA = @ocOriginal AND STS <> 998;
                    `;
                    await request2.query(sqlUpdate1);
  
                    const sqlUpdate2 = `
                        UPDATE tb_coletas
                        SET ATUALIZACAO = GETDATE(), DESTINO_CIDADE = ORIGEM_CIDADE, DESTINO_UF = ORIGEM_UF, DESTINO_CEP = ORIGEM_CEP
                        WHERE ORDEM_COLETA = @ocOriginal;
                    `;
                    await request2.query(sqlUpdate2);
                }
            }
  
            res.status(200).send({ result: result.recordset, sufixo: sulfixQtd });
        } else {
            res.status(404).send('Nenhum resultado encontrado.');
        }
  
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao desmembrar');
    }
  });