const publicKey = process.env.BLACKPAYMENTS_PUBLIC_KEY || "pk_AyxNDuqeGXV-DLDamNihziZbyow4W7NwWxoGDOmQE8fDOO_d";
const secretKey = process.env.BLACKPAYMENTS_SECRET_KEY || "sk_3TfrllWaXprXCYm11i6G3on1UT5kjzqXupaLPibCCUB-UYKj";
const baseUrl = "https://api.blackpayments.pro/v1";

function getAuthHeader() {
  return (
    "Basic " +
    Buffer.from(publicKey + ":" + secretKey).toString("base64")
  );
}

async function criarPagamento(valor) {
  // valor: em reais (ex: 45 = R$45)
  const url = `${baseUrl}/transactions`;
  const payload = {
    amount: valor, // Valor deve ser em reais (número inteiro)
    paymentMethod: "pix",
    // Se precisar adicionar outros campos, coloque aqui
    // ex: description: "Compra Legacy CC"
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!data.id || !data.pix || !data.pix.qrCode || !data.pix.code) {
    throw new Error(
      "Erro ao criar pagamento BlackPayments: " +
        (data.message || JSON.stringify(data))
    );
  }
  return {
    id: data.id,
    pixCopyPaste: data.pix.code,
    pixUrl: data.pix.qrCode,
  };
}

async function verificarPagamento(transactionId) {
  const url = `${baseUrl}/transactions/${transactionId}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  // O status pago é "approved" (veja na resposta da API, ajuste se for diferente)
  return data.status === "approved";
}

module.exports = { criarPagamento, verificarPagamento };