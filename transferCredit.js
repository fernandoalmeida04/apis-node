// Rota para realizar a transferência de crédito entre clientes (oracle)
app.post('/transferCredit', async (req, res) => {
    const opcao = req.body.option;
    const nTransf = req.body.ntransf;
    const newCli = req.body.newCli;
    const oldcli = req.body.oldcli;
    const value = req.body.value;
    const nomeusuario = req.body.nomeusuario;
    let connection;

    if (opcao == 1) {
        try {
            connection = await oracledb.getConnection(dbConfig);
            
            const query = `SELECT A.CODCLI as codcli, A.CLIENTE as cliente, B.VALOR as valor
                           FROM PCCLIENT A LEFT JOIN PCCRECLI B ON (A.CODCLI = B.CODCLI) 
                           WHERE B.NUMTRANSENTDEVCLI = :ntransf AND B.DTDESCONTO IS NULL`;
            const result = await connection.execute(query, [nTransf]);

            if (result && result.rows.length > 0) {
                const codeCli = result.rows[0][0];
                const nameCli = result.rows[0][1];
                const valor = result.rows[0][2];
                res.json({ status: 'success', codeCli, nameCli, valor });
            } else {
                res.json({ status: 'error', message: 'No results found' });
            }

        } catch (err) {
            console.error(err);
            res.status(500).json({ status: 'error', message: 'Database error' });
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error(err);
                }
            }
        }
    } else if (opcao == 2) {
        try {
            connection = await oracledb.getConnection(dbConfig);
            
            const query = `SELECT A.CODCLI, A.CLIENTE 
                           FROM   PCCLIENT A 
                           WHERE  A.CODCLI = :newcli`;
            const result = await connection.execute(query, [newCli]);

            if (result && result.rows.length > 0) {
                const codeCli = result.rows[0][0];
                const nameCli = result.rows[0][1];
                res.json({ status: 'success', codeCli, nameCli });
            } else {
                res.json({ status: 'error', message: 'No results found' });
            }

        } catch (err) {
            console.error(err);
            res.status(500).json({ status: 'error', message: 'Database error' });
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error(err);
                }
            }
        }
    } else if (opcao == 3) {
        try {
            connection = await oracledb.getConnection(dbConfig);
            
            const query = `UPDATE PCCRECLI A 
                           SET A.CODCLI = :newCli 
                           WHERE A.NUMTRANSENTDEVCLI = :nTransf 
                           AND A.DTDESCONTO IS NULL`;
            const result = await connection.execute(query, [newCli, nTransf], { autoCommit: true });
        
            if (result.rowsAffected > 0) {
                // Pega o código da matrícula do usuário logado
                const sqlGetMatricula = "SELECT p.MATRICULA as MATRICULA FROM pcempr p WHERE p.nome_guerra LIKE UPPER(:usernameSessao)";
                const resultMatricula = await connection.execute(sqlGetMatricula, [nomeusuario]);
                const codUsuario = resultMatricula.rows[0] ? resultMatricula.rows[0][0] : null;

                const dataAtual = new Date();
                const dataAtualISO = dataAtual.toISOString().split('T')[0]; // Formato ISO "yyyy-mm-dd"

                const query2 = `INSERT INTO JCLOGTRANSCREDDEV(DTALTER, CODCLIORIG, CODCLIDEST, VALOR, MATRICULA, NUMTRANSENT) 
                                VALUES (TO_DATE(:dataAtualISO, 'YYYY-MM-DD HH24:MI:SS'), :oldcli, :newCli, :value, :codUsuario, :nTransf)`;

                const result2 = await connection.execute(query2, [dataAtualISO, oldcli, newCli, value, codUsuario, nTransf], { autoCommit: true });
                if(result2){
                    res.json({ status: 'success', message: 'Crédito transferido com sucesso.' });
                }
            } else {
                res.json({ status: 'error', message: 'Erro ao transferir crédito' });
            }
        
        } catch (err) {
            console.error(err);
            res.status(500).json({ status: 'error', message: 'Database error' });
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error(err);
                }
            }
        }        
    } else {
        return res.status(400).json({ success: false, message: 'Operação inválida!' });
    }
});