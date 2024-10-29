// Api que lista os veículos disponíveis e ordena eles para exibir o melhor qualificado para aquela rota (mysql)
app.post('/veiculos', async (req, res) => {
  
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      date.setUTCHours(date.getUTCHours() + 3);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Mês começa em 0
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    const ordemColeta = req.body.ordemColeta;
    const dataColeta = formatDate(req.body.coletaSolicitada);
    const dataEntrega = formatDate(req.body.saidaColeta);
    const pagador = req.body.pagador;
    const tipoVeiculo = req.body.tipoVeiculo;
  
    let tipoVeiculoFiltro = '';
    let filtroTruck = '';
  
    if (tipoVeiculo && tipoVeiculo.length > 0) {
      if (tipoVeiculo.includes('CARRETA')) {
        tipoVeiculoFiltro = "AND UPPER(tnv.sdesc_ntcav) LIKE '%CARRETA%' AND UPPER(tnv2.sdesc_ntcav) NOT LIKE '%TRUCK%'";
      }
    
      if (tipoVeiculo.includes('TRUCK')) {
        filtroTruck = "CASE WHEN UPPER(tnv.sdesc_ntcav) LIKE '%TRUCK%' THEN 1 ELSE 2 END, ";
      }
    }
    
  
    const query = `
  WITH TEMP_VEIC_OCUP AS (
          SELECT 
              COALESCE(C.splaca1_col, C2.splaca_motor_ctrt) AS PLACA1,
              C.cod_col AS ORDEM_COLETA,
              C.dtcoletasolicitada_col AS COLETA_PLANEJADA,
              C.dtsaidacoleta_col AS SAIDA_PLANEJADA,
              COALESCE(C.splaca2_col, C2.splaca_carreta_1_ctrt) AS PLACA2,
              COALESCE(C.splaca3_col, NULLIF(C2.splaca_carreta_2_ctrt, 'ZZZ9999')) AS PLACA3
          FROM 
              tbl_coleta C
              LEFT JOIN tbl_contrato_ordem_coleta CC 
                  ON CC.nordemcoleta_coc = C.nnumero_col 
                  AND CC.npr_coc = C.npr_col
              LEFT JOIN tbl_contrato_nucci C2 
                  ON C2.cod_ctrt = CC.cod_ctrt 
                  AND C2.nstatus_ctrt NOT IN (99)
              LEFT JOIN tbl_veiculo V 
                  ON V.splaca_veic = COALESCE(C.splaca1_col, C2.splaca_motor_ctrt)
          WHERE 
              (
                  (C.dtcoletasolicitada_col BETWEEN ? AND ? AND IF(C.dtcoletaefetiva_col IS NULL, C.dtprevisaoentrega_col, C.dtcoletaefetiva_col) < ?) OR
                  (C.dtcoletasolicitada_col >=      ? AND IF(C.dtcoletaefetiva_col IS NULL, C.dtprevisaoentrega_col, C.dtcoletaefetiva_col) <= ?) OR
                  (C.dtcoletasolicitada_col <= 	  ? AND IF(C.dtcoletaefetiva_col IS NULL, C.dtprevisaoentrega_col, C.dtcoletaefetiva_col) >= ?) OR
                  (C.dtcoletasolicitada_col >= 	  ? AND IF(C.dtcoletaefetiva_col IS NULL, C.dtprevisaoentrega_col, C.dtcoletaefetiva_col) BETWEEN ? AND ?)
              ) 
              AND V.nstatus_veic NOT IN (99, 8, 4, 5) 
              AND V.nclassinterna_veic = 1
          GROUP BY PLACA1
      )
      SELECT 
          CAST(toc.cod_col AS CHAR) AS ORDEM_COLETA, 
          toc.cod_sit AS SIT_COL,
          V.splaca_veic AS PLACA1, 
          V.cod_tcav AS CD_CAV_1, 
          toc.splaca2_col AS PLACA2, 
          v2.cod_tcav AS CD_CAV_2, 
          toc.max_data_entrega AS ENTREGA,
          toc.splaca3_col AS PLACA3,
          m.snome_mot AS MOTORISTA,
          UPPER(tnv.sdesc_ntcav) AS TIPO_CARRETA,
          UPPER(tnv2.sdesc_ntcav) AS TIPO_VEICULO,
          m.scategoriahabilitacao_mot AS HABILITACAO,
          ts.snome_sit AS SITUACAO,
          c.scnpj_emp_col AS TOMADOR_CNPJ,
          m.nstatus_mot AS STATUS_MOT, 
          V.nstatus_veic AS STATUS_VEIC,
          V.smodelo_veic AS MODELO,
          toc.scep_emp AS DESTINO_CEP, 
          toc.scidade_emp AS DESTINO_CIDADE, 
          toc.suf_emp AS DESTINO_UF,
          toc.dlatitude_emp AS LATITUDE,
          toc.dlongitude_emp AS LONGITUDE
      FROM 
          tbl_veiculo V
          LEFT JOIN tbl_motorista m ON V.splaca_veic = m.splacapadrao_mot AND m.nstatus_mot IN (0, 1)
          LEFT JOIN tbl_coleta c ON V.splaca_veic = c.splaca1_col
          LEFT JOIN tbl_situacao ts ON c.cod_sit = ts.cod_sit
          LEFT JOIN tbl_veiculo v2 ON v2.splaca_veic = c.splaca2_col
          LEFT JOIN tbl_empresa e ON c.scnpj_emp_dest = e.scnpj_emp
          LEFT JOIN tbl_nucci_tipocavalo tnv2 ON V.cod_tcav = tnv2.cod_ntcav
          LEFT JOIN ( SELECT C2.splaca1_col, C2.splaca2_col, C2.splaca3_col, C2.cod_col, C2.cod_sit, E2.scep_emp, E2.scidade_emp, E2.suf_emp, E2.dlatitude_emp, E2.dlongitude_emp, IF(C2.dtcoletaefetiva_col IS NULL, MAX(C2.dtprevisaoentrega_col), MAX(C2.dtcoletaefetiva_col)) AS max_data_entrega FROM 
              tbl_coleta C2 
              LEFT JOIN tbl_empresa E2 ON C2.scnpj_emp_dest = E2.scnpj_emp 
              WHERE C2.dtcoletasolicitada_col <= ? AND C2.cod_sit <> 999 
              GROUP BY C2.splaca1_col, C2.cod_col
              ORDER BY C2.dtcoletasolicitada_col asc
          ) AS toc ON V.splaca_veic = toc.splaca1_col
          LEFT JOIN tbl_veiculo v3 ON toc.splaca2_col = v3.splaca_veic
          LEFT JOIN tbl_nucci_tipocavalo tnv ON v3.cod_tcav = tnv.cod_ntcav
      WHERE
          V.nstatus_veic IN (0, 1, 3) 
          AND V.nclassinterna_veic = 1 
          AND V.mobs_veic = ?
          AND V.bmanutencao_veic = 0
          AND ts.snome_sit <> 'CANCELAMENTO'
          AND m.setnia_mot <> 'XXX'
          AND toc.max_data_entrega < ?
          ${tipoVeiculoFiltro}
          AND UPPER(V.SCARTAO_VEIC) NOT LIKE '%INTERNO'
          AND (
              V.cod_tcav IN (
                  SELECT ntipoveiculo_crpedag 
                  FROM tbl_contrato_rotafinanceira_pedagio tcrp2 
                  WHERE cod_ctrtrf = (
                      SELECT tc.cod_ctrtrf 
                      FROM tbl_cotacao tc 
                      INNER JOIN tbl_coleta tl 
                          ON tc.cod_col = tl.cod_col 
                      WHERE tc.cod_col = ?
                  )
              ) OR
              v2.cod_tcav IN (
                  SELECT ntipoveiculo_crpedag 
                  FROM tbl_contrato_rotafinanceira_pedagio tcrp2 
                  WHERE cod_ctrtrf = (
                      SELECT tc.cod_ctrtrf 
                      FROM tbl_cotacao tc 
                      INNER JOIN tbl_coleta tl 
                          ON tc.cod_col = tl.cod_col 
                      WHERE tc.cod_col = ?
                  )
              )
          )
          AND V.cod_tcav NOT IN (22, 73, 74, 75, 76, 77)
          AND V.splaca_veic NOT IN ('NAN5E00', 'GER0006')
          AND NOT EXISTS (
              SELECT 1 
              FROM TEMP_VEIC_OCUP 
              WHERE PLACA1 = V.splaca_veic
          )
      GROUP BY 
          V.splaca_veic
      ORDER BY 
          ${filtroTruck}
          toc.max_data_entrega DESC
      LIMIT 25;
    `;
    connection.query(query, [dataColeta, dataEntrega, dataEntrega, dataColeta, dataEntrega, dataColeta, dataEntrega, dataColeta, dataColeta, dataEntrega, dataColeta, pagador, dataEntrega, ordemColeta, ordemColeta], async (err, results, fields) => {
      if (err) {
        console.error('Erro ao executar a query:', err.stack);
        res.status(500).send('Erro ao conectar ao banco de dados 1.');
        return;
      }
  
      const veiculos = results;
      const placas = veiculos.map(veiculo => veiculo.PLACA1);
      const token = req.authToken;
      const headers = {
        'x-access-token': token,
        'Content-Type': 'application/json'
      };
  
      // Obter a latitude e longitude do destino final
      const destinoQuery = `
        SELECT 
        IF(CP.scnpjcpf_clocal IS NULL, E2.dlatitude_emp, te.dlatitude_emp)  AS latitude, 
        IF(CP.scnpjcpf_clocal IS NULL, E2.dlongitude_emp, te.dlongitude_emp) AS longitude,
        te.snome_emp,
        E2.snome_emp
        FROM tbl_coleta tc
        LEFT JOIN tbl_coleta_local CP ON CP.cod_col = tc.cod_col
        LEFT JOIN tbl_empresa te ON te.scnpj_emp = CP.scnpjcpf_clocal
        LEFT JOIN tbl_empresa E2 ON E2.scnpj_emp = tc.scnpj_emp_dest 
        where tc.cod_col = ?
      `;
  
      connection.query(destinoQuery, [ordemColeta], async (err, destinoResults) => {
        if (err) {
          console.error('Erro ao executar a query de destino:', err.stack);
          res.status(500).send('Erro ao conectar ao banco de dados 2.');
          return;
        }
  
        if (destinoResults.length === 0) {
          res.status(404).send('Destino não encontrado.');
          return;
        }
  
        const destinoLat = destinoResults[0].latitude;
        const destinoLon = destinoResults[0].longitude;
  
        try {
          
          const response = await axios.post('https://api.showtecnologia.com/api/frotas/monitoramento/grid', {}, { headers });
          const todosVeiculos = response.data.dados.grid;
          const veiculosFiltrados = todosVeiculos.filter(veiculo => placas.includes(veiculo.veiculo.placa));
          const veiculosUnicos = placas.map(placa => veiculosFiltrados.find(veiculo => veiculo.veiculo.placa === placa)).filter(Boolean);
  
          const distances2 = [];
          const veiculosDistancias = [];
  
          for (let i = 0; i < veiculos.length; i++) {
            const date = new Date(veiculos[i].ENTREGA);
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Mês começa em 0
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
  
            const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
  
            const diferenca = calcularDiferencaCompleta(dataColeta, formattedDate);
  
            if (veiculosUnicos[i] && veiculos[i].PLACA1 === veiculosUnicos[i].veiculo.placa) {
              const origem = `${veiculos[i].LATITUDE},${veiculos[i].LONGITUDE}`;
              const expectLat = veiculos[i].LATITUDE;
              const expectLong = veiculos[i].LONGITUDE;
              const realLat = veiculosUnicos[i].localizacao.latitude;
              const realLong = veiculosUnicos[i].localizacao.longitude;
              const veiculoSituacao = veiculos[i].SIT_COL;
              // Distância entre veículo e destino final
              const destinoFinal = `${destinoLat},${destinoLon}`;
              const distanceMatrixUrl2 = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${origem}&destinations=${destinoFinal}&mode=driving&language=pt-BR&key=${googleMapsApiKey}`;
              const distanceResponse2 = await axios.get(distanceMatrixUrl2);
              const distanceData2 = distanceResponse2.data;
  
              let distanciaValueNew2 = null;
              let duracaoValueNew2 = null;
              let distanciaTextNew2 = '';
              let duracaoTextNew2 = '';
              if (distanceData2.rows[0].elements[0].status === "OK") {
                distanciaValueNew2 = distanceData2.rows[0].elements[0].distance.value;
                duracaoValueNew2 = distanceData2.rows[0].elements[0].duration.value;
                distanciaTextNew2 = distanceData2.rows[0].elements[0].distance.text;
                duracaoTextNew2 = distanceData2.rows[0].elements[0].duration.text;
                distances2.push({
                  placaOrigem: veiculos[i].PLACA1,
                  origem: origem,
                  destinoFinal: destinoFinal,
                  distanciaText2: distanceData2.rows[0].elements[0].distance.text,
                  distanciaValue2: distanceData2.rows[0].elements[0].distance.value,
                  duracaoText2: distanceData2.rows[0].elements[0].duration.text,
                  duracaoValue2: distanceData2.rows[0].elements[0].duration.value
                });
              } else {
                distanciaValueNew2 = 0;
                duracaoValueNew2 = 0;
                distanciaTextNew2 = '';
                duracaoTextNew2 = '';
                distances2.push({
                  origem: origem,
                  destino: destinoFinal,
                  error: "Distância não disponível"
                });
              }
              
  
              veiculosDistancias.push({
                placa: veiculos[i].PLACA1,
                situacao: veiculoSituacao,
                distancia2: distanciaValueNew2,
                duracao2: duracaoValueNew2,
                distanciaTexto: distanciaTextNew2,
                duracaoTexto: duracaoTextNew2,
                duracaoETAETD: diferenca,
                expectLat: expectLat,
                expectLong: expectLong,
                realLat: realLat,
                realLong: realLong
              });
  
            }
          }
  
          veiculosDistancias.sort((a, b) => {
            // Primeiro, priorize os veículos com 'situacao' igual a 30
            if (a.situacao === 30 && b.situacao !== 30) {
              return -1;
            }
            if (a.situacao !== 30 && b.situacao === 30) {
              return 1;
            }
            // Se ambos têm a mesma 'situacao', ordene pela distância
            return a.distancia2 - b.distancia2;
          });
  
          // Formatar os dados para retornar no formato desejado
          const veiculosFormatados = veiculosDistancias.map(veiculo => {
            const veiculoData = veiculos.find(v => v.PLACA1 === veiculo.placa);
            return {
              ORDEM_COLETA: veiculoData.ORDEM_COLETA,
              ENTREGA: veiculoData.ENTREGA,
              PLACA1: veiculoData.PLACA1,
              PLACA2: veiculoData.PLACA2,
              PLACA3: veiculoData.PLACA3,
              MOTORISTA: veiculoData.MOTORISTA,
              HABILITACAO: veiculoData.HABILITACAO,
              DESTINO_CEP: veiculoData.DESTINO_CEP,
              DESTINO_CIDADE: veiculoData.DESTINO_CIDADE,
              DESTINO_UF: veiculoData.DESTINO_UF,
              DISTANCIA: veiculo.distanciaTexto,
              TEMPO1: veiculo.duracaoETAETD,
              TEMPO2: veiculo.duracaoTexto,
              TIPO_CARRETA: veiculoData.TIPO_CARRETA,
              MODELO: veiculoData.MODELO,
              STATUS: veiculoData.SIT_COL,
              STATUS_VEIC: veiculoData.STATUS_VEIC,
              TIPO_VEICULO: veiculoData.TIPO_VEICULO,
              EXPECTLAT: veiculo.expectLat,
              EXPECTLONG: veiculo.expectLong,
              REALLAT: veiculo.realLat,
              REALLONG: veiculo.realLong
            }
          });
  
          res.json({ veiculosFormatados });
          //console.log(veiculosDistancias);
          //res.json({ distances1, distances2 });
  
        } catch (error) {
          if (error.response) {
            console.error('Erro ao acessar o endpoint de monitoramento de frotas:', error.response.data);
            res.status(500).send('Erro ao acessar o endpoint de monitoramento de frotas');
          } else {
            console.error('Erro de rede:', error.message);
            res.status(500).send('Erro de rede');
          }
        }
      });
    });
  });