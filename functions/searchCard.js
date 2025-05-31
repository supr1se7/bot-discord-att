const fs = require('fs');
const path = require('path');

function carregarEstoque() {
  try {
    const estoquePath = path.resolve(__dirname, '../estoque.json');
    const raw = fs.readFileSync(estoquePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('❌ Erro ao carregar estoque.json:', e);
    return {};
  }
}

function transformarEstoque(rawEstoque) {
  const todasCategorias = Object.values(rawEstoque).flat();

  return todasCategorias.map(str => {
    const partes = str.split('|').map(s => s.trim());

    // Caso antigo: campo 7 contém level e preço juntos
    if (partes.length === 7) {
      const levelMatch = partes[6].match(/(.+?)\s*R\$ ?([\d.,]+)/i);
      let level = partes[6], precoStr = '';
      if (levelMatch) {
        level = levelMatch[1].trim();
        precoStr = 'R$ ' + levelMatch[2];
      }
      partes[6] = level;
      partes[7] = precoStr;
    }

    if (partes.length < 8) return null;

    const [numero, mes, ano, cvv, bandeira, banco, level, precoStr] = partes;

    // Aceita vírgula ou ponto como separador decimal
    const precoMatch = (precoStr || '').match(/R\$ ?([\d.,]+)/i);
    let preco = 0;
    if (precoMatch) {
      preco = parseFloat(precoMatch[1].replace(',', '.'));
    }

    return {
      numero: numero ? numero.trim() : '',
      mes: mes ? mes.trim() : '',
      ano: ano ? ano.trim() : '',
      cvv: cvv ? cvv.trim() : '',
      bandeira: bandeira ? bandeira.trim().toLowerCase() : '',
      banco: banco ? banco.trim().toLowerCase() : '',
      saldo: preco,
      level: level ? level.trim().toLowerCase() : '',
      preco
    };
  }).filter(Boolean);
}

// Pesquisa flexível: aceita parcial, ignora maiúsculas/minúsculas e acentos
function filtrarCartoes(campo, valor, estoque) {
  const valorSearch = removerAcentos(valor.trim().toLowerCase());

  return estoque.filter(cartao => {
    let campoValor = cartao[campo] || '';
    campoValor = removerAcentos(String(campoValor).trim().toLowerCase());
    if (!campoValor) return false;
    // Para BIN (numero), exige começo igual; para outros campos, busca parcial
    if (campo === "numero") {
      return campoValor.startsWith(valorSearch);
    }
    return campoValor.includes(valorSearch);
  });
}

// Remove acentos para facilitar busca flexível
function removerAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function mascararNumero(num) {
  if (!num) return 'Número inválido';
  return num.slice(0, 6) + '******';
}

module.exports = {
  carregarEstoque,
  transformarEstoque,
  filtrarCartoes,
  mascararNumero
};