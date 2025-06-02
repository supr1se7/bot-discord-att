function transformarEstoque(rawEstoque) {
  // rawEstoque: { categoria: [ "numero|mes|ano|cvv|bandeira|banco|level|preco", ... ] }
  // Retorna array de objetos
  const result = [];
  for (const cat in rawEstoque) {
    for (const linha of rawEstoque[cat]) {
      const [numero, mes, ano, cvv, bandeira, banco, level, preco] = linha.split("|").map(s => s.trim());
      result.push({ 
        numero, mes, ano, cvv, bandeira, banco, level, preco: preco?.replace(/^R\$ ?/, '') || '', categoria: cat
      });
    }
  }
  return result;
}

function carregarEstoque() {
  const fs = require('fs');
  const path = require('path');
  const estoquePath = path.resolve(__dirname, '../estoque.json');
  if (!fs.existsSync(estoquePath))
    fs.writeFileSync(estoquePath, JSON.stringify({}, null, 2));
  return JSON.parse(fs.readFileSync(estoquePath, 'utf-8'));
}

function filtrarCartoes(campo, valorBusca, estoque) {
  // estoque: array de objetos já transformados
  return estoque.filter(cartao => {
    if (!cartao[campo]) return false;
    return cartao[campo].toLowerCase().includes(valorBusca.toLowerCase());
  });
}

function mascararNumero(numero) {
  if (!numero || numero.length < 8) return numero;
  return numero.slice(0, 4) + " **** **** " + numero.slice(-4);
}

module.exports = {
  transformarEstoque,
  carregarEstoque,
  filtrarCartoes,
  mascararNumero
};