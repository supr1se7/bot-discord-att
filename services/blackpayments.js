const publicKey = process.env.BLACKPAYMENTS_PUBLIC_KEY || "pk_AyxNDuqeGXV-DLDamNihziZbyow4W7NwWxoGDOmQE8fDOO_d";
const secretKey = process.env.BLACKPAYMENTS_SECRET_KEY || "sk_3TfrllWaXprXCYm11i6G3on1UT5kjzqXupaLPibCCUB-UYKj";
const baseUrl = "https://api.blackpayments.pro/v1";

function getAuthHeader() {
  return (
    "Basic " +
    Buffer.from(publicKey + ":" + secretKey).toString("base64")
  );
}

/**
 * Cria um pagamento Pix na BlackPayments
 * valor: valor em reais (ex: 45 para R$45,00)
 */
async function criarPagamento(valor, usuario = {}) {
  if (typeof valor !== 'number') valor = Number(valor);
  if (isNaN(valor) || valor <= 0) {
    throw new Error(`Valor inválido para pagamento: ${valor}`);
  }

  // Converte valor de reais para centavos
  const valorCentavos = Math.round(valor * 100);

  const url = `${baseUrl}/transactions`;
  const payload = {
    amount: valorCentavos,
    currency: "BRL",
    paymentMethod: "pix",
    description: "Compra de Assinatura Premium",
    reference: "compra_discord_" + Date.now(),
    customer: {
      name: usuario.nome || "Usuário Discord",
      email: usuario.email || "discorduser@legacy.bot"
    },
    items: [
      {
        title: "Assinatura Premium",
        quantity: 1,
        tangible: false,
        unitPrice: valorCentavos,
        externalRef: "item-premium-" + Date.now()
      }
    ]
  };
  console.log("Payload enviado para BlackPayments:", payload);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  console.log('BlackPayments response:', data);
  if (!data.id || !data.pix || !data.pix.qrcode) {
    throw new Error(
      "Erro ao criar pagamento BlackPayments: " +
        (data.message || JSON.stringify(data))
    );
  }
  return {
    id: data.id,
    pixCopyPaste: data.pix.qrcode,
    pixUrl: data.pix.secureUrl,
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
  console.log("[Pix DEBUG] Status completo recebido:", data);
  return (
    data.status === "approved" ||
    data.status === "paid" ||
    (data.data && (data.data.status === "approved" || data.data.status === "paid"))
  );
}

module.exports = { criarPagamento, verificarPagamento };