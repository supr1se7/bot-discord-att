const axios = require("axios");

async function criarPagamento(valorCentavos) {
  const url = "https://api.novaera-pagamentos.com/api/v1/transactions/";
  const payload = {
    paymentMethod: "pix",
    items: [
      {
        title: "Produto Exemplo",
        unitPrice: valorCentavos, // em centavos, inteiro
        quantity: 1,
        tangible: false,
      },
    ],
    amount: valorCentavos, // em centavos, inteiro
    customer: {
      name: "UEVELLYN CLAUDECY NEVES FERREIRA",
      email: "cliente@example.com",
      phone: "+5583987731351",
      document: { type: "cpf", number: "12587272424" },
    },
  };

  // LOG PARA DEBUG
  console.log("Payload enviado para novaera:", payload);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic c2tfRjM1UmxTak9ZWGpmd05YUllBZ1lLS2phdDYybEZMMS1lYk42MDhTQ3VCOGZaSjlTOnBrX21oZVB6QnR3RGlaV2NZdHlDcEd0SlE5dzA5WnlEME1MOHo4QnFKc0xDUUZHYVQwbQ==",
      },
    });

    const data = response.data.data;
    if (!data.pix) throw new Error("Pix não retornado");

    const pixCopyPaste = data.pix.qrcode;
    const pixUrl = data.pix.secureUrl || data.pix.url || null;

    return {
      id: data.id,
      valor: valorCentavos,
      pixCopyPaste,
      pixUrl,
    };
  } catch (err) {
    // LOGA DETALHE DO ERRO
    console.log("ERRO na chamada API novaera:", err.response?.data || err.message);
    throw err;
  }
}

async function verificarPagamento(transactionId) {
  const url = `https://api.novaera-pagamentos.com/api/v1/transactions/${transactionId}`;
  const response = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic c2tfRjM1UmxTak9ZWGpmd05YUllBZ1lLS2phdDYybEZMMS1lYk42MDhTQ3VCOGZaSjlTOnBrX21oZVB6QnR3RGlaV2NZdHlDcEd0SlE5dzA5WnlEME1MOHo4QnFKc0xDUUZHYVQwbQ==",
    },
  });
  const data = response.data.data || response.data;
  return data.status && data.status.toLowerCase() === "paid";
}

module.exports = {
  criarPagamento,
  verificarPagamento,
};