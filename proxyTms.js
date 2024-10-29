// Api para se conectar no servidor TMS para criação de contrato
app.post('/proxy-tms', async (req, res) => {
    try {
      const response = await fetch('https://ndev03.nutmscc.com.br/rest/tms/v1.2/contrato/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from('login_api:noaRn#ugvf6r7goFW9pwbfsupdeng56d54f$e').toString('base64')
        },
        body: JSON.stringify(req.body)
      });
  
      if (!response.ok) {
        throw new Error('Erro na resposta do servidor TMS');
      }
  
      const data = await response.json();
      res.json(data);
  
    } catch (error) {
      console.error('Erro ao comunicar com o TMS:', error.message);
      res.status(500).json({ error: 'Erro ao comunicar com o TMS' });
    }
  });