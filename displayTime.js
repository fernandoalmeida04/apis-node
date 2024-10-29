// Função que exibe a diferença entre duas datas de forma extensa para utilizar no front end
function calcularDiferencaCompleta(data1, data2) {
    const date1 = new Date(data1);
    const date2 = new Date(data2);
    const diferencaEmMilissegundos = date1 - date2;
    const diferencaPositiva = Math.abs(diferencaEmMilissegundos);
  
    let dias = Math.floor(diferencaPositiva / (1000 * 60 * 60 * 24));
    let horas = Math.floor((diferencaPositiva % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diferencaPositiva % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diferencaPositiva % (1000 * 60)) / 1000);
  
    horas -= 3;
    if (horas < 0) {
      horas += 24;
      dias -= 1;
    }
  
    if (diferencaEmMilissegundos < 0 && dias === 0 && horas === 0) {
      return `${-minutos} minutos`;
    }
  
    if (dias === 0) {
      return `${horas} horas e ${minutos} minutos`;
    } else {
      return `${dias} dias, ${horas} horas e ${minutos} minutos`;
    }
  }