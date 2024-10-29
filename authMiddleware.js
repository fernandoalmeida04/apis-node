// Middleware para armazenar o token de autenticação na requisição de login
const authMiddleware = async (req, res, next) => {
    try {
      const loginResponse = await axios.post('https://api.showtecnologia.com/api/login', {
        user: "email.exemplo@gmail.com",
        password: "78393c9d90bd592a185735d28b4c51a9"
      });
  
      const authToken = loginResponse.data.token;
      req.authToken = authToken;

      next();
    } catch (error) {
      console.error('Erro ao realizar login:', error.response ? error.response.data : error.message);
      res.status(500).send('Erro ao realizar login');
    }
};